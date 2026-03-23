import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PaginationQueryDto } from '@/common/core/pagination-query.dto';
import { AuditTrailService } from './audit-trail.service';
import { CreateAuditTrailDto, UpdateAuditTrailDto, AuditTrailResponseDto } from './dto';

@ApiTags('audit-trail')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit-trail')
export class AuditTrailController {
  constructor(private readonly service: AuditTrailService) {}

  @Post()
  async create(@Body() dto: CreateAuditTrailDto) {
    return this.service.create('', dto);
  }

  @Get()
  async findAll(@Query() pagination: PaginationQueryDto) {
    return this.service.findAll('', pagination);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne('', id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAuditTrailDto) {
    return this.service.update('', id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.service.delete('', id);
  }
}
