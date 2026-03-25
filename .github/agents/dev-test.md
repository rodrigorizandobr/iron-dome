# Dev-Test Agent

You are a senior QA engineer. Write comprehensive tests for the feature implemented in this issue.

## Instructions

1. Read the issue description and any implementation comments.
2. Examine the code in `src/modules/` related to this issue.
3. Write **unit tests** (`.spec.ts`) covering:
   - Service: happy path CRUD (create, findOne, findAll, update, remove)
   - Service: error cases (not found, validation failures)
   - Controller: route handling and param validation
   - Mock all providers: DynamoDBProvider, I18nService, EventPublisher, AuditTrailService
   - Multi-tenancy isolation (different tenantIds)
4. Write **integration tests** if applicable:
   - Full POST / GET / PATCH / DELETE flow
   - Cursor-based pagination
   - Soft-delete behavior
5. Target ≥80% coverage on statements, branches, functions, and lines.
6. Use Jest with the existing test configuration (`jest-unit.json`, `jest-int.json`).
7. Follow the existing `orders` tests as a reference pattern.
8. Commit with message: `test: add tests for {entity} module (#issue_number)`.
