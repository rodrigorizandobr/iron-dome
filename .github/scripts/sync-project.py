#!/usr/bin/env python3
"""
Poll GitHub Projects v2 and dispatch board-agents.yml for each card
that is in an actionable column and has no active pipeline run.

No labels are used. State is tracked purely by project column position:
  - Agent runs: moves card to next column (via move-card.py)
  - Poller sees card in next column on the next tick: dispatches next agent

Required env vars:
  GH_TOKEN       - GitHub token (needs project read + actions write; if project
                   is private/org-level a classic PAT with 'project' scope is needed)
  PROJECT_NUMBER - GitHub Projects v2 number (from vars.PROJECT_NUMBER)
  OWNER          - Repository owner login
  REPO           - Repository name
"""
import subprocess, json, os, sys

token = os.environ.get("GH_TOKEN", "")
project_number = os.environ.get("PROJECT_NUMBER", "")
owner = os.environ.get("OWNER", "")
repo = os.environ.get("REPO", "")

if not all([token, project_number, owner, repo]):
    missing = [k for k, v in {
        "GH_TOKEN": token, "PROJECT_NUMBER": project_number,
        "OWNER": owner, "REPO": repo
    }.items() if not v]
    print(f"Missing env vars {missing}. Skipping sync.")
    sys.exit(0)

# Maps project Status column name (lowercase) → workflow stage input value
COLUMN_TO_STAGE = {
    "refinement": "refinament",
    "dev":        "dev",
    "dev-test":   "dev-test",
    "testing":    "testing",
    "pr":         "pr",
}

env = {**os.environ, "GH_TOKEN": token}


def gh(*args):
    """Run gh CLI and return stdout string."""
    r = subprocess.run(["gh"] + list(args), capture_output=True, text=True, env=env)
    return r.stdout.strip(), r.returncode


def gql(query, variables=None):
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    r = subprocess.run(
        ["curl", "-s",
         "-H", f"Authorization: Bearer {token}",
         "-H", "Content-Type: application/json",
         "-X", "POST", "--data", json.dumps(payload),
         "https://api.github.com/graphql"],
        capture_output=True, text=True
    )
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        print(f"GraphQL parse error: {r.stdout[:300]}")
        return {}


def active_run_count():
    """Return number of board-agents runs currently in_progress or queued."""
    out, _ = gh("api",
                f"/repos/{owner}/{repo}/actions/workflows/board-agents.yml/runs",
                "--jq",
                "[.workflow_runs[] | select(.status == \"in_progress\" or .status == \"queued\" or .status == \"waiting\")] | length")
    try:
        return int(out)
    except ValueError:
        return 0


def dispatch(stage, issue_number):
    """Dispatch board-agents.yml via workflow_dispatch."""
    out, code = gh("workflow", "run", "board-agents.yml",
                   "--repo", f"{owner}/{repo}",
                   "-f", f"stage={stage}",
                   "-f", f"issue_number={issue_number}")
    return code == 0


# --- Query project items with their Status column value ---
QUERY = (
    "query($owner:String!,$number:Int!){"
    "repositoryOwner(login:$owner){"
    "...on User{projectV2(number:$number){"
    "items(first:100){nodes{"
    "fieldValues(first:10){nodes{"
    "...on ProjectV2ItemFieldSingleSelectValue{"
    "name,field{...on ProjectV2SingleSelectField{name}}}}},"
    "content{...on Issue{number}}}}}},"
    "...on Organization{projectV2(number:$number){"
    "items(first:100){nodes{"
    "fieldValues(first:10){nodes{"
    "...on ProjectV2ItemFieldSingleSelectValue{"
    "name,field{...on ProjectV2SingleSelectField{name}}}}},"
    "content{...on Issue{number}}}}}}}}"
)

data = gql(QUERY, {"owner": owner, "number": int(project_number)})
errors = data.get("errors")
if errors:
    print(f"GraphQL errors: {errors}")
    print("Tip: if permissions error, use a classic PAT with 'project' scope as GH_TOKEN.")
    sys.exit(0)

owner_data = (data.get("data") or {}).get("repositoryOwner") or {}
project = owner_data.get("projectV2")
if not project:
    print(f"Project #{project_number} not found for owner '{owner}'.")
    print("Verify PROJECT_NUMBER repo variable is set correctly.")
    sys.exit(0)

# Build list of (issue_number, column) pairs for actionable items
pending = []
for item in project["items"]["nodes"]:
    content = item.get("content") or {}
    issue_number = content.get("number")
    if not issue_number:
        continue  # draft item

    status_column = None
    for fv in item["fieldValues"]["nodes"]:
        if (fv.get("field") or {}).get("name", "").lower() == "status":
            status_column = (fv.get("name") or "").lower()
            break

    if status_column in COLUMN_TO_STAGE:
        pending.append((issue_number, status_column))

if not pending:
    print("No cards in actionable columns. Nothing to do.")
    sys.exit(0)

print(f"Found {len(pending)} card(s) in actionable columns: {pending}")

# Check if any agent run is already active — serialize to avoid double-dispatch
active = active_run_count()
if active > 0:
    print(f"{active} board-agents run(s) currently active. Waiting for completion before dispatching.")
    sys.exit(0)

# Dispatch one item (the first pending one, oldest-first by project order)
issue_number, column = pending[0]
stage = COLUMN_TO_STAGE[column]
print(f"Dispatching board-agents.yml: stage={stage}, issue=#{issue_number} (column='{column}')")

if dispatch(stage, issue_number):
    print(f"Dispatched successfully. Pipeline started for issue #{issue_number}.")
    if len(pending) > 1:
        print(f"Note: {len(pending) - 1} other card(s) will be processed in subsequent poll cycles.")
else:
    print("Dispatch failed. Check that GITHUB_TOKEN has 'actions: write' permission.")
    sys.exit(1)
