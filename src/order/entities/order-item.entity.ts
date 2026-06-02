// src/order/entities/order-item.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  // Snapshot sản phẩm từ CartItem
  @Column({ name: 'product_id' })
  productId!: number;

  @Column({ name: 'product_name', type: 'varchar' })
  productName!: string;

  @Column({ name: 'product_price', type: 'decimal', precision: 10, scale: 2 })
  productPrice!: number;

  @Column({ name: 'product_image_url', type: 'varchar', nullable: true })
  productImageUrl!: string | null;

  @Column({ name: 'product_sku', type: 'varchar', nullable: true })
  productSku!: string | null;

  @Column({ default: 1 })
  quantity!: number;

  // Thành tiền = productPrice * quantity
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal!: number;
}
