import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({ example: 'Bùi Hoàng Phi', required: false })
  fullName?: string;

  @ApiProperty({ example: '0901234567', required: false })
  phone?: string;

  @ApiProperty({ example: '123 Đường ABC, Quận 2', required: false })
  address?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'MatKhauCu123', description: 'Mật khẩu hiện tại' })
  currentPassword!: string;

  @ApiProperty({
    example: 'MatKhauMoi456',
    description: 'Mật khẩu mới tối thiểu 6 ký tự',
  })
  newPassword!: string;
}
