// src/order/order.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';

@ApiTags('Order')
@ApiBearerAuth()
@Controller('order')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // POST /order/checkout — Đặt hàng
  @Post('checkout')
  checkout(@Req() req: any, @Body() dto: CreateOrderDto) {
    return this.orderService.checkout(req.user.id, dto); // ← truyền id
  }

  // GET /order — Lịch sử đơn hàng
  @Get()
  getOrders(@Req() req: any) {
    return this.orderService.getOrders(req.user.id);
  }

  // GET /order/:id — Chi tiết đơn hàng
  @Get(':id')
  getOrderById(@Req() req: any, @Param('id', ParseIntPipe) orderId: number) {
    return this.orderService.getOrderById(req.user.id, orderId);
  }
}
