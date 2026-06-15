import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UpdateUserDto, UpdateOrderStatusDto } from './dto/admin.dto';

@ApiTags('Admin Module')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard) // Tất cả route đều cần JWT + Admin role
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── DASHBOARD ──────────────────────────────────────────────────────
  @Get('stats')
  @ApiOperation({ summary: 'Thống kê tổng quan dashboard' })
  getStats() {
    return this.adminService.getStats();
  }

  // ── USER MANAGEMENT ────────────────────────────────────────────────
  @Get('users')
  @ApiOperation({ summary: 'Danh sách tất cả user' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  getAllUsers(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.adminService.getAllUsers(+page, +limit);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Chi tiết 1 user' })
  getUserById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getUserById(id);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Cập nhật thông tin user' })
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.adminService.updateUser(id, dto);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Khóa/mở khóa tài khoản user' })
  toggleUserStatus(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.toggleUserStatus(id);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Xóa user' })
  deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteUser(id);
  }

  // ── ORDER MANAGEMENT ───────────────────────────────────────────────
  @Get('orders')
  @ApiOperation({ summary: 'Danh sách tất cả đơn hàng' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', required: false, example: 'pending' })
  getAllOrders(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    return this.adminService.getAllOrders(+page, +limit, status);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Chi tiết đơn hàng' })
  getOrderById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getOrderById(id);
  }

  @Patch('orders/:id/status')
  @ApiOperation({ summary: 'Cập nhật trạng thái đơn hàng' })
  updateOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.adminService.updateOrderStatus(id, dto);
  }
}
