# Team Decisions — Iron Dome

Shared memory for architectural decisions made by the AI team.
Every agent appends decisions here for cross-session persistence.

---

## Architecture

- **Database**: DynamoDB Single Table Design only. No relational DB ever.
- **PK/SK**: `TENANT#[tenantId]#[ENTITY]` / `[ENTITY]#[id]`
- **Delete**: Soft-delete only (`deleted: true`). Never physical delete.
- **Auth**: JWT global guard. Use `@Public()` to bypass.
- **Multi-tenancy**: `x-tenant-id` header on every request.

## Conventions

- Code and comments in English. User messages via i18n.
- Max 200 lines per file, max 15 cognitive complexity.
- JSDoc on all public methods.
- Branch naming: `feat/issue-{N}` for feature branches.
- Commit messages: `feat:`, `fix:`, `test:`, `docs:` prefixes.

## Module Pattern

Every new module follows `src/modules/orders/` as reference:

- `{entity}.module.ts` — NestJS module
- `{entity}.service.ts` — extends `BaseResourceService<T>`
- `{entity}.controller.ts` — REST CRUD + JWT + Pagination + ITenantRequest
- `{entity}-event.publisher.ts` — SNS events (fire-and-forget)
- `{entity}-processor.service.ts` — SQS consumer
- `dto/create-{entity}.dto.ts` — Swagger + class-validator
- `dto/update-{entity}.dto.ts` — PartialType
- `dto/{entity}-response.dto.ts` — Swagger response

## Testing

- Unit: `*.spec.ts` (CommonJS, jest-unit.json), ≥84% coverage per service
- Integration: `*.int-spec.ts` (ESM, jest-int.json), full HTTP flow
- ESM rule: use `mockImplementation(() => Promise.resolve(...))`, never `mockResolvedValue`
- CI command: `npm run ci` (audit + prettier + eslint + build + unit + integration)

## Pipeline Columns

| Column     | Agent            | Action                                       |
| ---------- | ---------------- | -------------------------------------------- |
| to-do      | —                | Backlog, no processing                       |
| refinement | refinement       | Analyze issue, write BDD acceptance criteria |
| dev        | dev              | Implement feature code                       |
| dev-test   | dev-test         | Write unit + integration tests               |
| testing    | board-agent (CI) | Run `npm run ci`, pass→pr, fail→dev          |
| pr         | pr               | Create PR, finalize                          |
| done       | —                | Merged, closed                               |

- **#42** [2026-03-30 19:23 UTC]: Moved from refinement to dev
- **#42** [2026-03-30 19:23 UTC]: Moved from testing to dev
