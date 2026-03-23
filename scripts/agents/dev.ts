import { execSync } from 'child_process';
import * as fs from 'fs';

/**
 * Dev Agent — Prepares issue for GitHub Copilot coding agent.
 * Reads issue details, generates a specification comment,
 * and assigns the issue to Copilot for implementation.
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

  // Generate specification template for Copilot
  const spec = generateSpecTemplate(issueTitle, issueBody);

  // Post specification as comment
  postComment(issueNumber, spec);

  // Assign to Copilot
  assignToCopilot(issueNumber);

  console.log(`✅ Issue #${issueNumber} ready for GitHub Copilot.`);
}

/**
 * Generates a Markdown specification template.
 * @param title - Issue title
 * @param body - Issue body/description
 * @returns Markdown specification
 */
function generateSpecTemplate(title: string, body: string): string {
  return `## 🤖 Dev Agent — Implementation Spec for GitHub Copilot

**Issue:** ${title}

**Description:**
${body}

---

### 📋 Implementation Checklist

#### 1. Entity Design
- [ ] Define entity interface (fields, types, optional/required)
- [ ] Plan DynamoDB PK/SK: \`TENANT#[tenantId]#[ENTITY]\`, \`[ENTITY]#[id]\`
- [ ] Identify lifecycle (soft-delete, audit trail, timestamps)

#### 2. Service Layer
- [ ] Extend \`BaseResourceService<T>\` for CRUD
- [ ] Implement \`create(tenantId, createDto)\` with AuditTrail
- [ ] Implement \`findOne(tenantId, id)\` with soft-delete filter
- [ ] Implement \`findAll(tenantId, pagination)\` returning \`PaginatedResult<T>\`
- [ ] Implement \`update(tenantId, id, updateDto)\` with AuditTrail
- [ ] Implement \`delete(tenantId, id)\` (soft-delete only)

#### 3. Event Publishing (if needed)
- [ ] Create \`[Entity]EventPublisher\` with SNS topic
- [ ] Publish events: \`publishCreated(tenantId, entity)\`
- [ ] Publish events: \`publishUpdated(tenantId, entity)\`
- [ ] Publish events: \`publishDeleted(tenantId, id)\`

#### 4. SQS Consumer (if needed)
- [ ] Create \`[Entity]ProcessorService extends SqsConsumerService\`
- [ ] Handle message polling and processing

#### 5. Controller
- [ ] Add \`@ApiBearerAuth()\` at class level
- [ ] \`POST /\` → \`create(@Request() req: ITenantRequest, @Body() dto)\`
- [ ] \`GET /\` → \`findAll(@Request() req: ITenantRequest, @Query() pagination: PaginationQueryDto)\`
- [ ] \`GET /:id\` → \`findOne(@Request() req: ITenantRequest, @Param('id') id: string)\`
- [ ] \`PATCH /:id\` → \`update(@Request() req: ITenantRequest, @Param('id') id, @Body() dto)\`
- [ ] \`DELETE /:id\` → \`delete(@Request() req: ITenantRequest, @Param('id') id)\`

#### 6. DTOs
- [ ] \`Create[Entity]Dto\` with \`@IsNotEmpty()\`, \`@IsString()\`, etc.
- [ ] \`Update[Entity]Dto\` (partial)
- [ ] \`[Entity]ResponseDto\` with \`@ApiProperty()\`

#### 7. Module Registration
- [ ] Import \`DynamoDBProvider\`, \`SNSProvider\` (if events)
- [ ] Register service, controller, event publisher, consumer

#### 8. Terraform (if new AWS resources)
- [ ] Add DynamoDB table or GSI in \`infra/terraform/main.tf\`
- [ ] Add SNS topic (if events)
- [ ] Add SQS queue + DLQ (if consumer)

#### 9. i18n (if user-facing messages)
- [ ] Add keys to \`src/common/i18n/en.json\`
- [ ] Add keys to \`src/common/i18n/pt-BR.json\`
- [ ] Use \`I18nService.translate(key, args)\` in service/controller

#### 10. Code Quality
- [ ] Max 200 lines/file
- [ ] JSDoc on all public methods
- [ ] Use \`ObfuscationService.obfuscate()\` before logging sensitive data
- [ ] Error handling via \`ErrorCode\` enum
- [ ] Max 15 cognitive complexity (SonarJS)

---

### 🏗️ Iron Dome Architecture Rules

**MANDATORY:**
- ✅ ONLY DynamoDB (never PostgreSQL/Prisma)
- ✅ Extend \`BaseResourceService\` for CRUD
- ✅ PK: \`TENANT#[tenantId]#[ENTITY]\`, SK: \`[ENTITY]#[id]\`
- ✅ JWT: \`@Public()\` decorator for bypass, \`@ApiBearerAuth()\` on controller
- ✅ Multi-tenancy: \`x-tenant-id\` header + \`ITenantRequest\` type
- ✅ Pagination: cursor-based \`PaginatedResult<T>\` only
- ✅ Soft-delete: \`deleted: true\` + \`updatedAt\` timestamp
- ✅ Audit Trail: \`AuditTrailService.record(tenantId, action, resourceType, id)\`
- ✅ Events: SNS/SQS fire-and-forget, never break main flow
- ✅ i18n: All user messages via \`I18nService.translate()\`
- ✅ AWS Naming: \`BaseProvider.getResourceName(type, name)\`

**Code:**
- Code and comments in English
- User messages via i18n (Portuguese + English)
- ZERO \`any\` types (strict TypeScript)

---

**Reference:** See [.github/agents/dev.agent.md](.github/agents/dev.agent.md) for complete Iron Dome architecture guide.

---

*Assigned to GitHub Copilot via automated workflow. Ready to code! 🚀*`;
}

/**
 * Posts specification comment on the issue.
 * @param issueNumber - GitHub issue number
 * @param body - Markdown comment body
 */
function postComment(issueNumber: string, body: string): void {
  const tmpFile = `/tmp/dev_spec_${issueNumber}.md`;
  fs.writeFileSync(tmpFile, body);

  try {
    execSync(`gh issue comment ${issueNumber} --body-file "${tmpFile}"`, {
      stdio: 'inherit',
    });
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

/**
 * Assigns the issue to GitHub Copilot coding agent.
 * @param issueNumber - GitHub issue number
 */
function assignToCopilot(issueNumber: string): void {
  try {
    // Create label if it doesn't exist
    execSync('gh label create copilot-working --color "0075ca" --description "GitHub Copilot working" 2>/dev/null || true');
    // Add label
    execSync(`gh issue edit ${issueNumber} --add-label "copilot-working" 2>/dev/null || true`);
    console.log(`✅ Assigned to GitHub Copilot (label: copilot-working)`);
  } catch (error) {
    console.warn('⚠️  Could not add label. Continuing...');
  }
}

devAgent();
