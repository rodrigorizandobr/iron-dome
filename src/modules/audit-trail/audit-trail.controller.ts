import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuditTrailApiService } from './audit-trail.service';
import { CreateAuditTrailDto, UpdateAuditTrailDto, AuditTrailResponseDto } from './dto';
import { PaginationQueryDto } from '../../common/core/pagination-query.dto';

/** Extended request type with tenantId from MultiTenancyMiddleware. */
interface ITenantRequest extends Request {
  tenantId: string;
}

const MSG_NOT_FOUND = 'Event not found';

/**
 * Audit Trail API Controller.
 * All endpoints require `x-tenant-id` header for multi-tenancy.
 */
@ApiBearerAuth()
@ApiTags('Audit Trail')
@ApiHeader({ name: 'x-tenant-id', required: true, description: 'Tenant identifier' })
@Controller('audit-trail')
export class AuditTrailController {
  constructor(private readonly service: AuditTrailApiService) {}

  /** Create a new audit trail event (async via SQS). */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ description: 'Audit trail event created', type: AuditTrailResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid event type or missing fields' })
  async create(
    @Req() req: ITenantRequest,
    @Body() createDto: CreateAuditTrailDto,
  ): Promise<AuditTrailResponseDto> {
    return this.service.create({
      ...createDto,
      tenantId: req.tenantId,
    } as unknown as CreateAuditTrailDto);
  }

  /** List all audit trail events for tenant (paginated). */
  @Get()
  @ApiOkResponse({ description: 'Paginated audit trail events list' })
  async findAll(@Req() req: ITenantRequest, @Query() pagination: PaginationQueryDto) {
    return this.service.findAll(req.tenantId, pagination);
  }

  /** Get a specific audit trail event by ID. */
  @Get(':id')
  @ApiOkResponse({ description: 'Audit trail event details', type: AuditTrailResponseDto })
  @ApiNotFoundResponse({ description: MSG_NOT_FOUND })
  async findOne(@Req() req: ITenantRequest, @Param('id') id: string) {
    return this.service.findOne(req.tenantId, id);
  }

  /** Update an audit trail event metadata. */
  @Patch(':id')
  @ApiOkResponse({ description: 'Audit trail event updated', type: AuditTrailResponseDto })
  @ApiNotFoundResponse({ description: MSG_NOT_FOUND })
  async update(
    @Req() req: ITenantRequest,
    @Param('id') id: string,
    @Body() updateDto: UpdateAuditTrailDto,
  ) {
    return this.service.update(req.tenantId, id, updateDto);
  }

  /** Soft-delete an audit trail event. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOkResponse({ description: 'Audit trail event deleted' })
  @ApiNotFoundResponse({ description: MSG_NOT_FOUND })
  async remove(@Req() req: ITenantRequest, @Param('id') id: string) {
    return this.service.remove(req.tenantId, id);
  }
}
