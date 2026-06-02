import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiPropertyOptional({ description: 'Ghi chú đơn hàng' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
