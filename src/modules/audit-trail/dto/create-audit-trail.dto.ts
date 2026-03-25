import { IsString, IsNotEmpty, IsEnum, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Supported audit event types (must be pre-registered).
 */
export enum AuditEventType {
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  TRANSACTION_CREATED = 'TRANSACTION_CREATED',
  TRANSACTION_UPDATED = 'TRANSACTION_UPDATED',
  TRANSACTION_CANCELLED = 'TRANSACTION_CANCELLED',
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
  ACCOUNT_UPDATED = 'ACCOUNT_UPDATED',
  BALANCE_UPDATED = 'BALANCE_UPDATED',
  TRANSFER_INITIATED = 'TRANSFER_INITIATED',
  TRANSFER_COMPLETED = 'TRANSFER_COMPLETED',
  WITHDRAWAL_REQUESTED = 'WITHDRAWAL_REQUESTED',
}

/**
 * DTO for creating an audit trail event.
 * Event type must be pre-registered.
 */
export class CreateAuditTrailDto {
  /**
   * Event type identifier (must be pre-registered).
   */
  @ApiProperty({
    enum: AuditEventType,
    description: 'Pre-registered event type',
  })
  @IsEnum(AuditEventType)
  @IsNotEmpty()
  eventType!: AuditEventType;

  /**
   * Actor identifier (user ID, system, etc).
   */
  @ApiProperty({ description: 'User or system that triggered the event' })
  @IsString()
  @IsNotEmpty()
  actorId!: string;

  /**
   * Resource type being audited (e.g., "TRANSACTION", "ACCOUNT", "USER").
   */
  @ApiProperty({ description: 'Type of resource affected' })
  @IsString()
  @IsNotEmpty()
  resourceType!: string;

  /**
   * Resource ID being audited.
   */
  @ApiProperty({ description: 'ID of the affected resource' })
  @IsString()
  @IsNotEmpty()
  resourceId!: string;

  /**
   * Action performed (CREATE, UPDATE, DELETE, VIEW, etc).
   */
  @ApiProperty({ description: 'Type of action performed' })
  @IsString()
  @IsNotEmpty()
  action!: string;

  /**
   * Event metadata (dynamic, depends on event type).
   */
  @ApiProperty({
    description: 'Event-specific metadata',
    example: { amount: 1000, currency: 'BRL', status: 'COMPLETED' },
  })
  @IsObject()
  metadata!: Record<string, unknown>;

  /**
   * Optional description.
   */
  @ApiProperty({ description: 'Human-readable description', required: false })
  @IsString()
  description?: string;
}
