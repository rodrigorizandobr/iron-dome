# Dev Agent

Creates the feature branch and posts the implementation specification.

## Execute

```bash
BRANCH="feat/issue-${ISSUE_NUMBER}"

cat <<EOF
## 🚀 Dev — Issue #${ISSUE_NUMBER}

**${ISSUE_TITLE}**

### Branch: \`${BRANCH}\`

### 📋 Implementation Checklist

#### 1️⃣ Entity & Data Model
- [ ] TypeScript interface
- [ ] DynamoDB PK/SK: \`TENANT#[tenantId]#[ENTITY]\` / \`[ENTITY]#[id]\`

#### 2️⃣ Service Layer
- [ ] Extends \`BaseResourceService<T>\`
- [ ] CRUD: create, findOne, findAll, update, remove
- [ ] \`PaginatedResult<T>\` pagination
- [ ] SNS events + AuditTrailService

#### 3️⃣ API Layer
- [ ] Controller with DTOs (Create, Update, Response)
- [ ] \`@ApiBearerAuth()\` + \`ITenantRequest\`
- [ ] Swagger documentation

#### 4️⃣ Module & Integration
- [ ] Module file + register in AppModule

#### 5️⃣ Config
- [ ] i18n keys in en.json + pt-BR.json
- [ ] Error codes in \`ErrorCode\` enum

---
*Dev spec posted by Board Agent.*
EOF
```
