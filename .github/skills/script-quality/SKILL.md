---
name: 'Script Quality & Safety'
description: 'Garantia de qualidade para scripts de automação (Seed, Agent Runners, GitHub Automation). Validação de entrada/saída, logging estruturado, mensagens i18n, tratamento de erro robusto, zero hardcoded secrets, e conformidade com ESLint/TypeScript.'
---

# Skill: Script Quality & Safety

## Quando usar

- Ao criar um **novo script** em `scripts/` (seed, agent runners, migrations, etc).
- Ao corrigir ou manter **scripts existentes**.
- Ao integrar scripts com **CI/CD pipelines** (GitHub Actions).
- Ao fazer scripts **chamarem APIs externas** (GitHub, OpenAI, AWS).
- Ao gerar dados **via scripts** (seed, fixtures).

---

## 🛡️ Regras Invioláveis (Script Domo de Ferro)

### 1. ZERO Hardcoded Secrets

**❌ FAILS:**

```typescript
const apiKey = 'sk_live_123abc'; // Hardcoded secret
const credentials = { accessKeyId: 'dummy', secretAccessKey: 'dummy' }; // Hardcoded
```

**✅ PASSES:**

```typescript
// Use ConfigService or environment variables
const apiKey = process.env.OPENAI_API_KEY!;
const region = process.env.AWS_REGION || 'us-east-1';
const endpoint = process.env.AWS_ENDPOINT || 'http://localhost:4566';

// For credentials: use AWS SDK ChainableCredentialProvider
// Or read from Secrets Manager
const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy',
};
```

### 2. Validação de Entrada

**Checklist:**

- [ ] Validate all `process.env.*` reads (exist, non-empty for critical vars)
- [ ] Validate command-line arguments (`process.argv`)
- [ ] Validate API response shapes (JSON schema or type guards)
- [ ] Throw clear errors with exit code ≠ 0 on validation failure

**Template:**

```typescript
// Type-safe env var reading
const REQUIRED_VARS = ['GITHUB_TOKEN', 'ISSUE_NUMBER', 'REPOSITORY'];
const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error(`Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

// Validate CLI args
const targetColumn = process.argv[2];
if (!targetColumn) {
  console.error('Usage: npx ts-node move-card.ts <columnName>');
  process.exit(1);
}
```

### 3. Structured Logging

**Requirements:**

- [ ] Log all major steps (start, API calls, data processing, completion)
- [ ] Use consistent emoji + message format
- [ ] Include context (issue #, file count, etc)
- [ ] Always log errors fully (message + stack)
- [ ] Use console.error for failures, console.log for info

**Template:**

```typescript
console.log(`✓ Starting seed for tenant "${tenantId}"...`);
console.log(`  → Reading configuration from ENV`);
console.log(`  → Connecting to DynamoDB@${endpoint}`);

try {
  // Do work
  console.log(`  ✓ Seeded ${count} items successfully`);
} catch (error) {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(`✗ Seed failed: ${err.message}`);
  console.error(`  Stack: ${err.stack}`);
  process.exit(1);
}

console.log('✓ Seed complete.');
```

### 4. Error Handling (Robust)

**Requirements:**

- [ ] Try-catch ALL async operations (fetch, fs, execSync)
- [ ] Catch errors, log fully, then exit(1) — NEVER re-throw without context
- [ ] Use typed error objects (check `instanceof Error`)
- [ ] Provide helpful error messages to user

**Template:**

```typescript
async function fetchFromGitHub(url: string, token: string): Promise<unknown> {
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`✗ Failed to fetch from GitHub: ${err.message}`);
    console.error(`  URL: ${url}`);
    throw error; // Re-throw for outer handler (main catch block)
  }
}

async function main() {
  try {
    // Do work
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`\n✗ Script failed: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();
```

### 5. No Literal Strings (i18n Compliance)

**ESLint Rule**: `i18next/no-literal-string` applies to scripts too!

**❌ FAILS:**

```typescript
console.log('Seeding orders...'); // Literal string
if (error) console.log('Error occurred'); // Literal string
```

**✅ PASSES (in scripts, use eslint-disable or constants):**

```typescript
/* eslint-disable-next-line i18next/no-literal-string */
console.log('Seeding orders...');

// OR extract to constant
const MSG_SEEDING_START = 'Seeding orders...';
/* eslint-disable i18next/no-literal-string */
console.log(MSG_SEEDING_START);
/* eslint-enable i18next/no-literal-string */
```

### 6. No External Dependencies for Core Logic

**Rule**: Scripts should rely ONLY on:

- Node.js built-ins (`fs`, `path`, `child_process`)
- AWS SDK v3 packages (already in project)
- OpenAI SDK (if agent runner)

**Why**: Keep scripts fast, reduce attack surface, no supply chain risk.

**❌ BAD:**

```typescript
import 'some-random-npm-package'; // Unvetted dependency
```

**✅ GOOD:**

```typescript
import * as fs from 'fs';
import { execSync } from 'child_process';
import { DynamoDBClient, ... } from '@aws-sdk/client-dynamodb';
```

### 7. Type Safety (Full Strict Mode)

**Requirements:**

- [ ] `noImplicitAny: true` — all parameters must have types
- [ ] `strictNullChecks: true` — check for null/undefined
- [ ] `strictFunctionTypes: true` — function callbacks strictly typed
- [ ] No `any` casts without `// @ts-expect-error` comment + reason

**Template:**

```typescript
interface ICommandOutput {
  stdout: string;
  stderr: string;
  code: number;
}

function executeCommand(cmd: string, options?: { encoding: 'utf-8' }): ICommandOutput {
  try {
    const stdout = execSync(cmd, { encoding: options?.encoding || 'utf-8' });
    return { stdout, stderr: '', code: 0 };
  } catch (error) {
    if (error instanceof Error) {
      return { stdout: '', stderr: error.message, code: 1 };
    }
    throw error;
  }
}
```

### 8. Graceful Shutdown

**Requirements:**

- [ ] On error: log, don't pollute stdout, exit(1)
- [ ] On success: clear status message, exit(0)
- [ ] On sigterm/sigint: cleanup resources, then exit

**Template:**

```typescript
async function cleanup() {
  // Close DB connections, cancel fetches, etc
  console.log('Cleaning up resources...');
}

process.on('SIGINT', async () => {
  console.log('\n✓ Interrupted by user.');
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n✓ Terminated.');
  await cleanup();
  process.exit(0);
});

async function main() {
  try {
    // Script logic
  } catch (error) {
    await cleanup();
    // Log error
    process.exit(1);
  }
}

main();
```

---

## ✅ Pre-Commit Script Checklist

Before committing any script, verify:

```bash
# 1. Format & Lint
npm run format
npm run lint
# Expected: ZERO warnings for scripts/

# 2. Type Check
npx tsc --noEmit
# Expected: No type errors in scripts/

# 3. Manual Review
- [ ] No hardcoded secrets, API keys, or credentials
- [ ] All process.env reads validated
- [ ] All async operations in try-catch
- [ ] Structured logging (emojis + context)
- [ ] Clear error messages to user
- [ ] Exit codes proper (0 = success, 1 = error)
- [ ] No literal strings (or documented with eslint-disable)
- [ ] No external npm dependencies (use built-ins/SDK only)
- [ ] Type signatures on all functions
- [ ] Comments explain "why", not "what"

# 4. Local Test (if possible)
# For seed.ts example:
docker-compose up -d localstack
npx ts-node scripts/seed.ts
# Expected: ✓ Seed complete. with items inserted

# 5. GitHub Actions will auto-run:
# - npm run format -- --check
# - npm run lint (includes scripts/)
# - npx tsc --noEmit
```

---

## 📋 Common Script Types & Patterns

### Pattern 1: Data Seed Script (`scripts/seed.ts`)

**Purpose**: Populate DynamoDB with test data for local development.

**Checklist:**

- [ ] Read DynamoDB config from env (region, endpoint, table name)
- [ ] Validate table exists before seeding
- [ ] Use BaseProvider pattern (if extracting to service)
- [ ] Log progress: items inserted, any failures
- [ ] Handle network errors gracefully

**Template:**

```typescript
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

/* eslint-disable i18next/no-literal-string */
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'dev-fintech-core-dynamodb-main';
const REGION = process.env.AWS_REGION || 'us-east-1';
const ENDPOINT = process.env.AWS_ENDPOINT || 'http://localhost:4566';
const TENANT_ID = process.env.DEMO_TENANT_ID || 'tenant-demo';
/* eslint-enable i18next/no-literal-string */

const client = new DynamoDBClient({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy',
  },
});

interface IOrderSeed {
  id: string;
  productName: string;
  amount: number;
}

async function seedOrders(orders: IOrderSeed[]): Promise<void> {
  /* eslint-disable-next-line i18next/no-literal-string */
  console.log(`✓ Seeding ${orders.length} orders for tenant "${TENANT_ID}"...`);

  for (const order of orders) {
    try {
      const item = {
        PK: `TENANT#${TENANT_ID}#ORDER`,
        SK: `ORDER#${order.id}`,
        id: order.id,
        tenantId: TENANT_ID,
        productName: order.productName,
        amount: order.amount,
        entityType: 'ORDER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deleted: false,
      };

      await client.send(
        new PutItemCommand({
          TableName: TABLE_NAME,
          Item: marshall(item),
        }),
      );

      /* eslint-disable-next-line i18next/no-literal-string */
      console.log(`  ✓ ${order.id} — ${order.productName}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      /* eslint-disable-next-line i18next/no-literal-string */
      console.error(`  ✗ Failed to seed ${order.id}: ${err.message}`);
      throw error;
    }
  }

  /* eslint-disable-next-line i18next/no-literal-string */
  console.log('✓ Seed complete.');
}

async function main() {
  try {
    const sampleOrders: IOrderSeed[] = [
      { id: 'order-001', productName: 'Premium Plan', amount: 29900 },
      { id: 'order-002', productName: 'Enterprise Plan', amount: 99900 },
    ];

    await seedOrders(sampleOrders);
    process.exit(0);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    /* eslint-disable-next-line i18next/no-literal-string */
    console.error(`✗ Seed failed: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();
```

### Pattern 2: Agent Runner Script (`scripts/dev.ts`, `scripts/dev-test.ts`)

**Purpose**: Call OpenAI (Copilot) to generate code based on GitHub issues.

**Checklist:**

- [ ] Validate COPILOT*TOKEN, ISSUE*\_, GITHUB\_\_ env vars
- [ ] Handle OpenAI API errors (rate limit, auth, timeout)
- [ ] Log API calls (input tokens, output tokens, response time)
- [ ] Write output files atomically (no partial writes)
- [ ] Graceful degradation if Copilot unavailable

**Key Security Points:**

- API_KEY never logged
- Request/response payloads logged safely (no secrets)
- Output files validated before writing

### Pattern 3: GitHub Automation Script (`scripts/move-card.ts`)

**Purpose**: Move issue cards on GitHub Project board via `gh` CLI.

**Checklist:**

- [ ] Validate GH*TOKEN, PROJECT*\*, ISSUE_NUMBER env vars
- [ ] Handle gh CLI errors (project doesn't exist, card not found)
- [ ] Parse JSON responses safely (with try-catch)
- [ ] Log what is being moved (from → to)
- [ ] Idempotent (moving to same column twice is OK)

---

## 🚫 Anti-Patterns (What NEVER to do in scripts)

| Anti-Pattern                  | Why Bad                             | Fix                                           |
| ----------------------------- | ----------------------------------- | --------------------------------------------- |
| Hardcoded API keys            | Security breach if exposed          | Use env vars + Secrets Manager                |
| `any` type casts              | Zero type safety                    | Use concrete types or type guards             |
| Literal strings in code       | ESLint errors, i18n violation       | Extract to const or eslint-disable            |
| Silent failures               | Operator doesn't know script failed | Always exit(1) on error, log fully            |
| No input validation           | Crashes on bad input                | Validate env, CLI args, API responses         |
| External npm deps             | Supply chain risk, bloat            | Use only Node.js + AWS SDK already in project |
| Async callbacks without await | Race conditions, ghost processes    | Use async/await properly                      |
| No logging                    | Can't debug in CI                   | Log major steps + errors                      |

---

## 🔗 References

- [Copilot Instructions](.github/copilot-instructions.md) — Architecture
- [Code Quality Skill](.github/skills/code-quality/SKILL.md) — Testing & JSDoc
- [CI Compliance](.github/CI-COMPLIANCE.md) — ESLint rules
- [Quality Checklist](.github/QUALITY-CHECKLIST.md) — Pre-commit validation
