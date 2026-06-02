import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../user/entities/user.entity';
import {
  RegisterDto,
  VerifyOtpDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/create-auth.dto';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mailerService: MailerService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ── HELPER: Tạo cặp Access Token + Refresh Token ──────────────────
  private generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRES'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES'),
    });

    return { accessToken, refreshToken };
  }

  // ── HELPER: Gửi email OTP dùng chung ──────────────────────────────
  private async sendOtpEmail(
    email: string,
    otp: string,
    subject: string,
    title: string,
  ) {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:25px;border:1px solid #e2e8f0;border-radius:16px;">
            <h2 style="color:#f59e0b;text-align:center;">${title}</h2>
            <p>Mã OTP của bạn:</p>
            <div style="text-align:center;margin:35px 0;">
              <span style="font-size:36px;font-weight:900;letter-spacing:6px;padding:14px 40px;border:2px dashed #cbd5e1;border-radius:12px;">${otp}</span>
            </div>
            <p style="color:#ef4444;text-align:center;">⚠️ Mã có hiệu lực trong 5 phút, chỉ dùng 1 lần.</p>
          </div>
        `,
      });
    } catch (error) {
      console.error('Lỗi gửi mail:', error);
    }
  }

  // ── REGISTER ───────────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const { email, password, fullName, phone, address } = dto;

    const userExist = await this.userRepository.findOne({ where: { email } });
    if (userExist) {
      throw new BadRequestException('Email này đã được sử dụng!');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiredAt = new Date();
    expiredAt.setMinutes(expiredAt.getMinutes() + 5);

    const newUser = this.userRepository.create({
      email,
      password_hash: passwordHash,
      fullName,
      phone,
      address,
      verification_code: otp,
      code_expired_at: expiredAt,
      is_verified: false,
    });
    await this.userRepository.save(newUser);

    await this.sendOtpEmail(
      email,
      otp,
      '[Webie] Mã Xác Thực Kích Hoạt Tài Khoản',
      'CHÀO MỪNG ĐẾN VỚI WEBIE',
    );

    return {
      success: true,
      message: 'Đăng ký thành công! Vui lòng kiểm tra email để lấy mã OTP.',
    };
  }

  // ── VERIFY OTP ─────────────────────────────────────────────────────
  async verifyOtp(dto: VerifyOtpDto) {
    const { email, otp } = dto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) throw new BadRequestException('Email không tồn tại!');
    if (user.is_verified)
      throw new BadRequestException('Tài khoản đã được xác thực rồi!');
    if (user.verification_code !== otp)
      throw new BadRequestException('Mã OTP không chính xác!');
    if (new Date() > user.code_expired_at!)
      throw new BadRequestException('Mã OTP đã hết hạn!');

    user.is_verified = true;
    user.verification_code = null;
    user.code_expired_at = null;
    await this.userRepository.save(user);

    return {
      success: true,
      message: 'Xác thực email thành công! Tài khoản đã được kích hoạt.',
    };
  }

  // ── LOGIN ──────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const { email, password } = dto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user)
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác!');
    if (!user.is_verified)
      throw new BadRequestException('Tài khoản chưa xác thực email!');
    if (!user.is_active) throw new BadRequestException('Tài khoản đã bị khóa!');

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch)
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác!');

    const { accessToken, refreshToken } = this.generateTokens(user);

    // Lưu refresh token vào DB
    user.refresh_token = refreshToken;
    await this.userRepository.save(user);

    return {
      success: true,
      message: 'Đăng nhập thành công!',
      data: { accessToken, refreshToken },
    };
  }

  // ── REFRESH TOKEN ──────────────────────────────────────────────────
  async refreshToken(token: string) {
    try {
      // Xác minh refresh token hợp lệ không
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      // Tìm user và kiểm tra token có khớp DB không
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });
      if (!user || user.refresh_token !== token) {
        throw new UnauthorizedException('Refresh token không hợp lệ!');
      }

      // Cấp cặp token mới
      const { accessToken, refreshToken } = this.generateTokens(user);
      user.refresh_token = refreshToken;
      await this.userRepository.save(user);

      return {
        success: true,
        data: { accessToken, refreshToken },
      };
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn!',
      );
    }
  }

  // ── LOGOUT ─────────────────────────────────────────────────────────
  async logout(userId: number) {
    await this.userRepository.update(userId, { refresh_token: null });
    return { success: true, message: 'Đăng xuất thành công!' };
  }

  // ── FORGOT PASSWORD ────────────────────────────────────────────────
  async forgotPassword(dto: ForgotPasswordDto) {
    const { email } = dto;

    const user = await this.userRepository.findOne({ where: { email } });
    // Không báo email có tồn tại hay không để tránh dò email
    if (!user) {
      return {
        success: true,
        message: 'Nếu email tồn tại, mã OTP đã được gửi!',
      };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiredAt = new Date();
    expiredAt.setMinutes(expiredAt.getMinutes() + 5);

    user.reset_password_code = otp;
    user.reset_code_expired_at = expiredAt;
    await this.userRepository.save(user);

    await this.sendOtpEmail(
      email,
      otp,
      '[Webie] Mã Đặt Lại Mật Khẩu',
      'ĐẶT LẠI MẬT KHẨU WEBIE',
    );

    return { success: true, message: 'Nếu email tồn tại, mã OTP đã được gửi!' };
  }

  // ── RESET PASSWORD ─────────────────────────────────────────────────
  async resetPassword(dto: ResetPasswordDto) {
    const { email, otp, newPassword } = dto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) throw new BadRequestException('Email không tồn tại!');
    if (user.reset_password_code !== otp)
      throw new BadRequestException('Mã OTP không chính xác!');
    if (new Date() > user.reset_code_expired_at!)
      throw new BadRequestException('Mã OTP đã hết hạn!');

    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.reset_password_code = null;
    user.reset_code_expired_at = null;
    user.refresh_token = null; // Đăng xuất toàn bộ thiết bị sau khi đổi mật khẩu
    await this.userRepository.save(user);

    return {
      success: true,
      message: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.',
    };
  }
}
