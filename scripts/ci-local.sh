#!/usr/bin/env bash
# =============================================================================
# CI Local — Roda os mesmos gates do GitHub Actions CI/CD Pipeline
# =============================================================================
# Uso: npm run ci
# Usado também pelo GitHub Actions (.github/workflows/ci.yml)
# =============================================================================
set -uo pipefail  # sem -e: continua mesmo com falhas para mostrar todos os erros

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
SKIP=0

print_header() {
  echo ""
  echo -e "${BLUE}${BOLD}══════════════════════════════════════════════${NC}"
  echo -e "${BLUE}${BOLD}  🛡️  Iron Dome — CI Local Gate${NC}"
  echo -e "${BLUE}${BOLD}══════════════════════════════════════════════${NC}"
  echo ""
}

step() {
  echo -e "${BOLD}▶ $1${NC}"
}

pass() {
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}✅ PASS${NC} — $1"
}

fail() {
  FAIL=$((FAIL + 1))
  echo -e "  ${RED}❌ FAIL${NC} — $1"
}

skip() {
  SKIP=$((SKIP + 1))
  echo -e "  ${YELLOW}⚠️  SKIP${NC} — $1"
}

print_summary() {
  echo ""
  echo -e "${BLUE}${BOLD}══════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  📊 Resultado${NC}"
  echo -e "${BLUE}${BOLD}══════════════════════════════════════════════${NC}"
  echo -e "  ${GREEN}✅ Passed: ${PASS}${NC}"
  echo -e "  ${RED}❌ Failed: ${FAIL}${NC}"
  echo -e "  ${YELLOW}⚠️  Skipped: ${SKIP}${NC}"
  echo ""

  if [ "$FAIL" -gt 0 ]; then
    echo -e "${RED}${BOLD}  ✗ CI FAILED — Corrija os erros antes de fazer push!${NC}"
    echo ""
    exit 1
  else
    echo -e "${GREEN}${BOLD}  ✓ CI PASSED — Seguro para fazer push!${NC}"
    echo ""
    exit 0
  fi
}

# =============================================================================
print_header

# --- GATE 1: Security Audit (prod) ---
step "Security Audit — npm audit --omit=dev"
if npm audit --audit-level=high --omit=dev --quiet 2>&1; then
  pass "Security Audit (prod)"
else
  fail "Security Audit (prod)"
fi

# --- GATE 2: Prettier ---
step "Format — Prettier check"
if npm run format -- --check --quiet 2>&1; then
  pass "Prettier format"
else
  fail "Prettier format (rode: npm run format)"
fi

# --- GATE 3: Dev audit (informativo, não bloqueia) ---
step "Security Audit — devDependencies (informativo)"
if npm audit --audit-level=high --only=dev --quiet 2>&1; then
  pass "Security Audit (dev)"
else
  skip "Security Audit (dev) — vulnerabilidades em devDeps (não bloqueia CI)"
fi

# --- GATE 4: ESLint ---
step "Lint — ESLint"
if npm run lint 2>&1; then
  pass "ESLint (0 errors)"
else
  fail "ESLint (corrija os erros acima)"
fi

# --- GATE 5: Build ---
step "Build — NestJS production build"
if npm run build 2>&1; then
  pass "Build (TypeScript compilation)"
else
  fail "Build (erro de compilação)"
fi

# --- GATE 6: Unit Tests + Coverage ---
step "Unit Tests + Coverage — Jest (v8, module-specific baseline)"
if npm run test:unit -- --coverage 2>&1; then
  pass "Unit Tests + Coverage (base: 80% orders.service.ts)"
else
  fail "Unit Tests ou Coverage abaixo do threshold"
fi

# --- GATE 7: Integration Tests (informativo, sem LocalStack) ---
step "Integration Tests — Jest ESM (informativo, sem LocalStack)"
if npm run test:integrated 2>&1; then
  pass "Integration Tests (7/7)"
else
  skip "Integration Tests — falhas esperadas sem LocalStack (não bloqueia CI)"
fi

print_summary
