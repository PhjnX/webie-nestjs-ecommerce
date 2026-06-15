import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';

@ApiTags('Payment — VNPay')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // POST /payment/vnpay — Tạo link thanh toán (cần đăng nhập)
  @Post('vnpay')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo link thanh toán VNPay cho đơn hàng' })
  async createPayment(@Req() req: any, @Body() dto: CreatePaymentDto) {
    const ipAddr =
      req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      '127.0.0.1';

    const paymentUrl = await this.paymentService.createVnpayUrl(
      req.user.id,
      dto.orderId,
      ipAddr,
    );

    return {
      success: true,
      data: { paymentUrl },
    };
  }

  // GET /payment/vnpay/return — VNPay redirect user về sau thanh toán
  @Get('vnpay/return')
  @ApiOperation({ summary: 'VNPay redirect về sau khi thanh toán' })
  async vnpayReturn(@Query() query: Record<string, string>) {
    return this.paymentService.handleReturn(query);
  }

  // GET /payment/vnpay/ipn — VNPay server gọi về để xác nhận
  @Get('vnpay/ipn')
  @ApiOperation({ summary: 'VNPay IPN — server to server callback' })
  async vnpayIpn(@Query() query: Record<string, string>) {
    return this.paymentService.handleIpn(query);
  }
}
