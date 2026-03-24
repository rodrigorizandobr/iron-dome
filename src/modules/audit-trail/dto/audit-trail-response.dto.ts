import { ApiProperty } from '@nestjs/swagger';
import { AuditEventType } from './create-audit-trail.dto';

/**
 * DTO for audit trail response.
 * Represents an immutable audit trail entry.
 */
export class AuditTrailResponseDto {
  /**
   * Unique audit trail entry ID.
   */
  @ApiProperty({ description: 'Unique identifier' })
  id: string;

  /**
   * Tenant ID (multi-tenancy isolation).
   */
  @ApiProperty({ description: 'Tenant identifier' })
  tenantId: string;

  /**
   * Event type.
   */
  @ApiProperty({
    enum: AuditEventType,
    description: 'Pre-registered event type',
  })
  eventType: AuditEventType;

  /**
   * Actor identifier.
   */
  @ApiProperty({ description: 'User or system that triggered the event' })
  actorId: string;

  /**
   * Resource type.
   */
  @ApiProperty({ description: 'Type of resource affected' })
  resourceType: string;

  /**
   * Resource ID.
   */
  @ApiProperty({ description: 'ID of the affected resource' })
  resourceId: string;

  /**
   * Action performed.
   */
  @ApiProperty({ description: 'Type of action performed' })
  action: string;

  /**
   * Event metadata (dynamic).
   */
  @ApiProperty({
    description: 'Event-specific metadata',
    type: 'object',
  })
  metadata: Record<string, unknown>;

  /**
   * Optional description.
   */
  @ApiProperty({ description: 'Human-readable description', nullable: true })
  description?: string | null;

  /**
   * Timestamp (ISO 8601).
   */
  @ApiProperty({ description: 'Event timestamp' })
  createdAt: string;

  /**
   * Last update timestamp.
   */
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: string;

  /**
   * Soft-delete flag.
   */
  @ApiProperty({ description: 'Soft-delete indicator' })
  deleted: boolean;
}
