// src/cart/cart.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { OdooService } from '../odoo/odoo.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private readonly cartRepo: Repository<Cart>,

    @InjectRepository(CartItem)
    private readonly cartItemRepo: Repository<CartItem>,

    private readonly odooService: OdooService,
  ) {}

  // ── HELPER: Lấy hoặc tạo mới Cart cho user ───────────────────────
  private async getOrCreateCart(userId: number): Promise<Cart> {
    let cart = await this.cartRepo.findOne({
      where: { user: { id: userId } },
      relations: { items: true },
    });

    if (!cart) {
      cart = this.cartRepo.create({ user: { id: userId } as any, items: [] });
      await this.cartRepo.save(cart);
    }

    return cart;
  }

  // ── ADD TO CART ───────────────────────────────────────────────────
  async addToCart(userId: number, dto: AddToCartDto): Promise<Cart> {
    // 1. Lấy thông tin sản phẩm từ Odoo
    const product = await this.odooService.getProductById(dto.productId);
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm #${dto.productId}`);
    }

    // 2. Lấy hoặc tạo cart
    const cart = await this.getOrCreateCart(userId);

    // 3. Kiểm tra sản phẩm đã có trong giỏ chưa
    const existingItem = cart.items.find(
      (item) => item.productId === dto.productId,
    );

    if (existingItem) {
      // Đã có → cộng thêm số lượng
      existingItem.quantity += dto.quantity;
      await this.cartItemRepo.save(existingItem);
    } else {
      // Chưa có → tạo mới với snapshot
      const newItem = this.cartItemRepo.create({
        cart,
        productId: product.id,
        productName: product.name,
        productPrice: product.price,
        productImageUrl: product.image_url ?? null,
        productSku: product.sku ?? null,
        quantity: dto.quantity,
      });
      await this.cartItemRepo.save(newItem);
    }

    // 4. Trả về cart đã cập nhật
    return this.getCart(userId);
  }

  // ── GET CART ──────────────────────────────────────────────────────
  async getCart(userId: number): Promise<Cart> {
    const cart = await this.cartRepo.findOne({
      where: { user: { id: userId } },
      relations: { items: true },
    });

    if (!cart) {
      // Trả về cart rỗng thay vì throw lỗi — UX tốt hơn
      return this.getOrCreateCart(userId);
    }

    return cart;
  }

  // ── UPDATE ITEM QUANTITY ──────────────────────────────────────────
  async updateItem(
    userId: number,
    itemId: number,
    dto: UpdateCartItemDto,
  ): Promise<Cart> {
    const cart = await this.getOrCreateCart(userId);

    const item = cart.items.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException(`Không tìm thấy item #${itemId} trong giỏ`);
    }

    item.quantity = dto.quantity;
    await this.cartItemRepo.save(item);

    return this.getCart(userId);
  }

  // ── REMOVE ITEM ───────────────────────────────────────────────────
  async removeItem(userId: number, itemId: number): Promise<Cart> {
    const cart = await this.getOrCreateCart(userId);

    const item = cart.items.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException(`Không tìm thấy item #${itemId} trong giỏ`);
    }

    await this.cartItemRepo.remove(item);

    return this.getCart(userId);
  }

  // ── CLEAR CART ────────────────────────────────────────────────────
  async clearCart(
    userId: number,
  ): Promise<{ success: boolean; message: string }> {
    const cart = await this.cartRepo.findOne({
      where: { user: { id: userId } },
      relations: { items: true },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Giỏ hàng đã trống');
    }

    await this.cartItemRepo.remove(cart.items);

    return { success: true, message: 'Đã xóa toàn bộ giỏ hàng' };
  }
}
