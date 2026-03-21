import { Controller, Get, Param, Req, Query, Version } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuditTrailsService } from './audit-trails.service';
import { AuditTrailResponseDto } from './dto/audit-trail-response.dto';
import { AuditTrailQueryDto } from './dto/audit-trail-query.dto';

/** Extended request type with tenantId from MultiTenancyMiddleware. */
interface ITenantRequest extends Request {
  tenantId: string;
}

const MSG_UNAUTHORIZED = 'Unauthorized';
const MSG_NOT_FOUND = 'Audit trail entry not found';

/**
 * Audit Trails REST Controller — read-only access to audit records.
 * All endpoints require JWT auth + `x-tenant-id` header for multi-tenancy.
 */
@ApiBearerAuth()
@ApiTags('audit-trails')
@ApiHeader({ name: 'x-tenant-id', required: true, description: 'Tenant identifier' })
@Controller('audit-trails')
export class AuditTrailsController {
  constructor(private readonly auditTrailsService: AuditTrailsService) {}

  /** List all audit trail entries for the current tenant (paginated, filterable). */
  @Get()
  @Version('1')
  @ApiOperation({
    summary: 'List audit trail entries (paginated, filterable by resourceType and action)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated audit trail list',
    type: AuditTrailResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 401, description: MSG_UNAUTHORIZED })
  async findAll(@Req() req: ITenantRequest, @Query() query: AuditTrailQueryDto) {
    return this.auditTrailsService.findAll(req.tenantId, query);
  }

  /** Retrieve a single audit trail entry by its unique ID. */
  @Get(':id')
  @Version('1')
  @ApiOperation({ summary: 'Get audit trail entry by ID' })
  @ApiParam({ name: 'id', description: 'Base64url-encoded audit trail entry ID' })
  @ApiResponse({ status: 200, description: 'Audit trail entry found', type: AuditTrailResponseDto })
  @ApiResponse({ status: 404, description: MSG_NOT_FOUND })
  @ApiResponse({ status: 401, description: MSG_UNAUTHORIZED })
  async findOne(@Req() req: ITenantRequest, @Param('id') id: string) {
    return this.auditTrailsService.findOne(req.tenantId, id);
  }
}
