---
description: 'Workflow pattern para todos os agentes de desenvolvimento. Integra architetura (api-guardian), qualidade (code-quality), e CI compliance.'
name: 'Agent Development Workflow'
---

# Agent Development Workflow — Passo a Passo

Todo agente de desenvolvimento (dev, dev-test, testing, pr) deve seguir este workflow para garantir que o código gerado passe em 100% nos gates de CI.

---

## 🎯 Fase 1: Scoping & Architecture

**Objetivo**: Entender o que será construído e validar contra regras arquiteturais.

### 1.1 Ler a Issue

- Título, descrição, critérios de aceitação
- Link para skills/padrões relevantes

### 1.2 Consultar API Guardian

Arquivo: `.github/agents/api-guardian.agent.md`

**Validar:**

- ✅ Database: DynamoDB não relacional?
- ✅ Auth: JWT + multi-tenant?
- ✅ Events: SNS/SQS para CUD?
- ✅ Audit: AuditTrailService em operações?
- ✅ i18n: Mensagens via I18nService.translate()?
- ✅ Soft-delete: Nunca delete físico?
- ✅ Naming: AWS resources via BaseProvider.getResourceName()?

### 1.3 Validar Padrões Relevantes

Baseado no escopo da task, revisar skills:

| Task Type                | Skills a Ler                                           |
| ------------------------ | ------------------------------------------------------ |
| Novo módulo CRUD         | `new-module`, `dynamodb-single-table`, `multi-tenancy` |
| Novo provider AWS        | `provider-architecture`, `aws-naming`                  |
| Security/sensitive dados | `data-obfuscation`                                     |
| Message/logging          | `i18n`                                                 |
| Soft-delete requirement  | `soft-delete`                                          |
| Terraform resource       | `terraform-iac`                                        |

### 1.4 Criar Plano de Arquitetura

Documento o design:

```
Task: Implement Order CRUD API

Design:
1. Service: OrdersService extends BaseResourceService
   - PK: TENANT#[tenantId]#ORDER
   - SK: ORDER#[id]
   - Soft-delete via deleted flag

2. Events: OrderEventPublisher (SNS)
   - order.created, order.updated, order.deleted

3. Audit: AuditTrailService.record() on create/update/delete

4. i18n: All user messages via I18nService.translate()

5. Files:
   - orders.service.ts (max 200 lines)
   - orders.controller.ts (max 200 lines)
   - order-event.publisher.ts (max 150 lines)
   - orders.service.spec.ts (85%+ coverage)
   - orders.int-spec.ts (80%+ coverage)
```

---

## 🛠️ Fase 2: Implementation

**Objetivo**: Escrever código que passa em _todos_ os 6 CI gates localmente.

### 2.1 Setup Ambiente Local

```bash
# Clone repo
git clone https://github.com/iron-dome/api-ai.git
cd api-ai

# Install deps
npm ci

# Start LocalStack (DynamoDB emulation)
docker-compose up -d

# Verify env
cat .env.example | head -20
```

### 2.2 Create Branch & Scaffold

```bash
git checkout -b feat/issue-123-order-crud
mkdir -p src/modules/orders/dto
```

### 2.3 Implement Service (BaseResourceService)

**File**: `src/modules/orders/orders.service.ts` (max 200 lines)

**Checklist:**

- [ ] Extends `BaseResourceService`
- [ ] Constructor receives: `DynamoDBProvider`, `I18nService`, `OrderEventPublisher`, `AuditTrailService`
- [ ] Inject dependencies via constructor
- [ ] Override `create()`, `update()`, `remove()`
- [ ] Call `EventPublisher.publish*()` in each method
- [ ] Call `AuditTrailService.record()` (fire-and-forget)
- [ ] JSDoc on all public methods
- [ ] Complexity < 15, lines < 200

**Template:**

```typescript
/**
 * OrdersService — Manages orders with soft-delete, audit, and events.
 */
@Injectable()
export class OrdersService extends BaseResourceService {
  private static readonly ENTITY = 'ORDER';

  constructor(
    dynamo: DynamoDBProvider,
    i18n: I18nService,
    private readonly eventPublisher: OrderEventPublisher,
    private readonly auditTrail: AuditTrailService,
  ) {
    super(dynamo, OrdersService.ENTITY, i18n);
  }

  /**
   * Create a new order.
   * @param tenantId — Tenant isolation
   * @param data — Order creation payload
   * @returns Created order
   */
  async create(tenantId: string, data: CreateOrderDto) {
    // Validate tenantId presence
    // Call super.create(tenantId, data)
    // Publish event: await this.eventPublisher.publishCreated(...)
    // Record audit: await this.auditTrail.record(...)
    // Return result
  }
  // ... update(), remove() similar
}
```

### 2.4 Implement Controller

**File**: `src/modules/orders/orders.controller.ts` (max 200 lines)

**Checklist:**

- [ ] Add `@ApiBearerAuth()` at class level
- [ ] Use `@Body() data: CreateOrderDto` for POST
- [ ] Use `@Query() pagination: PaginationQueryDto` for GET list
- [ ] Inject service via constructor
- [ ] All endpoints return typed `OrderResponseDto`
- [ ] Use `ITenantRequest` interface (never `(req as any).tenantId`)
- [ ] Add Swagger docs (`@ApiOperation`, `@ApiResponse`)
- [ ] Max 200 lines, < 15 complexity

**Template:**

```typescript
@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Create a new order.
   */
  @Post()
  @ApiOperation({ summary: 'Create order' })
  @ApiResponse({ status: 201, type: OrderResponseDto })
  async create(
    @Body() data: CreateOrderDto,
    @Req() req: ITenantRequest,
  ): Promise<OrderResponseDto> {
    const result = await this.ordersService.create(req.tenantId, data);
    return result as OrderResponseDto;
  }
  // ... other endpoints
}
```

### 2.5 Implement Event Publisher

**File**: `src/modules/orders/order-event.publisher.ts` (< 150 lines)

**Checklist:**

- [ ] Extends optional pattern (standalone provider)
- [ ] Inject `SNSProvider` via constructor
- [ ] Define event constants: `EVENT_CREATED`, `EVENT_UPDATED`, `EVENT_DELETED`
- [ ] Define topic name constant: `TOPIC_NAME`
- [ ] Methods: `publishCreated()`, `publishUpdated()`, `publishDeleted()`
- [ ] Fire-and-forget (catch errors, log, don't throw)

### 2.6 Implement Tests

#### Unit Tests: `orders.service.spec.ts`

- [ ] Mock: `DynamoDBProvider`, `I18nService`, `OrderEventPublisher`, `AuditTrailService`
- [ ] Test: `create()`, `findOne()`, `findAll()`, `update()`, `remove()`
- [ ] Coverage: ≥ 85% (branches, functions, lines, statements)
- [ ] Verify: `eventPublisher.publishCreated()` is called
- [ ] Verify: `auditTrail.record()` is called

#### Integration Tests: `orders.int-spec.ts`

- [ ] Setup: Create NestJS test app with real modules
- [ ] Test: POST/GET/PUT/DELETE /v1/orders endpoints
- [ ] Verify: Database persistence
- [ ] Verify: Multi-tenant isolation
- [ ] Coverage: ≥ 80%

**Example unit test:**

```typescript
it('should create order with tenant isolation', async () => {
  const result = await service.create({
    tenantId: 'tenant-1',
    productName: 'Widget',
    amount: 9990,
  } as never);

  expect(result.tenantId).toBe('tenant-1');
  expect(result.productName).toBe('Widget');
  expect(mockEventPublisher.publishCreated).toHaveBeenCalled();
  expect(mockAuditTrail.record).toHaveBeenCalled();
});
```

---

## ✅ Fase 3: Local Validation (Pre-Commit Checklist)

**Objective**: Ensure all 6 CI gates pass BEFORE pushing.

### 3.1 Format Code

```bash
npm run format
npm run format -- --check
# Expected: "All matched files use Prettier code style!"
```

### 3.2 Lint Code

```bash
npm run lint
# Expected: ZERO errors, ZERO warnings
# If fails: npm run lint -- --fix (for auto-fixes)
```

### 3.3 Type Check

```bash
npx tsc --noEmit
# Expected: No type errors
```

### 3.4 Unit Tests

```bash
npm run test:unit
# Expected: 10 tests pass, ≥85% coverage
```

### 3.5 Integration Tests

```bash
npm run test:integrated
# Expected: Integration tests pass, ≥80% coverage
```

### 3.6 Security Scan

```bash
npm run lint  # Includes no-secrets
# Expected: No hardcoded secrets, API keys, passwords
```

---

## 📤 Fase 4: Commit & Push

### 4.1 Stage Files

```bash
git add -A
```

### 4.2 Commit with Conventional Format

**Types**: `feat`, `fix`, `test`, `chore`, `docs`, `refactor`, `ci`

**Example:**

```bash
git commit -m "feat: implement order CRUD API with soft-delete

- Implement OrdersService extending BaseResourceService
- Multi-tenant isolation via TENANT#[tenantId]#ORDER PK
- Soft-delete via deleted flag + updatedAt timestamp
- Publish SNS events on create/update/delete
- Integrate AuditTrailService for tracking
- Add OrderEventPublisher for async processing
- Implement OrdersController with JWT + pagination
- Add unit tests (87% coverage)
- Add integration tests (84% coverage)
- All ESLint/Prettier/TypeScript checks pass"
```

### 4.3 Push to Remote

```bash
git push origin feat/issue-123-order-crud
```

### 4.4 Monitor CI Pipeline

GitHub Actions runs 6 gates:

1. ✅ Prettier format
2. ✅ ESLint lint
3. ✅ TypeScript type-check
4. ✅ Unit tests + coverage
5. ✅ Integration tests + coverage
6. ✅ Security scan

**If any gate fails:**

1. Read CI error message carefully
2. Consult [CI-COMPLIANCE.md](.github/CI-COMPLIANCE.md) for fix
3. Apply fix locally
4. Re-run local checklist (3.1-3.6)
5. Commit & push again

---

## 🚀 Fase 5: Pull Request

### 5.1 Create PR

- Title: Same as commit message
- Description: Link to issue, list changes, testing summary
- Reviewers: Request architecture review

### 5.2 Merge Criteria

- ✅ CI: All gates GREEN
- ✅ Code review: Approved
- ✅ Conversations: Resolved
- ✅ Coverage: ≥ 85% unit, ≥ 80% integration

### 5.3 Merge to Main

- Use "Squash and merge" or "Create a merge commit"
- Delete branch after merge

---

## 📚 Reference Files

- [API Guardian](.github/agents/api-guardian.agent.md) — Architecture rules
- [Code Quality Skill](.github/skills/code-quality/SKILL.md) — Testing standards
- [DynamoDB Skill](.github/skills/dynamodb-single-table/SKILL.md) — Data design
- [Multi-Tenancy Skill](.github/skills/multi-tenancy/SKILL.md) — Tenant isolation
- [i18n Skill](.github/skills/i18n/SKILL.md) — Message localization
- [CI Compliance](.github/CI-COMPLIANCE.md) — Full CI reference

---

## ❓ FAQ

**Q: Como saber se meu código pass nas regras arquiteturais?**  
A: Execute `npm run lint`. Se todos ESLint rules passam, a arquitetura está ok.

**Q: Qual é o min coverage para tests passarem?**  
A: Unit: 85%, Integration: 80%. Veja em `jest-unit.json` e `jest-int.json`.

**Q: Di que fazer se um arquivo fica > 200 linhas?**  
A: Dividir em 2+ módulos menores. Exemplo: `Service` + `EventPublisher` + `Processor`.

**Q: Como saber se preciso escrever integration tests?**  
A: Se a feature interage com banco de dados, SNS, SQS, ou API endpoints, precisa de `*.int-spec.ts`.

**Q: Posso usar `any` type?**  
A: NÃO. ESLint bloqueia. Use tipos concretos ou `unknown + type guard`.

**Q: Como adiciono tradução de mensagens?**  
A: Use `I18nService.translate('msg.key')` e adicione a chave em `src/common/i18n/pt-BR.json` e `en.json`.
