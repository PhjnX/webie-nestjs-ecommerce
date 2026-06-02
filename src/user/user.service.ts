import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateProfileDto, ChangePasswordDto } from './dto/update-user.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ── GET PROFILE ────────────────────────────────────────────────────
  async getProfile(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản!');

    // Không trả về các trường nhạy cảm
    const { password_hash, verification_code, reset_password_code, refresh_token, ...profile } = user;

    return { success: true, data: profile };
  }

  // ── UPDATE PROFILE ─────────────────────────────────────────────────
  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản!');

    // Chỉ cập nhật các trường được gửi lên
    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.address !== undefined) user.address = dto.address;

    await this.userRepository.save(user);

    return { success: true, message: 'Cập nhật thông tin thành công!' };
  }

  // ── UPLOAD AVATAR ──────────────────────────────────────────────────
  async uploadAvatar(userId: number, file: Express.Multer.File) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản!');

    // Xóa ảnh cũ trên Cloudinary nếu có
    if (user.avatar_url) {
      await this.cloudinaryService.deleteImage(user.avatar_url);
    }

    // Upload ảnh mới lên Cloudinary
    const avatarUrl = await this.cloudinaryService.uploadImage(file, 'avatars');

    // Lưu URL mới vào DB
    user.avatar_url = avatarUrl;
    await this.userRepository.save(user);

    return {
      success: true,
      message: 'Cập nhật ảnh đại diện thành công!',
      data: { avatar_url: avatarUrl },
    };
  }

  // ── CHANGE PASSWORD ────────────────────────────────────────────────
  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản!');

    // Kiểm tra mật khẩu hiện tại có đúng không
    const isMatch = await bcrypt.compare(dto.currentPassword, user.password_hash);
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu hiện tại không chính xác!');
    }

    // Kiểm tra mật khẩu mới không được giống mật khẩu cũ
    const isSame = await bcrypt.compare(dto.newPassword, user.password_hash);
    if (isSame) {
      throw new BadRequestException('Mật khẩu mới không được giống mật khẩu cũ!');
    }

    // Hash và lưu mật khẩu mới
    user.password_hash = await bcrypt.hash(dto.newPassword, 10);
    user.refresh_token = null; // Đăng xuất toàn bộ thiết bị
    await this.userRepository.save(user);

    return {
      success: true,
      message: 'Đổi mật khẩu thành công! Vui lòng đăng nhập lại.',
    };
  }
}