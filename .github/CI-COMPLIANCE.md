# CI Compliance Checklist — Iron Dome API

**Status**: Qualidade de código e segurança auditada automaticamente em cada `push`  
**CI Pipelines**: Code Quality (Logic Gate), Type Safety, Test Coverage, Security Scan  
**Failure**: Qualquer falha bloqueia merge para `main`

---

## 🎯 Quick Reference: Antes de commitar

```bash
# 1. Format everything
npm run format

# 2. Lint all files  
npm run lint

# 3. Type check
npx tsc --noEmit

# 4. Unit tests (85% coverage)
npm run test:unit

# 5. Integration tests (80% coverage)
npm run test:integrated
```

---

## 📋 CI Gates — O que cada pipeline valida

### 1. **Code Formatting** (`npm run format`)
- **Tool**: Prettier
- **Check**: `npm run format -- --check`
- **Auto-fix**: `npm run format` (writes to disk)
- **Files**: `**/*.{ts,js,cjs,mjs,json,yml,md}`

**Falha quando:**
- Indentação incorreta (2 espaços obrigatórios)
- Aspas inconsistentes (double quotes `"..."`)
- Line length > 80 chars (markdown) or 120 (code)
- YAML/JSON structures malformed

**Fix:**
```bash
npm run format  # Runs prettier -w
```

---

### 2. **Linting** (`npm run lint`)
- **Tool**: ESLint + 5 plugins (typescript-eslint, i18next, no-secrets, sonarjs, prettier)
- **Check**: All `.ts`, `.js`, `.mjs` files
- **Policy**: ZERO warnings

#### Rules that will FAIL CI:

| Rule | Severity | What it catches | Fix |
|------|----------|-----------------|-----|
| `no-explicit-any` | ❌ ERROR | `const x: any` | Use concrete types: `unknown`, typed interfaces |
| `no-unsafe-*` | ❌ ERROR | `.field` on `any` value | Type cast: `res.body as OrderResponseDto` |
| `no-literal-string` | ❌ ERROR | `console.log('hello')` outside callees | Use constant or `// eslint-disable-next-line` |
| `no-secrets/no-secrets` | ❌ ERROR | Hardcoded API keys, tokens, passwords | Move to `.env`, use `SecretsManager` |
| `naming-convention` | ❌ ERROR | `myClass`, `INTERFACE`, `_private` | Classes: PascalCase, Interfaces: IPascalCase, constants: UPPER_CASE |
| `cognitive-complexity` | ❌ ERROR | >15 branching paths in one function | Refactor into smaller functions |
| `max-lines` | ❌ ERROR | File > 200 lines (skip blanks/comments) | Split into smaller modules |
| `no-duplicate-string` | ⚠️ WARN | String used ≥3 times | Extract to `const CONSTANT = '...'` (wrapped in eslint-disable) |
| `no-identical-functions` | ❌ ERROR | 2+ identical function bodies | Extract common logic, reuse |
| `i18next/no-literal-string` | ❌ ERROR | User-facing string not translated | Use `I18nService.translate(key)` or add `// eslint-disable-next-line` |

#### Test Files Exception:
Files matching `**/*.spec.ts`, `**/*.test.ts`, `**/*.int-spec.ts` are exempt from:
- `i18next/no-literal-string`
- `sonarjs/no-duplicate-string`
- `max-lines`

**Fix:**
```bash
npm run lint -- --fix  # Auto-fixes formatting issues
# Manual fixes for logic issues (type casts, naming, refactoring)
```

---

### 3. **Type Safety** (`npx tsc --noEmit`)
- **Compiler**: TypeScript (strict mode)
- **Strict Options**: All enabled (see `tsconfig.json`)

**Common errors:**
- Missing type annotations on function returns
- Implicit `any` types
- Property access on optional types without narrowing
- Unused variables/imports

**Fix:**
```bash
npx tsc --noEmit  # Shows all errors
# Add type annotations, imports, or remove dead code
```

---

### 4. **Unit Tests** (`npm run test:unit`)
- **Framework**: Jest
- **Pattern**: `**/*.spec.ts`
- **Coverage Threshold**: **85%** (branches, functions, lines, statements)
- **Config**: `jest-unit.json`

**Thresholds:**
```json
{
  "coverageThreshold": {
    "global": {
      "branches": 85,      // if/else paths
      "functions": 85,     // function definitions
      "lines": 85,         // lines of code
      "statements": 85     // total statements
    }
  }
}
```

**Fails when:**
- Coverage < 85% on any metric
- Tests don't pass (`FAIL`)
- Missing test files for new modules

**Fix:**
```bash
npm run test:unit -- --coverage  # Shows coverage report
# Add tests to reach 85%  
# Use mockups for external services
```

---

### 5. **Integration Tests** (`npm run test:integrated`)
- **Framework**: Jest + Supertest
- **Pattern**: `**/*.int-spec.ts`
- **Coverage Threshold**: **80%** (slightly relaxed for integration)
- **Config**: `jest-int.json`

**Requires:**
- Real database connections (LocalStack for local dev)
- HTTP endpoint testing
- Multi-step workflows

**Fails when:**
- Coverage < 80%
- Integration tests fail
- Database not accessible

---

### 6. **Security Scan** (`no-secrets` plugin)
- **Tool**: eslint-plugin-no-secrets
- **Scans**: All `.ts`, `.js` files

**Blocks:**
- API keys (e.g., `sk_live_...`, `ghp_...`)
- Passwords in code (e.g., `password: 'secret123'`)
- AWS credentials (e.g., `AKIA...`)
- Database URLs with embedded credentials

**Fix:**
```bash
# Move to environment variables or AWS Secrets Manager
# Use ConfigService.get() to read at runtime
const apiKey = this.configService.get<string>('API_KEY');
```

---

## 🛠️ Common Failure Scenarios

### Scenario 1: "Unsafe member access .body on 'any' value"
```typescript
// ❌ FAILS
const result = await someFunction();  // returns any
console.log(result.body.id);

// ✅ PASSES
interface IResult { body: { id: string } }
const result = await someFunction() as IResult;
console.log(result.body.id);
```

### Scenario 2: "disallow literal string: expect(...).toBe('value')"
```typescript
// ❌ FAILS (in non-test-exempted files)
console.log('User created');

// ✅ PASSES
// eslint-disable-next-line i18next/no-literal-string
console.log('User created');
// OR (in test files):
expect(res.body.name).toBe('Widget');  // Auto-exempt
```

### Scenario 3: "Define a constant instead of duplicating this literal 3 times"
```typescript
// ❌ FAILS
if (status === 'pending') { }
if (status === 'pending') { }
if (status === 'pending') { }

// ✅ PASSES
const PENDING_STATUS = 'pending';
if (status === PENDING_STATUS) { }
if (status === PENDING_STATUS) { }
if (status === PENDING_STATUS) { }
```

### Scenario 4: "File has 250 lines. Limit is 200"
```typescript
// ❌ FAILS: One 250-line service
export class OrdersService { /* ... */ }

// ✅ PASSES: Split into two files
export class OrdersService { /* core logic */ }
export class OrderProcessorService { /* specific logic */ }
```

### Scenario 5: "Cognitive complexity 18. Limit is 15"
```typescript
// ❌ FAILS: 18+ nested if/else/for/while/case
if (a) {
  if (b) {
    for (const item of items) {
      switch (item.type) {
        case 'x':
          if (item.x) { /* ... */ }
          // ... many more conditions
      }
    }
  }
}

// ✅ PASSES: Refactor into helper functions
const processItem = (item: T) => { /* 5 complexity */ };
items.forEach(processItem);
```

---

## 🚀 Agent & Workflow Rules

All agents (dev, dev-test, testing, pr) MUST:

1. **Before Adding Code:**
   - Check `.github/CI-COMPLIANCE.md` (this file)
   - Read [`copilot-instructions.md`](.github/copilot-instructions.md) for architecture rules

2. **During Development:**
   - Format: `npm run format`
   - Lint: `npm run lint`
   - Type-check: `npx tsc --noEmit`
   - Test: `npm run test:unit / test:integrated`

3. **Before Committing:**
   - **ZERO ESLint warnings** must pass
   - **Coverage ≥ 85%** for unit tests
   - **Coverage ≥ 80%** for integration tests
   - All files < 200 lines
   - All functions < 15 complexity
   - All interfaces prefixed with `I`
   - All secrets in `.env` or Secrets Manager

4. **Commit Message Format:**
   ```
   <type>(<scope>): <description>
   
   Follows Conventional Commits:
   - feat: New feature (triggers release)
   - fix: Bug fix (triggers release)
   - docs: Documentation
   - refactor: Code restructure
   - test: Add/modify tests
   - chore: Dependencies, build config
   - ci: CI/CD pipeline changes
   ```

5. **Pull Request Criteria:**
   - CI must be GREEN ✅
   - Coverage report must meet thresholds
   - Code review required before merge
   - All conversations resolved

---

## 📊 CI Pipeline Overview

```
git push → GitHub Actions (CI)
  ├─ Prettier check (format)
  ├─ ESLint (lint)
  ├─ TypeScript (type safety)
  ├─ Unit tests + coverage (85%)
  ├─ Integration tests + coverage (80%)
  └─ Security scan (no-secrets)
  
  ✅ ALL PASS → Can merge to main
  ❌ ANY FAIL → Block merge, fix & push again
```

---

## 🔗 Additional References

- [Copilot Instructions](./copilot-instructions.md) — Architecture rules
- [Code Quality Skill](.github/skills/code-quality/SKILL.md) — Testing & JSDoc standards
- [API Guardian Agent](.github/agents/api-guardian.agent.md) — Architectural enforcement
- [ESLint Config](../eslint.config.mjs) — Rule details
- [jest-unit.json](../jest-unit.json) — Coverage thresholds  
- [jest-int.json](../jest-int.json) — Integration test config

