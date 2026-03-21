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

# Integration tests (no coverage by default, ~30s)
npm run test:integrated

# With integration coverage
npm run test:integrated -- --coverage
```

All commands should pass WITHOUT:

- ❌ `TypeError: original argument must be of type function`
- ❌ `babel-plugin-istanbul` errors
- ❌ `test-exclude` module errors

---

## 📊 Coverage Thresholds (Module-Specific)

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

**Why module-specific instead of global?**

❌ **Bad (Global thresholds)**:

- DTOs have no logic → 0% coverage
- Entry points tested via e2e → 0% coverage
- Validators tested indirectly → 0% coverage
- Result: Global threshold always fails (false negatives)

✅ **Good (Module-specific)**:

- Only test what has testable logic (services, controllers)
- Thresholds scale as project grows
- New modules can be added without breaking CI
- Clear intent: "orders.service MUST have 75% coverage"

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
npm run test:integrated              # Uses NODE_OPTIONS flag, no errors
npm run test:integrated -- --coverage # Collect coverage with v8
```

**Expected output:**

```
Test Suites: 1 failed, 1 total  # May fail on data operations (DynamoDB setup)
Tests:       4 passed, 3 failed  # Auth tests pass, data tests may fail without LocalStack
No vm-modules or ESM errors
```

---

**Status**: ✅ ESM + v8 provider fully working  
**Last verified**: March 21, 2026  
**Prerequisites**: NODE_OPTIONS flag + ESM imports in test files
