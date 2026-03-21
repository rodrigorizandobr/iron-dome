import { PartialType } from '@nestjs/swagger';
import { CreateOrderDto } from './create-order.dto';

/**
 * DTO for updating an existing order. All fields optional.
 */
export class UpdateOrderDto extends PartialType(CreateOrderDto) {}
