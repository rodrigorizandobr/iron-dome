import { IsString, IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for creating a new order.
 */
export class CreateOrderDto {
  @ApiProperty({ description: 'Product name', example: 'Widget Pro' })
  @IsString()
  @IsNotEmpty()
  productName!: string;

  @ApiProperty({ description: 'Order amount in cents', example: 9990 })
  @IsNumber()
  amount!: number;
}
