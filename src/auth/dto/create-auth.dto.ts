import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'phi@webie.vn' })
  email!: string;

  @ApiProperty({ example: 'MatKhauSieuCap123' })
  password!: string;

  @ApiProperty({ example: 'Bùi Hoàng Phi', required: false })
  fullName?: string;

  @ApiProperty({ example: '0901234567', required: false })
  phone?: string;

  @ApiProperty({ example: '123 Đường Sông Hành, Quận 2', required: false })
  address?: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'phi@webie.vn' })
  email!: string;

  @ApiProperty({ example: '123456' })
  otp!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'phi@webie.vn' })
  email!: string;

  @ApiProperty({ example: 'MatKhauSieuCap123' })
  password!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'phi@webie.vn',
    description: 'Email đã đăng ký tài khoản',
  })
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'phi@webie.vn' })
  email!: string;

  @ApiProperty({ example: '123456', description: 'Mã OTP nhận qua email' })
  otp!: string;

  @ApiProperty({
    example: 'MatKhauMoi123',
    description: 'Mật khẩu mới tối thiểu 6 ký tự',
  })
  newPassword!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token nhận được khi đăng nhập' })
  refreshToken!: string;
}
