import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateContactDto {
  @ApiProperty({ example: 'Bùi Hoàng Phi', description: 'Họ và tên' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên' })
  fullName!: string;

  @ApiProperty({ example: '0901234567', description: 'Số điện thoại' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập số điện thoại' })
  phone!: string;

  @ApiProperty({ example: 'phi@webie.vn', description: 'Email liên hệ' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Vui lòng nhập email' })
  email!: string;

  @ApiProperty({
    example: 'Tôi muốn tư vấn về Digital Vcard...',
    description: 'Nội dung tin nhắn',
  })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung tin nhắn' })
  @MinLength(10, { message: 'Tin nhắn tối thiểu 10 ký tự' })
  message!: string;
}