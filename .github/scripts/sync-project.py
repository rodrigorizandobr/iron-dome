#!/usr/bin/env python3
"""
Poll GitHub Projects v2 and dispatch board-agents.yml for each card
that is in an actionable column and has no active pipeline run.

No labels are used for state. State is tracked purely by project column position:
  - Agent runs: moves card to next column (via move-card.py)
  - Poller sees card in next column on the next tick: dispatches next agent

Deduplication: Checks the last completed run for the same issue+stage to prevent
re-dispatching for a stuck card. After 3 consecutive dispatches without movement,
adds a 'stuck' label so the issue is skipped until manually unstuck.

Required env vars:
  GH_TOKEN       - GitHub token (needs project read + actions write)
  PROJECT_NUMBER - GitHub Projects v2 number (from vars.PROJECT_NUMBER)
  OWNER          - Repository owner login
  REPO           - Full repository name (owner/repo format from github.repository)
"""
import subprocess, json, os, sys

token = os.environ.get("GH_TOKEN", "")
project_number = os.environ.get("PROJECT_NUMBER", "")
owner = os.environ.get("OWNER", "")
repo_full = os.environ.get("REPO", "")

# REPO comes as "owner/repo" from github.repository — extract just the repo name
repo = repo_full.split("/")[-1] if "/" in repo_full else repo_full

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

MAX_RETRIES = 3  # Max dispatches for same issue+stage before marking as stuck

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


def recent_completed_runs(limit=10):
    """Return list of recent completed board-agents runs with their inputs."""
    out, _ = gh("api",
                f"/repos/{owner}/{repo}/actions/workflows/board-agents.yml/runs?status=completed&per_page={limit}",
                "--jq",
                "[.workflow_runs[:10] | .[] | {conclusion, inputs: (.inputs // {})}]")
    try:
        return json.loads(out) if out else []
    except (json.JSONDecodeError, ValueError):
        return []


def count_recent_dispatches(stage, issue_number):
    """Count how many times this issue+stage was dispatched recently (completed runs)."""
    runs = recent_completed_runs()
    count = 0
    for run in runs:
        inputs = run.get("inputs", {})
        if str(inputs.get("issue_number", "")) == str(issue_number) and inputs.get("stage", "") == stage:
            count += 1
        else:
            break  # Stop at first different run (chronological order)
    return count


def dispatch(stage, issue_number):
    """Dispatch board-agents.yml via workflow_dispatch."""
    out, code = gh("workflow", "run", "board-agents.yml",
                   "--repo", f"{owner}/{repo}",
                   "-f", f"stage={stage}",
                   "-f", f"issue_number={issue_number}")
    if code != 0:
        print(f"  Dispatch failed (exit code {code}): {out}")
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
    sys.exit(1)

owner_data = (data.get("data") or {}).get("repositoryOwner") or {}
project = owner_data.get("projectV2")
if not project:
    print(f"Project #{project_number} not found for owner '{owner}'.")
    print("Verify PROJECT_NUMBER repo variable is set correctly.")
    sys.exit(1)

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

    if status_column not in COLUMN_TO_STAGE:
        continue

    # Skip issues with 'copilot-working' label (waiting for Copilot to create PR)
    labels_out, _ = gh("issue", "view", str(issue_number),
                       "--repo", f"{owner}/{repo}",
                       "--json", "labels",
                       "--jq", "[.labels[].name] | join(\",\")")
    if "copilot-working" in labels_out:
        print(f"  Issue #{issue_number}: skipping (copilot-working label)")
        continue

    if "stuck" in labels_out:
        print(f"  Issue #{issue_number}: skipping (stuck label — needs manual intervention)")
        continue

    pending.append((issue_number, status_column))

if not pending:
    print("No cards in actionable columns. Nothing to do.")
    sys.exit(0)

print(f"Found {len(pending)} card(s) in actionable columns: {pending}")

# Check if any agent run is already active — serialize to avoid double-dispatch
active = active_run_count()
if active > 0:
    print(f"{active} board-agents run(s) currently active. Waiting for completion.")
    sys.exit(0)

# Dispatch one item (the first pending one, oldest-first by project order)
issue_number, column = pending[0]
stage = COLUMN_TO_STAGE[column]

# Deduplication: check if same issue+stage was already dispatched recently
retry_count = count_recent_dispatches(stage, issue_number)
if retry_count >= MAX_RETRIES:
    print(f"Issue #{issue_number} stuck at '{column}' after {retry_count} attempts. Adding 'stuck' label.")
    gh("issue", "edit", str(issue_number),
       "--repo", f"{owner}/{repo}",
       "--add-label", "stuck")
    gh("issue", "comment", str(issue_number),
       "--repo", f"{owner}/{repo}",
       "--body", f"⚠️ Pipeline stuck at **{column}** after {retry_count} attempts. Manual intervention needed. Remove the `stuck` label to retry.")
    sys.exit(0)

if retry_count > 0:
    print(f"  Note: This is attempt #{retry_count + 1} for issue #{issue_number} at '{column}'")

print(f"Dispatching board-agents.yml: stage={stage}, issue=#{issue_number} (column='{column}')")

if dispatch(stage, issue_number):
    print(f"Dispatched successfully. Pipeline started for issue #{issue_number}.")
    if len(pending) > 1:
        print(f"Note: {len(pending) - 1} other card(s) will be processed in subsequent poll cycles.")
else:
    print("Dispatch failed. Check that GH_TOKEN has 'actions: write' permission.")
    sys.exit(1)
