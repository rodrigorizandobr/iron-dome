import { ApiProperty } from '@nestjs/swagger';
import { AuditAction } from '../../../common/core/audit-trail.service';

/**
 * Response DTO representing an Audit Trail entry in API responses.
 */
export class AuditTrailResponseDto {
  @ApiProperty({ description: 'Entry unique ID (base64-encoded SK)', example: 'QVVESVRIMS4uLg==' })
  id!: string;

  @ApiProperty({ description: 'Tenant ID', example: 'tenant-abc' })
  tenantId!: string;

  @ApiProperty({
    description: 'Audit action performed',
    example: 'CREATE',
    enum: ['CREATE', 'UPDATE', 'DELETE'],
  })
  action!: AuditAction;

  @ApiProperty({ description: 'Resource type', example: 'ORDER' })
  resourceType!: string;

  @ApiProperty({ description: 'Resource ID', example: '1711929600000' })
  resourceId!: string;

  @ApiProperty({
    description: 'User who performed the action',
    example: 'user-123',
    required: false,
  })
  performedBy?: string;

  @ApiProperty({
    description: 'ISO timestamp of the audit event',
    example: '2026-03-20T12:00:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({ description: 'Changed fields snapshot', required: false })
  changes?: Record<string, unknown>;

  @ApiProperty({ description: 'Entity type', example: 'AUDIT' })
  entityType!: string;
}
