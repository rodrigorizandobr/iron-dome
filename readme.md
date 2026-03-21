# API AI — Iron Dome (Enterprise Serverless Architecture)

**100% Serverless NestJS** for Fintech/SaaS. Powered by DynamoDB Single Table Design, Multi-tenancy, JWT Auth, Event-Driven Architecture (SNS/SQS), Audit Trail, Terraform IaC, and AWS Lambda.

---

## Summary

- [Quick Start](#quick-start)
- [How to Create a New CRUD Module](#how-to-create-a-new-crud-module)
- [Authentication & Multi-tenancy](#authentication--multi-tenancy)
- [How to Manage Tenants](#how-to-manage-tenants)
- [Database (DynamoDB Single Table)](#database-dynamodb-single-table)
- [Event-Driven Architecture (SNS/SQS)](#event-driven-architecture-snssqs)
- [AWS Providers](#aws-providers)
- [Infrastructure (Terraform)](#infrastructure-terraform)
- [Audit Trail & Security](#audit-trail--security)
- [Practical Examples (cURL)](#practical-examples-curl)
- [Tech Stack](#tech-stack)

---

## Quick Start

### Prerequisites

- Node.js >= 22
- Docker (for LocalStack)
- Terraform CLI

### Step 1: Install Dependencies

\`\`\`bash
npm install
\`\`\`

### Step 2: Environment Setup

\`\`\`bash
cp .env.example .env
\`\`\`

The `.env.example` comes with default values for local development:
\`\`\`env
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
CORS_ORIGINS=\*
\`\`\`

### Step 3: Local Infrastructure (LocalStack)

\`\`\`bash

# Start LocalStack

npm run infra

# Provision resources via Terraform

cd infra/terraform
terraform init
terraform apply -auto-approve
cd ../..
\`\`\`

### Step 4: Run Application

\`\`\`bash
npm run start:dev
\`\`\`
Swagger UI: `http://localhost:3000/doc`

---

## How to Create a New CRUD Module

To create a new module (e.g., `Products`), follow these steps:

### 1. Define the DTOs

Create `create-product.dto.ts` and `update-product.dto.ts` using `class-validator` and `ApiProperty` for Swagger.

### 2. Create the Service

Extend `BaseResourceService`. It provides `create`, `findOne`, `findAll`, `update`, and `remove` out of the box.

\`\`\`typescript
@Injectable()
export class ProductsService extends BaseResourceService<ProductEntity, CreateProductDto, UpdateProductDto> {
constructor(dynamo: DynamoDBProvider, i18n: I18nService) {
// 'PRODUCT' is the entity prefix used for DynamoDB SK (PRODUCT#<id>)
super(dynamo, 'PRODUCT', i18n);
}
}
\`\`\`

### 3. Create the Controller

Ensure it uses `@ApiBearerAuth()` and receives `ITenantRequest`.

\`\`\`typescript
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', required: true })
@Controller('products')
export class ProductsController {
constructor(private readonly service: ProductsService) {}

@Post()
async create(@Req() req: ITenantRequest, @Body() dto: CreateProductDto) {
return this.service.create({ ...dto, tenantId: req.tenantId });
}

@Get()
async findAll(@Req() req: ITenantRequest, @Query() pagination: PaginationQueryDto) {
return this.service.findAll(req.tenantId, pagination);
}
}
\`\`\`

---

## Authentication & Multi-tenancy

### JWT Authentication

All routes are **protected by default**.

- **Global Guard**: `JwtAuthGuard` is registered globally.
- **Bypass**: Use the `@Public()` decorator for public endpoints (like `/health`).
- **Header**: Requests must include `Authorization: Bearer <token>`.

### Multi-tenancy Logic

The system implements logical isolation via headers and DynamoDB Partition Keys.

- **Header**: Every request (except public ones) **MUST** include `x-tenant-id`.
- **Middleware**: Extracts the ID and attaches it to `req.tenantId`.
- **Validation**: If `x-tenant-id` is missing, it triggers an exception in enforced settings.

---

## How to Manage Tenants

In this architecture, **Tenants are managed logically**. There is no "Tenant Table" required to start, although one can be added for metadata.

### 1. Onboarding a New Tenant

To onboard a new tenant (e.g., `acme-corp`):

1.  **Issue a JWT**: The JWT payload must include `{ "tenantId": "acme-corp" }`.
2.  **Client Header**: The client must send `x-tenant-id: acme-corp` in every request.
3.  **Data Isolation**: The first time `acme-corp` creates a resource, the system automatically creates DynamoDB entries with the PK `TENANT#acme-corp#<ENTITY>`.

### 2. Managing Tenant-Specific Config

If you need to store tenant settings (e.g., name, plan, status):

1.  Use a `TenantsService` (extending `BaseResourceService`).
2.  Entities will be stored under PK `TENANT#SYSTEM#TENANT` and SK `TENANT#<tenantId>`.

---

## Database (DynamoDB Single Table)

We use a **Single Table Design** for performance and cost-efficiency.

- **PK**: `TENANT#[tenantId]#[ENTITY_TYPE]` (e.g., `TENANT#123#ORDER`)
- **SK**: `[ENTITY_TYPE]#[id]` (e.g., `ORDER#abc-456`)

### BaseResourceService Features:

- **Cursor Pagination**: Returns `items` and a `cursor` (base64) for the next page.
- **Soft Delete**: `remove()` sets `deleted: true`. Physical deletion never occurs.
- **Timestamps**: Automatically manages `createdAt` and `updatedAt`.

---

## Event-Driven Architecture (SNS/SQS)

### Publishing Events

Use an `EventPublisher` (extending SNS logic) to notify other services.
\`\`\`typescript
await this.sns.publish(topicArn, {
event: 'order.created',
data: { orderId: '123' },
tenantId: 'tenant-abc'
});
\`\`\`

### Consuming Events (SQS)

Extend `SqsConsumerService` to create background workers.

- Set `SQS_CONSUMER_ENABLED=true` in `.env`.
- The consumer will long-poll the queue and trigger `handleMessage()`.

---

## AWS Providers

All providers extend `BaseProvider` to ensure standardized resource naming: `[ENV]-[DOMAIN]-[SUBDOMAIN]-[TYPE]-[NAME]`.

- **S3Provider**: `await this.s3.upload(bucket, key, body)`
- **SNSProvider**: `await this.sns.publish(topic, message)`
- **SQSProvider**: `await this.sqs.sendMessage(queue, message)`
- **OpenAIProvider**: `await this.openai.analyze(text, t)`

---

## Audit Trail

Every CUD (Create, Update, Delete) operation is automatically logged into the Audit Table.

- **Infrastructure**: Fire-and-forget. It won't block the main request.
- **Storage**: PK: `TENANT#[tenantId]#AUDIT`, SK: `AUDIT#[timestamp]#[type]#[id]`.

---

## Practical Examples (cURL)

### Generate a Dev Token

\`\`\`bash
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign(
{ sub: 'user-1', email: 'dev@example.com', tenantId: 'tenant-demo' },
process.env.JWT_SECRET || 'dev-secret-change-me',
{ expiresIn: '1h' }
);
console.log(token);
"
\`\`\`

### Create a Resource

\`\`\`bash
curl -X POST "http://localhost:3000/v1/orders" \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer $TOKEN" \
 -H "x-tenant-id: tenant-demo" \
 -d '{"productName": "Pro Plan", "amount": 2990}'
\`\`\`

---

## Tech Stack

- **NestJS**: Framework
- **DynamoDB**: Single Table Design
- **Terraform**: IaC
- **AWS Lambda**: Runtime
- **SNS/SQS**: Messaging
