---
name: 'Agents CI Compliance'
description: 'Instruções para todos os agentes (dev, dev-test, testing, pr) garantirem conformidade total com CI. Checklist antes de cada commit, pipeline validation, e fallback strategies.'
---

# Agentes CI Compliance — O Checklist Obrigatório

Todos os agentes IA que desenvolvem código para a Iron Dome DEVEM seguir este checklist **antes de qualquer commit**.

---

## 📋 Pre-Commit Checklist (OBRIGATÓRIO)

Antes de executar `git commit`, o agente deve validar **TODOS** estes 6 pontos:

### ✅ 1. Prettier (Código Formatado)

```bash
npm run format && npm run format -- --check
```

- **Deve passar**: "All matched files use Prettier code style!"
- **Se falhar**: Re-execute `npm run format` (escreve em disco automaticamente)
- **Válida**: Indentação, aspas, line breaks, YAML syntax

### ✅ 2. ESLint (Sem Warnings)

```bash
npm run lint
```

- **Deve passar**: ZERO errors, ZERO warnings
- **Se falhar**: Corrija usando `npm run lint -- --fix` ou manualmente:
  - Add type annotations (`:string`, `:boolean`, `as Type`)
  - Extract constants for duplicated literals
  - Remove unused imports
  - Use `// eslint-disable-next-line RULE` para casos edge (test files)

### ✅ 3. TypeScript (Type Check)

```bash
npx tsc --noEmit
```

- **Deve passar**: ZERO type errors
- **Se falhar**:
  - Add `: Type` annotations on function parameters/returns
  - Don't use `any`, use `unknown` + type guard
  - Import types: `import type { SomeType } from '...'`

### ✅ 4. Unit Tests (80% Module-Specific Coverage — MANDATORY)

```bash
npm run test:unit                    # Fast, no coverage (~3s)
npm run test:unit -- --coverage      # MUST PASS with ≥80% on tested modules (~10s)
```

- **Deve passar**: Todos testes + coverage ≥ 80% em módulos com testes
- **Estratégia Module-Specific**:
  - `orders.service.ts`: 80% (tem testes completos)
  - `orders.controller.ts`: 70% (parcialmente testado)
  - `base-resource.service.ts`: 70% (parcialmente testado)
  - Novos módulos: devem atingir 80% quando adicionados
- **Por que 80%?**
  - Força qualidade de código
  - Previne código não testado ser merged
  - Cada módulo novo herda padrão (80% ou falha CI)
  - Module-specific: `./src/modules/orders/orders.service.ts` ≥ 75%

#### Se falhar — Jest Coverage Error (babel-plugin-istanbul)

**Sintoma:**

```
TypeError: The "original" argument must be of type function
  at promisify (node:internal/util:481:3)
  at Object.<anonymous> (/node_modules/test-exclude/index.js:5:14)
Failed to collect coverage from /path/to/src/...
```

**Root Cause:** Jest uses `coverageProvider: "babel"` by default, which fails with TypeScript

**✅ FIX (obrigatório em jest-unit.json):**

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

**Verificação:** `npm run test:unit -- --coverage` ✅ (deve passar com ≥80% em 4 métricas)

#### Se falhar — Coverage Threshold (80% BLOQUEADOR)

**Sintoma**: `Jest: "global" coverage threshold for statements (80%) not met: 24.71%`

**Causa**: Código novo sem testes suficientes

**Fix (obrigatório)**:

1. Add `*.spec.ts` tests para TODAS as novas functions
2. Target: 80%+ em branches, functions, lines, statements
3. Moque `DynamoDBProvider`, `I18nService`, `EventPublisher` em services
4. Rode: `npm run test:unit -- --coverage` até passar
5. Verifique que coverage report mostra ≥80% em 4 métricas

**Importante**: Este é um bloqueador de CI. Sem 80%, não passa. Sem passar, não merge.

### ✅ 5. Integration Tests (No Coverage)

```bash
npm run test:integrated
```

- **Deve passar**: All integration tests pass, coverage ≥ 80%
- **Se falhar**:
  - Ensure LocalStack is running (`docker-compose up`)
  - Add `*.int-spec.ts` files with real DB interactions
  - Check SQS/SNS topics exist in LocalStack

### ✅ 6. Security Scan (No Secrets)

```bash
npm run lint  # Inclui no-secrets plugin
```

- **Deve bloquer**: API keys, passwords, AWS credentials, tokens hardcoded
- **Solução**: Mova para `.env` ou `SecretsManager`:

  ```bash
  # ❌ BAD
  const apiKey = 'sk_live_abc123xyz';

  # ✅ GOOD
  const apiKey = this.configService.get<string>('API_KEY');
  ```

---

## 🎯 CI Gates — O que cada pipeline valida

Ver [`.github/CI-COMPLIANCE.md`](.github/CI-COMPLIANCE.md) para detalhes completos.

**Quick:** Prettier → ESLint → TypeScript → Unit → Integration → Security scan

```
git push → GitHub Actions (CI)
  ├─ ✅ Prettier (format)
  ├─ ✅ ESLint (lint)
  ├─ ✅ TypeScript (type)
  ├─ ✅ Unit Tests (≥85%)
  ├─ ✅ Integration Tests (≥80%)
  └─ ✅ Security (no-secrets)
```

---

## 🔧 Como o Agente Deve Proceder

### Durante a Codificação:

1. **Arquitetura PRIMEIRO**: Leia [`copilot-instructions.md`](.github/copilot-instructions.md)
   - DynamoDB? ✅ (nunca PostgreSQL)
   - BaseResourceService? ✅
   - JWT + Multi-tenancy? ✅
   - Audit trail? ✅

2. **Format & Lint DURANTE**: Não aguarde o fim
   - Max 200 linhas por arquivo
   - Max 15 complexidade cognitiva
   - Todas as interfaces com `I` prefix
   - JSDoc em métodos públicos

3. **Testes JUNTO**: Escreva `.spec.ts` ao lado do `.ts`
   - 85%+ coverage (unit)
   - Mock todas as dependências externas

### Antes do Commit:

4. **Rode o checklist** (6 passos acima)
5. **Commit com tipo correto** (feat, fix, test, chore, etc)
6. **Message em inglês, descritivo**:

   ```
   feat: add order repository with soft-delete support

   - Implement OrdersService extending BaseResourceService
   - Add multi-tenant PK isolation (TENANT#[tenantId]#ORDER)
   - Soft-delete via deleted flag + updatedAt timestamp
   - Publish SNS events on create/update/delete
   - Add AuditTrailService integration
   - 85% unit test coverage
   ```

### Se o CI Falhar:

7. **Leia o erro** na GitHub Actions
8. **Aplique o fix** usando tabela em [CI-COMPLIANCE.md](.github/CI-COMPLIANCE.md)
9. **Re-teste localmente** com checklist
10. **Push novamente**

---

## ❌ Erros Comuns e Soluções

| Erro                                                    | Causa                    | Solução                                                |
| ------------------------------------------------------- | ------------------------ | ------------------------------------------------------ |
| `Unsafe member access .body on 'any'`                   | Sem type cast            | `res.body as OrderResponseDto`                         |
| `disallow literal string: expect(...).toBe('value')`    | String literal em código | Use `const` ou `// eslint-disable-next-line` em testes |
| `Define a constant instead of duplicating 'pending' 3x` | Mesmo literal 3+ vezes   | `const PENDING = 'pending';`                           |
| `File has 250 lines. Limit is 200`                      | Arquivo muito grande     | Dividir em 2+ módulos                                  |
| `Cognitive complexity 20. Limit is 15`                  | Muitos if/else aninhados | Refatorar em funções menores                           |
| `'password' field detected (no-secrets)`                | Senha hardcoded          | `configService.get('PASSWORD')`                        |
| `Interface 'User' missing I prefix`                     | Nomenclatura errada      | Renomear `IUser`                                       |
| `Coverage 78%. Threshold is 85%`                        | Testes insuficientes     | Adicionar testes para funções não cobertas             |
| `Test suite failed to run`                              | Import error             | Verificar path relativo e type mismatch                |

---

## 📊 Exemplo: Workflow Completo

```bash
# 1. Developer starts feature branch
git checkout -b feat/add-payment-service

# 2. Write code + tests
cat > src/modules/payments/payments.service.ts << 'EOF'
import { Injectable } from '@nestjs/common';
import { BaseResourceService } from '../../common/core/base-resource.service';
import { DynamoDBProvider } from '../../providers/aws/dynamodb.provider';
import { I18nService } from '../../common/core/i18n.service';

const STRIPE_API_KEY_ENV = 'STRIPE_API_KEY';  // ✅ Constant, not hardcoded

/**
 * Manages payment transactions via Stripe.
 * Extends BaseResourceService for DynamoDB operations.
 */
@Injectable()
export class PaymentsService extends BaseResourceService {
  constructor(
    dynamo: DynamoDBProvider,
    i18n: I18nService,
  ) {
    super(dynamo, 'PAYMENT', i18n);
  }

  /**
   * Process a payment.
   * @param tenantId - Tenant isolation
   * @param amount - Amount in cents
   * @returns Processed payment object
   */
  async process(tenantId: string, amount: number) {
    // Implementation...
  }
}
EOF

# 3. Write tests
cat > src/modules/payments/payments.service.spec.ts << 'EOF'
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    // Setup mocks...
  });

  it('should process payment', async () => {
    // Test...
  });
});
EOF

# 4. Pre-commit validation
npm run format && npm run format -- --check  # ✅ Prettier OK
npm run lint                                 # ✅ ESLint OK
npx tsc --noEmit                             # ✅ TypeScript OK
npm run test:unit                            # ✅ 85%+ coverage
npm run test:integrated                      # ✅ 80%+ coverage

# 5. Commit
git add -A
git commit -m "feat: add payment processing service with Stripe integration

- Implement PaymentsService extending BaseResourceService
- Multi-tenant isolation via tenantId in PK
- Soft-delete on payment cancellation
- 87% unit test coverage
- Secure API key via ConfigService"

# 6. Push (triggers CI)
git push origin feat/add-payment-service

# → GitHub Actions runs all 6 gates
# → All GREEN ✅ → Can create PR
# → Any RED ❌ → Fix locally, push again
```

---

## 🚨 Critical Rules for Agents

1. **NEVER** hardcode secrets, API keys, passwords
2. **ALWAYS** extend `BaseResourceService` for data operations
3. **ALWAYS** use `I18nService.translate()` for user messages
4. **ALWAYS** add `tenantId` to `create()` calls
5. **NEVER** delete records physically — use soft-delete
6. **ALWAYS** publish SNS events on CUD operations
7. **ALWAYS** record audit trail via `AuditTrailService`
8. **NEVER** use `any` type — use concrete types or `unknown + type guard`
9. **ALWAYS** run checklist before committing
10. **ALWAYS** read error messages from CI failures carefully

---

## 📖 Learn More

- [API Guardian Instructions](.github/agents/api-guardian.agent.md) — Architectural rules
- [Code Quality Skill](.github/skills/code-quality/SKILL.md) — Testing best practices
- [i18n Skill](.github/skills/i18n/SKILL.md) — i18n compliance
- [DynamoDB Single-Table Skill](.github/skills/dynamodb-single-table/SKILL.md) — Data design
- [CI Compliance Guide](.github/CI-COMPLIANCE.md) — Full CI reference
