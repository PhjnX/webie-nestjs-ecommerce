import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '../../order/entities/order.entity';

export class UpdateUserDto {
  @ApiProperty({ example: 'Bùi Hoàng Phi', required: false })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiProperty({ example: '0901234567', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: '123 Đường ABC', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: 'user', enum: ['user', 'admin'], required: false })
  @IsEnum(['user', 'admin'])
  @IsOptional()
  role?: 'user' | 'admin';
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PROCESSING })
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
