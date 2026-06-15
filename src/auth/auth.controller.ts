import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  VerifyOtpDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
  ResendOtpDto,
} from './dto/create-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

class SetAdminDto {
  @ApiProperty({ example: 'vietnamwebie@gmail.com' })
  email!: string;

  @ApiProperty({ example: 'webie-secret-2025' })
  secretKey!: string;
}

@ApiTags('Authentication Module')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản mới' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Xác thực OTP kích hoạt tài khoản' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập — trả về Access Token + Refresh Token' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh-token')
  @ApiOperation({ summary: 'Lấy Access Token mới bằng Refresh Token' })
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng xuất — vô hiệu hóa Refresh Token' })
  logout(@Req() req: any) {
    return this.authService.logout(req.user.id);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Quên mật khẩu — gửi OTP về email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Đặt lại mật khẩu bằng OTP' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ⚠️ XÓA ROUTE NÀY SAU KHI DÙNG XONG!
  @Post('set-admin')
  @ApiOperation({ summary: '⚠️ Tạm thời — Set role admin (xóa sau khi dùng)' })
  async setAdmin(@Body() body: SetAdminDto) {
    if (body.secretKey !== 'webie-secret-2025') {
      throw new BadRequestException('Secret key không hợp lệ!');
    }
    return this.authService.setAdmin(body.email);
  }
  @Post('resend-otp')
  @ApiOperation({ summary: 'Gửi lại OTP khi hết hạn' })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }
}
