import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { OdooService } from './odoo.service';

@ApiTags('Odoo — Sản phẩm & Danh mục')
@Controller('odoo')
export class OdooController {
  constructor(private readonly odooService: OdooService) {}

  @Get('products')
  @ApiOperation({ summary: 'Danh sách sản phẩm (có phân trang)' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  getProducts(@Query('limit') limit = 20, @Query('offset') offset = 0) {
    return this.odooService.getProducts(+limit, +offset);
  }

  @Get('products/search')
  @ApiOperation({ summary: 'Tìm kiếm sản phẩm theo tên' })
  @ApiQuery({ name: 'keyword', required: true, example: 'Danh thiếp' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  searchProducts(
    @Query('keyword') keyword: string,
    @Query('limit') limit = 20,
  ) {
    return this.odooService.searchProducts(keyword, +limit);
  }

  @Get('products/category/:categoryId')
  @ApiOperation({ summary: 'Lọc sản phẩm theo danh mục' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  getProductsByCategory(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
  ) {
    return this.odooService.getProductsByCategory(categoryId, +limit, +offset);
  }

  // ✅ Các route có sub-path (/:id/image, /:id/stock) phải đặt TRƯỚC /:id
  @Get('products/:id/image')
  @ApiOperation({ summary: 'Lấy ảnh sản phẩm (proxy qua Odoo, có xác thực)' })
  async getProductImage(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const { buffer, contentType } = await this.odooService.getProductImage(id);
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  }

  @Get('products/:id/stock')
  @ApiOperation({ summary: 'Kiểm tra tồn kho sản phẩm' })
  checkStock(@Param('id', ParseIntPipe) id: number) {
    return this.odooService.checkStock(id);
  }

  // ✅ Route dynamic /:id để CUỐI CÙNG trong nhóm products
  @Get('products/:id')
  @ApiOperation({ summary: 'Chi tiết 1 sản phẩm' })
  getProductById(@Param('id', ParseIntPipe) id: number) {
    return this.odooService.getProductById(id);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Danh sách danh mục sản phẩm' })
  getCategories() {
    return this.odooService.getCategories();
  }
}
