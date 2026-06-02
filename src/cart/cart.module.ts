// src/cart/cart.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { OdooModule } from '../odoo/odoo.module'; // Để gọi OdooService lấy thông tin SP → snapshot

@Module({
  imports: [
    TypeOrmModule.forFeature([Cart, CartItem]),
    OdooModule, // Để gọi OdooService lấy thông tin SP → snapshot
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService], // Export để OrderModule dùng sau này
})
export class CartModule {}
