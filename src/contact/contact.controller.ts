import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';

@ApiTags('Contact — Tư vấn & Liên hệ')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @ApiOperation({ summary: 'Gửi yêu cầu tư vấn' })
  @ApiResponse({ status: 201, description: 'Đã gửi yêu cầu thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  sendContact(@Body() dto: CreateContactDto) {
    return this.contactService.sendContact(dto);
  }
}
