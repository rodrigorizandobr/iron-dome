# API AI — Enterprise Serverless Architecture

**100% Serverless NestJS** para Fintech/SaaS. DynamoDB Single Table Design, Multi-tenancy, JWT Auth, Event-Driven (SNS/SQS), Audit Trail, Terraform IaC, Lambda-ready.

---

## Sumário

- [Quick Start](#quick-start)
- [Exemplos Práticos com cURL](#exemplos-práticos-com-curl)
- [Autenticação JWT](#autenticação-jwt)
- [CRUD Completo — Orders](#crud-completo--orders)
- [Paginação Cursor-Based](#paginação-cursor-based)
- [Multi-Tenancy](#multi-tenancy)
- [Health Checks](#health-checks)
- [Event-Driven (SNS/SQS)](#event-driven-snssqs)
- [Audit Trail](#audit-trail)
- [Nomenclatura AWS](#nomenclatura-de-recursos-aws)
- [Arquitetura](#arquitetura)
- [BaseProvider — O Fundamento](#baseprovider--o-fundamento)
- [BaseResourceService — CRUD NoSQL](#baseresourceservice--crud-nosql)
- [Criando um Módulo Novo](#criando-um-módulo-novo)
- [Providers AWS](#providers-aws)
- [i18n (Internacionalização)](#i18n-internacionalização)
- [Segurança e Ofuscação](#segurança-e-ofuscação)
- [Error Codes](#error-codes)
- [Rate Limiting](#rate-limiting)
- [CORS](#cors)
- [Infraestrutura (Terraform)](#infraestrutura-terraform)
- [Deploy Lambda](#deploy-lambda)
- [Testes](#testes)
- [Scripts Disponíveis](#scripts-disponíveis)
- [Swagger](#swagger)
- [Tech Stack](#tech-stack)
- [Recursos Legados (Deployd)](#recursos-legados-deployd)

---

## Quick Start

### Pré-requisitos

- Node.js >= 22
- Docker (para LocalStack)
- Terraform CLI

### 1. Clone e instale

```bash
git clone <repo-url>
cd api-ai
npm install
```

### 2. Configure o ambiente

```bash
cp .env.example .env
```

O `.env.example` já vem com valores padrão para desenvolvimento local:

```env
AWS_REGION=us-east-1
AWS_ENDPOINT=http://localhost:4566
AWS_ACCESS_KEY_ID=dummy
AWS_SECRET_ACCESS_KEY=dummy
NODE_ENV=dev
APP_DOMAIN=fintech
APP_SUBDOMAIN=core
JWT_SECRET=dev-secret-change-me
JWT_EXPIRES_IN=1h
OPENAI_API_KEY=sk-your-key-here
SQS_CONSUMER_ENABLED=false
AWS_ACCOUNT_ID=000000000000
PORT=3000
CORS_ORIGINS=*
```

### 3. Suba a infraestrutura local

```bash
# Sobe LocalStack (DynamoDB, S3, SQS, SNS, Lambda, Secrets Manager)
npm run infra

# Provisiona recursos no LocalStack via Terraform
cd infra/terraform
terraform init
terraform apply -auto-approve
cd ../..
```

### 4. Seed de dados (opcional)

```bash
npm run seed
```

Cria 5 orders de exemplo para o tenant `tenant-demo`.

### 5. Inicie a aplicação

```bash
npm run start:dev
```

A API estará disponível em `http://localhost:3000`.
Swagger UI: `http://localhost:3000/doc`

### 6. Teste rápido

```bash
# Health check (não precisa de auth)
curl http://localhost:3000/v1/health

# Resposta:
# {"status":"ok","timestamp":"2026-03-20T12:00:00.000Z"}
```

---

## Exemplos Práticos com cURL

### Obter um Token JWT (dev)

Em desenvolvimento, gere um token manualmente:

```bash
# Usando Node.js para gerar um token rápido
node -e "
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { sub: 'user-1', email: 'dev@ci9.com', tenantId: 'tenant-demo' },
    process.env.JWT_SECRET || 'dev-secret-change-me',
    { expiresIn: '1h' }
  );
  console.log(token);
"
```

Salve o token numa variável para usar nos exemplos:

```bash
export TOKEN="eyJhbGciOiJIUzI1NiIs..."
export BASE_URL="http://localhost:3000/v1"
export TENANT="tenant-demo"
```

### Criar um pedido

```bash
curl -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" \
  -d '{
    "productName": "Premium Plan",
    "amount": 29900
  }'
```

**Resposta (201):**
```json
{
  "id": "1711929600000",
  "tenantId": "tenant-demo",
  "productName": "Premium Plan",
  "amount": 29900,
  "entityType": "ORDER",
  "createdAt": "2026-03-20T12:00:00.000Z",
  "updatedAt": "2026-03-20T12:00:00.000Z",
  "deleted": false
}
```

### Listar pedidos (com paginação)

```bash
# Primeira página (20 itens por padrão)
curl "$BASE_URL/orders?limit=2" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT"
```

**Resposta (200):**
```json
{
  "items": [
    {
      "id": "order-001",
      "tenantId": "tenant-demo",
      "productName": "Premium Plan",
      "amount": 29900,
      "deleted": false
    },
    {
      "id": "order-002",
      "tenantId": "tenant-demo",
      "productName": "Enterprise Plan",
      "amount": 99900,
      "deleted": false
    }
  ],
  "cursor": "eyJQSyI6eyJTIjoiVEVOQU5UI3RlbmFudC1kZW1vI09SREVSIn19"
}
```

```bash
# Próxima página usando o cursor retornado
curl "$BASE_URL/orders?limit=2&cursor=eyJQSyI6eyJTIjoiVEVOQU5UI3RlbmFudC1kZW1vI09SREVSIn19" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT"
```

### Buscar um pedido por ID

```bash
curl "$BASE_URL/orders/order-001" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT"
```

### Atualizar um pedido

```bash
curl -X PUT "$BASE_URL/orders/order-001" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" \
  -d '{"amount": 34900}'
```

### Soft-delete um pedido

```bash
curl -X DELETE "$BASE_URL/orders/order-001" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT"
```

> O item permanece no DynamoDB com `deleted: true`. Não é removido fisicamente.

### Erros comuns

```bash
# Sem token → 401
curl "$BASE_URL/orders" -H "x-tenant-id: $TENANT"
# {"statusCode":401,"errorCode":"ERR_UNAUTHORIZED","message":"Unauthorized"}

# Body inválido → 400
curl -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" \
  -d '{"productName":"","amount":"abc"}'
# {"statusCode":400,"errorCode":"ERR_VALIDATION","message":["productName should not be empty","amount must be a number"]}

# ID não encontrado → 404
curl "$BASE_URL/orders/nao-existe" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT"
# {"statusCode":404,"errorCode":"ERR_NOT_FOUND","message":"ORDER with ID nao-existe not found"}
```

---

## Autenticação JWT

Todas as rotas são protegidas por JWT por padrão. Rotas públicas usam `@Public()`.

### Fluxo

```
Request → JwtAuthGuard → verifica @Public() metadata
                        → se público: permite
                        → se não: valida Bearer token
                        → extrai payload (sub, email, tenantId)
```

### Payload do token

```typescript
interface IJwtPayload {
  sub: string;        // ID do usuário
  email?: string;     // Email (opcional)
  tenantId?: string;  // Tenant (opcional)
  iat?: number;       // Issued at
  exp?: number;       // Expiration
}
```

### Variáveis de ambiente

```env
JWT_SECRET=sua-chave-secreta       # Obrigatório em produção
JWT_EXPIRES_IN=3600                 # Segundos (padrão: 1h)
```

### Tornando rotas públicas

```typescript
import { Public } from '../../common/guards/public.decorator';

@Public()
@Get('health')
getHealth() {
  return { status: 'ok' };
}
```

---

## CRUD Completo — Orders

### Endpoints

| Método   | Rota              | Descrição              | Auth |
|----------|-------------------|------------------------|------|
| `POST`   | `/v1/orders`      | Criar pedido           | JWT  |
| `GET`    | `/v1/orders`      | Listar (paginado)      | JWT  |
| `GET`    | `/v1/orders/:id`  | Buscar por ID          | JWT  |
| `PUT`    | `/v1/orders/:id`  | Atualizar              | JWT  |
| `DELETE` | `/v1/orders/:id`  | Soft-delete            | JWT  |

### DTOs

**CreateOrderDto:**
```json
{
  "productName": "Widget Pro",
  "amount": 9990
}
```

**UpdateOrderDto (todos opcionais):**
```json
{
  "productName": "Widget Ultra",
  "amount": 14900
}
```

### Ciclo de vida completo

```bash
# 1. Criar
ORDER_ID=$(curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" \
  -d '{"productName":"Widget Pro","amount":9990}' | jq -r '.id')

echo "Criado: $ORDER_ID"

# 2. Buscar
curl -s "$BASE_URL/orders/$ORDER_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" | jq

# 3. Atualizar preço
curl -s -X PUT "$BASE_URL/orders/$ORDER_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" \
  -d '{"amount":14900}' | jq

# 4. Listar todos
curl -s "$BASE_URL/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" | jq

# 5. Soft-delete
curl -s -X DELETE "$BASE_URL/orders/$ORDER_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" | jq

# 6. Tentar buscar novamente → 404
curl -s "$BASE_URL/orders/$ORDER_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" | jq
```

---

## Paginação Cursor-Based

Paginação nativa do DynamoDB via cursor (não offset). Ideal para datasets grandes.

### Parâmetros

| Param    | Tipo   | Default | Descrição                                              |
|----------|--------|---------|--------------------------------------------------------|
| `limit`  | number | 20      | Itens por página (1-100)                               |
| `cursor` | string | —       | Cursor da página anterior (base64 de LastEvaluatedKey) |

### Navegação entre páginas

```bash
# Página 1
RESPONSE=$(curl -s "$BASE_URL/orders?limit=2" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT")

echo "$RESPONSE" | jq '.items | length'  # 2
CURSOR=$(echo "$RESPONSE" | jq -r '.cursor')

# Página 2 (se cursor existir)
if [ "$CURSOR" != "null" ]; then
  curl -s "$BASE_URL/orders?limit=2&cursor=$CURSOR" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tenant-id: $TENANT" | jq
fi
```

### Formato da resposta

```json
{
  "items": [],
  "cursor": "eyJQSyI6..."
}
```

Quando `cursor` é `undefined`, não há mais páginas.

---

## Multi-Tenancy

Isolamento lógico por tenant via PK do DynamoDB. Cada request deve incluir `x-tenant-id`.

### Fluxo

```
Client → Header: x-tenant-id: abc
       → MultiTenancyMiddleware → req.tenantId = 'abc'
       → Controller → Service → DynamoDB PK: TENANT#abc#ORDER
```

### Design de chaves

```
PK: TENANT#[tenantId]#[ENTITY]   →  TENANT#abc#ORDER
SK: [ENTITY]#[id]                →  ORDER#12345
```

Tenant A **nunca** acessa dados do Tenant B — o isolamento é garantido pela PK.

### Exemplo: isolamento entre tenants

```bash
# Tenant A cria um pedido
curl -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: tenant-A" \
  -d '{"productName":"Plano A","amount":100}'

# Tenant B não vê — retorna lista vazia
curl "$BASE_URL/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: tenant-B"
# {"items":[],"cursor":null}
```

---

## Health Checks

Dois endpoints públicos (sem JWT):

### Liveness — `GET /v1/health`

```bash
curl http://localhost:3000/v1/health
# {"status":"ok","timestamp":"2026-03-20T12:00:00.000Z"}
```

### Readiness — `GET /v1/health/ready`

Verifica conectividade real com DynamoDB:

```bash
curl http://localhost:3000/v1/health/ready
```

```json
{
  "status": "ready",
  "uptime": "123.45",
  "dependencies": {
    "dynamodb": {"status": "up"}
  }
}
```

Se DynamoDB estiver fora: `"status": "degraded"` com `"dynamodb": {"status": "down"}`.

---

## Event-Driven (SNS/SQS)

Toda mutação em Orders publica um evento via SNS, consumido via SQS.

### Fluxo

```
OrdersService.create()
  → DynamoDB putItem
  → SNS publish("order.created")
  → SQS queue (subscription)
  → OrderProcessorService.handleMessage()
  → Audit Trail
```

### Eventos publicados

| Evento          | Trigger                     | Dados extras         |
|-----------------|-----------------------------|----------------------|
| order.created   | `POST /v1/orders`           | productName, amount  |
| order.updated   | `PUT /v1/orders/:id`        | —                    |
| order.deleted   | `DELETE /v1/orders/:id`     | —                    |

### Formato do evento

```json
{
  "event": "order.created",
  "orderId": "1711929600000",
  "tenantId": "tenant-demo",
  "timestamp": "2026-03-20T12:00:00.000Z",
  "data": {
    "productName": "Premium Plan",
    "amount": 29900
  }
}
```

### Ativar o consumer SQS

```env
SQS_CONSUMER_ENABLED=true
```

O `OrderProcessorService` começa a pollar a fila automaticamente no startup.

---

## Audit Trail

Toda operação CUD é registrada no DynamoDB automaticamente. Fire-and-forget.

### Design de chaves

```
PK: TENANT#[tenantId]#AUDIT
SK: AUDIT#[timestamp]#[resourceType]#[resourceId]
```

### Exemplo de registro

```json
{
  "PK": "TENANT#tenant-demo#AUDIT",
  "SK": "AUDIT#2026-03-20T12:00:00.000Z#ORDER#order-001",
  "entityType": "AUDIT",
  "action": "CREATE",
  "resourceType": "ORDER",
  "resourceId": "order-001",
  "tenantId": "tenant-demo",
  "timestamp": "2026-03-20T12:00:00.000Z"
}
```

Falhas no audit nunca interrompem o fluxo principal. Entries são imutáveis.

---

## Nomenclatura de Recursos AWS

Todo recurso segue o padrão:

```
[AMBIENTE]-[DOMÍNIO]-[SUBDOMÍNIO]-[TIPO_RECURSO]-[NOME_FUNCIONAL]
```

| Recurso         | Nome Gerado                             |
|-----------------|-----------------------------------------|
| DynamoDB Table  | `dev-fintech-core-dynamodb-main`        |
| S3 Bucket       | `dev-fintech-core-s3-storage`           |
| SQS Queue       | `dev-fintech-core-sqs-order-processor`  |
| SNS Topic       | `dev-fintech-core-sns-order-events`     |
| Lambda Function | `dev-fintech-core-lambda-api-handler`   |

### No código

```typescript
const table  = this.getResourceName('dynamodb', 'main');
const bucket = this.getResourceName('s3', 'storage');
const queue  = this.getResourceName('sqs', 'order-processor');
```

### No Terraform

```hcl
locals {
  resource_prefix = "${var.env}-${var.domain}-${var.subdomain}"
}

resource "aws_dynamodb_table" "main" {
  name = "${local.resource_prefix}-dynamodb-main"
}
```

---

## Arquitetura

```
src/
├── main.ts                              ← Bootstrap HTTP
├── lambda.ts                            ← Bootstrap Lambda
├── app.module.ts                        ← Root module
├── providers/
│   ├── base.provider.ts                 ← Enums + Naming + Logging
│   └── aws/
│       ├── dynamodb.provider.ts         ← putItem, getItem, query, checkHealth
│       ├── s3.provider.ts               ← upload, getObject
│       ├── sqs.provider.ts              ← sendMessage
│       ├── sns.provider.ts              ← publish
│       ├── secrets-manager.provider.ts
│       └── cloudwatch-logs.provider.ts
├── common/
│   ├── core/
│   │   ├── base-resource.service.ts     ← CRUD genérico DynamoDB
│   │   ├── pagination-query.dto.ts      ← limit + cursor DTO
│   │   ├── error-codes.ts              ← ErrorCode enum + registry
│   │   ├── audit-trail.service.ts       ← Audit trail DynamoDB
│   │   ├── i18n.service.ts             ← Traduções
│   │   ├── obfuscation.service.ts       ← Masking dados sensíveis
│   │   └── validate-env.ts             ← Validação env vars
│   ├── guards/
│   │   ├── jwt-auth.guard.ts           ← Guard global JWT
│   │   ├── public.decorator.ts          ← @Public() bypass
│   │   ├── jwt.strategy.ts             ← Passport strategy
│   │   └── auth.module.ts              ← JWT + Guard config
│   ├── filters/
│   │   └── global-exception.filter.ts   ← Erros + ErrorCode + Log
│   ├── middlewares/
│   │   ├── multi-tenancy.middleware.ts  ← x-tenant-id
│   │   └── request-logging.middleware.ts ← HTTP logger
│   ├── consumers/
│   │   └── sqs-consumer.service.ts      ← Base SQS consumer
│   └── i18n/
│       ├── pt-BR.json
│       └── en.json
├── modules/
│   ├── health/                          ← /health + /health/ready
│   └── orders/                          ← CRUD + Events + Audit
│       ├── orders.controller.ts
│       ├── orders.service.ts
│       ├── order-event.publisher.ts     ← SNS publisher
│       ├── order-processor.service.ts   ← SQS consumer
│       ├── orders.service.spec.ts
│       ├── orders.int-spec.ts
│       └── dto/
infra/terraform/main.tf                  ← DynamoDB, S3, SQS, SNS, Lambda, API GW
scripts/seed.ts                          ← Seed de dados LocalStack
```

---

## BaseProvider — O Fundamento

Todos os providers herdam desta classe:

```typescript
export abstract class BaseProvider {
  // Gera nome corporativo
  public getResourceName(resourceType: string, functionalName: string): string;

  // Log padronizado
  protected logOperation(operation: string, details?: Record<string, unknown>): void;

  // Tratamento de erro com stack trace
  protected handleError(operation: string, error: unknown): never;
}
```

### Criando um novo Provider

```typescript
@Injectable()
export class RedisProvider extends BaseProvider {
  constructor(protected readonly configService: ConfigService) {
    super(RedisProvider.name, configService);
  }

  async ping(): Promise<boolean> {
    this.logOperation('ping');
    try {
      // ... lógica
      return true;
    } catch (error) {
      this.handleError('ping', error);
    }
  }
}
```

---

## BaseResourceService — CRUD NoSQL

Herda para ganhar CRUD completo com multi-tenancy, soft-delete e paginação:

```typescript
@Injectable()
export class ProductsService extends BaseResourceService<Product, CreateProductDto, UpdateProductDto> {
  constructor(dynamo: DynamoDBProvider, i18n: I18nService) {
    super(dynamo, 'PRODUCT', i18n);
  }
}
```

### Métodos herdados

| Método                                 | Descrição                                |
|----------------------------------------|------------------------------------------|
| `create(data)`                         | Cria com PK/SK + timestamps + deleted=false |
| `findAll(tenantId, { limit, cursor })` | Query paginada, filtra soft-deleted      |
| `findOne(tenantId, id)`                | GetItem, filtra soft-deleted             |
| `update(tenantId, id, data)`           | Merge + updatedAt                        |
| `remove(tenantId, id)`                 | Soft-delete: `deleted: true`             |

---

## Criando um Módulo Novo

Siga o padrão do módulo Orders. Exemplo: módulo **Products**.

### 1. DTO

```typescript
// src/modules/products/dto/create-product.dto.ts
import { IsString, IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'Widget Pro' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 4990 })
  @IsNumber()
  price!: number;
}
```

### 2. Service

```typescript
// src/modules/products/products.service.ts
@Injectable()
export class ProductsService extends BaseResourceService<IProduct, CreateProductDto, UpdateProductDto> {
  constructor(dynamo: DynamoDBProvider, i18n: I18nService) {
    super(dynamo, 'PRODUCT', i18n);
  }
}
```

### 3. Controller

```typescript
// src/modules/products/products.controller.ts
@ApiBearerAuth()
@ApiTags('products')
@ApiHeader({ name: 'x-tenant-id', required: true })
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Version('1')
  async create(@Req() req: ITenantRequest, @Body() dto: CreateProductDto) {
    return this.productsService.create({ ...dto, tenantId: req.tenantId });
  }

  @Get()
  @Version('1')
  async findAll(@Req() req: ITenantRequest, @Query() pagination: PaginationQueryDto) {
    return this.productsService.findAll(req.tenantId, pagination);
  }
  // ... findOne, update, remove
}
```

### 4. Module + registre no AppModule

```typescript
@Module({
  controllers: [ProductsController],
  providers: [ProductsService, DynamoDBProvider],
})
export class ProductsModule {}
```

Resultado: 5 endpoints REST com multi-tenancy, paginação, soft-delete e Swagger.

---

## Providers AWS

| Provider                  | Métodos principais                           |
|---------------------------|----------------------------------------------|
| `DynamoDBProvider`        | `putItem`, `getItem`, `query`, `checkHealth` |
| `S3Provider`              | `upload`, `getObject`, `getBucketName`       |
| `SQSProvider`             | `sendMessage`, `getQueueName`                |
| `SNSProvider`             | `publish`, `getTopicName`                    |
| `SecretsManagerProvider`  | `getSecret`, `getSecretName`                 |
| `CloudWatchLogsProvider`  | `putLog`, `ensureLogGroup`                   |
| `OpenAIProvider`          | `createChatCompletion`, `analyze`            |

---

## i18n (Internacionalização)

```typescript
const msg = this.i18n.translate('errors.not_found', { model: 'Order', id: '123' });
// → "Order with ID 123 not found" (en)
// → "Order com ID 123 não encontrado" (pt-BR)
```

- Detecção via header `Accept-Language`.
- Catálogos: `src/common/i18n/pt-BR.json` e `en.json`.
- Fallback para inglês.

---

## Segurança e Ofuscação

```typescript
const safe = this.obfuscation.obfuscate({
  name: 'John',
  cpf: '123.456.789-00',
  token: 'eyJhbGci...',
});
// → { name: 'John', cpf: '********', token: '********' }
```

Campos auto-ofuscados: `password`, `secret`, `token`, `key`, `auth`, `credit_card`, `cvv`, `cpf`, `rg`, `document`, `payload`.

---

## Error Codes

Toda resposta de erro inclui `errorCode`:

```json
{
  "statusCode": 404,
  "errorCode": "ERR_NOT_FOUND",
  "timestamp": "2026-03-20T12:00:00.000Z",
  "path": "/v1/orders/xyz",
  "tenantId": "tenant-demo",
  "message": "ORDER with ID xyz not found"
}
```

| ErrorCode                 | HTTP | Descrição                |
|---------------------------|------|--------------------------|
| `ERR_INTERNAL`            | 500  | Erro interno             |
| `ERR_VALIDATION`          | 400  | Validação falhou         |
| `ERR_NOT_FOUND`           | 404  | Recurso não encontrado   |
| `ERR_UNAUTHORIZED`        | 401  | Token ausente/inválido   |
| `ERR_FORBIDDEN`           | 403  | Acesso negado            |
| `ERR_TENANT_REQUIRED`     | 400  | tenantId obrigatório     |
| `ERR_RATE_LIMITED`        | 429  | Muitas requisições       |
| `ERR_SERVICE_UNAVAILABLE` | 503  | Serviço indisponível     |

---

## Rate Limiting

Proteção global: **60 requests por minuto por IP**.

Quando excedido:

```json
{
  "statusCode": 429,
  "errorCode": "ERR_RATE_LIMITED",
  "message": "ThrottlerException: Too Many Requests"
}
```

---

## CORS

Configurável via `CORS_ORIGINS`:

```env
# Dev — permitir tudo
CORS_ORIGINS=*

# Produção — domínios específicos
CORS_ORIGINS=https://app.example.com,https://admin.example.com
```

---

## Infraestrutura (Terraform)

### Recursos provisionados

| Recurso                   | Nome                                         |
|---------------------------|----------------------------------------------|
| DynamoDB Table (+ GSI)    | `dev-fintech-core-dynamodb-main`             |
| S3 Bucket (versioned+SSE) | `dev-fintech-core-s3-storage`                |
| SQS Queue + DLQ           | `dev-fintech-core-sqs-order-processor`       |
| SNS Topic + Subscription  | `dev-fintech-core-sns-order-events`          |
| CloudWatch Log Group      | `/api/dev-fintech-core-logs-api`             |
| Lambda Function           | `dev-fintech-core-lambda-api-handler`        |
| API Gateway v2 (HTTP)     | `dev-fintech-core-apigw-http`                |
| IAM Role + Policies       | `dev-fintech-core-iam-lambda-exec`           |

### Comandos

```bash
cd infra/terraform

# LocalStack
terraform init && terraform apply -auto-approve

# Produção
terraform apply -var="env=prd" -var="domain=fintech" -var="subdomain=payments"
```

---

## Deploy Lambda

A API roda como Lambda via `@codegenie/serverless-express`.

### Build e deploy

```bash
npm run build
cd dist && zip -r lambda.zip . && cd ..
# O zip fica em dist/lambda.zip — referenciado no Terraform
```

### Fluxo na AWS

```
Client → API Gateway v2 (HTTP) → Lambda → NestJS → DynamoDB/S3/SQS/SNS
```

---

## Testes

```bash
npm run test:unit         # Unitários (10 testes)
npm run test:integrated   # Integração (supertest + JWT)
npm run lint              # ESLint (zero warnings)
npm run build             # TypeScript check
```

### Exemplo: teste unitário

```typescript
it('should create an order with tenant isolation', async () => {
  const result = await service.create({
    tenantId: 'tenant-A',
    productName: 'Widget',
    amount: 9990,
  });

  expect(result.tenantId).toBe('tenant-A');
  expect(mockDynamo.putItem).toHaveBeenCalled();
  expect(mockEventPublisher.publishCreated).toHaveBeenCalled();
  expect(mockAudit.record).toHaveBeenCalled();
});
```

### Exemplo: teste de integração

```typescript
it('should reject unauthenticated requests', async () => {
  await request(app.getHttpServer())
    .post('/v1/orders')
    .send({ productName: 'Test', amount: 100 })
    .expect(401);
});

it('should create order with valid token', async () => {
  const { body } = await request(app.getHttpServer())
    .post('/v1/orders')
    .set('Authorization', `Bearer ${token}`)
    .set('x-tenant-id', 'tenant-int')
    .send({ productName: 'Test', amount: 5000 })
    .expect(201);

  expect(body.productName).toBe('Test');
});
```

---

## Scripts Disponíveis

| Script                    | Descrição                            |
|---------------------------|--------------------------------------|
| `npm run start`           | Inicia a aplicação                   |
| `npm run start:dev`       | Modo watch (desenvolvimento)         |
| `npm run start:prod`      | Build compilado                      |
| `npm run build`           | Compila o projeto                    |
| `npm run infra`           | Sobe LocalStack via Docker           |
| `npm run stop`            | Para Docker                          |
| `npm run seed`            | Popula DynamoDB com dados exemplo    |
| `npm run lint`            | ESLint                               |
| `npm run lint:fix`        | ESLint com auto-fix                  |
| `npm run format`          | Prettier                             |
| `npm run test:unit`       | Testes unitários                     |
| `npm run test:integrated` | Testes de integração                 |

---

## Swagger

Acesse `http://localhost:3000/doc` após iniciar a aplicação.

- Autenticação via botão **Authorize** com Bearer Token.
- Todos os endpoints com request/response schemas documentados.
- DTOs com exemplos e validações visíveis.

---

## Tech Stack

| Tecnologia                      | Uso                          |
|---------------------------------|------------------------------|
| NestJS                          | Framework                    |
| TypeScript (strict)             | Linguagem                    |
| DynamoDB                        | Banco (Single Table Design)  |
| S3                              | Storage                      |
| SQS + DLQ                       | Filas assíncronas            |
| SNS                             | Pub/Sub de eventos           |
| CloudWatch Logs                 | Logging centralizado         |
| Terraform                       | Infrastructure as Code       |
| LocalStack                      | Emulação AWS local           |
| JWT / Passport                  | Autenticação                 |
| class-validator                 | Validação de DTOs            |
| Swagger / OpenAPI               | Documentação API             |
| Jest                            | Testes                       |
| ESLint + Prettier               | Qualidade de código          |
| @codegenie/serverless-express   | Lambda adapter               |

---

**Licença:** ISC
