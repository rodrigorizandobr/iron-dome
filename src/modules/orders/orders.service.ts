import { Injectable } from '@nestjs/common';
import { BaseResourceService } from '../../common/core/base-resource.service';
import { DynamoDBProvider } from '../../providers/aws/dynamodb.provider';
import { I18nService } from '../../common/core/i18n.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderEventPublisher } from './order-event.publisher';
import { AuditTrailService } from '../../common/core/audit-trail.service';

/**
 * Represents an Order entity in DynamoDB.
 */
export interface IOrder {
  id: string;
  tenantId: string;
  productName: string;
  amount: number;
  entityType: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}

/**
 * Orders Service — full CRUD for the Order entity.
 * Inherits create, findAll, findOne, update, remove from BaseResourceService.
 * Publishes SNS events on create, update, and remove.
 */
const ORDER_ENTITY = 'ORDER';

@Injectable()
export class OrdersService extends BaseResourceService<IOrder, CreateOrderDto, UpdateOrderDto> {
  constructor(
    dynamo: DynamoDBProvider,
    i18n: I18nService,
    private readonly eventPublisher: OrderEventPublisher,
    private readonly audit: AuditTrailService,
  ) {
    super(dynamo, ORDER_ENTITY, i18n);
  }

  /** Create an order and publish order.created event. */
  async create(data: CreateOrderDto & { id?: string; tenantId?: string }): Promise<IOrder> {
    const result = await super.create(data);
    await this.eventPublisher.publishCreated(result.id, result.tenantId, {
      productName: result.productName,
      amount: result.amount,
    });
    await this.audit.record(result.tenantId, 'CREATE', ORDER_ENTITY, result.id);
    return result;
  }

  /** Update an order and publish order.updated event. */
  async update(tenantId: string, id: string, data: UpdateOrderDto): Promise<IOrder> {
    const result = await super.update(tenantId, id, data);
    await this.eventPublisher.publishUpdated(result.id, result.tenantId);
    await this.audit.record(
      tenantId,
      'UPDATE',
      ORDER_ENTITY,
      id,
      undefined,
      data as unknown as Record<string, unknown>,
    );
    return result;
  }

  /** Soft-delete an order and publish order.deleted event. */
  async remove(tenantId: string, id: string): Promise<IOrder> {
    const result = await super.remove(tenantId, id);
    await this.eventPublisher.publishDeleted(result.id, result.tenantId);
    await this.audit.record(tenantId, 'DELETE', ORDER_ENTITY, id);
    return result;
  }
}
