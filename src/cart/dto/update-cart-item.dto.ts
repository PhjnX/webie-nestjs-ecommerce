// src/cart/dto/update-cart-item.dto.ts
import { IsInt, Min } from 'class-validator';

export class UpdateCartItemDto {
  @IsInt()
  @Min(1, { message: 'quantity tối thiểu là 1' })
  quantity!: number;
}