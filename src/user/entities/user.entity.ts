// src/user/entities/user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true, type: 'varchar' })
  email!: string;

  @Column({ type: 'varchar' })
  password_hash!: string;

  @Column({ name: 'full_name', type: 'varchar', nullable: true })
  fullName!: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', nullable: true })
  avatar_url!: string | null;

  @Column({ type: 'enum', enum: ['user', 'admin'], default: 'user' })
  role!: 'user' | 'admin';

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  is_verified!: boolean;

  @Column({ name: 'verification_code', type: 'varchar', nullable: true })
  verification_code!: string | null;

  @Column({ name: 'code_expired_at', type: 'timestamp', nullable: true })
  code_expired_at!: Date | null;

  @Column({ name: 'reset_password_code', type: 'varchar', nullable: true })
  reset_password_code!: string | null;

  @Column({ name: 'reset_code_expired_at', type: 'timestamp', nullable: true })
  reset_code_expired_at!: Date | null;

  @Column({ name: 'refresh_token', type: 'text', nullable: true })
  refresh_token!: string | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
