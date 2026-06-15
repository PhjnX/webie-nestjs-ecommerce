import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { CreateContactDto } from './dto/create-contact.dto';

@Injectable()
export class ContactService {
  constructor(private readonly mailerService: MailerService) {}

  private readonly logoUrl =
    'https://res.cloudinary.com/dcfchnhgk/image/upload/v1780556741/e8a6e1db-0961-4fbe-847e-b25828dc5d00_ui8547.png';

  async sendContact(dto: CreateContactDto): Promise<{ success: boolean; message: string }> {
    const { fullName, phone, email, message } = dto;

    // Gửi email thông báo cho Admin
    await this.sendAdminNotification(dto);

    // Gửi email xác nhận cho khách
    await this.sendCustomerConfirmation(dto);

    return {
      success: true,
      message: 'Yêu cầu tư vấn đã được gửi thành công! Chúng tôi sẽ liên hệ bạn trong vòng 24 giờ.',
    };
  }

  // ── Email thông báo cho Admin ──────────────────────────────────────
  private async sendAdminNotification(dto: CreateContactDto): Promise<void> {
    const { fullName, phone, email, message } = dto;

    const html = `
      <div style="background:#f5f5f5;font-family:Arial,sans-serif;padding:32px 16px">
        <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

          <!-- Header Logo -->
          <div style="background:#000;text-align:center">
            <img src="${this.logoUrl}" alt="Webie" style="width:100%;height:auto;display:block"/>
          </div>

          <!-- Alert bar -->
          <div style="background:#C9A84C;padding:12px 24px;text-align:center">
            <p style="margin:0;color:#000;font-weight:bold;font-size:14px">
              📩 Có yêu cầu tư vấn mới!
            </p>
          </div>

          <!-- Body -->
          <div style="padding:28px 24px">

            <!-- Thông tin khách -->
            <div style="background:#f9f9f9;border-radius:8px;padding:18px;margin-bottom:24px;border:1px solid #eee">
              <p style="color:#C9A84C;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 14px">
                Thông tin khách hàng
              </p>
              <table style="width:100%;font-size:14px;border-collapse:collapse">
                <tr>
                  <td style="color:#888;padding:6px 0;width:100px">Họ tên:</td>
                  <td style="color:#111;padding:6px 0;font-weight:600">${fullName}</td>
                </tr>
                <tr>
                  <td style="color:#888;padding:6px 0">Email:</td>
                  <td style="padding:6px 0">
                    <a href="mailto:${email}" style="color:#C9A84C;text-decoration:none">${email}</a>
                  </td>
                </tr>
                <tr>
                  <td style="color:#888;padding:6px 0">SĐT:</td>
                  <td style="padding:6px 0">
                    <a href="tel:${phone}" style="color:#111;text-decoration:none">${phone}</a>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Nội dung tin nhắn -->
            <div style="margin-bottom:24px">
              <p style="color:#C9A84C;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px">
                Nội dung tin nhắn
              </p>
              <div style="background:#f9f9f9;border-radius:8px;padding:16px;border:1px solid #eee;border-left:4px solid #C9A84C">
                <p style="margin:0;color:#111;font-size:14px;line-height:1.7">${message}</p>
              </div>
            </div>

            <!-- Nút hành động -->
            <div style="text-align:center">
              <a href="mailto:${email}?subject=Re: Tư vấn từ Webie"
                 style="display:inline-block;background:#C9A84C;color:#000;padding:12px 28px;border-radius:50px;font-weight:700;font-size:14px;text-decoration:none;">
                📧 Phản hồi khách hàng ngay
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background:#000;padding:20px 24px;text-align:center">
            <p style="color:#555;font-size:12px;margin:0">© 2025 Webie Vietnam — Hệ thống thông báo tự động</p>
          </div>

        </div>
      </div>
    `;

    await this.mailerService.sendMail({
      to: process.env.MAIL_FROM,
      subject: `[Webie] 📩 Yêu cầu tư vấn mới từ ${fullName}`,
      html,
    });
  }

  // ── Email xác nhận cho khách ───────────────────────────────────────
  private async sendCustomerConfirmation(dto: CreateContactDto): Promise<void> {
    const { fullName, phone, email, message } = dto;

    const html = `
      <div style="background:#f5f5f5;font-family:Arial,sans-serif;padding:32px 16px">
        <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

          <!-- Header Logo -->
          <div style="background:#000;text-align:center">
            <img src="${this.logoUrl}" alt="Webie" style="width:100%;height:auto;display:block"/>
          </div>

          <!-- Alert bar -->
          <div style="background:#C9A84C;padding:12px 24px;text-align:center">
            <p style="margin:0;color:#000;font-weight:bold;font-size:14px">
              Cảm ơn bạn đã liên hệ với Webie!
            </p>
          </div>

          <!-- Body -->
          <div style="padding:28px 24px">
            <p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 24px">
              Xin chào <strong style="color:#111">${fullName}</strong>,<br/>
              Chúng tôi đã nhận được yêu cầu tư vấn của bạn.
              Đội ngũ Webie sẽ liên hệ lại với bạn trong vòng <strong style="color:#C9A84C">24 giờ</strong> làm việc.
            </p>

            <!-- Thông tin đã gửi -->
            <div style="background:#f9f9f9;border-radius:8px;padding:18px;margin-bottom:24px;border:1px solid #eee">
              <p style="color:#C9A84C;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 14px">
                Thông tin yêu cầu của bạn
              </p>
              <table style="width:100%;font-size:14px;border-collapse:collapse">
                <tr>
                  <td style="color:#888;padding:6px 0;width:100px">Họ tên:</td>
                  <td style="color:#111;padding:6px 0;font-weight:600">${fullName}</td>
                </tr>
                <tr>
                  <td style="color:#888;padding:6px 0">Email:</td>
                  <td style="color:#111;padding:6px 0">${email}</td>
                </tr>
                <tr>
                  <td style="color:#888;padding:6px 0">SĐT:</td>
                  <td style="color:#111;padding:6px 0">${phone}</td>
                </tr>
              </table>
            </div>

            <!-- Nội dung tin nhắn -->
            <div style="margin-bottom:24px">
              <p style="color:#C9A84C;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px">
                Nội dung tin nhắn của bạn
              </p>
              <div style="background:#f9f9f9;border-radius:8px;padding:16px;border:1px solid #eee;border-left:4px solid #C9A84C">
                <p style="margin:0;color:#555;font-size:14px;line-height:1.7;font-style:italic">"${message}"</p>
              </div>
            </div>

            <!-- Cam kết -->
            <div style="background:#fffbf0;border-radius:8px;padding:16px;border:1px solid #f0e6c8;text-align:center">
              <p style="margin:0;color:#C9A84C;font-weight:bold;font-size:13px">
                ⏱ Thời gian phản hồi: Trong vòng 24 giờ làm việc
              </p>
              <p style="margin:8px 0 0;color:#888;font-size:12px">
                Nếu cần hỗ trợ gấp, vui lòng liên hệ trực tiếp qua email bên dưới
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div style="background:#000;padding:20px 24px;text-align:center">
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
      to: email,
      subject: `[Webie] Chúng tôi đã nhận được yêu cầu tư vấn của bạn`,
      html,
    });
  }
}