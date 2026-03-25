#!/usr/bin/env bash
#
# Diagnose Pipeline — Verifies all prerequisites for the
# autonomous board-agents pipeline to work correctly.
#
# Usage: bash scripts/diagnose-pipeline.sh
#
set -euo pipefail

REPO="rodrigorizandobr/iron-dome"
PASS=0
FAIL=0

check() {
  local label="$1"
  local result="$2"  # 0=pass, 1=fail
  local detail="${3:-}"

  if [ "$result" -eq 0 ]; then
    echo "  ✅ $label"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $label"
    [ -n "$detail" ] && echo "     → $detail"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "🔍 Pipeline Diagnostics for $REPO"
echo "=================================="

# 1. Check gh CLI
echo ""
echo "📋 1. Prerequisites"
if command -v gh &>/dev/null; then
  check "gh CLI installed" 0
else
  check "gh CLI installed" 1 "Install: brew install gh"
fi

# Check gh auth
if gh auth status &>/dev/null; then
  check "gh authenticated" 0
else
  check "gh authenticated" 1 "Run: gh auth login"
fi

# 2. Check secrets
echo ""
echo "🔑 2. Secrets"
SECRETS=$(gh secret list --repo "$REPO" 2>&1 || echo "ERROR")
if echo "$SECRETS" | grep -q "PROJECT_TOKEN"; then
  check "PROJECT_TOKEN secret exists" 0
else
  check "PROJECT_TOKEN secret exists" 1 "Create a PAT with 'project' + 'repo' scopes and add as PROJECT_TOKEN secret"
fi

# 3. Check variables
echo ""
echo "📊 3. Variables"
VARS=$(gh variable list --repo "$REPO" 2>&1 || echo "ERROR")
if echo "$VARS" | grep -q "PROJECT_NUMBER"; then
  PROJECT_NUM=$(echo "$VARS" | grep "PROJECT_NUMBER" | awk '{print $2}')
  check "PROJECT_NUMBER variable exists (value: $PROJECT_NUM)" 0
else
  check "PROJECT_NUMBER variable exists" 1 "Run: gh variable set PROJECT_NUMBER --body '1' --repo $REPO"
fi

# 4. Check workflows exist
echo ""
echo "⚙️ 4. Workflows"
WORKFLOWS=$(gh workflow list --repo "$REPO" 2>&1 || echo "ERROR")
for WF in "board-agents" "project-sync" "copilot-pr"; do
  if echo "$WORKFLOWS" | grep -qi "$WF"; then
    check "Workflow $WF exists" 0
  else
    check "Workflow $WF exists" 1 "Check .github/workflows/${WF}.yml"
  fi
done

# 5. Check project columns
echo ""
echo "📂 5. Project Board Columns"
COLUMNS_JSON=$(gh api graphql -f query='query { repositoryOwner(login: "rodrigorizandobr") { ... on User { projectV2(number: 1) { fields(first: 20) { nodes { ... on ProjectV2SingleSelectField { name options { name } } } } } } } }' 2>&1 || echo "ERROR")
if echo "$COLUMNS_JSON" | grep -q "Refinement"; then
  COLS=$(echo "$COLUMNS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
fields = data.get('data',{}).get('repositoryOwner',{}).get('projectV2',{}).get('fields',{}).get('nodes',[])
for f in fields:
    if f.get('name','').lower() == 'status':
        opts = [o['name'] for o in f.get('options',[])]
        print(', '.join(opts))
" 2>/dev/null || echo "parse error")
  check "Project columns found: $COLS" 0

  # Verify expected columns
  for COL in "Refinement" "Dev" "Dev-Test" "Testing" "PR" "Done"; do
    if echo "$COLS" | grep -qi "$COL"; then
      check "  Column '$COL'" 0
    else
      check "  Column '$COL'" 1 "Add this column to your project board"
    fi
  done
else
  check "Project board accessible" 1 "Check PROJECT_TOKEN has 'project' scope. Response: ${COLUMNS_JSON:0:200}"
fi

# 6. Check recent workflow runs
echo ""
echo "🏃 6. Recent Workflow Runs"
SYNC_RUNS=$(gh run list --workflow=project-sync.yml --limit=3 --repo "$REPO" 2>&1 || echo "NONE")
if echo "$SYNC_RUNS" | grep -q "completed\|in_progress"; then
  check "project-sync.yml runs recently" 0
  echo "$SYNC_RUNS" | head -3 | while read -r line; do echo "     $line"; done
else
  check "project-sync.yml runs recently" 1 "No recent runs. Cron may not be active yet."
fi

AGENT_RUNS=$(gh run list --workflow=board-agents.yml --limit=3 --repo "$REPO" 2>&1 || echo "NONE")
if echo "$AGENT_RUNS" | grep -q "completed\|in_progress\|failure"; then
  check "board-agents.yml runs recently" 0
  echo "$AGENT_RUNS" | head -3 | while read -r line; do echo "     $line"; done
else
  check "board-agents.yml runs recently" 1 "No recent runs."
fi

# 7. Check scripts compile
echo ""
echo "🔧 7. Scripts"
if npx ts-node --compiler-options '{"noEmit":true}' -e "import './scripts/agents/refinament'" 2>/dev/null; then
  check "refinament.ts compiles" 0
else
  check "refinament.ts compiles" 1 "Run: npx ts-node scripts/agents/refinament.ts"
fi

if npx ts-node --compiler-options '{"noEmit":true}' -e "import './scripts/agents/dev'" 2>/dev/null; then
  check "dev.ts compiles" 0
else
  check "dev.ts compiles" 1 "Run: npx ts-node scripts/agents/dev.ts"
fi

# 8. Check issue #12 exists
echo ""
echo "🎫 8. Issue #12"
ISSUE_DATA=$(gh issue view 12 --repo "$REPO" --json state,title,labels 2>&1 || echo "ERROR")
if echo "$ISSUE_DATA" | grep -q "title"; then
  TITLE=$(echo "$ISSUE_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['title'])" 2>/dev/null || echo "?")
  STATE=$(echo "$ISSUE_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['state'])" 2>/dev/null || echo "?")
  check "Issue #12 exists: '$TITLE' (state: $STATE)" 0
else
  check "Issue #12 exists" 1 "$ISSUE_DATA"
fi

# Summary
echo ""
echo "=================================="
echo "📊 Results: $PASS passed, $FAIL failed"
if [ "$FAIL" -eq 0 ]; then
  echo "🎉 All checks passed! Pipeline should work."
  echo ""
  echo "To trigger manually:"
  echo "  gh workflow run board-agents.yml -f stage=refinament -f issue_number=12 --repo $REPO"
else
  echo "⚠️  Fix the $FAIL failing check(s) above before running the pipeline."
fi
echo ""
