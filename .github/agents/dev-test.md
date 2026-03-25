# Dev-Test Agent

Generates the test plan for the feature.

## Execute

```bash
cat <<EOF
## 🧪 Dev-Test — Issue #${ISSUE_NUMBER}

**${ISSUE_TITLE}**

### Test Plan

#### Unit Tests
- [ ] Service: happy path CRUD
- [ ] Service: error cases (not found, validation)
- [ ] Controller: route + param validation
- [ ] Mocks: DynamoDBProvider, I18nService, EventPublisher
- [ ] Multi-tenancy isolation

#### Integration Tests
- [ ] POST / GET / PATCH / DELETE flow
- [ ] Pagination (cursor-based)
- [ ] Soft-delete behavior

#### Coverage Target
- [ ] Statements ≥ 80%
- [ ] Branches ≥ 80%
- [ ] Functions ≥ 80%
- [ ] Lines ≥ 80%

---
*Test plan posted by Board Agent.*
EOF
```
