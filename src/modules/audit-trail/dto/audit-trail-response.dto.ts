import { ApiProperty } from '@nestjs/swagger';
import { AuditEventType } from './create-audit-trail.dto';

/**
 * DTO for audit trail response.
 * Represents an immutable audit trail entry.
 */
export class AuditTrailResponseDto {
  @ApiProperty({ description: 'Unique identifier' })
  id!: string;

  @ApiProperty({ description: 'Tenant identifier' })
  tenantId!: string;

  @ApiProperty({ enum: AuditEventType, description: 'Pre-registered event type' })
  eventType!: AuditEventType;

  @ApiProperty({ description: 'User or system that triggered the event' })
  actorId!: string;

  @ApiProperty({ description: 'Type of resource affected' })
  resourceType!: string;

  @ApiProperty({ description: 'ID of the affected resource' })
  resourceId!: string;

  @ApiProperty({ description: 'Type of action performed' })
  action!: string;

  @ApiProperty({ description: 'Event-specific metadata', example: {} })
  metadata!: Record<string, unknown>;

  @ApiProperty({ description: 'Human-readable description', nullable: true })
  description?: string | null;

  @ApiProperty({ description: 'Event timestamp' })
  createdAt!: string;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: string;

  @ApiProperty({ description: 'Soft-delete indicator', example: false })
  deleted!: boolean;
}
