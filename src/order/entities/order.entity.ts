// src/order/entities/order.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { OrderItem } from './order-item.entity';

export enum OrderStatus {
  PENDING = 'pending', // Chờ thanh toán
  PAID = 'paid', // Đã thanh toán
  PROCESSING = 'processing', // Đang triển khai
  COMPLETED = 'completed', // Hoàn thành
  CANCELLED = 'cancelled', // Đã hủy
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items!: OrderItem[];

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status!: OrderStatus;

  // Tổng tiền tại thời điểm đặt hàng
  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount!: number;

  // Thông tin khách hàng snapshot (phòng user đổi sau)
  @Column({ name: 'customer_name', type: 'varchar' })
  customerName!: string;

  @Column({ name: 'customer_email', type: 'varchar' })
  customerEmail!: string;

  @Column({ name: 'customer_phone', type: 'varchar', nullable: true })
  customerPhone!: string | null;

  // Ghi chú của khách
  @Column({ type: 'text', nullable: true })
  note!: string | null;

  // VNPay transaction ID (dùng ở Giai đoạn 6)
  @Column({ name: 'vnpay_txn_ref', type: 'varchar', nullable: true })
  vnpayTxnRef!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
