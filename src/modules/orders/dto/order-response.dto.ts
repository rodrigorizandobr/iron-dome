import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO representing an Order in API responses.
 */
export class OrderResponseDto {
  @ApiProperty({ description: 'Order unique ID', example: '1711929600000' })
  id!: string;

  @ApiProperty({ description: 'Tenant ID', example: 'tenant-abc' })
  tenantId!: string;

  @ApiProperty({ description: 'Product name', example: 'Widget Pro' })
  productName!: string;

  @ApiProperty({ description: 'Amount in cents', example: 9990 })
  amount!: number;

  @ApiProperty({ description: 'Entity type', example: 'ORDER' })
  entityType!: string;

  @ApiProperty({ description: 'ISO creation date', example: '2026-03-20T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ description: 'ISO last update date', example: '2026-03-20T12:00:00.000Z' })
  updatedAt!: string;

  @ApiProperty({ description: 'Soft-delete flag', example: false })
  deleted!: boolean;
}
