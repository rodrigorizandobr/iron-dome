import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
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
} from '@nestjs/swagger';
import { AuditTrailApiService } from './audit-trail.service';
import { CreateAuditTrailDto, UpdateAuditTrailDto, AuditTrailResponseDto } from './dto';
import { PaginationQueryDto } from '../../common/core/pagination-query.dto';
import { ITenantRequest } from '../../common/middlewares/multi-tenancy.middleware';

/**
 * Audit Trail API Controller.
 * Endpoints for CRUD operations on audit trail events.
 */
@Controller('audit-trail')
@ApiBearerAuth()
@ApiTags('Audit Trail')
export class AuditTrailController {
  constructor(private readonly service: AuditTrailApiService) {}

  /**
   * Create a new audit trail event.
   * Event is published to SQS for async processing.
   * @param req - HTTP request with tenant info
   * @param createDto - Event details
   * @returns Created event
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({
    description: 'Audit trail event created (async processing)',
    type: AuditTrailResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid event type or missing fields' })
  async create(
    @Request() req: ITenantRequest,
    @Body() createDto: CreateAuditTrailDto,
  ): Promise<AuditTrailResponseDto> {
    return this.service.create({ ...createDto, tenantId: req.tenantId });
  }

  /**
   * Get all audit trail events for tenant (paginated).
   * @param req - HTTP request with tenant info
   * @param pagination - Pagination parameters
   * @returns Paginated audit trail events
   */
  @Get()
  @ApiOkResponse({
    description: 'List of audit trail events',
    type: [AuditTrailResponseDto],
  })
  async findAll(
    @Request() req: ITenantRequest,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.service.findAll(req.tenantId, pagination);
  }

  /**
   * Get a specific audit trail event by ID.
   * @param req - HTTP request with tenant info
   * @param id - Event ID
   * @returns Audit trail event
   */
  @Get(':id')
  @ApiOkResponse({
    description: 'Audit trail event details',
    type: AuditTrailResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Event not found' })
  async findOne(@Request() req: ITenantRequest, @Param('id') id: string): Promise<AuditTrailResponseDto> {
    return this.service.findOne(req.tenantId, id);
  }

  /**
   * Update an audit trail event metadata.
   * @param req - HTTP request with tenant info
   * @param id - Event ID
   * @param updateDto - Updated fields
   * @returns Updated event
   */
  @Patch(':id')
  @ApiOkResponse({
    description: 'Audit trail event updated',
    type: AuditTrailResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Event not found' })
  async update(
    @Request() req: ITenantRequest,
    @Param('id') id: string,
    @Body() updateDto: UpdateAuditTrailDto,
  ): Promise<AuditTrailResponseDto> {
    return this.service.update(req.tenantId, id, updateDto);
  }

  /**
   * Delete (soft-delete) an audit trail event.
   * @param req - HTTP request with tenant info
   * @param id - Event ID
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOkResponse({ description: 'Audit trail event deleted' })
  @ApiNotFoundResponse({ description: 'Event not found' })
  async delete(@Request() req: ITenantRequest, @Param('id') id: string): Promise<void> {
    await this.service.delete(req.tenantId, id);
  }
}
