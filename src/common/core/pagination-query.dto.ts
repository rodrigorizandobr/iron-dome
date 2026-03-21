import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for DynamoDB cursor-based pagination query params.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Maximum items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Pagination cursor (base64-encoded DynamoDB LastEvaluatedKey)',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
