// src/order/order.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { CartModule } from '../cart/cart.module';
import { User } from '../user/entities/user.entity'; // ← thêm

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, User]),
    CartModule, // Dùng CartService để lấy giỏ hàng + clearCart
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService], // Export để VNPay module dùng sau
})
export class OrderModule {}
