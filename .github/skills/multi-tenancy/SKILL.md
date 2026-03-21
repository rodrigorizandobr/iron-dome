---
name: 'Multi-Tenancy'
description: 'Skill para implementar e validar isolamento multi-tenant em toda a aplicação. Cobre middleware de extração, PK com tenantId, validação obrigatória no create(), e padrões de acesso isolado no DynamoDB.'
---

# Skill: Multi-Tenancy

## Quando usar esta skill

- Ao criar uma **nova entidade** ou **service** que manipula dados.
- Ao criar ou revisar **controllers** que recebem requisições HTTP.
- Ao verificar se o isolamento de tenants está correto em uma feature.
- Ao depurar problemas de dados onde um tenant acessa dados de outro.

## Princípio Central

> Sem `tenantId`, não é seguro. Todo dado pertence a um tenant.

O isolamento é **lógico** via prefixo na PK do DynamoDB. Não existe database separado por tenant — a separação é por chave.

## Arquitetura

```
HTTP Request
  │ Header: x-tenant-id: abc-123
  │ Header: Authorization: Bearer <jwt-token>
  ▼
JwtAuthGuard (global APP_GUARD — validates JWT, @Public() bypass)
  ▼
MultiTenancyMiddleware (extrai header → req.tenantId)
  ▼
Controller (acessa req.tenantId via ITenantRequest tipado)
  ▼
Service extends BaseResourceService
  ▼
DynamoDB PK: TENANT#abc-123#ORDER
```

## Componentes

### 1. MultiTenancyMiddleware (`src/common/middlewares/multi-tenancy.middleware.ts`)

Extrai o header `x-tenant-id` e injeta `tenantId` no objeto `req`:

```typescript
@Injectable()
export class MultiTenancyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'] || 'default';
    (req as any).tenantId = tenantId;
    next();
  }
}
```

> Registrado globalmente no `AppModule.configure()`.

### 2. Validação no BaseResourceService

O método `create()` **exige** `tenantId` no DTO. Sem ele → `BadRequestException`:

```typescript
async create(data: any): Promise<T> {
  const tenantId = data.tenantId;
  if (!tenantId) {
    throw new BadRequestException('Tenant isolation requires tenantId');
  }
  // PK gerada com tenantId
  const item = {
    ...data,
    PK: this.getPk(tenantId), // TENANT#abc#ORDER
    SK: this.getSk(id),       // ORDER#001
  };
}
```

### 3. Isolamento na PK (DynamoDB)

| Operação  | Chave usada                      | Isolamento                        |
| --------- | -------------------------------- | --------------------------------- |
| `create`  | PK: `TENANT#[tenantId]#[ENTITY]` | ✅ Tenant no PK                   |
| `findOne` | PK + SK                          | ✅ Acessa apenas dados do tenant  |
| `findAll` | Query por PK                     | ✅ Retorna apenas dados do tenant |
| `update`  | PK + SK (via `findOne` primeiro) | ✅ Validado antes do update       |
| `remove`  | PK + SK (via `findOne` primeiro) | ✅ Soft-delete isolado            |

## Como usar no Controller

```typescript
import { Request } from 'express';
import { PaginationQueryDto } from '../../common/core/pagination-query.dto';

/** Extended request type with tenantId from MultiTenancyMiddleware. */
interface ITenantRequest extends Request {
  tenantId: string;
}

@ApiBearerAuth()
@ApiTags('orders')
@ApiHeader({ name: 'x-tenant-id', required: true, description: 'Tenant identifier' })
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async findAll(@Req() req: ITenantRequest, @Query() pagination: PaginationQueryDto) {
    return this.ordersService.findAll(req.tenantId, pagination);
  }

  @Post()
  async create(@Req() req: ITenantRequest, @Body() dto: CreateOrderDto) {
    return this.ordersService.create({
      ...dto,
      tenantId: req.tenantId,
    } as unknown as CreateOrderDto);
  }

  @Get(':id')
  async findOne(@Req() req: ITenantRequest, @Param('id') id: string) {
    return this.ordersService.findOne(req.tenantId, id);
  }
}
```

**IMPORTANT**: Always use `ITenantRequest` typed interface. NEVER use `(req as any).tenantId`.

## Regras de Validação (Checklist)

- [ ] Toda requisição HTTP passa pelo `MultiTenancyMiddleware`.
- [ ] Todo `create()` recebe `tenantId` no DTO.
- [ ] Todo `findAll()`, `findOne()`, `update()`, `remove()` recebe `tenantId` como primeiro parâmetro.
- [ ] A PK contém `TENANT#[tenantId]#[ENTITY]` — nunca apenas o entityName.
- [ ] Controllers usam `ITenantRequest` tipado (NUNCA `(req as any).tenantId`).
- [ ] Controllers têm `@ApiBearerAuth()` no class level (JWT obrigatório).
- [ ] Nenhuma query usa Scan (full table scan) — sempre Query filtrada por PK.
- [ ] O GSI1 (cross-tenant) é reservado para operações administrativas com controle de acesso.

## Anti-Patterns (NUNCA fazer)

```typescript
// ❌ ERRADO: Scan sem filtro de tenant
await this.dynamo.scan(tableName);

// ❌ ERRADO: Query sem tenantId na PK
await this.dynamo.query(tableName, 'ORDER');

// ❌ ERRADO: Criar sem tenantId
await this.ordersService.create({ productName: 'X', amount: 10 });

// ❌ ERRADO: Usar (req as any).tenantId
const tenantId = (req as any).tenantId;

// ✅ CORRETO: Sempre com tenantId via ITenantRequest
async findAll(@Req() req: ITenantRequest) {
  return this.ordersService.findAll(req.tenantId);
}
await this.ordersService.create({ tenantId: 'abc', productName: 'X', amount: 10 });
```

## Testes

Ao testar, sempre verifique isolamento entre tenants:

```typescript
// Cria dados para tenant-A
await service.create({ tenantId: 'tenant-A', name: 'Item A' });

// Cria dados para tenant-B
await service.create({ tenantId: 'tenant-B', name: 'Item B' });

// tenant-A só vê seus dados (PaginatedResult)
const resultA = await service.findAll('tenant-A');
expect(resultA.items).toHaveLength(1);
expect(resultA.items[0].name).toBe('Item A');

// tenant-B só vê seus dados
const resultB = await service.findAll('tenant-B');
expect(resultB.items).toHaveLength(1);
expect(resultB.items[0].name).toBe('Item B');
```
