import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Order } from '../order/entities/order.entity';
import { UpdateUserDto, UpdateOrderStatusDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  // ── USER MANAGEMENT ────────────────────────────────────────────────

  async getAllUsers(page = 1, limit = 20): Promise<any> {
    const offset = (page - 1) * limit;

    const [users, total] = await this.userRepo.findAndCount({
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        is_verified: true,
        is_active: true,
        avatar_url: true,
        created_at: true,
      },
      order: { created_at: 'DESC' },
      skip: offset,
      take: limit,
    });

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: users,
    };
  }

  async getUserById(id: number): Promise<any> {
    const user = await this.userRepo.findOne({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        address: true,
        role: true,
        is_verified: true,
        is_active: true,
        avatar_url: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) throw new NotFoundException(`Không tìm thấy user #${id}`);
    return user;
  }

  async updateUser(id: number, dto: UpdateUserDto): Promise<any> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`Không tìm thấy user #${id}`);

    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.address !== undefined) user.address = dto.address;
    if (dto.role !== undefined) user.role = dto.role;

    await this.userRepo.save(user);
    return { success: true, message: 'Cập nhật user thành công!' };
  }

  async toggleUserStatus(id: number): Promise<any> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`Không tìm thấy user #${id}`);

    user.is_active = !user.is_active;
    await this.userRepo.save(user);

    return {
      success: true,
      message: user.is_active
        ? `Đã mở khóa tài khoản user #${id}`
        : `Đã khóa tài khoản user #${id}`,
      is_active: user.is_active,
    };
  }

  async deleteUser(id: number): Promise<any> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`Không tìm thấy user #${id}`);

    await this.userRepo.remove(user);
    return { success: true, message: `Đã xóa user #${id}` };
  }

  // ── ORDER MANAGEMENT ───────────────────────────────────────────────

  async getAllOrders(page = 1, limit = 20, status?: string): Promise<any> {
    const offset = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [orders, total] = await this.orderRepo.findAndCount({
      where,
      relations: { items: true, user: true },
      order: { created_at: 'DESC' },
      skip: offset,
      take: limit,
    });

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: orders.map((o) => ({
        id: o.id,
        status: o.status,
        totalAmount: o.totalAmount,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        customerPhone: o.customerPhone,
        note: o.note,
        itemCount: o.items.length,
        userId: o.user?.id,
        created_at: o.created_at,
      })),
    };
  }

  async getOrderById(id: number): Promise<any> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: { items: true, user: true },
    });

    if (!order) throw new NotFoundException(`Không tìm thấy đơn hàng #${id}`);
    return order;
  }

  async updateOrderStatus(id: number, dto: UpdateOrderStatusDto): Promise<any> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException(`Không tìm thấy đơn hàng #${id}`);

    order.status = dto.status;
    await this.orderRepo.save(order);

    return {
      success: true,
      message: `Đã cập nhật trạng thái đơn hàng #${id} thành "${dto.status}"`,
    };
  }

  // ── DASHBOARD STATS ────────────────────────────────────────────────
  async getStats(): Promise<any> {
    const totalUsers = await this.userRepo.count();
    const verifiedUsers = await this.userRepo.count({
      where: { is_verified: true },
    });
    const activeUsers = await this.userRepo.count({
      where: { is_active: true },
    });

    const totalOrders = await this.orderRepo.count();
    const pendingOrders = await this.orderRepo.count({
      where: { status: 'pending' as any },
    });
    const paidOrders = await this.orderRepo.count({
      where: { status: 'paid' as any },
    });
    const processingOrders = await this.orderRepo.count({
      where: { status: 'processing' as any },
    });
    const completedOrders = await this.orderRepo.count({
      where: { status: 'completed' as any },
    });
    const cancelledOrders = await this.orderRepo.count({
      where: { status: 'cancelled' as any },
    });

    const revenueResult = await this.orderRepo
      .createQueryBuilder('order')
      .select('SUM(order.totalAmount)', 'total')
      .where('order.status IN (:...statuses)', {
        statuses: ['paid', 'completed'],
      })
      .getRawOne();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthRevenueResult = await this.orderRepo
      .createQueryBuilder('order')
      .select('SUM(order.totalAmount)', 'total')
      .where('order.status IN (:...statuses)', {
        statuses: ['paid', 'completed'],
      })
      .andWhere('order.created_at >= :startOfMonth', { startOfMonth })
      .getRawOne();

    const latestOrders = await this.orderRepo.find({
      order: { created_at: 'DESC' },
      take: 5,
      select: {
        id: true,
        status: true,
        totalAmount: true,
        customerName: true,
        customerEmail: true,
        created_at: true,
      },
    });

    return {
      users: {
        total: totalUsers,
        verified: verifiedUsers,
        active: activeUsers,
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        paid: paidOrders,
        processing: processingOrders,
        completed: completedOrders,
        cancelled: cancelledOrders,
      },
      revenue: {
        total: Number(revenueResult?.total || 0),
        thisMonth: Number(monthRevenueResult?.total || 0),
      },
      latestOrders,
    };
  }
}
