#!/usr/bin/env python3
"""
Board Agent — Generic card processor.

Polls the project board. For each card not in the last column
and not already labeled "processing":
  1. Add "processing" label
  2. Detect column name
  3. Read .github/agents/{column}.md
  4. Execute embedded bash script -> capture stdout
  5. Post stdout as issue comment
  6. Move card to next column
  7. Remove "processing" label
"""
import os
import sys
import json
import subprocess
import tempfile
import re

GH_TOKEN = os.environ["GH_TOKEN"]
PROJECT_NUMBER = int(os.environ["PROJECT_NUMBER"])
OWNER = os.environ["OWNER"]
REPO = os.environ["REPO"]
MANUAL_ISSUE = os.environ.get("MANUAL_ISSUE", "").strip()
TARGET_COLUMN = os.environ.get("TARGET_COLUMN", "").strip()

if "/" in REPO:
    REPO = REPO.split("/", 1)[1]
FULL_REPO = f"{OWNER}/{REPO}"
LABEL = "processing"


def gh_gql(query, **variables):
    """Execute a GitHub GraphQL query via gh CLI."""
    cmd = ["gh", "api", "graphql", "-f", f"query={query}"]
    for k, v in variables.items():
        flag = "-F" if isinstance(v, int) else "-f"
        cmd += [flag, f"{k}={v}"]
    r = subprocess.run(
        cmd, capture_output=True, text=True,
        env={**os.environ, "GH_TOKEN": GH_TOKEN},
    )
    if r.returncode != 0:
        print(f"  ❌ GraphQL: {r.stderr.strip()}")
        return None
    return json.loads(r.stdout)


def get_board():
    """Fetch project columns and cards via GraphQL."""
    q = """
    query($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) {
          id
          fields(first: 20) { nodes {
            ... on ProjectV2SingleSelectField {
              id name options { id name }
            }
          }}
          items(first: 100) { nodes {
            id
            fieldValues(first: 20) { nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name field { ... on ProjectV2SingleSelectField { name } }
              }
            }}
            content {
              ... on Issue {
                number title body state
                labels(first: 10) { nodes { name } }
              }
            }
          }}
        }
      }
    }"""
    data = gh_gql(q, owner=OWNER, number=PROJECT_NUMBER)
    if not data:
        return None

    proj = data["data"]["user"]["projectV2"]
    status = next(
        (f for f in proj["fields"]["nodes"] if f.get("name") == "Status"),
        None,
    )
    if not status:
        print("❌ No 'Status' field found in project")
        return None

    columns = [o["name"] for o in status["options"]]

    cards = []
    for item in proj["items"]["nodes"]:
        c = item.get("content")
        if not c or not c.get("number"):
            continue
        col = None
        for fv in item["fieldValues"]["nodes"]:
            if fv.get("field", {}).get("name") == "Status":
                col = fv.get("name")
        labels = [lb["name"] for lb in c.get("labels", {}).get("nodes", [])]
        cards.append({
            "item_id": item["id"],
            "number": c["number"],
            "title": c["title"],
            "body": c.get("body") or "",
            "column": col,
            "labels": labels,
            "state": c.get("state", "OPEN"),
        })

    return {
        "id": proj["id"],
        "status_field": status,
        "columns": columns,
        "cards": cards,
    }


def add_issue_to_project(board, issue_number):
    """Add an issue to the project board if not already present."""
    # Get issue node ID
    data = gh_gql("""query($owner:String!,$repo:String!,$n:Int!) {
      repository(owner:$owner, name:$repo) {
        issue(number:$n) { id title body state }
      }
    }""", owner=OWNER, repo=REPO, n=int(issue_number))
    if not data:
        return None

    issue = data["data"]["repository"]["issue"]
    if not issue:
        print(f"  ❌ Issue #{issue_number} not found")
        return None

    # Add to project
    result = gh_gql("""mutation($proj:ID!, $content:ID!) {
      addProjectV2ItemById(input:{projectId:$proj contentId:$content}) {
        item { id }
      }
    }""", proj=board["id"], content=issue["id"])
    if not result:
        return None

    item_id = result["data"]["addProjectV2ItemById"]["item"]["id"]
    first_col = board["columns"][0] if board["columns"] else None

    card = {
        "item_id": item_id,
        "number": int(issue_number),
        "title": issue["title"],
        "body": issue.get("body") or "",
        "column": first_col,
        "labels": [],
        "state": issue.get("state", "OPEN"),
    }
    board["cards"].append(card)
    print(f"  📥 Added #{issue_number} to project")
    return card


# ── Label helpers ─────────────────────────────────────────

def label_add(n):
    """Create label if missing, then add to issue."""
    env = {**os.environ, "GH_TOKEN": GH_TOKEN}
    subprocess.run(
        ["gh", "label", "create", LABEL,
         "--color", "fbca04", "--force", "--repo", FULL_REPO],
        capture_output=True, env=env,
    )
    subprocess.run(
        ["gh", "issue", "edit", str(n),
         "--add-label", LABEL, "--repo", FULL_REPO],
        capture_output=True, env=env,
    )
    print(f"  🏷️  +{LABEL}")


def label_remove(n):
    """Remove processing label from issue."""
    subprocess.run(
        ["gh", "issue", "edit", str(n),
         "--remove-label", LABEL, "--repo", FULL_REPO],
        capture_output=True,
        env={**os.environ, "GH_TOKEN": GH_TOKEN},
    )
    print(f"  🏷️  -{LABEL}")


# ── Comment helper ────────────────────────────────────────

def post_comment(n, body):
    """Post a markdown comment on an issue."""
    fd, tmp = tempfile.mkstemp(suffix=".md")
    try:
        with os.fdopen(fd, "w") as f:
            f.write(body)
        subprocess.run(
            ["gh", "issue", "comment", str(n),
             "--body-file", tmp, "--repo", FULL_REPO],
            capture_output=True,
            env={**os.environ, "GH_TOKEN": GH_TOKEN},
        )
    finally:
        os.unlink(tmp)
    print(f"  💬 Comment posted")


# ── Move card ─────────────────────────────────────────────

def move_next(board, item_id, current_col):
    """Move a project card to the next column."""
    cols = board["columns"]
    try:
        idx = cols.index(current_col)
    except ValueError:
        print(f"  ❌ Column '{current_col}' not in {cols}")
        return False
    if idx >= len(cols) - 1:
        print(f"  ℹ️  Already in last column")
        return False

    nxt = cols[idx + 1]
    opt = next(
        (o for o in board["status_field"]["options"] if o["name"] == nxt),
        None,
    )
    if not opt:
        print(f"  ❌ Option ID not found for '{nxt}'")
        return False

    mutation = """
    mutation($p:ID!,$i:ID!,$f:ID!,$o:String!) {
      updateProjectV2ItemFieldValue(input:{
        projectId:$p itemId:$i fieldId:$f
        value:{singleSelectOptionId:$o}
      }) { projectV2Item { id } }
    }"""
    r = gh_gql(
        mutation,
        p=board["id"], i=item_id,
        f=board["status_field"]["id"], o=opt["id"],
    )
    ok = r and "errors" not in r
    print(f"  {'✅' if ok else '❌'} {current_col} → {nxt}")
    return ok


# ── Agent runner ──────────────────────────────────────────

def run_agent(column, number, title, body):
    """
    Read .github/agents/{column}.md, extract the ```bash block,
    execute it, and return stdout as the comment text.
    """
    agent_path = f".github/agents/{column.lower()}.md"
    if not os.path.exists(agent_path):
        print(f"  ⚠️  No agent file: {agent_path}")
        return None

    content = open(agent_path).read()
    match = re.search(r"```bash\n(.*?)```", content, re.DOTALL)
    if not match:
        return content  # no script — return the raw markdown

    script = match.group(1)
    branch = f"feat/issue-{number}"

    # ── git setup ──
    env_git = {**os.environ, "GH_TOKEN": GH_TOKEN, "HUSKY": "0", "CI": "true"}
    run = lambda cmd: subprocess.run(cmd, capture_output=True, text=True, env=env_git)
    run(["git", "config", "user.name", "Board Agent"])
    run(["git", "config", "user.email", "board-agent@iron-dome.local"])
    run(["git", "fetch", "origin"])

    # checkout or create branch
    if run(["git", "checkout", branch]).returncode != 0:
        run(["git", "checkout", "-b", branch, "origin/main"])
    else:
        run(["git", "merge", "origin/main", "--no-edit", "-q"])

    # ── execute script ──
    script_env = {
        **os.environ,
        "ISSUE_NUMBER": str(number),
        "ISSUE_TITLE": title,
        "ISSUE_BODY": body,
        "BRANCH": branch,
        "FULL_REPO": FULL_REPO,
        "GH_TOKEN": GH_TOKEN,
        "HUSKY": "0",
        "CI": "true",
    }

    fd, tmp = tempfile.mkstemp(suffix=".sh")
    with os.fdopen(fd, "w") as f:
        f.write(f"#!/bin/bash\n{script}")
    os.chmod(tmp, 0o755)

    try:
        r = subprocess.run(
            ["/bin/bash", tmp],
            capture_output=True, text=True,
            env=script_env, timeout=300,
        )
        output = r.stdout.strip()
        if r.returncode != 0 and r.stderr.strip():
            output += f"\n\n⚠️ stderr:\n```\n{r.stderr.strip()[-500:]}\n```"
    except subprocess.TimeoutExpired:
        output = "⚠️ Agent timed out (5 min limit)"
    finally:
        os.unlink(tmp)

    # ── commit & push any file changes ──
    run(["git", "add", "-A"])
    if run(["git", "diff", "--staged", "--quiet"]).returncode != 0:
        run(["git", "commit", "--no-verify", "-m",
             f"chore(agent): {column.lower()} for #{number}"])
        push = run(["git", "push", "origin", branch])
        if push.returncode != 0:
            run(["git", "push", "origin", branch, "-u"])

    # back to main
    run(["git", "checkout", "main", "--force"])
    return output or f"✅ Agent `{column}` completed."


# ── Main ──────────────────────────────────────────────────

def process(card, board):
    """Process a single card through all columns until done or no agent."""
    cols = board["columns"]
    last_col = cols[-1] if cols else "done"

    while True:
        n = card["number"]
        col = card["column"]

        if col is None or col == last_col:
            print(f"  ℹ️  #{n} reached '{col or last_col}', stopping")
            break

        print(f"\n{'=' * 50}")
        print(f"🔄 #{n} — {card['title']} [{col}]")

        agent_path = f".github/agents/{col.lower()}.md"
        if not os.path.exists(agent_path):
            msg = f"⚠️ No agent found for column `{col}` (`{agent_path}`)."
            print(f"  ⚠️  No agent for '{col}', posting comment and stopping")
            post_comment(n, msg)
            label_remove(n)
            break

        label_add(n)
        try:
            result = run_agent(col, n, card["title"], card["body"])
            if result is None:
                break
            post_comment(n, result)
            moved = move_next(board, card["item_id"], col)
            if not moved:
                break
            # Update card column for next iteration
            idx = cols.index(col)
            card["column"] = cols[idx + 1]
        finally:
            label_remove(n)


def move_to_column(board, issue_number, target_col):
    """Move a card to a specific column (used for manual override)."""
    card = next(
        (c for c in board["cards"] if str(c["number"]) == issue_number),
        None,
    )
    if not card:
        print(f"  ❌ Issue #{issue_number} not found on board")
        return False

    opt = next(
        (o for o in board["status_field"]["options"] if o["name"] == target_col),
        None,
    )
    if not opt:
        print(f"  ❌ Column '{target_col}' not found")
        return False

    mutation = """
    mutation($p:ID!,$i:ID!,$f:ID!,$o:String!) {
      updateProjectV2ItemFieldValue(input:{
        projectId:$p itemId:$i fieldId:$f
        value:{singleSelectOptionId:$o}
      }) { projectV2Item { id } }
    }"""
    r = gh_gql(
        mutation,
        p=board["id"], i=card["item_id"],
        f=board["status_field"]["id"], o=opt["id"],
    )
    ok = r and "errors" not in r
    if ok:
        card["column"] = target_col
        print(f"  📌 Moved #{issue_number} → {target_col}")
    return ok


def main():
    print("🤖 Board Agent")
    print(f"   {FULL_REPO} — Project #{PROJECT_NUMBER}")

    board = get_board()
    if not board:
        print("❌ Could not load board")
        sys.exit(1)

    cols = board["columns"]
    last_col = cols[-1] if cols else "Done"
    print(f"   Columns: {' → '.join(cols)}")

    # Auto-add issue to project if not present
    if MANUAL_ISSUE:
        found = any(str(c["number"]) == MANUAL_ISSUE for c in board["cards"])
        if not found:
            add_issue_to_project(board, MANUAL_ISSUE)

    # Optional: move card to a specific column before processing
    if TARGET_COLUMN and MANUAL_ISSUE:
        move_to_column(board, MANUAL_ISSUE, TARGET_COLUMN)

    pending = [
        c for c in board["cards"]
        if c["column"] is not None
        and c["column"] != last_col
        and LABEL not in c["labels"]
        and (not MANUAL_ISSUE or str(c["number"]) == MANUAL_ISSUE)
    ]

    if not pending:
        print("ℹ️  No cards to process")
        return

    print(f"   Pending: {len(pending)} card(s)")

    for card in pending:
        process(card, board)

    print(f"\n✅ Board Agent finished")


if __name__ == "__main__":
    main()
