// src/order/order.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CartService } from '../cart/cart.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { User } from '../user/entities/user.entity';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly cartService: CartService,
    private readonly mailerService: MailerService,
  ) {}

  // ── CHECKOUT — Tạo đơn hàng từ giỏ hàng ─────────────────────────
  async checkout(userId: number, dto: CreateOrderDto): Promise<Order> {
    // 1. Load full user từ DB (JWT chỉ có id/email/role)
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    // 2. Lấy giỏ hàng
    const cart = await this.cartService.getCart(userId);
    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestException('Giỏ hàng đang trống, không thể đặt hàng');
    }

    // 3. Tính tổng tiền
    const totalAmount = cart.items.reduce((sum, item) => {
      return sum + Number(item.productPrice) * item.quantity;
    }, 0);

    // 4. Tạo Order
    const order = this.orderRepo.create({
      user,
      status: OrderStatus.PENDING,
      totalAmount,
      customerName: user.fullName ?? user.email,
      customerEmail: user.email,
      customerPhone: user.phone ?? null,
      note: dto.note ?? null,
      vnpayTxnRef: null,
    });

    const savedOrder = await this.orderRepo.save(order);

    // 5. Tạo OrderItems từ CartItems
    const orderItems = cart.items.map((cartItem) =>
      this.orderItemRepo.create({
        order: savedOrder,
        productId: cartItem.productId,
        productName: cartItem.productName,
        productPrice: cartItem.productPrice,
        productImageUrl: cartItem.productImageUrl,
        productSku: cartItem.productSku,
        quantity: cartItem.quantity,
        subtotal: Number(cartItem.productPrice) * cartItem.quantity,
      }),
    );

    await this.orderItemRepo.save(orderItems);

    // 6. Xóa giỏ hàng sau khi đặt hàng thành công
    await this.cartService.clearCart(userId);

    // 7. Gửi email xác nhận
    const fullOrder = await this.getOrderById(userId, savedOrder.id);
    await this.sendOrderEmails(fullOrder);

    return fullOrder;
  }

  // ── GET ORDER HISTORY — Lịch sử đơn hàng ────────────────────────
  async getOrders(userId: number): Promise<Order[]> {
    return this.orderRepo.find({
      where: { user: { id: userId } },
      relations: { items: true },
      order: { created_at: 'DESC' },
    });
  }

  // ── GET ORDER BY ID — Chi tiết đơn hàng ──────────────────────────
  async getOrderById(userId: number, orderId: number): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, user: { id: userId } },
      relations: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
    }

    return order;
  }

  // ── HELPER: Gửi email cho khách + admin ──────────────────────────
  private async sendOrderEmails(order: Order): Promise<void> {
    const itemsHtml = order.items
      .map(
        (item) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd">${item.productName}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${item.quantity}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right">
            ${Number(item.productPrice).toLocaleString('vi-VN')}đ
          </td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right">
            ${Number(item.subtotal).toLocaleString('vi-VN')}đ
          </td>
        </tr>`,
      )
      .join('');

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#2563eb">Xác nhận đơn hàng #${order.id}</h2>
        <p>Xin chào <strong>${order.customerName}</strong>,</p>
        <p>Đơn hàng của bạn đã được ghi nhận. Chúng tôi sẽ liên hệ sớm để triển khai sản phẩm.</p>

        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="padding:8px;border:1px solid #ddd;text-align:left">Sản phẩm</th>
              <th style="padding:8px;border:1px solid #ddd">SL</th>
              <th style="padding:8px;border:1px solid #ddd">Đơn giá</th>
              <th style="padding:8px;border:1px solid #ddd">Thành tiền</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding:8px;border:1px solid #ddd;text-align:right">
                <strong>Tổng cộng:</strong>
              </td>
              <td style="padding:8px;border:1px solid #ddd;text-align:right;color:#2563eb">
                <strong>${Number(order.totalAmount).toLocaleString('vi-VN')}đ</strong>
              </td>
            </tr>
          </tfoot>
        </table>

        ${order.note ? `<p><strong>Ghi chú:</strong> ${order.note}</p>` : ''}
        <p style="color:#6b7280;font-size:14px">
          Trạng thái: <strong>Chờ thanh toán</strong>
        </p>
        <hr/>
        <p style="color:#6b7280;font-size:12px">
          Webie Vietnam — vietnamwebie@gmail.com
        </p>
      </div>
    `;

    // Gửi cho khách
    await this.mailerService.sendMail({
      to: order.customerEmail,
      subject: `[Webie] Xác nhận đơn hàng #${order.id}`,
      html: emailHtml,
    });

    // Gửi cho admin
    await this.mailerService.sendMail({
      to: process.env.MAIL_FROM,
      subject: `[Webie] Đơn hàng mới #${order.id} — ${order.customerName}`,
      html: `
        <h3>Đơn hàng mới cần xử lý</h3>
        <p><strong>Khách hàng:</strong> ${order.customerName}</p>
        <p><strong>Email:</strong> ${order.customerEmail}</p>
        <p><strong>SĐT:</strong> ${order.customerPhone ?? 'Không có'}</p>
        <p><strong>Tổng tiền:</strong> 
          ${Number(order.totalAmount).toLocaleString('vi-VN')}đ
        </p>
        ${order.note ? `<p><strong>Ghi chú:</strong> ${order.note}</p>` : ''}
        ${emailHtml}
      `,
    });
  }
}
