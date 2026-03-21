---
name: 'Code Quality Standards'
description: 'Skill para garantir qualidade de código corporativa. Cobre limites de linhas/complexidade, ESLint config, JSDoc, ZERO warnings, cobertura de testes, convenções de nomenclatura, e idioma (código inglês, mensagens via i18n).'
---

# Skill: Code Quality Standards

## Quando usar esta skill

- Ao criar um **novo arquivo** (service, controller, provider, filter, etc).
- Ao revisar se um arquivo segue os padrões de qualidade.
- Ao configurar ou debugar **ESLint**.
- Ao escrever **testes unitários ou integrados**.
- Ao verificar padrões de **nomenclatura** e **documentação**.

## Regras Corporativas

### 1. Limites por Arquivo

| Métrica                | Limite  | Enforcement        |
| ---------------------- | ------- | ------------------ |
| Linhas por arquivo     | **200** | ESLint `max-lines` |
| Complexidade cognitiva | **15**  | SonarJS            |
| Funções duplicadas     | **0**   | SonarJS            |
| Warnings no lint       | **0**   | CI pipeline        |

### 2. Cobertura de Testes

| Tipo       | Mínimo  | Config           |
| ---------- | ------- | ---------------- |
| Unitários  | **85%** | `jest-unit.json` |
| Integrados | **80%** | `jest-int.json`  |

Configuração em `jest-unit.json`:

```json
{
  "coverageThreshold": {
    "global": {
      "branches": 85,
      "functions": 85,
      "lines": 85,
      "statements": 85
    }
  }
}
```

### 3. Idioma

| Contexto                    | Idioma                                        |
| --------------------------- | --------------------------------------------- |
| Código (variáveis, classes) | **Inglês**                                    |
| Comentários e JSDoc         | **Inglês**                                    |
| Mensagens ao usuário        | **i18n** (via `I18nService`)                  |
| Commits                     | **Inglês**                                    |
| Documentação                | **Inglês** (com tradução pt-BR se necessário) |

## ESLint Configuration (`eslint.config.mjs`)

### Plugins ativos

| Plugin              | Propósito                             |
| ------------------- | ------------------------------------- |
| `typescript-eslint` | Type strictness                       |
| `i18next`           | Bloqueia strings literais user-facing |
| `no-secrets`        | Detecta segredos hardcoded            |
| `sonarjs`           | Complexidade e duplicação             |
| `prettier`          | Formatação consistente                |

### Regras críticas

```javascript
// Type strictness (ZERO any)
'@typescript-eslint/no-explicit-any': 'error',
'@typescript-eslint/no-unsafe-assignment': 'error',
'@typescript-eslint/no-unsafe-call': 'error',
'@typescript-eslint/no-unsafe-member-access': 'error',
'@typescript-eslint/no-unsafe-return': 'error',

// Naming conventions
'@typescript-eslint/naming-convention': ['error',
  { selector: 'class', format: ['PascalCase'] },
  { selector: 'interface', format: ['PascalCase'], prefix: ['I'] },
],

// Secrets detection
'no-secrets/no-secrets': 'error',

// Complexity
'sonarjs/cognitive-complexity': ['error', 15],
'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
'sonarjs/no-duplicate-string': 'warn',
'sonarjs/no-identical-functions': 'error',

// i18n
'i18next/no-literal-string': ['error', { /* config */ }],
```

## JSDoc Obrigatório

Todo método público DEVE ter JSDoc com `@param`, `@returns`, e `@example` (quando relevante):

````typescript
/**
 * Creates a new order for the specified tenant.
 *
 * @param data - The order creation data including tenantId.
 * @returns The created order with generated id and timestamps.
 *
 * @example
 * ```typescript
 * const order = await this.ordersService.create({
 *   tenantId: 'abc',
 *   productName: 'Widget',
 *   amount: 99.90,
 * });
 * ```
 */
async create(data: CreateOrderDto): Promise<Order> {
  // ...
}
````

### Classes e Interfaces

````typescript
/**
 * AWS DynamoDB Provider for CRUD operations.
 * Extends BaseProvider for standardized naming and logging.
 *
 * @example
 * ```typescript
 * constructor(private readonly dynamo: DynamoDBProvider) {}
 * await this.dynamo.putItem(tableName, item);
 * ```
 */
@Injectable()
export class DynamoDBProvider extends BaseProvider {}
````

## Convenções de Nomenclatura

### Arquivos

| Tipo         | Padrão                        | Exemplo                       |
| ------------ | ----------------------------- | ----------------------------- |
| Module       | `[name].module.ts`            | `orders.module.ts`            |
| Controller   | `[name].controller.ts`        | `orders.controller.ts`        |
| Service      | `[name].service.ts`           | `orders.service.ts`           |
| Provider     | `[name].provider.ts`          | `dynamodb.provider.ts`        |
| Filter       | `[name].filter.ts`            | `global-exception.filter.ts`  |
| Middleware   | `[name].middleware.ts`        | `multi-tenancy.middleware.ts` |
| Test Unit    | `[name].spec.ts`              | `orders.service.spec.ts`      |
| Test Int     | `[name].int-spec.ts`          | `orders.int-spec.ts`          |
| Event Pub    | `[name]-event.publisher.ts`   | `order-event.publisher.ts`    |
| SQS Proc     | `[name]-processor.service.ts` | `order-processor.service.ts`  |
| Response DTO | `[name]-response.dto.ts`      | `order-response.dto.ts`       |

### Classes

| Tipo       | Padrão             | Exemplo                  |
| ---------- | ------------------ | ------------------------ |
| Module     | `[Name]Module`     | `OrdersModule`           |
| Controller | `[Name]Controller` | `OrdersController`       |
| Service    | `[Name]Service`    | `OrdersService`          |
| Provider   | `[Name]Provider`   | `DynamoDBProvider`       |
| Filter     | `[Name]Filter`     | `GlobalExceptionFilter`  |
| Middleware | `[Name]Middleware` | `MultiTenancyMiddleware` |
| Interface  | `I[Name]`          | `IBaseResource`          |

### Variáveis e métodos

- **camelCase** para variáveis e métodos: `tenantId`, `findAll`, `getResourceName`.
- **UPPER_SNAKE_CASE** para constantes e enums: `AppEnvironment.DEVELOPMENT`.
- **PascalCase** para classes e interfaces: `BaseResourceService`, `IBaseResource`.

## Como validar qualidade

### Comandos

```bash
# Lint (ZERO warnings obrigatório)
npm run lint

# Testes unitários com cobertura
npm run test -- --coverage --config jest-unit.json

# Build (verifica compilação TypeScript)
npm run build
```

### Pipeline CI (ordem)

1. `npm run lint` → 0 errors, 0 warnings
2. `npm run test -- --coverage` → 85%+ cobertura
3. `npm run build` → Compilação sem erros

## Regras de Validação (Checklist)

- [ ] Arquivo tem no máximo **200 linhas** (excluindo blank + comments).
- [ ] Complexidade cognitiva máxima de **15** por função.
- [ ] Nenhuma função duplicada.
- [ ] `npm run lint` com **ZERO warnings**.
- [ ] Todo método público tem **JSDoc**.
- [ ] Classes em **PascalCase**, interfaces com prefixo **I**.
- [ ] Código e comentários em **inglês**.
- [ ] Mensagens user-facing via **i18n** (não strings literais).
- [ ] Sem `any` explícito (use tipos adequados).
- [ ] Sem segredos hardcoded no código.
- [ ] Testes cobrindo 85%+ (unitários) e 80%+ (integrados).

## Anti-Patterns (NUNCA fazer)

```typescript
// ❌ ERRADO: Arquivo com 300+ linhas
// Divida em múltiplos arquivos com responsabilidades claras

// ❌ ERRADO: Função com 20+ de complexidade cognitiva
// Extraia sub-funções com responsabilidade única

// ❌ ERRADO: `any` type
const data: any = await service.getData();

// ❌ ERRADO: Sem JSDoc em método público
async findAll(tenantId: string): Promise<Order[]> { }

// ❌ ERRADO: findAll retornando array simples
async findAll(tenantId: string): Promise<Order[]> { }

// ❌ ERRADO: String literal como mensagem
throw new Error('Something went wrong');

// ✅ CORRETO: Tipado, documentado, i18n, PaginatedResult
/** Finds all orders for the given tenant. */
async findAll(tenantId: string, options?: PaginationOptions): Promise<PaginatedResult<Order>> { }
throw new Error(this.i18n.translate('errors.generic'));
```

## Jest Coverage Configuration Issues (Common Failures)

### Problema: "babel-plugin-istanbul: original argument must be of type function"

**Sintoma (Em CI ou local com `--coverage`):**

```
TypeError: The "original" argument must be of type function. Received an instance of Object
  at promisify (node:internal/util:481:3)
  at Object.<anonymous> (/node_modules/test-exclude/index.js:5:14)
```

**Root cause (⚠️ NÃO é `collectCoverageFromChildProcesses`, essa opção não existe no Jest):**

- Por padrão, Jest usa `babel-plugin-istanbul` para instrumentação de coverage
- `babel-plugin-istanbul` tenta instrumentar TODOS os arquivos ts/js
- Node's `promisify` falha quando `test-exclude` tenta processar o coverage regex
- Versões incompatíveis de `test-exclude` causam esse erro

**✅ SOLUÇÃO CORRETA: Use `coverageProvider: "v8"` (nativo do Node, sem plugins):**

```json
{
  "collectCoverage": false,
  "coverageProvider": "v8",
  "collectCoverageFrom": [
    "**/*.ts",
    "!**/*.spec.ts",
    "!**/*.int-spec.ts",
    "!**/index.ts",
    "!**/main.ts",
    "!**/lambda.ts",
    "!**/*.dto.ts",
    "!**/validate-env.ts"
  ],
  "coverageThreshold": {}
}
```

**Por que v8 é melhor que babel-plugin-istanbul:**

- ✅ V8 é nativo do Node.js (sem dependências externas)
- ✅ Funciona com TS-Jest via instrumentação nativa
- ✅ Sem problemas com plugins Babel
- ✅ Mais rápido (não precisa de transformação adicional)
- ✅ Compatível com `--coverage` via CLI

**NUNCA coleter coverage de:**

- ❌ `*.spec.ts` — test files (já coletados pelo próprio teste)
- ❌ `*.int-spec.ts` — integration test files
- ❌ `*.dto.ts` — Data Transfer Objects (apenas decoradores + tipos, nenhuma lógica)
- ❌ `validate-env.ts` — env validation (testada indiretamente via imports)
- ❌ `index.ts` — re-exports only
- ❌ `main.ts` e `lambda.ts` — entry points (testados via e2e, não unit)

**Thresholds realistas (module-specific, não global):**

Enquanto o suite de testes cresce, use thresholds module-specific no lugar de global:

```json
{
  "coverageThreshold": {
    "./src/modules/orders/orders.service.ts": {
      "branches": 75,
      "functions": 75,
      "lines": 75,
      "statements": 75
    }
  }
}
```

DTO e entry-point files não têm lógica, então thresholds globais altos causam falsos positivos.

**Verificação rápida (local antes de commitar):**

```bash
npm run test:unit                    # Sem coverage (rápido, ~3s)
npm run test:unit -- --coverage     # Com coverage usando v8 (~10s)
```

Ambos devem passar sem erros de `babel-plugin-istanbul` ou `test-exclude`.
