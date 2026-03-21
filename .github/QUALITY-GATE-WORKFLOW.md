# 🛡️ Quality Gate Workflow — Agent Guidelines

**Objetivo**: Garantir que todo código (e toda documentação relacionada) passa por gates de qualidade ANTES de commit. Previne regressions e erros repetitivos.

---

## 1. Pre-Commit Checklist (OBRIGATÓRIO)

Antes de qualquer commit, execute EM SEQUÊNCIA:

### 1.1 Formatting
```bash
npm run format
# Deve sair sem mudanças ao código (idempotent)
```
✅ **Deve passar silenciosamente**

### 1.2 Linting
```bash
npm run lint
# Zero errors allowed. Warnings OK (88 acceptable warnings).
```
✅ **ZERO errors** — Se houver erro, é bloqueador

### 1.3 Type Checking
```bash
npm run typecheck
# Typescript compilation, strictNullChecks, etc
```
✅ **ZERO type errors** — Se houver erro, é bloqueador

### 1.4 Unit Tests
```bash
npm run test:unit
# Fast, no coverage (~3s)
```
✅ **Todos os testes devem passar**

### 1.5 Unit Tests com Coverage (CRÍTICO)
```bash
npm run test:unit -- --coverage
# Uses v8 provider, não babel-plugin-istanbul
# Toma ~10s
```
✅ **Testes + coverage devem passar SEM erros de instrumentação**

**Se falhar com "TypeError: original argument must be of type function":**
→ Verifique `jest-unit.json` tem `"coverageProvider": "v8"`
→ Verifique `collectCoverageFromChildProcesses` foi removido
→ Consulte `.github/CI-COMPLIANCE.md` Scenario 6

---

## 2. What MUST be Tested (Test Strategy)

| Componente           | Arquivo              | Coverage Min | Estratégia                    |
| -------------------- | -------------------- | ------------ | ----------------------------- |
| Service (CRUD logic) | `*.service.ts`       | **75%**      | Unit test com mocks           |
| Controller (routes)  | `*.controller.ts`    | Integração   | E2E/Integration test          |
| Provider (AWS API)   | `*provider.ts`       | Integração   | Mock SDK calls                |
| DTO (data objects)   | `*.dto.ts`           | **0%**       | Não testável (dados, sem lógica) |
| Guard (auth)         | `*guard.ts`          | Integração   | Mock JWT payload              |
| Middleware           | `*middleware.ts`     | Integração   | Mock req/res objects          |

---

## 3. Common Failures & Solutions (Quick Reference)

### Problem: ESLint Error
**Symptom**: `npm run lint` fails with non-zero exit code
```
✖ 42 problems (42 errors)
```
**Fix**: Check `.github/CI-COMPLIANCE.md`→Scenario 1 (ESLint)
- Usually: unsafe `any`, max-lines exceeded, naming convention
- Run: `npm run lint -- --fix` (auto-repairs many issues)

### Problem: Jest Coverage Error
**Symptom**: `TypeError: original argument must be of type function`
```
at promisify (node:internal/util:481:3)
at Object.<anonymous> (/node_modules/test-exclude/index.js:5:14)
```
**Fix**: Check `.github/CI-COMPLIANCE.md`→Scenario 6 (Jest Coverage)
- Ensure `jest-unit.json` has `"coverageProvider": "v8"`
- Remove `collectCoverageFromChildProcesses` (invalid option)
- Re-run: `npm run test:unit -- --coverage`

### Problem: Coverage Threshold Failure
**Symptom**: `Jest: "global" coverage threshold for statements (80%) not met: 24%`
```
Jest: "global" coverage threshold for statements (80%) not met: 24.71%
Jest: "global" coverage threshold for functions (40%) not met: 12.96%
```
**Fix**: Check `.github/skills/code-quality/SKILL.md`→"Jest Coverage Configuration"
- Use **module-specific thresholds**, not global
- Only enforce threshold on modules with tests
- Example: orders.service.ts at 75%, all others no threshold

---

## 4. Gate Execution Order (CI Pipeline)

Each gate MUST run in order. If ANY gate fails, pipeline stops:

```
1️⃣ Prettier (format check)
   ↓
2️⃣ ESLint (linting)
   ↓
3️⃣ TypeScript (type checking)
   ↓
4️⃣ Unit Tests (test execution)
   ↓
5️⃣ Unit Tests Coverage (v8 provider)
   ↓
6️⃣ Security Scan (SAST)
```

**CI config**: `.github/workflows/ci.yml`

---

## 5. Documentation Must Stay in Sync

Whenever you change behavior (like fixing Jest), UPDATE docs in this order:

### 5.1 Skill Files (.github/skills/*/SKILL.md)
- Update relevant section explaining the **why** and **how**
- Include code examples
- Mention file types that DON'T need testing

### 5.2 Compliance Guides (.github/CI-COMPLIANCE.md)
- Add or update Scenario describing the **exact symptom**
- Provide **step-by-step fix**
- Explain **root cause** (prevents future mistakes)

### 5.3 Agent Guides (.github/agents/CI-COMPLIANCE-AGENTS.md)
- Update checklist items for agents to verify
- Add subsection "If failing — [Error Name]"
- Link to Scenario in CI-COMPLIANCE.md for details

### 5.4 Code Comments (if complex logic)
- JSDoc on public methods
- Comments for non-obvious decisions

---

## 6. Testing Best Practices

### Unit Tests (jest-unit.json)
- **Fast**: Mocks all external dependencies (DynamoDB, SNS, etc)
- **Coverage**: 75%+ on **tested modules only** (orders.service.ts)
- **Thresholds**: Module-specific, not global
- **Provider**: v8 (native Node.js coverage)

```bash
npm run test:unit                    # ~3s, no coverage
npm run test:unit -- --coverage      # ~10s, with v8 coverage
```

### Integration Tests (jest-int.json)
- **Scope**: Controller + Service + Mocked AWS
- **Speed**: Slower than unit (~30s)
- **Coverage**: No global threshold (test as you grow)
- **LocalStack**: Use docker-compose for LocalStack setup

```bash
npm run test:integrated              # Run integration suite
```

### Coverage Thresholds

**Good** (module-specific):
```json
{
  "coverageThreshold": {
    "./src/modules/orders/orders.service.ts": {
      "branches": 75,
      "functions": 75,
      "lines": 75,
      "statements": 75
    }
  }
}
```

**Bad** (global on growing projects):
```json
{
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  }
}
```

---

## 7. Checklist: Before You Commit

- [ ] Ran `npm run format` → exits 0
- [ ] Ran `npm run lint` → ZERO errors
- [ ] Ran `npm run typecheck` → ZERO errors
- [ ] Ran `npm run test:unit` → all pass
- [ ] Ran `npm run test:unit -- --coverage` → all pass (v8 provider)
- [ ] Updated `.github/CI-COMPLIANCE.md` if behavior changed
- [ ] Updated `.github/skills/*/SKILL.md` if rule changed
- [ ] Updated `.github/agents/CI-COMPLIANCE-AGENTS.md` if gate changed
- [ ] Commit message is clear and references issue/scenario
- [ ] Ready for CI pipeline ✅

---

## 8. Red Flags (Never Commit)

❌ **ESLint warnings about `any` type** → Unsafe, violates strict typing
❌ **File > 200 lines** → Violates code quality rule
❌ **No JSDoc on public methods** → Violates documentation rule
❌ **Test coverage < threshold** → Violates quality gate (fail CI)
❌ **babel-plugin-istanbul errors** → Violates coverage instrumentation (Jest v8 check)
❌ **Documentation out of sync** → Violates agent/developer workflow

---

## 9. Quick Reference: Gate Status

```
🟢 GREEN (All gates pass)
  ├─ Prettier ✅
  ├─ ESLint (0 errors)
  ├─ TypeScript (0 errors)
  ├─ Unit tests (all pass)
  ├─ Unit coverage (v8 OK)
  └─ Security scan ✅

🔴 RED (Any gate fails — stop, don't push)
  ├─ Fix the failing gate
  ├─ Consult CI-COMPLIANCE.md for scenario
  ├─ Update docs if behavior changed
  └─ Re-run all gates before retry
```

---

## 10. Links for Help

- **General Code Quality**: `.github/skills/code-quality/SKILL.md`
- **CI Failures**: `.github/CI-COMPLIANCE.md` (all scenarios)
- **Agent Checks**: `.github/agents/CI-COMPLIANCE-AGENTS.md`
- **Jest Issues**: CI-COMPLIANCE.md → Scenario 6
- **Script Quality**: `.github/skills/script-quality/SKILL.md`
- **Architecture Rules**: `.github/copilot-instructions.md` (API Guardian mode)

---

## 11. Philosophy

> **"If it's not in the gate, it's broken. If it's not in the docs, it never happened."**

Every quality rule has:
1. ✅ **Enforcement** (ESLint, Jest, TypeScript)
2. 📖 **Documentation** (where to find help)
3. 🔧 **Solution** (exact steps to fix)
4. ⚠️ **Prevention** (why it matters, common mistakes)

This prevents knowledge loss and makes debugging trivial: **follow the docs, pass the gate**.
