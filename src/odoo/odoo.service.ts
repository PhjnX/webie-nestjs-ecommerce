import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class OdooService {
  private readonly url = process.env.ODOO_URL;
  private readonly db = process.env.ODOO_DB;
  private readonly login = process.env.ODOO_LOGIN;
  private readonly password = process.env.ODOO_PASS;

  private cachedCookie: string | null = null;
  private cookieExpiredAt: Date | null = null;

  // ── HELPER: Axios instance dùng chung ─────────────────────────────
  private get http(): AxiosInstance {
    return axios.create({ baseURL: this.url });
  }

  // ── HELPER: Cache session cookie 30 phút ──────────────────────────
  async authenticate(): Promise<string> {
    // Nếu cookie còn hạn thì dùng lại, không authenticate lại
    if (
      this.cachedCookie &&
      this.cookieExpiredAt &&
      new Date() < this.cookieExpiredAt
    ) {
      return this.cachedCookie;
    }

    const response = await this.http.post('/web/session/authenticate', {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: this.db,
        login: this.login,
        password: this.password,
      },
    });

    const cookies = response.headers['set-cookie'];
    this.cachedCookie = cookies ? cookies[0] : '';

    // Cache cookie 30 phút
    const expired = new Date();
    expired.setMinutes(expired.getMinutes() + 30);
    this.cookieExpiredAt = expired;

    return this.cachedCookie;
  }

  // ── HELPER: Gọi Odoo API dùng chung ───────────────────────────────
  private async callOdoo(
    model: string,
    method: string,
    kwargs: any,
  ): Promise<any> {
    const cookie = await this.authenticate();

    const response = await this.http.post(
      '/web/dataset/call_kw',
      {
        jsonrpc: '2.0',
        method: 'call',
        params: { model, method, args: [], kwargs },
      },
      {
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer', // ← nhận raw bytes
      },
    );

    // Decode UTF-8 từ raw bytes
    const text = Buffer.from(response.data).toString('utf8');
    const json = JSON.parse(text);

    return json.result;
  }

  // ── HELPER: Chuyển Base64 thành URL ảnh Odoo ──────────────────────
  private getImageUrl(productId: number): string {
    return `${this.url}/web/image/product.template/${productId}/image_1920`;
  }

  // ── GET ALL PRODUCTS — Danh sách sản phẩm ─────────────────────────
  async getProducts(limit = 20, offset = 0): Promise<any> {
    const result = await this.callOdoo('product.template', 'search_read', {
      domain: [], // ← Bỏ filter sale_ok để lấy tất cả SP
      fields: [
        'id',
        'name',
        'list_price',
        'description_sale',
        'categ_id',
        'default_code',
        'qty_available',
      ],
      limit,
      offset,
    });

    console.log('Odoo raw result:', result); // ← Debug xem trả về gì

    // ← Thêm check null
    if (!result || !Array.isArray(result)) {
      return { total: 0, limit, offset, data: [] };
    }

    const total = await this.callOdoo('product.template', 'search_count', {
      domain: [],
    });

    return {
      total,
      limit,
      offset,
      data: result.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.list_price,
        description: p.description_sale || null,
        category: p.categ_id
          ? { id: p.categ_id[0], name: p.categ_id[1] }
          : null,
        sku: p.default_code || null,
        stock: p.qty_available || 0,
        image_url: this.getImageUrl(p.id),
      })),
    };
  }

  // ── GET PRODUCT BY ID — Chi tiết sản phẩm ─────────────────────────
  async getProductById(id: number): Promise<any> {
    const result = await this.callOdoo('product.template', 'search_read', {
      domain: [['id', '=', id]],
      fields: [
        'id',
        'name',
        'list_price',
        'description_sale',
        'categ_id',
        'default_code',
        'qty_available',
        'image_1920', // Chi tiết mới có ảnh Base64
      ],
      limit: 1,
    });

    if (!result || result.length === 0) return null;

    const p = result[0];
    return {
      id: p.id,
      name: p.name,
      price: p.list_price,
      description: p.description_sale || null,
      category: p.categ_id ? { id: p.categ_id[0], name: p.categ_id[1] } : null,
      sku: p.default_code || null,
      stock: p.qty_available || 0,
      image_url: this.getImageUrl(p.id),
      image_base64: p.image_1920 || null,
    };
  }

  // ── GET CATEGORIES — Danh sách danh mục ───────────────────────────
  async getCategories(): Promise<any[]> {
    const result = await this.callOdoo('product.category', 'search_read', {
      domain: [],
      fields: ['id', 'name', 'parent_id'],
      limit: 100,
    });

    return result.map((c: any) => ({
      id: c.id,
      name: c.name,
      parent: c.parent_id ? { id: c.parent_id[0], name: c.parent_id[1] } : null,
    }));
  }

  // ── GET PRODUCTS BY CATEGORY — Lọc theo danh mục ──────────────────
  async getProductsByCategory(
    categoryId: number,
    limit = 20,
    offset = 0,
  ): Promise<any> {
    const result = await this.callOdoo('product.template', 'search_read', {
      domain: [
        ['categ_id', '=', categoryId],
        ['sale_ok', '=', true],
      ],
      fields: [
        'id',
        'name',
        'list_price',
        'description_sale',
        'categ_id',
        'default_code',
        'qty_available',
      ],
      limit,
      offset,
    });

    const total = await this.callOdoo('product.template', 'search_count', {
      domain: [
        ['categ_id', '=', categoryId],
        ['sale_ok', '=', true],
      ],
    });

    return {
      total,
      limit,
      offset,
      data: result.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.list_price,
        description: p.description_sale || null,
        category: p.categ_id
          ? { id: p.categ_id[0], name: p.categ_id[1] }
          : null,
        sku: p.default_code || null,
        stock: p.qty_available || 0,
        image_url: this.getImageUrl(p.id),
      })),
    };
  }

  // ── SEARCH PRODUCTS — Tìm kiếm sản phẩm ──────────────────────────
  async searchProducts(keyword: string, limit = 20): Promise<any> {
    const result = await this.callOdoo('product.template', 'search_read', {
      domain: [
        ['name', 'ilike', keyword], // ilike = không phân biệt hoa thường
        ['sale_ok', '=', true],
      ],
      fields: [
        'id',
        'name',
        'list_price',
        'description_sale',
        'categ_id',
        'default_code',
        'qty_available',
      ],
      limit,
    });

    return {
      keyword,
      total: result.length,
      data: result.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.list_price,
        description: p.description_sale || null,
        category: p.categ_id
          ? { id: p.categ_id[0], name: p.categ_id[1] }
          : null,
        sku: p.default_code || null,
        stock: p.qty_available || 0,
        image_url: this.getImageUrl(p.id),
      })),
    };
  }

  // ── CHECK STOCK — Kiểm tra tồn kho ────────────────────────────────
  async checkStock(productId: number): Promise<any> {
    const result = await this.callOdoo('product.template', 'search_read', {
      domain: [['id', '=', productId]],
      fields: ['id', 'name', 'qty_available'],
      limit: 1,
    });

    if (!result || result.length === 0) {
      return { available: false, stock: 0 };
    }

    const p = result[0];
    return {
      id: p.id,
      name: p.name,
      stock: p.qty_available,
      available: p.qty_available > 0,
    };
  }
}
