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
# Uses v8 provider (NOT babel-plugin-istanbul)
# ESM NOT required for unit tests
# Toma ~10s
```

✅ **Testes + coverage DEVEM passar com 80% minimum (module-specific)**

**Se falhar com "TypeError: original argument must be of type function":**
→ Verifique `jest-unit.json` tem `"coverageProvider": "v8"` (não babel)
→ Verifique `"globals"` foi REMOVIDO (deprecated ts-jest syntax)
→ Verifique só `"transform"` com ts-jest config está presente
→ Consulte `.github/JEST-REFERENCE.md` ou `.github/agents/CI-COMPLIANCE-AGENTS.md`

### 1.6 Integration Tests (OPCIONAL em pre-commit)

```bash
npm run test:integrated
# ESM mode (NODE_OPTIONS=--experimental-vm-modules)
# Coverage é disabled (v8 + ESM + AWS SDK incompatível)
# SEM flag --coverage
```

✅ **Integration tests são opcionais em pre-commit** (rodam em CI automaticamente)

⚠️ **NUNCA use** `npm run test:integrated -- --coverage` (causa babel-plugin-istanbul error)

---

## 2. What MUST be Tested (Test Strategy)

| Componente           | Precisas Testes?  | Coverage Threshold  | Strategy                                                  |
| -------------------- | ----------------- | ------------------- | --------------------------------------------------------- |
| Service (CRUD logic) | **✅ YES**        | **Baseline actual** | Unit tests com mocks (define threshold DEPOIS dos testes) |
| Controller (routes)  | **⏳ TODO**       | None yet            | Escrever testes integrados primeiro                       |
| Provider (AWS API)   | **⏳ TODO**       | None yet            | Escrever unit tests com mocks                             |
| Integration Tests    | **✅ YES**        | **NO coverage**     | Testa fluxo com LocalStack (ESM + v8 incompatível)        |
| DTO (data objects)   | **❌ NOT NEEDED** | **0%**              | Tipos puros, sem lógica                                   |
| Guard (auth)         | **⏳ TODO**       | None yet            | Escrever unit tests depois                                |
| Middleware           | **⏳ TODO**       | None yet            | Escrever unit tests depois                                |

**Coverage Strategy - PRAGMATIC**:

1. ✅ **Write comprehensive tests FIRST** (`*.spec.ts`)
2. ✅ **Get real coverage baseline** (`npm run test:unit -- --coverage`)
3. ✅ **Add threshold in jest-unit.json** using ACTUAL numbers (not artificial targets)
4. ✅ **CI enforces**: Coverage must NOT drop below baseline
5. ❌ **AVOID**: Setting 80% threshold on 0% coverage code (waste of CI)

**Coverage Thresholds**:

- Orders Service: 100% branches, 75% functions, 84% lines, 84% statements (has tests ✓)
- Other modules: No threshold yet (no comprehensive tests written yet)
- Integration Tests: No coverage collected (ESM incompatible with v8)

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

### 5.1 Skill Files (.github/skills/\*/SKILL.md)

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

### Coverage Thresholds (Module-Specific 80% — Enforced)

**Current (and enforced)** — Module-specific 80% for tested modules:

```json
{
  "coverageThreshold": {
    "./src/modules/orders/orders.service.ts": { "branches": 80, ... },
    "./src/modules/orders/orders.controller.ts": { "branches": 70, ... },
    "./src/common/core/base-resource.service.ts": { "branches": 70, ... }
  }
}
```

**Why Module-Specific 80%?**

✅ **Benefits**:

- Target 80% for well-tested modules
- Incremental adoption (70% for modules under development)
- Prevents low-quality code from being merged
- New modules inherit requirement immediately
- Forces test-first development per module
- Realistic and achievable thresholds

**How it works**:

- Each module Path gets explicit threshold
- orders.service: 80% (strict, fully tested)
- orders.controller: 70% (integration in progress)
- base-resource: 70% (utility, indirect testing)
- When adding new module: must specify threshold
- CI blocks merge if any module < its threshold

---

## 7. Checklist: Before You Commit

- [ ] Ran `npm run format` → exits 0
- [ ] Ran `npm run lint` → ZERO errors
- [ ] Ran `npm run typecheck` → ZERO errors
- [ ] Ran `npm run test:unit` → all pass
- [ ] Ran `npm run test:unit -- --coverage` → **MUST PASS with 80%** ← CRITICAL
- [ ] Verified all 4 metrics ≥ 80% (branches, functions, lines, statements)
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
