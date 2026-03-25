import { IsString, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for updating an audit trail event.
 * Only specific fields can be updated (status, metadata).
 */
export class UpdateAuditTrailDto {
  /**
   * Optional metadata updates.
   */
  @ApiProperty({
    description: 'Partial metadata updates',
    required: false,
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  /**
   * Optional description update.
   */
  @ApiProperty({ description: 'Updated description', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
