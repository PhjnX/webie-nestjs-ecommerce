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
  async cancelOrder(userId: number, orderId: number): Promise<any> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, user: { id: userId } },
      relations: { items: true },
    });

    if (!order)
      throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);

    // Chỉ cho hủy khi đang PENDING
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Không thể hủy đơn hàng có trạng thái "${order.status}"! Chỉ hủy được đơn đang chờ thanh toán.`,
      );
    }

    order.status = OrderStatus.CANCELLED;
    await this.orderRepo.save(order);

    // Gửi email thông báo hủy đơn
    await this.sendCancelEmail(order);

    return {
      success: true,
      message: `Đã hủy đơn hàng #${orderId} thành công!`,
    };
  }

  private async sendCancelEmail(order: Order): Promise<void> {
    const logoUrl =
      'https://res.cloudinary.com/dcfchnhgk/image/upload/v1780556741/e8a6e1db-0961-4fbe-847e-b25828dc5d00_ui8547.png';

    await this.mailerService.sendMail({
      to: order.customerEmail,
      subject: `[Webie] Đơn hàng #${order.id} đã được hủy`,
      html: `
      <div style="background:#f5f5f5;font-family:Arial,sans-serif;padding:32px 16px">
        <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

          <div style="background:#000;text-align:center">
            <img src="${logoUrl}" alt="Webie" style="width:100%;height:auto;display:block"/>
          </div>

          <div style="background:#ef4444;padding:12px 24px;text-align:center">
            <p style="margin:0;color:#fff;font-weight:bold;font-size:14px">
              Đơn hàng #${order.id} đã được hủy
            </p>
          </div>

          <div style="padding:28px 24px">
            <p style="color:#555;font-size:14px;line-height:1.7">
              Xin chào <strong style="color:#111">${order.customerName}</strong>,
              đơn hàng <strong style="color:#C9A84C">#${order.id}</strong> của bạn đã được hủy thành công.
            </p>

            <div style="background:#f9f9f9;border-radius:8px;padding:16px;border-left:4px solid #ef4444">
              <p style="margin:0;color:#ef4444;font-weight:bold;font-size:14px">Trạng thái: Đã hủy</p>
              <p style="margin:6px 0 0;color:#888;font-size:13px">
                Nếu bạn có thắc mắc, vui lòng liên hệ với chúng tôi qua email bên dưới.
              </p>
            </div>
          </div>

          <div style="background:#000;padding:20px 24px;text-align:center">
            <p style="color:#555;font-size:12px;margin:0">© 2025 Webie Vietnam</p>
            <a href="mailto:vietnamwebie@gmail.com" style="color:#C9A84C;font-size:12px;text-decoration:none">
              vietnamwebie@gmail.com
            </a>
          </div>

        </div>
      </div>
    `,
    });
  }

  // ── HELPER: Gửi email cho khách + admin ──────────────────────────
  private async sendOrderEmails(order: Order): Promise<void> {
    const logoUrl =
      'https://res.cloudinary.com/dcfchnhgk/image/upload/v1780556741/e8a6e1db-0961-4fbe-847e-b25828dc5d00_ui8547.png';

    const itemsHtml = order.items
      .map(
        (item) => `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #eee;color:#111;font-size:14px">
          ${item.productName}
        </td>
        <td style="padding:12px;border-bottom:1px solid #eee;color:#111;text-align:center;font-size:14px">
          ${item.quantity}
        </td>
        <td style="padding:12px;border-bottom:1px solid #eee;color:#C9A84C;text-align:right;font-size:14px">
          ${Number(item.productPrice).toLocaleString('vi-VN')}đ
        </td>
        <td style="padding:12px;border-bottom:1px solid #eee;color:#C9A84C;text-align:right;font-size:14px;font-weight:bold">
          ${Number(item.subtotal).toLocaleString('vi-VN')}đ
        </td>
      </tr>`,
      )
      .join('');

    const html = `
    <div style="background:#f5f5f5;font-family:Arial,sans-serif;padding:32px 16px">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

        <!-- Header Logo -->
        <div style="background:#000;text-align:center">
          <img src="${logoUrl}" alt="Webie" style="width:100%;height:auto;display:block"/>
        </div>

        <!-- Alert bar -->
        <div style="background:#C9A84C;padding:12px 24px;text-align:center">
          <p style="margin:0;color:#000;font-weight:bold;font-size:14px">
            Xác nhận đơn hàng #${order.id}
          </p>
        </div>

        <!-- Body -->
        <div style="padding:28px 24px">
          <p style="color:#555;margin:0 0 24px;font-size:14px;line-height:1.6">
            Xin chào <strong style="color:#111">${order.customerName}</strong>,
            đơn hàng của bạn đã được ghi nhận thành công!
            Vui lòng hoàn tất thanh toán để chúng tôi bắt đầu triển khai sản phẩm.
          </p>

          <!-- Thông tin đơn hàng -->
          <div style="background:#f9f9f9;border-radius:8px;padding:18px;margin-bottom:24px;border:1px solid #eee">
            <p style="color:#C9A84C;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 14px">
              Thông tin đơn hàng
            </p>
            <table style="width:100%;font-size:14px;border-collapse:collapse">
              <tr>
                <td style="color:#888;padding:5px 0;width:100px">Mã đơn:</td>
                <td style="color:#111;padding:5px 0;font-weight:bold">#${order.id}</td>
              </tr>
              <tr>
                <td style="color:#888;padding:5px 0">Họ tên:</td>
                <td style="color:#111;padding:5px 0">${order.customerName}</td>
              </tr>
              <tr>
                <td style="color:#888;padding:5px 0">Email:</td>
                <td style="padding:5px 0">
                  <a href="mailto:${order.customerEmail}" style="color:#C9A84C;text-decoration:none">
                    ${order.customerEmail}
                  </a>
                </td>
              </tr>
              <tr>
                <td style="color:#888;padding:5px 0">SĐT:</td>
                <td style="color:#111;padding:5px 0">${order.customerPhone ?? 'Không có'}</td>
              </tr>
              ${
                order.note
                  ? `
              <tr>
                <td style="color:#888;padding:5px 0">Ghi chú:</td>
                <td style="color:#111;padding:5px 0">${order.note}</td>
              </tr>`
                  : ''
              }
            </table>
          </div>

          <!-- Sản phẩm -->
          <p style="color:#C9A84C;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px">
            Sản phẩm đã đặt
          </p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px">
            <thead>
              <tr style="background:#f9f9f9">
                <th style="padding:10px 12px;color:#888;text-align:left;font-weight:600;border-bottom:2px solid #eee">Sản phẩm</th>
                <th style="padding:10px 12px;color:#888;text-align:center;font-weight:600;border-bottom:2px solid #eee">SL</th>
                <th style="padding:10px 12px;color:#888;text-align:right;font-weight:600;border-bottom:2px solid #eee">Đơn giá</th>
                <th style="padding:10px 12px;color:#888;text-align:right;font-weight:600;border-bottom:2px solid #eee">Thành tiền</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="padding:14px 12px;text-align:right;color:#555;font-size:15px">
                  Tổng cộng:
                </td>
                <td style="padding:14px 12px;text-align:right;color:#C9A84C;font-size:18px;font-weight:bold">
                  ${Number(order.totalAmount).toLocaleString('vi-VN')}đ
                </td>
              </tr>
            </tfoot>
          </table>

          <!-- Trạng thái -->
          <div style="border-left:4px solid #C9A84C;padding:12px 16px;background:#fffbf0;border-radius:4px">
            <p style="margin:0;color:#C9A84C;font-weight:bold;font-size:14px">
              Trạng thái: Chờ thanh toán
            </p>
            <p style="margin:6px 0 0;color:#888;font-size:13px">
              Sau khi thanh toán, đội ngũ Webie sẽ liên hệ bạn để triển khai sản phẩm.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background:#000;padding:20px 24px;border-top:1px solid #222;text-align:center">
          <p style="color:#555;font-size:12px;margin:0">© 2025 Webie Vietnam</p>
          <p style="margin:4px 0 0">
            <a href="mailto:vietnamwebie@gmail.com" style="color:#C9A84C;font-size:12px;text-decoration:none">
              vietnamwebie@gmail.com
            </a>
          </p>
        </div>

      </div>
    </div>
  `;

    await this.mailerService.sendMail({
      to: order.customerEmail,
      subject: `[Webie] Xác nhận đơn hàng #${order.id}`,
      html,
    });
  }
}
