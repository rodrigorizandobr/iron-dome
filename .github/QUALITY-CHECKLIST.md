# ⚡ Quality Checklist — Copy & Paste Before Commit

Use este checklist imediatamente antes de fazer `git commit`. Se todos os ✅ estiverem green, o código passará no CI.

---

## Local Validation (Execute in Order)

```bash
# 1️⃣ Format
npm run format && npm run format -- --check
# OUTPUT: "All matched files use Prettier code style!"

# 2️⃣ Lint
npm run lint
# OUTPUT: (ZERO errors, ZERO warnings — if failures, see CI-COMPLIANCE.md)

# 3️⃣ Type Check
npx tsc --noEmit
# OUTPUT: (no output = no errors)

# 4️⃣ Unit Tests
npm run test:unit
# OUTPUT: "Test Suites: X passed, X total" + "Lines: 85%+"

# 5️⃣ Integration Tests
npm run test:integrated
# OUTPUT: "Test Suites: X passed, X total" + "Lines: 80%+"

# 6️⃣ Commit
git add -A
git commit -m "type(scope): description"
# Conventional format: feat|fix|test|chore|docs|refactor|ci

# 7️⃣ Push
git push origin branch-name
```

---

## Code Checklist (Before Running Tests)

- [ ] **Max Lines**: File < 200 lines
- [ ] **Complexity**: No function > 15 branches
- [ ] **Interfaces**: All start with `I` (e.g., `IUserService`)
- [ ] **JSDoc**: All public methods documented
- [ ] **Types**: No `any` type, use concrete or `unknown + guard`
- [ ] **Constants**: Duplicated strings (≥3x) extracted to `const`
- [ ] **i18n**: User messages via `I18nService.translate()`
- [ ] **Secrets**: No hardcoded API keys/passwords (use `ConfigService`)
- [ ] **Imports**: All unused imports removed
- [ ] **Async/Await**: Fire-and-forget errors logged, not thrown

---

## Architecture Checklist (For New Modules)

- [ ] **Service**: Extends `BaseResourceService`
- [ ] **Database**: DynamoDB (no PostgreSQL, no Prisma)
- [ ] **PK/SK**: Format `TENANT#[tenantId]#[ENTITY]` and `[ENTITY]#[id]`
- [ ] **Multi-Tenant**: `tenantId` in all `create()` calls
- [ ] **Soft-Delete**: `deleted: true` flag, never physical delete
- [ ] **Events**: SNS publish on create/update/delete
- [ ] **Audit**: `AuditTrailService.record()` on CUD
- [ ] **Controller**: `@ApiBearerAuth()` class-level + `ITenantRequest`
- [ ] **Providers**: Extend `BaseProvider`, use `getAwsConfig()`
- [ ] **Tests**: 85%+ unit, 80%+ integration coverage

---

## Commit Message Template

```
feat(orders): implement order CRUD with soft-delete

- [ONE LINE PER FEATURE]
- Service extends BaseResourceService
- Multi-tenant PK isolation
- Soft-delete flag handling
- SNS event publishing
- Audit trail integration
- 85% unit test coverage
- [ZERO ESLint warnings]
```

---

## If CI Fails on GitHub Actions

| Error                                  | Fix                                          |
| -------------------------------------- | -------------------------------------------- |
| `Unsafe member access .field on 'any'` | Cast: `obj as IType`                         |
| `disallow literal string`              | Use `const` or `// eslint-disable-next-line` |
| `duplicate string 'pending' 3x`        | `const PENDING = 'pending'`                  |
| `File > 200 lines`                     | Split into 2 modules                         |
| `Cognitive complexity > 15`            | Refactor into smaller functions              |
| `coverage < 85%`                       | Add more unit tests                          |
| `coverage < 80%`                       | Add more integration tests                   |
| `API key found`                        | Move to `.env` or Secrets Manager            |

---

## Help Links

- **Full CI Guide**: [CI-COMPLIANCE.md](.github/CI-COMPLIANCE.md)
- **Agent Instructions**: [CI-COMPLIANCE-AGENTS.md](.github/agents/CI-COMPLIANCE-AGENTS.md)
- **Workflow Steps**: [AGENT-WORKFLOW.md](.github/AGENT-WORKFLOW.md)
- **Architecture**: [api-guardian.agent.md](.github/agents/api-guardian.agent.md)
- **Code Quality Skill**: [skills/code-quality/SKILL.md](.github/skills/code-quality/SKILL.md)

---

**Remember**: Local validation PREVENTS CI failures. Always run the 6 gates before pushing.
