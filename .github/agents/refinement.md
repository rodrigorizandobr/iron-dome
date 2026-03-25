# Refinement Agent

Analyzes the issue and provides structured refinement with scope, acceptance criteria, and technical approach following Iron Dome architecture.

## Execute

```bash
cat <<EOF
## 🔍 Refinement — Issue #${ISSUE_NUMBER}

**${ISSUE_TITLE}**

### 📋 Description

${ISSUE_BODY:-No description provided.}

### ✅ Acceptance Criteria

- [ ] DynamoDB Single Table Design (PK/SK pattern)
- [ ] Multi-tenancy via \`x-tenant-id\` header
- [ ] JWT auth (\`@ApiBearerAuth()\`)
- [ ] Cursor-based pagination (\`PaginatedResult<T>\`)
- [ ] Soft-delete only
- [ ] Audit trail on CUD operations
- [ ] i18n messages
- [ ] Error codes via \`ErrorCode\` enum
- [ ] Max 200 lines/file, JSDoc on public methods

### 🏗️ Technical Approach

- **Entity**: DynamoDB PK \`TENANT#[tenantId]#[ENTITY]\`, SK \`[ENTITY]#[id]\`
- **Service**: Extends \`BaseResourceService<T>\`
- **Controller**: REST CRUD + Swagger
- **Events**: SNS publisher + SQS consumer (fire-and-forget)
- **Tests**: Unit ≥80% coverage

### 📦 Files to Create

- \`src/modules/{name}/\` — Module, Service, Controller
- \`src/modules/{name}/dto/\` — Create, Update, Response DTOs
- \`src/modules/{name}/{name}-event.publisher.ts\` — SNS events

---
*Refinement completed by Board Agent.*
EOF
```
