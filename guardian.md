# Boilerplate Development Rules — Iron Dome 🛡️

> Este arquivo contém as regras de ouro do projeto. Todo código gerado, revisado ou refatorado deve obedecer rigorosamente.

---

## Architecture Rules

### Stack

- **Framework**: NestJS (Strict TypeScript, CommonJS).
- **Database**: ONLY DynamoDB (Single Table Design). NO PostgreSQL. NO Prisma. NO relational ORMs.
- **Infrastructure**: Terraform (`infra/terraform/main.tf`). LocalStack for local dev.
- **AI**: OpenAI GPT-4 via `OpenAIProvider`.

### AWS Resource Naming (Corporate Standard)

Pattern: `[ENV]-[DOMAIN]-[SUBDOMAIN]-[RESOURCE_TYPE]-[FUNCTIONAL_NAME]`

- **Implementation**: `BaseProvider.getResourceName(type, functionalName)`
- **Enums**: `AppEnvironment` (dev, hml, sandbox, prd) and `AppServiceType` (api, worker, job, frontend)
- **Rule**: Terraform and NestJS code MUST generate identical names.

### Provider Design

- Every AWS/external provider MUST extend `BaseProvider`.
- Constructor MUST receive `ConfigService` and pass it to `super(Name, configService)`.
- Use `this.logOperation()` and `this.handleError()` for standardized logging/errors.

### Data Layer

- Use `BaseResourceService` for all CRUD operations.
- PK: `TENANT#[tenantId]#[ENTITY]`, SK: `[ENTITY]#[id]`.
- GSI1: `entityType` + `SK` for cross-tenant admin queries.
- Soft-delete ONLY (`deleted: true`). NEVER physically delete.

### Multi-Tenancy

- Header `x-tenant-id` extracted by `MultiTenancyMiddleware`.
- Every `create()` requires `tenantId`. Missing it → `BadRequestException`.

### i18n (Internationalization)

- Use `I18nService.translate(key, args)` for ALL user-facing messages.
- Catalogs: `src/common/i18n/pt-BR.json` (default) and `src/common/i18n/en.json`.
- Detection via `Accept-Language` header.

### Security & Audit

- Use `ObfuscationService.obfuscate(obj)` BEFORE logging any object.
- Sensitive fields: password, secret, token, key, auth, credit_card, cvv, cpf, rg, document.
- Use AWS Secrets Manager for credentials. NEVER hardcode secrets.
- All errors logged to `storage/log/error.log` with obfuscation.

---

## Code Quality Rules

- **Max 200 lines per file**. (ESLint max-lines)
- **Max 15 cognitive complexity** per method. (SonarJS)
- **ZERO warnings policy** in lint and console.
- **Coverage**: Unit 85%+, Integration 80%+.
- **JSDoc mandatory** on all public methods, providers, and modules.
- **Code and comments in English**. User messages via i18n.
- **No `any` type**. Use concrete interfaces or `unknown` with narrowing.
- **SOLID principles**. Modules are black boxes. No cross-module direct imports.
- **Hardcoded secret detection** enabled in ESLint.

---

## Folder Convention

```
src/
├── providers/          → AWS and external infrastructure (BaseProvider pattern)
│   ├── base.provider.ts
│   ├── aws/            → DynamoDB, S3, SQS, SNS, SecretsManager
│   └── openai/         → AI capabilities
├── common/
│   ├── core/           → BaseResourceService, I18nService, ObfuscationService
│   ├── filters/        → GlobalExceptionFilter (obfuscation + audit)
│   ├── middlewares/    → Multi-tenancy
│   └── i18n/           → Translation catalogs
├── modules/            → Business logic (feature modules)
└── app.module.ts       → Root module
infra/terraform/        → IaC definitions
```

---

## Delivery Checklist

1. Define PK/SK pattern for the entity.
2. Add AWS resources to Terraform if needed.
3. Create Service extending `BaseResourceService`.
4. Create Controller with Swagger decorators.
5. Add i18n keys to both JSON catalogs.
6. Write unit tests (85%+) and integration tests (80%+).
7. Run `npm run lint` — ZERO warnings.
8. Verify naming with `BaseProvider.getResourceName()`.
