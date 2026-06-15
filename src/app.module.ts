// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm'; // 🛠️ Thêm import này
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OdooModule } from './odoo/odoo.module';
import { AuthModule } from './auth/auth.module';
import { OrderModule } from './order/order.module';
import { MailerModule } from '@nestjs-modules/mailer'; // 🛠️ Thêm import này
import { UserModule } from './user/user.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { CartModule } from './cart/cart.module'; // thêm import
import { PaymentModule } from './payment/payment.module';
import { ContactModule } from './contact/contact.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    // 1. Đọc file .env toàn cục
    ConfigModule.forRoot({ isGlobal: true }),

    // 2. 🛠️ BỔ SUNG CẤU HÌNH KẾT NỐI DATABASE Ở ĐÂY
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      charset: 'utf8mb4',
      // Tự động quét tìm tất cả các file có đuôi .entity.ts trong folder src
      entities: [__dirname + '/**/*.entity{.ts,.js}'],

      // Đánh lửa kích hoạt tính năng tự tạo bảng vật lý trên cPanel khi run app
      synchronize: true,
    }),
    MailerModule.forRoot({
      transport: {
        host: process.env.MAIL_HOST,
        port: parseInt(process.env.MAIL_PORT || '587', 10),
        secure: false, // Chạy port 587 thì secure là false
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASSWORD,
        },
      },
      defaults: {
        from: `"Webie VietNam" <${process.env.MAIL_FROM}>`,
      },
    }),
    OdooModule,

    AuthModule,

    OrderModule,

    UserModule,

    CloudinaryModule,

    CartModule,

    PaymentModule,
    ContactModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
