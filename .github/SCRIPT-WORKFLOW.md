---
name: 'Script Development Workflow'
description: 'Workflow seguro para criar/editar scripts em scripts/ com validação de entrada, logging estruturado, tratamento de erro robusto, zero hardcoded secrets, e conformidade total com CI.'
---

# Script Development Workflow — Segurança & Qualidade

Todo script em `scripts/` **DEVE** seguir este workflow para garantir que funcione de forma segura, auditável e sem quebrar em produção.

---

## 📋 Pre-Development Checklist

Antes de começar a escrever um novo script, valide:

- [ ] **Propósito claro**: O que o script faz? (seed, migration, agent runner, etc)
- [ ] **Inputs**: Quais env vars ou CLI args precisa?
- [ ] **Outputs**: O que o script produz? (files, DB changes, logs?)
- [ ] **Error cases**: O que pode dar errado? (missing env, API timeout, file not found)
- [ ] **Pattern**: Qual padrão de script usar? (seed, agent runner, automation?)

**Documentação obrigatória no topo do arquivo:**
```typescript
/**
 * Script: [Name]
 * Purpose: [One-line description]
 * Usage: npx ts-node scripts/[name].ts [ARG1] [ARG2]
 * Required ENV: REQUIRED_VAR1, REQUIRED_VAR2
 * Optional ENV: OPTIONAL_VAR (default: 'value')
 * Exit codes: 0 = success, 1 = error
 * Example: npx ts-node scripts/seed.ts
 */
```

---

## 🛠️ Step-by-Step Development

### Step 1: Setup & Validation

**Read the Pattern:**
- Data seed → [Skill: Script Quality — Pattern 1](.github/skills/script-quality/SKILL.md#pattern-1-data-seed-script)
- Agent runner → [Skill: Script Quality — Pattern 2](.github/skills/script-quality/SKILL.md#pattern-2-agent-runner-script)
- GitHub automation → [Skill: Script Quality — Pattern 3](.github/skills/script-quality/SKILL.md#pattern-3-github-automation-script)

**Create file:**
```bash
touch scripts/my-script.ts
```

**Add JSDoc header** (see above)

### Step 2: Implement with Guardrails

**1. Validate Environment Variables**
```typescript
const REQUIRED_VARS = ['VAR1', 'VAR2'];
const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const var1 = process.env.VAR1!;  // Non-null assertion after validation
const var2 = process.env.VAR2!;  // Safe to use
```

**2. Validate CLI Arguments**
```typescript
const targetColumn = process.argv[2];
if (!targetColumn) {
  console.error('Usage: npx ts-node scripts/my-script.ts <columnName>');
  process.exit(1);
}
```

**3. Structured Logging**
```typescript
/* eslint-disable-next-line i18next/no-literal-string */
console.log('✓ Starting script...');
/* eslint-disable-next-line i18next/no-literal-string */
console.log(`  → Reading configuration from ENV`);

try {
  // Do work
  /* eslint-disable-next-line i18next/no-literal-string */
  console.log(`  ✓ Completed successfully (${count} items)`);
} catch (error) {
  const err = error instanceof Error ? error : new Error(String(error));
  /* eslint-disable-next-line i18next/no-literal-string */
  console.error(`✗ Failed: ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
}
```

**4. Type All Function Signatures**
```typescript
// ❌ BAD
async function processData(items) {
  for (const item of items) {
    // ...
  }
}

// ✅ GOOD
interface IItem {
  id: string;
  name: string;
}

async function processData(items: IItem[]): Promise<void> {
  for (const item of items) {
    console.log(item.id); // Type-safe
  }
}
```

**5. Robust Error Handling**
```typescript
async function fetchData(url: string): Promise<unknown> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    /* eslint-disable-next-line i18next/no-literal-string */
    console.error(`Failed to fetch: ${err.message}`);
    throw error; // Re-throw for main catch
  }
}

async function main() {
  try {
    await fetchData('https://api.example.com/data');
  } catch (error) {
    // Log + exit
    process.exit(1);
  }
}

main();
```

**6. No Hardcoded Secrets**
```typescript
// ❌ BAD
const apiKey = 'sk_live_abc123';
const credentials = { accessKeyId: 'AKIA...', secretAccessKey: '...' };

// ✅ GOOD
const apiKey = process.env.OPENAI_API_KEY!;
const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy',
};
```

### Step 3: Code Quality Checks (Local)

```bash
# 1. Format
npm run format
# Expected: Script reformatted (if needed)

# 2. Lint
npm run lint
# Expected: scripts/my-script.ts passes (ZERO warnings)
# If fails: Use eslint-disable for safe violations (i18next literal strings)

# 3. Type check
npx tsc --noEmit
# Expected: No type errors

# 4. Manual review
✓ No hardcoded secrets?
✓ All env vars validated?
✓ All async ops in try-catch?
✓ Structured logging with emojis?
✓ All functions typed?
✓ Clear error messages?
✓ Exit codes correct (0/1)?
✓ No literal strings (or documented)?
✓ No external npm deps?
```

### Step 4: Local Test

**For seed scripts:**
```bash
# Start LocalStack
docker-compose up -d localstack

# Run script
npx ts-node scripts/my-script.ts

# Verify data
aws dynamodb scan \
  --table-name dev-fintech-core-dynamodb-main \
  --endpoint-url http://localhost:4566 \
  --region us-east-1
```

**For agent runners:**
```bash
# Set test env vars
export COPILOT_TOKEN=ghu_...
export ISSUE_TITLE="Test issue"
export ISSUE_BODY="Test body"
export ISSUE_NUMBER=123

# Run script
npx ts-node scripts/dev.ts

# Check generated files
git status
cat src/modules/test/test.service.ts
```

**For automation scripts:**
```bash
# Set GitHub env vars
export GH_TOKEN=ghp_...
export GITHUB_REPOSITORY=owner/repo
export PROJECT_NUMBER=123
export ISSUE_NUMBER=456

# Run script
npx ts-node scripts/move-card.ts "Dev"

# Verify in GitHub UI (project board)
```

### Step 5: Commit & Push

```bash
# Stage
git add scripts/my-script.ts

# Commit with conventional format
git commit -m "feat(scripts): add my-script for [purpose]

- Validate required env vars (VAR1, VAR2)
- Implement [main logic with detail]
- Structured logging with emoji indicators
- Robust error handling (try-catch all async)
- Zero hardcoded secrets
- Type-safe function signatures
- Manual test: npx ts-node scripts/my-script.ts ✓"

# Push
git push origin branch-name
```

### Step 6: CI Validation

GitHub Actions automatically validates:
- ✅ `npm run format -- --check` (scripts/ included)
- ✅ `npm run lint` (scripts/ included)
- ✅ `npx tsc --noEmit` (scripts/ included)

**If CI fails:**
1. Read GitHub Actions error message
2. Consult [Script Quality Skill](.github/skills/script-quality/SKILL.md)
3. Fix locally (likely missing type, hardcoded secret, or literal string)
4. Re-test locally
5. Commit & push again

---

## 📝 Template Scripts

### Template 1: Seed Script
```typescript
/**
 * Script: seed
 * Purpose: Populate DynamoDB with test data for local development
 * Usage: npx ts-node scripts/seed.ts
 * Required ENV: (none for local dev, uses defaults)
 * Exit codes: 0 = success, 1 = error
 */
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

interface IOrderData {
  id: string;
  productName: string;
  amount: number;
}

async function seedOrders(orders: IOrderData[]): Promise<void> {
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

async function main(): Promise<void> {
  try {
    const sampleOrders: IOrderData[] = [
      { id: 'order-001', productName: 'Premium Plan', amount: 29900 },
      { id: 'order-002', productName: 'Enterprise Plan', amount: 99900 },
      { id: 'order-003', productName: 'Starter Plan', amount: 9900 },
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

### Template 2: Agent Runner Script
See [Script Quality Skill — Pattern 2](.github/skills/script-quality/SKILL.md#pattern-2-agent-runner-script)

### Template 3: GitHub Automation Script
See [Script Quality Skill — Pattern 3](.github/skills/script-quality/SKILL.md#pattern-3-github-automation-script)

---

## 🔗 References

- [Script Quality Skill](.github/skills/script-quality/SKILL.md) — All patterns & anti-patterns
- [Code Quality Skill](.github/skills/code-quality/SKILL.md) — Testing & JSDoc
- [CI Compliance](.github/CI-COMPLIANCE.md) — ESLint rules that apply to scripts
- [Quality Checklist](.github/QUALITY-CHECKLIST.md) — Pre-commit validation steps

