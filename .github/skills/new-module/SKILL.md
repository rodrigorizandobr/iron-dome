---
name: "New Module Generator"
description: "Skill para criar um módulo CRUD completo (Deployd-style) a partir de apenas um nome de entidade. Gera Service, Controller, Module, DTOs, Response DTO, Event Publisher, SQS Processor, i18n keys, e testes — tudo integrado com DynamoDB, JWT Auth, Pagination, Audit Trail, Event-Driven Architecture, Multi-tenancy, Soft-delete e i18n."
---

# Skill: New Module Generator (Deployd-style)

## Quando usar esta skill
- Quando o usuário diz: **"cria um módulo de Orders"**, **"preciso de CRUD de Products"**, **"adiciona Users"**.
- Quando alguém pede para criar uma **nova entidade de negócio** com REST API.
- Este é o skill mais importante — transforma um nome em API completa.

## Filosofia Deployd
> **1 nome → API CRUD completa.** Sem boilerplate manual. O copilot gera tudo.

Deployd: `dpd create /orders` → API pronta.  
API AI: `"cria módulo orders"` → Copilot gera 8 arquivos → API pronta.

## O que será gerado

Para uma entidade chamada `Order`:

```
src/modules/orders/
├── orders.module.ts              ← NestJS Module (com providers de eventos e auditoria)
├── orders.service.ts             ← Service extends BaseResourceService (+ SNS + Audit)
├── orders.controller.ts          ← REST Controller com JWT, Swagger, Pagination
├── order-event.publisher.ts      ← SNS Event Publisher (lifecycle events)
├── order-processor.service.ts    ← SQS Consumer (async event processing)
├── dto/
│   ├── create-order.dto.ts       ← DTO de criação (class-validator)
│   ├── update-order.dto.ts       ← DTO de atualização (Partial)
│   └── order-response.dto.ts     ← Response DTO (Swagger docs)
└── orders.service.spec.ts        ← Testes unitários
```

Plus: chaves i18n em `en.json` e `pt-BR.json`.

---

## Receita Completa (Copie e Adapte)

Substitua `Order`/`ORDER`/`orders` pelo nome da sua entidade.

### 1. DTOs (`src/modules/orders/dto/create-order.dto.ts`)

```typescript
import { IsString, IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ description: 'Product name' })
  @IsString()
  @IsNotEmpty()
  productName: string;

  @ApiProperty({ description: 'Order amount' })
  @IsNumber()
  amount: number;
}
```

### 2. Update DTO (`src/modules/orders/dto/update-order.dto.ts`)

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateOrderDto } from './create-order.dto';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {}
```

### 3. Response DTO (`src/modules/orders/dto/order-response.dto.ts`)

```typescript
import { ApiProperty } from '@nestjs/swagger';

/** Response DTO representing an Order in API responses. */
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
```

### 4. Event Publisher (`src/modules/orders/order-event.publisher.ts`)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SNSProvider } from '../../providers/aws/sns.provider';

/** Standard event payload published to SNS. */
export interface IOrderEvent {
  event: string;
  orderId: string;
  tenantId: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

/**
 * Order Event Publisher — publishes order lifecycle events to SNS.
 * Topic: `[env]-fintech-core-sns-order-events`
 */
@Injectable()
export class OrderEventPublisher {
  private readonly logger = new Logger(OrderEventPublisher.name);
  private readonly topicArn: string;

  constructor(
    private readonly sns: SNSProvider,
    private readonly configService: ConfigService,
  ) {
    const topicName = this.sns.getTopicName('order-events');
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const accountId = this.configService.get<string>('AWS_ACCOUNT_ID', '000000000000');
    this.topicArn = `arn:aws:sns:${region}:${accountId}:${topicName}`;
  }

  /** Publish an order.created event. */
  async publishCreated(orderId: string, tenantId: string, data?: Record<string, unknown>) {
    return this.publishEvent('order.created', orderId, tenantId, data);
  }

  /** Publish an order.updated event. */
  async publishUpdated(orderId: string, tenantId: string, data?: Record<string, unknown>) {
    return this.publishEvent('order.updated', orderId, tenantId, data);
  }

  /** Publish an order.deleted event. */
  async publishDeleted(orderId: string, tenantId: string) {
    return this.publishEvent('order.deleted', orderId, tenantId);
  }

  /** Generic event publisher. Fire-and-forget — logs errors but never throws. */
  private async publishEvent(
    event: string, orderId: string, tenantId: string, data?: Record<string, unknown>,
  ) {
    const payload: IOrderEvent = {
      event, orderId, tenantId, timestamp: new Date().toISOString(), data,
    };
    try {
      await this.sns.publish(this.topicArn, payload as unknown as Record<string, unknown>);
      this.logger.log(`Published ${event} for order ${orderId}`);
    } catch (error) {
      this.logger.error(`Failed to publish ${event}: ${(error as Error).message}`);
    }
  }
}
```

### 5. SQS Processor (`src/modules/orders/order-processor.service.ts`)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SqsConsumerService, ISqsMessage } from '../../common/consumers/sqs-consumer.service';

/**
 * Order Processor — consumes messages from the order-processor SQS queue.
 * Handles order lifecycle events (created, updated, deleted).
 */
@Injectable()
export class OrderProcessorService extends SqsConsumerService {
  private readonly processorLogger = new Logger(OrderProcessorService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  /** Process order events from the queue. */
  protected async handleMessage(message: ISqsMessage): Promise<void> {
    const { body, messageId } = message;
    const event = body.event as string;
    const orderId = body.orderId as string;

    this.processorLogger.log(
      `Processing event=${event} orderId=${orderId} messageId=${messageId}`,
    );

    switch (event) {
      case 'order.created':
        await this.onOrderCreated(body);
        break;
      case 'order.updated':
        await this.onOrderUpdated(body);
        break;
      case 'order.deleted':
        await this.onOrderDeleted(body);
        break;
      default:
        this.processorLogger.warn(`Unknown event: ${event}`);
    }
  }

  private async onOrderCreated(body: Record<string, unknown>) {
    this.processorLogger.log(`Order created: ${body.orderId}`);
  }

  private async onOrderUpdated(body: Record<string, unknown>) {
    this.processorLogger.log(`Order updated: ${body.orderId}`);
  }

  private async onOrderDeleted(body: Record<string, unknown>) {
    this.processorLogger.log(`Order deleted: ${body.orderId}`);
  }
}
```

### 6. Service (`src/modules/orders/orders.service.ts`)

```typescript
import { Injectable } from '@nestjs/common';
import { BaseResourceService } from '../../common/core/base-resource.service';
import { DynamoDBProvider } from '../../providers/aws/dynamodb.provider';
import { I18nService } from '../../common/core/i18n.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderEventPublisher } from './order-event.publisher';
import { AuditTrailService } from '../../common/core/audit-trail.service';

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
@Injectable()
export class OrdersService extends BaseResourceService<IOrder, CreateOrderDto, UpdateOrderDto> {
  constructor(
    dynamo: DynamoDBProvider,
    i18n: I18nService,
    private readonly eventPublisher: OrderEventPublisher,
    private readonly audit: AuditTrailService,
  ) {
    super(dynamo, 'ORDER', i18n);
  }

  /** Create an order and publish order.created event. */
  async create(data: CreateOrderDto & { id?: string; tenantId?: string }): Promise<IOrder> {
    const result = await super.create(data);
    await this.eventPublisher.publishCreated(result.id, result.tenantId, {
      productName: result.productName,
      amount: result.amount,
    });
    await this.audit.record(result.tenantId, 'CREATE', 'ORDER', result.id);
    return result;
  }

  /** Update an order and publish order.updated event. */
  async update(tenantId: string, id: string, data: UpdateOrderDto): Promise<IOrder> {
    const result = await super.update(tenantId, id, data);
    await this.eventPublisher.publishUpdated(result.id, result.tenantId);
    await this.audit.record(tenantId, 'UPDATE', 'ORDER', id, undefined, data as unknown as Record<string, unknown>);
    return result;
  }

  /** Soft-delete an order and publish order.deleted event. */
  async remove(tenantId: string, id: string): Promise<IOrder> {
    const result = await super.remove(tenantId, id);
    await this.eventPublisher.publishDeleted(result.id, result.tenantId);
    await this.audit.record(tenantId, 'DELETE', 'ORDER', id);
    return result;
  }
}
```

> **Every CUD operation** publishes an SNS event and records an audit trail entry.

### 7. Controller (`src/modules/orders/orders.controller.ts`)

```typescript
import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Req, Query, Version,
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

/**
 * Orders REST Controller.
 * All endpoints require JWT auth + `x-tenant-id` header.
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
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Req() req: ITenantRequest, @Body() dto: CreateOrderDto) {
    return this.ordersService.create({ ...dto, tenantId: req.tenantId } as unknown as CreateOrderDto);
  }

  /** List all orders for the current tenant (paginated). */
  @Get()
  @Version('1')
  @ApiOperation({ summary: 'List all orders (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated orders list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Req() req: ITenantRequest, @Query() pagination: PaginationQueryDto) {
    return this.ordersService.findAll(req.tenantId, pagination);
  }

  /** Get a single order by ID. */
  @Get(':id')
  @Version('1')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Order found', type: OrderResponseDto })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(@Req() req: ITenantRequest, @Param('id') id: string) {
    return this.ordersService.findOne(req.tenantId, id);
  }

  /** Update an existing order. */
  @Put(':id')
  @Version('1')
  @ApiOperation({ summary: 'Update order' })
  @ApiResponse({ status: 200, description: 'Order updated', type: OrderResponseDto })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @Req() req: ITenantRequest,
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ordersService.update(req.tenantId, id, dto);
  }

  /** Soft-delete an order. */
  @Delete(':id')
  @Version('1')
  @ApiOperation({ summary: 'Soft-delete order' })
  @ApiResponse({ status: 200, description: 'Order soft-deleted', type: OrderResponseDto })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async remove(@Req() req: ITenantRequest, @Param('id') id: string) {
    return this.ordersService.remove(req.tenantId, id);
  }
}
```

**Diferenças críticas vs versão anterior**:
- `@ApiBearerAuth()` — JWT obrigatório (global via `AuthModule`)
- `ITenantRequest` — interface tipada (sem `as any`)
- `@Query() pagination: PaginationQueryDto` — paginação cursor-based no `findAll`
- `OrderResponseDto` — tipo na `@ApiResponse` para Swagger docs
- `@ApiResponse({ status: 401 })` — documentação do JWT auth

### 8. Module (`src/modules/orders/orders.module.ts`)

```typescript
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { DynamoDBProvider } from '../../providers/aws/dynamodb.provider';
import { SNSProvider } from '../../providers/aws/sns.provider';
import { OrderEventPublisher } from './order-event.publisher';
import { OrderProcessorService } from './order-processor.service';
import { AuditTrailService } from '../../common/core/audit-trail.service';

/**
 * Orders Module — full CRUD + event-driven architecture.
 * Publishes SNS events on mutations, consumes SQS for async processing.
 */
@Module({
  controllers: [OrdersController],
  providers: [
    OrdersService,
    DynamoDBProvider,
    SNSProvider,
    OrderEventPublisher,
    OrderProcessorService,
    AuditTrailService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
```

### 9. Register in AppModule (`src/app.module.ts`)

```typescript
import { OrdersModule } from './modules/orders/orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    AuthModule,     // ← JWT global (APP_GUARD)
    HealthModule,
    OrdersModule,   // ← Your new module
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // ← Rate limiting
    // ... global providers
  ],
})
```

### 10. i18n Keys

Add to both `src/common/i18n/en.json` and `pt-BR.json`:

```json
// en.json — add under "orders"
"orders": {
  "created": "Order {id} created successfully",
  "updated": "Order {id} updated successfully",
  "deleted": "Order {id} removed successfully"
}
```

```json
// pt-BR.json
"orders": {
  "created": "Pedido {id} criado com sucesso",
  "updated": "Pedido {id} atualizado com sucesso",
  "deleted": "Pedido {id} removido com sucesso"
}
```

### 11. Unit Test (`src/modules/orders/orders.service.spec.ts`)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { DynamoDBProvider } from '../../providers/aws/dynamodb.provider';
import { I18nService } from '../../common/core/i18n.service';
import { OrderEventPublisher } from './order-event.publisher';
import { AuditTrailService } from '../../common/core/audit-trail.service';
import { BadRequestException } from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;
  const mockDynamo = {
    getResourceName: jest.fn().mockReturnValue('test-table'),
    putItem: jest.fn().mockResolvedValue({}),
    getItem: jest.fn(),
    query: jest.fn(),
  };
  const mockEventPublisher = {
    publishCreated: jest.fn().mockResolvedValue(undefined),
    publishUpdated: jest.fn().mockResolvedValue(undefined),
    publishDeleted: jest.fn().mockResolvedValue(undefined),
  };
  const mockAudit = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: DynamoDBProvider, useValue: mockDynamo },
        { provide: I18nService, useValue: { translate: (k: string) => k } },
        { provide: OrderEventPublisher, useValue: mockEventPublisher },
        { provide: AuditTrailService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw if tenantId is missing on create', async () => {
    await expect(service.create({ productName: 'X', amount: 10 } as any))
      .rejects.toThrow(BadRequestException);
  });

  it('should create with tenant isolation and publish event', async () => {
    const result = await service.create({
      tenantId: 'tenant-A', productName: 'Widget', amount: 50,
    } as any);
    expect(result.tenantId).toBe('tenant-A');
    expect(result.deleted).toBe(false);
    expect(mockEventPublisher.publishCreated).toHaveBeenCalledWith(
      result.id, 'tenant-A', { productName: 'Widget', amount: 50 },
    );
    expect(mockAudit.record).toHaveBeenCalledWith(
      'tenant-A', 'CREATE', 'ORDER', result.id,
    );
  });
});
```

---

## Checklist Instantâneo

Ao criar um módulo, confirme:

- [ ] Service herda de `BaseResourceService` com entityName CORRETO
- [ ] Service injeta `EventPublisher` e `AuditTrailService` e overrides CUD methods
- [ ] Controller usa `ITenantRequest` tipado (sem `as any`) em TODOS os métodos
- [ ] Controller tem `@ApiBearerAuth()` no class level
- [ ] Controller `findAll` aceita `@Query() pagination: PaginationQueryDto`
- [ ] Controller `@ApiResponse` usa `OrderResponseDto` como `type` e inclui `401`
- [ ] DTOs usam `class-validator` e `@ApiProperty` do Swagger
- [ ] Response DTO criado em `dto/[entity]-response.dto.ts`
- [ ] Event Publisher criado com métodos `publishCreated/Updated/Deleted`
- [ ] SQS Processor criado estendendo `SqsConsumerService`
- [ ] Module inclui: DynamoDBProvider, SNSProvider, EventPublisher, Processor, AuditTrailService
- [ ] Module registrado no `AppModule.imports`
- [ ] Chaves i18n adicionadas em AMBOS catálogos
- [ ] Teste unitário cobre create, findAll, tenant isolation, e event publishing
- [ ] `npm run lint` → ZERO warnings

## Resultado

Depois de seguir esta receita, você terá:

```bash
# POST   /v1/orders          → create (JWT + tenantId + SNS event + audit)
# GET    /v1/orders          → findAll (paginated, cursor-based)
# GET    /v1/orders/:id      → findOne (filtered by tenant + soft-delete)
# PUT    /v1/orders/:id      → update (merge + SNS event + audit)
# DELETE /v1/orders/:id      → soft-delete (deleted: true + SNS event + audit)
#
# Swagger: http://localhost:3000/doc (with JWT lock icon)
```

**Zero configuração extra.** DynamoDB, JWT Auth, Pagination, Audit Trail, SNS Events, Multi-tenancy, Soft-delete, i18n, Rate Limiting, Validation — tudo incluso.
