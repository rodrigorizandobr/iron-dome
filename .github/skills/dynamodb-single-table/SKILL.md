---
name: "DynamoDB Single Table Design"
description: "Skill para implementar entidades de dados usando Single Table Design no DynamoDB. Cobre PK/SK, GSI, BaseResourceService, Multi-tenancy, Soft-delete e queries performáticas."
---

# Skill: DynamoDB Single Table Design

## Quando usar esta skill
- Ao criar uma **nova entidade de negócio** (Users, Orders, Products, etc).
- Ao projetar **access patterns** para queries no DynamoDB.
- Ao revisar se uma implementação respeita o isolamento de tenants.

## Conceito Central
Uma única tabela DynamoDB serve a **todas as entidades** do subdomínio. A diferenciação é feita via prefixos nas chaves PK e SK.

### Design de Chaves

| Chave | Formato                        | Propósito                              |
|-------|--------------------------------|----------------------------------------|
| PK    | `TENANT#[tenantId]#[ENTITY]`   | Agrupa itens por tenant + entidade     |
| SK    | `[ENTITY]#[id]`                | Identifica o item específico           |
| PK    | `TENANT#[tenantId]#AUDIT`      | Audit trail entries (immutable)        |
| SK    | `AUDIT#[ts]#[type]#[id]`       | Chronological audit ordering           |
| GSI1PK| `entityType`                   | Busca cross-tenant por tipo de entidade|
| GSI1SK| `SK`                           | Ordenação natural pelo ID              |

### Exemplo para a entidade `ORDER`

| PK                      | SK            | entityType | id     | status  |
|-------------------------|---------------|------------|--------|---------|
| `TENANT#abc#ORDER`      | `ORDER#001`   | `ORDER`    | `001`  | `paid`  |
| `TENANT#abc#ORDER`      | `ORDER#002`   | `ORDER`    | `002`  | `pending`|
| `TENANT#xyz#ORDER`      | `ORDER#003`   | `ORDER`    | `003`  | `paid`  |

## Como implementar um novo recurso

### 1. Crie o Service herdando de BaseResourceService

```typescript
import { Injectable } from '@nestjs/common';
import { BaseResourceService } from '../../common/core/base-resource.service';
import { DynamoDBProvider } from '../../providers/aws/dynamodb.provider';
import { I18nService } from '../../common/core/i18n.service';
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

@Injectable()
export class OrdersService extends BaseResourceService<IOrder, CreateOrderDto, UpdateOrderDto> {
  constructor(
    dynamo: DynamoDBProvider,
    i18n: I18nService,
    private readonly eventPublisher: OrderEventPublisher,
    private readonly audit: AuditTrailService,
  ) {
    super(dynamo, 'ORDER', i18n);
    //                ^^^^^ Este é o entityName usado nas PK/SK
  }

  /** Override CUD methods to publish events and record audit trail. */
  async create(data: CreateOrderDto & { id?: string; tenantId?: string }): Promise<IOrder> {
    const result = await super.create(data);
    await this.eventPublisher.publishCreated(result.id, result.tenantId, { ... });
    await this.audit.record(result.tenantId, 'CREATE', 'ORDER', result.id);
    return result;
  }
}
```

### 2. O que você ganha automaticamente

| Método    | Operação DynamoDB | Descrição                                |
|-----------|-------------------|------------------------------------------|
| `create`  | PutItem           | Insere com PK/SK, timestamps, `deleted: false` |
| `findOne` | GetItem           | Busca por PK+SK, filtra soft-deleted     |
| `findAll` | Query             | Query pela PK do tenant, filtra deleted, **cursor-based pagination** |
| `update`  | PutItem           | Merge com dados existentes + updatedAt   |
| `remove`  | PutItem           | Soft-delete: `deleted: true`             |

### 3. Atributos automáticos em todo item

```json
{
  "PK": "TENANT#abc#ORDER",
  "SK": "ORDER#001",
  "id": "001",
  "entityType": "ORDER",
  "createdAt": "2026-03-19T12:00:00.000Z",
  "updatedAt": "2026-03-19T12:00:00.000Z",
  "deleted": false,
  "tenantId": "abc",
  "productName": "Widget",
  "amount": 100
}
```

## Regras Invioláveis
1. **NUNCA** crie mais de uma tabela por subdomínio. Use Single Table Design.
2. **NUNCA** crie um item sem `tenantId`. O `BaseResourceService` lança `BadRequestException` automaticamente.
3. **NUNCA** delete fisicamente. O `remove()` faz soft-delete com `deleted: true`.
4. **SEMPRE** use `marshall()` / `unmarshall()` do `@aws-sdk/util-dynamodb` para conversão de tipos.
5. O nome da tabela vem de `this.dynamo.getResourceName('dynamodb', 'main')`. Nunca hardcode.
6. `findAll` retorna `PaginatedResult<T>` com `{ items: T[], cursor?: string }`, **NUNCA** `T[]`.
7. O cursor é base64 do `LastEvaluatedKey` do DynamoDB.
8. Controllers usam `@Query() pagination: PaginationQueryDto` (limit + cursor) no `findAll`.
9. O entity type `AUDIT` (PK: `TENANT#[tenantId]#AUDIT`) é reservado para audit trail — imutável.
