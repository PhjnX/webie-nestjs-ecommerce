// src/cart/dto/add-to-cart.dto.ts
import { IsInt, Min } from 'class-validator';

export class AddToCartDto {
  @IsInt({ message: 'productId phải là số nguyên' })
  productId!: number;

  @IsInt({ message: 'quantity phải là số nguyên' })
  @Min(1, { message: 'quantity tối thiểu là 1' })
  quantity!: number;
}