import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/core/pagination-query.dto';
import { AuditAction } from '../../../common/core/audit-trail.service';

const VALID_ACTIONS: AuditAction[] = ['CREATE', 'UPDATE', 'DELETE'];

/**
 * Query DTO for listing audit trail entries.
 * Extends cursor-based pagination with optional filters.
 */
export class AuditTrailQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by resource type', example: 'ORDER' })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional({
    description: 'Filter by audit action',
    example: 'CREATE',
    enum: VALID_ACTIONS,
  })
  @IsOptional()
  @IsIn(VALID_ACTIONS)
  action?: AuditAction;
}
