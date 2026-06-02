import { Module } from '@nestjs/common';
import { OdooService } from './odoo.service';
import { OdooController } from './odoo.controller';

@Module({
  providers: [OdooService],
  controllers: [OdooController],
  exports: [OdooService], // ← thêm dòng này
})
export class OdooModule {}
