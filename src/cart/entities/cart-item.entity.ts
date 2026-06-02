// src/cart/entities/cart-item.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Cart } from './cart.entity';

@Entity('cart_items')
export class CartItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart!: Cart;

  // ── ID sản phẩm bên Odoo ──────────────────────────────────────────
  @Column({ name: 'product_id' })
  productId!: number;

  // ── Snapshot tại thời điểm thêm vào giỏ ──────────────────────────
  @Column({ name: 'product_name', type: 'varchar' })
  productName!: string;

  @Column({ name: 'product_price', type: 'decimal', precision: 10, scale: 2 })
  productPrice!: number;

  @Column({ name: 'product_image_url', type: 'varchar', nullable: true })
  productImageUrl!: string | null;

  @Column({ name: 'product_sku', type: 'varchar', nullable: true })
  productSku!: string | null;

  // ── Số lượng ─────────────────────────────────────────────────────
  @Column({ default: 1 })
  quantity!: number;
}
