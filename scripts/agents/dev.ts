import { execSync } from 'child_process';
import * as fs from 'fs';

/**
 * Dev Agent — Prepares issue for GitHub Copilot coding agent.
 * Creates branch, generates implementation checklist, posts to issue,
 * and assigns to Copilot for autonomous implementation.
 *
 * GitHub Copilot will:
 * 1. Read the issue and checklist
 * 2. Create a git branch with code
 * 3. Open a PR
 * 4. copilot-pr.yml will detect the PR and advance the card
 */
function devAgent(): void {
  const issueNumber = process.env.ISSUE_NUMBER ?? '';
  const issueTitle = process.env.ISSUE_TITLE ?? 'No title';
  const issueBody = process.env.ISSUE_BODY ?? 'No description';

  if (!issueNumber) {
    console.error('❌ ISSUE_NUMBER env var is required.');
    process.exit(1);
  }

  console.log(`🚀 Dev Agent — Issue #${issueNumber}: ${issueTitle}`);

  try {
    // 1. Create feature branch
    console.log(`📦 Creating branch: feat/issue-${issueNumber}`);
    createBranch(issueNumber);

    // 2. Generate and post implementation spec
    console.log('📋 Posting implementation checklist...');
    const spec = generateSpec(issueNumber, issueTitle, issueBody);
    postComment(issueNumber, spec);

    // 3. Assign to Copilot and add label
    console.log('🤖 Assigning to GitHub Copilot...');
    assignToCopilot(issueNumber);

    console.log(`\n✅ Dev Agent completed!`);
    console.log(`\n📌 GitHub Copilot will now:`);
    console.log(`   1. Implement the checklist`);
    console.log(`   2. Create a PR on feat/issue-${issueNumber}`);
    console.log(`   3. Trigger automatic board advancement\n`);
  } catch (error) {
    console.error(`❌ Dev Agent failed: ${error}`);
    process.exit(1);
  }
}

/**
 * Create and checkout feature branch.
 */
function createBranch(issueNumber: string): void {
  const branchName = `feat/issue-${issueNumber}`;

  try {
    // Fetch latest and create branch
    execSync('git fetch origin 2>/dev/null || true', { stdio: 'pipe' });
    execSync(
      `git checkout -b ${branchName} origin/main 2>/dev/null || git checkout ${branchName} 2>/dev/null || true`,
      {
        stdio: 'pipe',
      },
    );
    console.log(`✅ Branch ready: ${branchName}`);
  } catch (error) {
    console.warn(`⚠️  Branch operation: ${error}`);
  }
}

/**
 * Generate implementation checklist based on issue.
 */
function generateSpec(issueNumber: string, title: string, body: string): string {
  return `## 🤖 Dev Agent — Implementation Spec

**Issue:** #${issueNumber} — ${title}

**Description:**
${body}

---

### 📋 Implementation Checklist

#### 1️⃣ Entity & Data Model
- [ ] Define TypeScript interface (fields, types)
- [ ] Design DynamoDB PK/SK: \`TENANT#[tenantId]#[ENTITY]\`, \`[ENTITY]#[id]\`
- [ ] Plan soft-delete strategy

#### 2️⃣ Data Access Layer
- [ ] Create Service extending \`BaseResourceService<T>\`
- [ ] Implement CRUD methods (create, findOne, findAll, update, delete)
- [ ] Add pagination support (PaginatedResult<T>)
- [ ] Publish events via SNS (if applicable)
- [ ] Record audit trail (AuditTrailService)

#### 3️⃣ API Layer
- [ ] Create DTOs (Create, Update, Response)
- [ ] Create Controller with routes
- [ ] Add \`@ApiBearerAuth()\` for JWT protection
- [ ] Use \`ITenantRequest\` for multi-tenancy
- [ ] Add Swagger documentation (\`@ApiProperty\`)

#### 4️⃣ Module & Integration
- [ ] Create Module file
- [ ] Register providers (DynamoDB, SNS, SQS if needed)
- [ ] Export public API
- [ ] Import in AppModule

#### 5️⃣ Event Handling (if needed)
- [ ] Create EventPublisher (SNS)
- [ ] Create Consumer (SQS)
- [ ] Configure queue + DLQ

#### 6️⃣ Configuration & i18n
- [ ] Add error messages to \`src/common/i18n/en.json\`
- [ ] Add translations to \`src/common/i18n/pt-BR.json\`

#### 7️⃣ Infrastructure
- [ ] Add Terraform resources (tables, queues, topics)
- [ ] Update Lambda IAM policies if needed

#### 8️⃣ Code Quality
- [ ] Max 200 lines per file
- [ ] JSDoc on all public methods
- [ ] Use ErrorCode enum for errors
- [ ] Max 15 cognitive complexity
- [ ] Zero \`any\` types

---

### 🏗️ Iron Dome Architecture Rules

**MANDATORY:**
- ✅ ONLY **DynamoDB** (BaseResourceService)
- ✅ **PK/SK pattern:** \`TENANT#tenantId#ENTITY\` / \`ENTITY#id\`
- ✅ **Multi-tenancy:** \`x-tenant-id\` header + \`ITenantRequest\`
- ✅ **Pagination:** cursor-based \`PaginatedResult<T>\`
- ✅ **Soft-delete:** \`deleted: true\` + \`updatedAt\`
- ✅ **JWT:** \`@ApiBearerAuth()\` on controller
- ✅ **Audit:** \`AuditTrailService.record()\` on CUD
- ✅ **i18n:** \`I18nService.translate()\` for user messages
- ✅ **Code:** English, max 200 lines/file, JSDoc

**Events (if applicable):**
- SNS topic for events (created, updated, deleted)
- SQS consumer for async processing
- Fire-and-forget (never block main flow)

---

**Reference:** [.github/agents/dev.agent.md](.github/agents/dev.agent.md)

---

**Next steps:**
1. Copilot generates code following this checklist
2. Copilot creates a PR on \`feat/issue-${issueNumber}\`
3. GitHub workflow detects PR → advances card to Dev-Test
4. Dev-Test agent generates unit + integration tests

---

*Assigned to GitHub Copilot coding agent. Ready to code! 🚀*`;
}

/**
 * Post implementation spec as issue comment.
 */
function postComment(issueNumber: string, body: string): void {
  const tmpFile = `/tmp/dev_spec_${issueNumber}.md`;
  fs.writeFileSync(tmpFile, body);

  try {
    execSync(`gh issue comment ${issueNumber} --body-file "${tmpFile}"`, {
      stdio: 'pipe',
    });
    console.log(`✅ Spec posted on issue #${issueNumber}`);
  } catch (error) {
    console.warn(`⚠️  Failed to post comment: ${error}`);
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

/**
 * Assign issue to Copilot and add label.
 */
function assignToCopilot(issueNumber: string): void {
  try {
    // Create label if missing
    execSync(
      'gh label create copilot-working --color "0075ca" --description "GitHub Copilot working" 2>/dev/null || true',
      {
        stdio: 'pipe',
      },
    );

    // Add label
    execSync(`gh issue edit ${issueNumber} --add-label "copilot-working"`, {
      stdio: 'pipe',
    });

    console.log(`✅ Label "copilot-working" added to issue #${issueNumber}`);
  } catch (error) {
    console.warn(`⚠️  Failed to add label: ${error}`);
  }
}

// Main
devAgent();
