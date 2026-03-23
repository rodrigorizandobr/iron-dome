#!/usr/bin/env python3
"""
Poll GitHub Projects v2 and add stage labels to trigger board-agents.yml.

Logic:
  - For each project item whose Status column is an actionable stage
    (refinement, dev, dev-test, testing, pr):
    - If the issue has NO current stage label → pipeline not started yet
      → add the matching label (triggers board-agents.yml via issues: labeled)
    - If the issue already has ANY stage label → pipeline in progress → skip

Required env vars:
  GH_TOKEN       - GitHub token (needs issues:write; project read may need a PAT)
  PROJECT_NUMBER - GitHub Projects v2 number (from vars.PROJECT_NUMBER)
  OWNER          - Repository owner login
"""
import subprocess, json, os, sys

token = os.environ.get("GH_TOKEN", "")
project_number = os.environ.get("PROJECT_NUMBER", "")
owner = os.environ.get("OWNER", "")

if not all([token, project_number, owner]):
    print("Missing PROJECT_NUMBER or OWNER. Skipping sync.")
    sys.exit(0)

STAGE_LABELS = {"refinement", "dev", "dev-test", "testing", "pr"}

# Maps project Status column name (lowercase) → issue label to add
COLUMN_TO_LABEL = {
    "refinement": "refinement",
    "dev": "dev",
    "dev-test": "dev-test",
    "testing": "testing",
    "pr": "pr",
}


def gql(query, variables=None):
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    r = subprocess.run(
        ["curl", "-s",
         "-H", f"Authorization: Bearer {token}",
         "-H", "Content-Type: application/json",
         "-X", "POST",
         "--data", json.dumps(payload),
         "https://api.github.com/graphql"],
        capture_output=True, text=True
    )
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        print(f"GraphQL parse error: {r.stdout[:200]}")
        return {}


# Compact single-line queries to avoid YAML block-scalar issues if ever inlined
QUERY = (
    "query($owner:String!,$number:Int!){"
    "repositoryOwner(login:$owner){"
    "...on User{projectV2(number:$number){"
    "items(first:100){nodes{"
    "fieldValues(first:10){nodes{"
    "...on ProjectV2ItemFieldSingleSelectValue{"
    "name,field{...on ProjectV2SingleSelectField{name}}}}},"
    "content{...on Issue{number,labels(first:20){nodes{name}}}}}}}},"
    "...on Organization{projectV2(number:$number){"
    "items(first:100){nodes{"
    "fieldValues(first:10){nodes{"
    "...on ProjectV2ItemFieldSingleSelectValue{"
    "name,field{...on ProjectV2SingleSelectField{name}}}}},"
    "content{...on Issue{number,labels(first:20){nodes{name}}}}}}}}}}"
)

data = gql(QUERY, {"owner": owner, "number": int(project_number)})
errors = data.get("errors")
if errors:
    print(f"GraphQL errors: {errors}")
    print("Tip: if this is a permissions error, create a classic PAT with 'project' scope")
    print("     and store it as the GH_TOKEN secret (or a separate PROJECT_TOKEN secret).")
    sys.exit(0)

owner_data = (data.get("data") or {}).get("repositoryOwner") or {}
project = owner_data.get("projectV2")
if not project:
    print(f"Project #{project_number} not found for owner '{owner}'.")
    print("Verify PROJECT_NUMBER repo variable is set correctly.")
    sys.exit(0)

triggered = 0
skipped = 0

for item in project["items"]["nodes"]:
    content = item.get("content") or {}
    issue_number = content.get("number")
    if not issue_number:
        continue  # draft item, no issue attached

    # Resolve current Status column
    status_column = None
    for fv in item["fieldValues"]["nodes"]:
        field = fv.get("field") or {}
        if field.get("name", "").lower() == "status":
            status_column = (fv.get("name") or "").lower()
            break

    if status_column not in COLUMN_TO_LABEL:
        continue  # "todo", "done", or unknown column — no agent for this

    target_label = COLUMN_TO_LABEL[status_column]

    # Current labels on the issue
    current_labels = {ln["name"] for ln in content.get("labels", {}).get("nodes", [])}
    current_stage_labels = current_labels & STAGE_LABELS

    if current_stage_labels:
        # Pipeline already in progress — skip to avoid double-triggering
        skipped += 1
        print(f"Issue #{issue_number}: pipeline in progress ({current_stage_labels}) → skip")
        continue

    # No stage label AND card is in an actionable column → trigger pipeline
    print(f"Issue #{issue_number}: column='{status_column}' → adding label '{target_label}'")
    result = subprocess.run(
        ["gh", "issue", "edit", str(issue_number), "--add-label", target_label],
        capture_output=True, text=True,
        env={**os.environ, "GH_TOKEN": token}
    )
    if result.returncode == 0:
        print(f"  Label '{target_label}' added → board-agents pipeline triggered")
        triggered += 1
    else:
        print(f"  Error adding label: {result.stderr.strip()}")

print(f"\nSync complete: {triggered} triggered, {skipped} skipped (in progress).")
