import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Req,
  Query,
  Version,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { PaginationQueryDto } from '../../common/core/pagination-query.dto';

/** Extended request type with tenantId from MultiTenancyMiddleware. */
interface ITenantRequest extends Request {
  tenantId: string;
}

const MSG_UNAUTHORIZED = 'Unauthorized';
const MSG_ORDER_NOT_FOUND = 'Order not found';

/**
 * Orders REST Controller.
 * All endpoints require `x-tenant-id` header for multi-tenancy.
 */
@ApiBearerAuth()
@ApiTags('orders')
@ApiHeader({ name: 'x-tenant-id', required: true, description: 'Tenant identifier' })
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** Create a new order for the current tenant. */
  @Post()
  @Version('1')
  @ApiOperation({ summary: 'Create an order' })
  @ApiResponse({ status: 201, description: 'Order created', type: OrderResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: MSG_UNAUTHORIZED })
  async create(@Req() req: ITenantRequest, @Body() dto: CreateOrderDto): Promise<OrderResponseDto> {
    return this.ordersService.create({
      ...dto,
      tenantId: req.tenantId,
    } as unknown as CreateOrderDto);
  }

  /** List all orders for the current tenant (paginated). */
  @Get()
  @Version('1')
  @ApiOperation({ summary: 'List all orders (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated orders list' })
  @ApiResponse({ status: 401, description: MSG_UNAUTHORIZED })
  async findAll(@Req() req: ITenantRequest, @Query() pagination: PaginationQueryDto) {
    return this.ordersService.findAll(req.tenantId, pagination);
  }

  /** Get a single order by ID. */
  @Get(':id')
  @Version('1')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Order found', type: OrderResponseDto })
  @ApiResponse({ status: 404, description: MSG_ORDER_NOT_FOUND })
  @ApiResponse({ status: 401, description: MSG_UNAUTHORIZED })
  async findOne(@Req() req: ITenantRequest, @Param('id') id: string) {
    return this.ordersService.findOne(req.tenantId, id);
  }

  /** Update an existing order. */
  @Put(':id')
  @Version('1')
  @ApiOperation({ summary: 'Update order' })
  @ApiResponse({ status: 200, description: 'Order updated', type: OrderResponseDto })
  @ApiResponse({ status: 404, description: MSG_ORDER_NOT_FOUND })
  @ApiResponse({ status: 401, description: MSG_UNAUTHORIZED })
  async update(@Req() req: ITenantRequest, @Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(req.tenantId, id, dto);
  }

  /** Soft-delete an order. */
  @Delete(':id')
  @Version('1')
  @ApiOperation({ summary: 'Soft-delete order' })
  @ApiResponse({ status: 200, description: 'Order soft-deleted', type: OrderResponseDto })
  @ApiResponse({ status: 404, description: MSG_ORDER_NOT_FOUND })
  @ApiResponse({ status: 401, description: MSG_UNAUTHORIZED })
  async remove(@Req() req: ITenantRequest, @Param('id') id: string) {
    return this.ordersService.remove(req.tenantId, id);
  }
}
