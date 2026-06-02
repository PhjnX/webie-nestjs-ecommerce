import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  // Upload ảnh lên Cloudinary, trả về URL
  async uploadImage(
    file: Express.Multer.File,
    folder: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          folder: `webie/${folder}`, // Ảnh lưu vào folder webie/avatars
          transformation: [
            { width: 500, height: 500, crop: 'fill', gravity: 'face' }, // Tự crop vuông, ưu tiên mặt
            { quality: 'auto', fetch_format: 'auto' }, // Tự tối ưu chất lượng
          ],
        },
        (error, result) => {
          if (error || !result) {
            reject(new BadRequestException('Upload ảnh thất bại!'));
          } else {
            resolve(result.secure_url); // Trả về URL https
          }
        },
      );

      // Chuyển buffer file sang stream để upload
      const stream = Readable.from(file.buffer);
      stream.pipe(upload);
    });
  }

  // Xóa ảnh cũ trên Cloudinary khi user đổi avatar
  async deleteImage(imageUrl: string): Promise<void> {
    try {
      // Lấy public_id từ URL cloudinary
      const parts = imageUrl.split('/');
      const filename = parts[parts.length - 1].split('.')[0];
      const folder = parts[parts.length - 2];
      const publicId = `webie/${folder}/${filename}`;
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error('Xóa ảnh Cloudinary thất bại:', error);
    }
  }
}
