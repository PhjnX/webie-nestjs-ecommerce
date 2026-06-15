// src/payment/payment.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { Order, OrderStatus } from '../order/entities/order.entity';
import { OrderItem } from '../order/entities/order-item.entity';
import * as crypto from 'crypto';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,

    private readonly configService: ConfigService,
    private readonly mailerService: MailerService,
  ) {}

  // ── TẠO LINK THANH TOÁN VNPAY ─────────────────────────────────────
  async createVnpayUrl(
    userId: number,
    orderId: number,
    ipAddr: string,
  ): Promise<string> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, user: { id: userId } },
    });
    if (!order)
      throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Đơn hàng này không thể thanh toán!');
    }

    const txnRef = `${orderId}-${Date.now()}`;
    order.vnpayTxnRef = txnRef;
    await this.orderRepo.save(order);

    const tmnCode = this.configService.get('VNPAY_TMN_CODE');
    const hashSecret = this.configService.get('VNPAY_HASH_SECRET');
    const vnpUrl = this.configService.get('VNPAY_URL');
    const returnUrl = this.configService.get('VNPAY_RETURN_URL');
    const createDate = this.formatDate(new Date());
    const amount = Math.round(Number(order.totalAmount) * 100);

    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Amount: amount.toString(),
      vnp_CreateDate: createDate,
      vnp_CurrCode: 'VND',
      vnp_IpAddr: ipAddr,
      vnp_Locale: 'vn',
      vnp_OrderInfo: `Thanh toan don hang #${orderId}`,
      vnp_OrderType: 'other',
      vnp_ReturnUrl: returnUrl,
      vnp_TxnRef: txnRef,
    };

    const sortedParams = this.sortObject(params);
    const signData = new URLSearchParams(sortedParams).toString();
    const hmac = crypto.createHmac('sha512', hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    sortedParams['vnp_SecureHash'] = signed;

    return `${vnpUrl}?${new URLSearchParams(sortedParams).toString()}`;
  }

  // ── XỬ LÝ RETURN URL ──────────────────────────────────────────────
  async handleReturn(query: Record<string, string>): Promise<{
    success: boolean;
    message: string;
    orderId?: number;
  }> {
    const isValid = this.verifySignature(query);
    if (!isValid) {
      return { success: false, message: 'Chữ ký không hợp lệ!' };
    }

    const responseCode = query['vnp_ResponseCode'];
    const txnRef = query['vnp_TxnRef'];

    const order = await this.orderRepo.findOne({
      where: { vnpayTxnRef: txnRef },
      relations: { items: true },
    });

    if (!order) {
      return { success: false, message: 'Không tìm thấy đơn hàng!' };
    }

    if (responseCode === '00') {
      order.status = OrderStatus.PAID;
      await this.orderRepo.save(order);

      // ← Thêm 2 dòng này, giữ nguyên tất cả còn lại
      await this.sendPaidEmailToCustomer(order);
      await this.sendPaidEmailToAdmin(order);

      return {
        success: true,
        message: 'Thanh toán thành công!',
        orderId: order.id,
      };
    } else {
      order.status = OrderStatus.CANCELLED;
      await this.orderRepo.save(order);
      return {
        success: false,
        message: 'Thanh toán thất bại hoặc bị hủy!',
        orderId: order.id,
      };
    }
  }

  // ── XỬ LÝ IPN ─────────────────────────────────────────────────────
  async handleIpn(
    query: Record<string, string>,
  ): Promise<{ RspCode: string; Message: string }> {
    const isValid = this.verifySignature(query);
    if (!isValid) return { RspCode: '97', Message: 'Invalid signature' };

    const txnRef = query['vnp_TxnRef'];
    const responseCode = query['vnp_ResponseCode'];
    const amount = parseInt(query['vnp_Amount']) / 100;

    const order = await this.orderRepo.findOne({
      where: { vnpayTxnRef: txnRef },
    });
    if (!order) return { RspCode: '01', Message: 'Order not found' };
    if (order.status !== OrderStatus.PENDING)
      return { RspCode: '02', Message: 'Order already confirmed' };
    if (Math.round(Number(order.totalAmount)) !== Math.round(amount))
      return { RspCode: '04', Message: 'Invalid amount' };

    if (responseCode === '00') {
      order.status = OrderStatus.PAID;
    } else {
      order.status = OrderStatus.CANCELLED;
    }
    await this.orderRepo.save(order);

    return { RspCode: '00', Message: 'Confirm success' };
  }

  // ── Email khách sau thanh toán ── MỚI THÊM ───────────────────────
  private async sendPaidEmailToCustomer(order: Order): Promise<void> {
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
            Thanh toán thành công!
          </p>
        </div>

        <!-- Body -->
        <div style="padding:28px 24px">
          <p style="color:#555;margin:0 0 24px;font-size:14px;line-height:1.6">
            Xin chào <strong style="color:#111">${order.customerName}</strong>,
            chúc mừng bạn đã thanh toán thành công đơn hàng
            <strong style="color:#C9A84C">#${order.id}</strong>.
            Đội ngũ Webie sẽ liên hệ bạn trong thời gian sớm nhất để triển khai sản phẩm.
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
            Sản phẩm đã mua
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
              Trạng thái: Đã thanh toán ✅
            </p>
            <p style="margin:6px 0 0;color:#888;font-size:13px">
              Đội ngũ Webie sẽ liên hệ bạn sớm nhất có thể để triển khai sản phẩm.
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
      subject: `[Webie] Thanh toán thành công — Đơn hàng #${order.id}`,
      html,
    });
  }

  // ── Email admin sau thanh toán ── GIỮ NGUYÊN ─────────────────────
  private async sendPaidEmailToAdmin(order: Order): Promise<void> {
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

        <!-- Header -->
        <div style="background:#000;text-align:center">
          <img src="${logoUrl}" alt="Webie" style="width:100%;height:auto;display:block"/>
        </div>

        <!-- Alert bar -->
        <div style="background:#C9A84C;padding:12px 24px;text-align:center">
          <p style="margin:0;color:#000;font-weight:bold;font-size:14px">
            Đơn hàng #${order.id} đã thanh toán thành công
          </p>
        </div>

        <!-- Body -->
        <div style="padding:28px 24px">

          <!-- Thông tin khách -->
          <div style="background:#f9f9f9;border-radius:8px;padding:18px;margin-bottom:24px;border:1px solid #eee">
            <p style="color:#C9A84C;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 14px">
              Thông tin khách hàng
            </p>
            <table style="width:100%;font-size:14px">
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
            Sản phẩm đã mua
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
              Trạng thái: Đã thanh toán
            </p>
            <p style="margin:6px 0 0;color:#888;font-size:13px">
              Liên hệ khách hàng để triển khai sản phẩm.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background:#000;padding:20px 24px;border-top:1px solid #222;text-align:center">
          <p style="color:#555;font-size:12px;margin:0">
            © 2025 Webie Vietnam — Hệ thống thông báo tự động
          </p>
        </div>

      </div>
    </div>
  `;

    await this.mailerService.sendMail({
      to: process.env.MAIL_FROM,
      subject: `[Webie] Đơn hàng #${order.id} đã thanh toán`,
      html,
    });
  }

  // ── HELPER: Xác minh chữ ký ───────────────────────────────────────
  private verifySignature(query: Record<string, string>): boolean {
    const secureHash = query['vnp_SecureHash'];
    const hashSecret = this.configService.get('VNPAY_HASH_SECRET');

    const params = { ...query };
    delete params['vnp_SecureHash'];
    delete params['vnp_SecureHashType'];

    const sortedParams = this.sortObject(params);
    const signData = new URLSearchParams(sortedParams).toString();
    const hmac = crypto.createHmac('sha512', hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return signed === secureHash;
  }

  // ── HELPER: Format ngày ───────────────────────────────────────────
  private formatDate(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return (
      date.getFullYear().toString() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds())
    );
  }

  // ── HELPER: Sort object ───────────────────────────────────────────
  private sortObject(obj: Record<string, string>): Record<string, string> {
    return Object.keys(obj)
      .sort()
      .reduce((result: Record<string, string>, key) => {
        result[key] = obj[key];
        return result;
      }, {});
  }
}
