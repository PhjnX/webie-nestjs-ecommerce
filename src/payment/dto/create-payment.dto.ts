import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ example: 1, description: 'ID đơn hàng cần thanh toán' })
  @IsInt()
  @Min(1)
  orderId!: number;
}