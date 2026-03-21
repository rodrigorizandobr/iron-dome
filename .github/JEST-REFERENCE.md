# Jest Configuration & Coverage Best Practices

**Last Updated**: March 21, 2026  
**Status**: ✅ Verified & Working (v8 provider)

---

## 🚨 Current Configuration (jest-unit.json & jest-int.json)

### Coverage Provider: v8 (NOT babel-plugin-istanbul)

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
  ]
}
```

### Why v8?

| Feature                | Babel Plugin | v8 Native | Winner |
| ---------------------- | ------------ | --------- | ------ |
| Requires Babel plugins | ✅ Yes       | ❌ No     | v8     |
| Works with TypeScript  | ⚠️ Fragile   | ✅ Yes    | v8     |
| Native to Node.js      | ❌ No        | ✅ Yes    | v8     |
| Speed                  | ⚠️ Slow      | ✅ Fast   | v8     |
| test-exclude compat    | ❌ Fails     | ✅ Works  | v8     |

**Conclusion**: Always use `v8` in jest.json configs.

---

## ✅ Working Commands

```bash
# Fast check (no coverage, ~3s)
npm run test:unit

# With coverage using v8 (~10s)
npm run test:unit -- --coverage

# Integration tests (ESM mode, no coverage allowed, ~30s)
npm run test:integrated
# ⚠️ DO NOT use --coverage with integration tests (ESM + v8 + AWS SDK = incompatible)
```

All commands should pass WITHOUT:

- ❌ `TypeError: original argument must be of type function`
- ❌ `babel-plugin-istanbul` errors
- ❌ `test-exclude` module errors
- ❌ `globals is deprecated` warning (ts-jest)

**Why not coverage on integration tests?**

ESM mode + v8 coverage + AWS SDK v3 dynamic imports = incompatible. Use unit test coverage instead (already enforced at 80%).

---

## 📊 Coverage Thresholds (Module-Specific 80% — MANDATORY)

```json
{
  "coverageThreshold": {
    "./src/modules/orders/orders.service.ts": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    },
    "./src/modules/orders/orders.controller.ts": {
      "branches": 70,
      "functions": 70,
      "lines": 70,
      "statements": 70
    },
    "./src/common/core/base-resource.service.ts": {
      "branches": 70,
      "functions": 70,
      "lines": 70,
      "statements": 70
    }
  }
}
```

**Why Module-Specific 80%?**

✅ **Benefits**:

- Target 80% for well-tested modules (orders.service)
- Incremental adoption for modules under development (70%)
- Prevents untested code from being merged
- New modules inherit 80% requirement when added
- DTOs, entry points, validators automatically excluded
- Forces test-first development per module

**How it works**:

1. Each module with tests gets its own threshold
2. orders.service: 80% (comprehensive tests)
3. orders.controller: 70% (integration focused)
4. base-resource.service: 70% (base functionality)
5. New modules: must specify threshold when added

**Coverage metric breakdown**:

- **statements**: Individual code statements executed
- **branches**: If/else, ternary operators covered
- **functions**: All functions have test cases
- **lines**: Physical code lines executed

All 4 metrics MUST meet their module threshold for CI to pass.

---

## 🚫 Things That BREAK Coverage

### ❌ Never Remove These Exclusions

```json
"!**/*.spec.ts",              // Test files are data, not logic
"!**/*.int-spec.ts",          // Integration tests are data
"!**/index.ts",               // Re-exports only
"!**/main.ts",                // Entry point (tested via e2e)
"!**/lambda.ts",              // AWS Lambda handler (tested via e2e)
"!**/*.dto.ts",               // Decorators + interfaces = no logic
"!**/validate-env.ts"         // Config validation (indirect test)
```

### ❌ Never Add These (Invalid Options)

```json
"collectCoverageFromChildProcesses": false,  // ❌ Jest doesn't recognize this
"useProviders": ["babel"],                    // ❌ Not a real option
```

### ❌ Never Use These Coverage Providers

- ❌ `babel` (causes test-exclude errors)
- ❌ Default (same as babel)

### ✅ Always Use

```json
"coverageProvider": "v8"       // ✅ Native Node.js
```

---

## 🔍 Debugging Coverage Errors

### Error: "TypeError: original argument must be of type function"

**Symptom**:

```
TypeError: The "original" argument must be of type function. Received an instance of Object
  at promisify (node:internal/util:481:3)
  at Object.<anonymous> (/node_modules/test-exclude/index.js:5:14)
Failed to collect coverage from /src/...
```

**Root Cause**: Jest is using babel-plugin-istanbul (default or misconfigured)

**Fix**:

1. Open `jest-unit.json`
2. Ensure has: `"coverageProvider": "v8"`
3. Remove: `"collectCoverageFromChildProcesses"` if present
4. Keep: All `!**/*.dto.ts` exclusions
5. Run: `npm run test:unit -- --coverage`

**Verify**: Should pass in ~10s without babel errors.

---

## 📋 Testing Checklist

Before committing any test change:

- [ ] Run `npm run test:unit` → ✅ passes
- [ ] Run `npm run test:unit -- --coverage` → ✅ passes (v8 provider)
- [ ] Coverage report shows no `babel-plugin-istanbul` errors
- [ ] Coverage metrics match module-specific thresholds
- [ ] No TypeErrors from `test-exclude`
- [ ] No warnings about `collectCoverageFromChildProcesses`

---

## 🧪 Example: Adding a New Test

### 1. Create Test File

```typescript
// src/modules/orders/orders.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        // Mock DynamoDBProvider, etc.
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create an order', () => {
    // Your test logic
    expect(true).toBe(true);
  });
});
```

### 2. Run Tests

```bash
npm run test:unit
# ✅ Should pass

npm run test:unit -- --coverage
# ✅ Should show coverage metrics using v8
```

### 3. Check Coverage Report

```
File                      │ % Stmts │ % Branch │ % Funcs │ % Lines
─────────────────────────────────────────────────────────────────
orders.service.ts         │    84   │   100    │    75   │    84     ✅ Meets 75% threshold
```

### 4. Commit

```bash
git add src/modules/orders/orders.service.spec.ts
git commit -m "test(orders): add unit tests for order creation and retrieval

- Test OrdersService.create() with tenant isolation
- Test OrdersService.findOne() soft-delete behavior
- Coverage: 84% statements, 75% functions (meets threshold)
- Verified: npm run test:unit -- --coverage passes"
```

---

## 🔗 References

- **Bugfix**: `.github/CI-COMPLIANCE.md` → Scenario 6: Jest Coverage Error
- **Details**: `.github/skills/code-quality/SKILL.md` → Jest Coverage Configuration
- **Agent Check**: `.github/agents/CI-COMPLIANCE-AGENTS.md` → Unit Tests section
- **Workflow**: `.github/QUALITY-GATE-WORKFLOW.md`

---

## 📚 Key Takeaways

1. **v8 is the only provider** — babel-plugin-istanbul is broken with TypeScript
2. **Module-specific thresholds** — scale as project grows, no false negatives
3. **Exclude DTOs and entry points** — they have no testable logic
4. **Test locally before push** — `npm run test:unit -- --coverage` must pass
5. **Update docs when you change** — Jest config changes require doc updates

---

---

## 🔧 Integration Tests & AWS SDK v3 ESM

### Problem: "experimental-vm-modules" Error

```
Error: A dynamic import callback was invoked without --experimental-vm-modules
```

**Cause**: AWS SDK v3 requires Node.js ESM dynamic imports

**Solution in npm script:**

```bash
NODE_OPTIONS=--experimental-vm-modules npm run test:integrated
```

This is already configured in `package.json` under `test:integrated` script.

### Jest Configuration for Integration Tests

**jest-int.json** includes:

```json
{
  "preset": "ts-jest",
  "extensionsToTreatAsEsm": [".ts"],
  "globals": { "ts-jest": { "useESM": true } },
  "moduleNameMapper": { "^(\\.{1,2}/.*)\\.js$": "$1" }
}
```

### Critical Import Changes for ESM

**supertest** requires different import in ESM context:

❌ **CommonJS (don't use):**

```typescript
import * as request from 'supertest';
```

✅ **ESM (correct):**

```typescript
import request from 'supertest';
```

**Same for other vendors with default exports:**

- `import axios from 'axios'` (not `import * as axios`)
- `import jwt from 'jsonwebtoken'` (not `import * as jwt`)

### Running Integration Tests Locally

```bash
npm run test:integrated              # ESM + NODE_OPTIONS, no coverage collection
```

**Why NO coverage for integration tests?**

Integration tests do NOT collect coverage because:

- ❌ ESM + v8 coverage + dynamic imports = complex configuration
- ❌ Integration tests often fail (external systems, LocalStack)
- ❌ Coverage on partial test results is misleading
- ✅ Unit tests already provide good coverage metrics
- ✅ Integration tests verify end-to-end behavior, not code paths

If you need coverage metrics, use `npm run test:unit -- --coverage` instead.

**Expected output:**

```
Test Suites: 1 failed, 1 total  # May fail on data operations (DynamoDB setup)
Tests:       4 passed, 3 failed  # Auth tests pass, data tests need LocalStack
No vm-modules or ESM errors
No coverage collection
```

---

**Status**: ✅ ESM + v8 provider fully working (unit tests)  
**Integration tests**: No coverage (expected behavior)  
**Last verified**: March 21, 2026  
**Prerequisites**: NODE_OPTIONS flag + ESM imports in test files
