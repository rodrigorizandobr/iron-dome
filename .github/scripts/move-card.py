#!/usr/bin/env python3
"""
Move a GitHub Projects v2 card to a target column.

Required env vars:
  GH_TOKEN       - GitHub token with project write access
  PROJECT_NUMBER - GitHub Projects v2 number
  OWNER          - Repository owner (user or org login)
  ISSUE          - Issue number
  TARGET_COLUMN  - Target column name (e.g., "Dev", "Testing", "PR", "Done")
"""
import subprocess, json, os, sys

token = os.environ.get("GH_TOKEN", "")
project_number = os.environ.get("PROJECT_NUMBER", "")
owner = os.environ.get("OWNER", "")
issue = os.environ.get("ISSUE", "")
target_col = os.environ.get("TARGET_COLUMN", "")

if not all([token, project_number, owner, issue, target_col]):
    missing = [k for k, v in {
        "GH_TOKEN": token, "PROJECT_NUMBER": project_number,
        "OWNER": owner, "ISSUE": issue, "TARGET_COLUMN": target_col
    }.items() if not v]
    print(f"Skipping card move: missing env vars {missing}")
    sys.exit(0)


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
    return json.loads(r.stdout)


# Single-line GraphQL query avoids YAML parsing issues in inline heredocs
QUERY = (
    "query($owner:String!,$number:Int!){"
    "repositoryOwner(login:$owner){"
    "...on User{projectV2(number:$number){id,"
    "fields(first:20){nodes{...on ProjectV2SingleSelectField{id,name,options{id,name}}}},"
    "items(first:100){nodes{id,content{...on Issue{number}}}}}},"
    "...on Organization{projectV2(number:$number){id,"
    "fields(first:20){nodes{...on ProjectV2SingleSelectField{id,name,options{id,name}}}},"
    "items(first:100){nodes{id,content{...on Issue{number}}}}}}}}"
)

MUTATION = (
    "mutation($p:ID!,$i:ID!,$f:ID!,$v:String!){"
    "updateProjectV2ItemFieldValue(input:{"
    "projectId:$p,itemId:$i,fieldId:$f,"
    "value:{singleSelectOptionId:$v}"
    "}){projectV2Item{id}}}"
)

data = gql(QUERY, {"owner": owner, "number": int(project_number)})
p = (data.get("data", {}).get("repositoryOwner", {}) or {}).get("projectV2")
if not p:
    print(f"Project #{project_number} not found for owner '{owner}'. Check PROJECT_NUMBER and token scopes.")
    sys.exit(0)

status_field = next(
    (f for f in p["fields"]["nodes"] if f.get("name", "").lower() == "status"),
    None
)
if not status_field:
    print("Status field not found in project.")
    sys.exit(0)

target_option = next(
    (o for o in status_field["options"] if o["name"].lower() == target_col.lower()),
    None
)
if not target_option:
    opts = [o["name"] for o in status_field["options"]]
    print(f"Column '{target_col}' not found. Available columns: {opts}")
    sys.exit(0)

item = next(
    (i for i in p["items"]["nodes"]
     if (i.get("content") or {}).get("number") == int(issue)),
    None
)
if not item:
    print(f"Issue #{issue} not found in project.")
    sys.exit(0)

result = gql(MUTATION, {
    "p": p["id"], "i": item["id"],
    "f": status_field["id"], "v": target_option["id"]
})
if result.get("errors"):
    print(f"Error moving card: {result['errors']}")
else:
    print(f"Issue #{issue} moved to column '{target_option['name']}'")
