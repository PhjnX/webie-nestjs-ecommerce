// src/cart/cart.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@ApiTags('Cart')
@ApiBearerAuth()
@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // GET /cart — Lấy giỏ hàng hiện tại
  @Get()
  getCart(@Req() req: any) {
    return this.cartService.getCart(req.user.id);
  }

  // POST /cart/add — Thêm sản phẩm vào giỏ
  @Post('add')
  addToCart(@Req() req: any, @Body() dto: AddToCartDto) {
    return this.cartService.addToCart(req.user.id, dto);
  }

  // PATCH /cart/item/:id — Cập nhật số lượng
  @Patch('item/:id')
  updateItem(
    @Req() req: any,
    @Param('id', ParseIntPipe) itemId: number,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(req.user.id, itemId, dto);
  }

  // DELETE /cart/item/:id — Xóa 1 sản phẩm
  @Delete('item/:id')
  removeItem(@Req() req: any, @Param('id', ParseIntPipe) itemId: number) {
    return this.cartService.removeItem(req.user.id, itemId);
  }

  // DELETE /cart — Xóa toàn bộ giỏ hàng
  @Delete()
  clearCart(@Req() req: any) {
    return this.cartService.clearCart(req.user.id);
  }
}
