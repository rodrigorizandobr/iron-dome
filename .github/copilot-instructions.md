# Copilot Instructions — API AI (Iron Dome)

## About This Project
This is a **100% Serverless NestJS API** for Fintech/SaaS. No relational databases. No Prisma. Only DynamoDB Single Table Design, Terraform IaC, AWS SDK v3, JWT Auth, Event-Driven Architecture (SNS/SQS), and Lambda deployment.

## Critical Architecture Rules

### Database
- **ONLY DynamoDB**. Never suggest PostgreSQL, MySQL, Prisma, TypeORM, or any relational ORM.
- Use `BaseResourceService` for all CRUD operations. It handles PK/SK, multi-tenancy, pagination, and soft-delete automatically.
- PK format: `TENANT#[tenantId]#[ENTITY]`, SK format: `[ENTITY]#[id]`.
- `findAll` returns `PaginatedResult<T>` (cursor-based pagination), NOT `T[]`.

### AWS Resource Naming
Every AWS resource name MUST follow: `[ENV]-[DOMAIN]-[SUBDOMAIN]-[RESOURCE_TYPE]-[FUNCTIONAL_NAME]`
- Use `BaseProvider.getResourceName(type, name)` — never hardcode resource names.
- Environment and Service Type are controlled by Enums (`AppEnvironment`, `AppServiceType`).

### Providers
- Every AWS or external provider MUST extend `BaseProvider`.
- Constructor MUST receive `ConfigService` and pass it to `super(ProviderName, configService)`.
- Use `this.logOperation()` and `this.handleError()` for standardized logging.
- Available: DynamoDBProvider, S3Provider, SQSProvider, SNSProvider, SecretsManagerProvider, CloudWatchLogsProvider, OpenAIProvider.

### Authentication (JWT)
- `AuthModule` registers `JwtAuthGuard` as global `APP_GUARD`.
- **All routes are protected by default**. Use `@Public()` decorator to bypass.
- Controllers MUST have `@ApiBearerAuth()` at class level.
- JWT secret via `JWT_SECRET` env var. Token expiry via `JWT_EXPIRES_IN`.

### Rate Limiting
- `ThrottlerModule` with 60 requests per minute per IP (global `ThrottlerGuard` as `APP_GUARD`).
- Configured in `AppModule`: `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])`.

### Pagination
- Cursor-based DynamoDB pagination via `PaginationQueryDto` (limit + cursor).
- `findAll` always returns `PaginatedResult<T>` with `{ items: T[], cursor?: string }`.
- Controllers use `@Query() pagination: PaginationQueryDto` in `findAll`.

### Multi-Tenancy
- Every request carries `x-tenant-id` header, extracted by `MultiTenancyMiddleware`.
- Use typed `ITenantRequest` interface in controllers (NOT `(req as any).tenantId`).
- Every `create()` call requires `tenantId`. Missing it throws `BadRequestException`.

### Event-Driven Architecture
- CUD operations publish SNS events via `[Entity]EventPublisher`.
- SQS consumers extend `SqsConsumerService` for async processing.
- SNS topic subscribes to SQS queue (fan-out pattern).
- Events are fire-and-forget — never break the main flow.

### Audit Trail
- `AuditTrailService.record(tenantId, action, resourceType, resourceId)` on every CUD.
- PK: `TENANT#[tenantId]#AUDIT`, SK: `AUDIT#[timestamp]#[resourceType]#[id]`.
- Fire-and-forget — audit failures are logged but never thrown.

### Error Codes
- `ErrorCode` enum + `ERROR_REGISTRY` in `src/common/core/error-codes.ts`.
- `GlobalExceptionFilter` includes `errorCode` field in error responses.
- Every error code maps to an HTTP status and i18n translation key.

### i18n
- All user-facing messages must use `I18nService.translate(key, args)`.
- Translation files: `src/common/i18n/pt-BR.json` and `src/common/i18n/en.json`.

### Security
- Soft-delete only. Never physically delete records.
- Use `ObfuscationService.obfuscate(obj)` before logging any object.
- Use AWS Secrets Manager for credentials.
- CORS configured via `CORS_ORIGINS` env var.
- Environment validation on startup via `validate-env.ts`.

### Code Quality
- Max 200 lines per file.
- Max 15 cognitive complexity (SonarJS).
- Zero warnings policy.
- JSDoc on all public methods.
- Code and comments in English. User messages via i18n.

### Infrastructure
- All infrastructure is defined in `infra/terraform/main.tf`.
- Resources: DynamoDB, S3, SQS+DLQ, SNS+subscription, CloudWatch Log Group, Lambda, API Gateway v2, IAM.
- Local development uses LocalStack via `docker-compose.yml`.
- Lambda entry point: `src/lambda.ts` (via `@codegenie/serverless-express`).

## File Structure
```
src/
├── lambda.ts                              → AWS Lambda handler entry point
├── main.ts                                → Local NestJS bootstrap
├── app.module.ts                          → Root module (AuthModule, ThrottlerModule, etc.)
├── providers/
│   ├── base.provider.ts                   → Enums, naming, logging base class
│   └── aws/
│       ├── dynamodb.provider.ts           → DynamoDB SDK v3
│       ├── s3.provider.ts                 → S3 SDK v3
│       ├── sqs.provider.ts               → SQS SDK v3
│       ├── sns.provider.ts               → SNS SDK v3
│       ├── secrets-manager.provider.ts    → Secrets Manager SDK v3
│       └── cloudwatch-logs.provider.ts    → CloudWatch Logs SDK v3
├── common/
│   ├── core/
│   │   ├── base-resource.service.ts       → CRUD NoSQL (pagination, soft-delete, multi-tenant)
│   │   ├── i18n.service.ts               → Internationalization (request-scoped)
│   │   ├── obfuscation.service.ts        → Sensitive data masking
│   │   ├── audit-trail.service.ts        → Immutable audit trail (fire-and-forget)
│   │   ├── error-codes.ts               → ErrorCode enum + ERROR_REGISTRY
│   │   ├── pagination-query.dto.ts       → PaginationQueryDto (limit + cursor)
│   │   └── validate-env.ts              → Startup env validation
│   ├── filters/
│   │   └── global-exception.filter.ts    → Log + Obfuscation + ErrorCode + Response
│   ├── guards/
│   │   ├── auth.module.ts                → JWT AuthModule (global APP_GUARD)
│   │   ├── jwt-auth.guard.ts             → JwtAuthGuard (with @Public() bypass)
│   │   ├── jwt.strategy.ts              → Passport JWT Strategy
│   │   └── public.decorator.ts          → @Public() decorator
│   ├── middlewares/
│   │   ├── multi-tenancy.middleware.ts   → x-tenant-id extraction
│   │   └── request-logging.middleware.ts → HTTP request logging
│   ├── consumers/
│   │   └── sqs-consumer.service.ts       → Base SQS Consumer (long-polling)
│   └── i18n/
│       ├── en.json                       → English translations
│       └── pt-BR.json                    → Portuguese translations
├── modules/
│   ├── health/                           → Health check endpoints (@Public)
│   └── orders/                           → Example CRUD module (reference implementation)
│       ├── orders.module.ts
│       ├── orders.service.ts             → BaseResourceService + EventPublisher + AuditTrail
│       ├── orders.controller.ts          → JWT + Pagination + ITenantRequest
│       ├── order-event.publisher.ts      → SNS events (created/updated/deleted)
│       ├── order-processor.service.ts    → SQS consumer for order events
│       └── dto/
│           ├── create-order.dto.ts
│           ├── update-order.dto.ts
│           └── order-response.dto.ts     → Swagger response type
└── scripts/
    └── seed.ts                           → Seed data for local development
infra/terraform/main.tf                   → DynamoDB, S3, SQS+DLQ, SNS, CloudWatch, Lambda, API GW, IAM
```

## Available Skills (deep knowledge per topic)
| Skill | Covers |
|-------|--------|
| `aws-naming` | Corporate naming convention, Enums, Terraform alignment |
| `dynamodb-single-table` | PK/SK design, BaseResourceService, pagination, access patterns |
| `provider-architecture` | BaseProvider inheritance, new provider template |
| `multi-tenancy` | Tenant isolation, ITenantRequest, middleware, PK-based security |
| `soft-delete` | Never physical delete, filter pattern, restore |
| `i18n` | I18nService, JSON catalogs, ESLint enforcement |
| `data-obfuscation` | ObfuscationService, sensitive fields, LGPD/PCI |
| `terraform-iac` | main.tf templates, LocalStack, all AWS resource patterns |
| `code-quality` | Limits, ESLint, JSDoc, tests (unit + integration), naming conventions |
| `new-module` | **Deployd-style** full CRUD module generator (JWT, Pagination, Audit, Events, SNS/SQS) |
