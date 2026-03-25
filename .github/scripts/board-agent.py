#!/usr/bin/env python3
"""
Board Agent — Copilot Coding Agent orchestrator.

Polls the project board every minute. For each card not in the last
column and without "processing" label:
  1. Skip if card has "processing" label
  2. Add "processing" label
  3. Detect column name (status)
  4. Find agent at .github/agents/{column}.md
  5. Execute agent (Copilot for most columns, direct CI for testing)
  6. If testing: run npm run ci — pass → next column, fail → back to dev
  7. Remove "processing" label
  8. Recursively process the new column
"""
import os
import sys
import json
import subprocess
import tempfile

GH_TOKEN = os.environ["GH_TOKEN"]
PROJECT_NUMBER = int(os.environ["PROJECT_NUMBER"])
OWNER = os.environ["OWNER"]
REPO = os.environ["REPO"]
MANUAL_ISSUE = os.environ.get("MANUAL_ISSUE", "").strip()
TARGET_COLUMN = os.environ.get("TARGET_COLUMN", "").strip()

if "/" in REPO:
    REPO = REPO.split("/", 1)[1]
FULL_REPO = f"{OWNER}/{REPO}"
LABEL_PROCESSING = "processing"
LABEL_COPILOT = "copilot-working"
COPILOT_BOT = "copilot-swe-agent[bot]"
TESTING_COLUMN = "testing"
DEV_COLUMN = "dev"


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
                assignees(first: 10) { nodes { login } }
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
        assignees = [a["login"] for a in c.get("assignees", {}).get("nodes", [])]
        cards.append({
            "item_id": item["id"],
            "number": c["number"],
            "title": c["title"],
            "body": c.get("body") or "",
            "column": col,
            "labels": labels,
            "assignees": assignees,
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

def label_add(n, label):
    """Create label if missing, then add to issue."""
    env = {**os.environ, "GH_TOKEN": GH_TOKEN}
    color = "fbca04" if label == LABEL_PROCESSING else "1d76db"
    subprocess.run(
        ["gh", "label", "create", label,
         "--color", color, "--force", "--repo", FULL_REPO],
        capture_output=True, env=env,
    )
    subprocess.run(
        ["gh", "issue", "edit", str(n),
         "--add-label", label, "--repo", FULL_REPO],
        capture_output=True, env=env,
    )
    print(f"  🏷️  +{label}")


def label_remove(n, label):
    """Remove a label from issue."""
    subprocess.run(
        ["gh", "issue", "edit", str(n),
         "--remove-label", label, "--repo", FULL_REPO],
        capture_output=True,
        env={**os.environ, "GH_TOKEN": GH_TOKEN},
    )
    print(f"  🏷️  -{label}")


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


# ── Copilot Coding Agent ─────────────────────────────────

def get_copilot_bot_id():
    """Get the copilot-swe-agent bot ID via suggestedActors query."""
    data = gh_gql("""query($owner:String!,$repo:String!) {
      repository(owner:$owner, name:$repo) {
        suggestedActors(capabilities:[CAN_BE_ASSIGNED], first:100) {
          nodes { login __typename ... on Bot { id } ... on User { id } }
        }
      }
    }""", owner=OWNER, repo=REPO)
    if not data:
        return None
    nodes = data["data"]["repository"]["suggestedActors"]["nodes"]
    bot = next((n for n in nodes if n.get("login") == "copilot-swe-agent"), None)
    return bot["id"] if bot else None


def get_repo_id():
    """Get the repository GraphQL global ID."""
    data = gh_gql("""query($owner:String!,$repo:String!) {
      repository(owner:$owner, name:$repo) { id }
    }""", owner=OWNER, repo=REPO)
    if not data:
        return None
    return data["data"]["repository"]["id"]


def get_issue_id(number):
    """Get the issue GraphQL global ID."""
    data = gh_gql("""query($owner:String!,$repo:String!,$n:Int!) {
      repository(owner:$owner, name:$repo) { issue(number:$n) { id } }
    }""", owner=OWNER, repo=REPO, n=int(number))
    if not data:
        return None
    return data["data"]["repository"]["issue"]["id"]


def assign_copilot(number, instructions):
    """Assign Copilot Coding Agent to an issue with custom instructions."""
    # Try REST API first (simpler)
    payload = json.dumps({
        "assignees": [COPILOT_BOT],
        "agent_assignment": {
            "target_repo": FULL_REPO,
            "base_branch": "main",
            "custom_instructions": instructions,
            "custom_agent": "",
            "model": "",
        },
    })
    r = subprocess.run(
        ["gh", "api", "--method", "POST",
         "-H", "Accept: application/vnd.github+json",
         "-H", "X-GitHub-Api-Version: 2022-11-28",
         f"/repos/{FULL_REPO}/issues/{number}/assignees",
         "--input", "-"],
        input=payload, capture_output=True, text=True,
        env={**os.environ, "GH_TOKEN": GH_TOKEN},
    )
    if r.returncode == 0:
        print(f"  🤖 Copilot assigned via REST API")
        return True

    print(f"  ⚠️  REST assign failed: {r.stderr.strip()[:200]}")

    # Fallback: GraphQL
    bot_id = get_copilot_bot_id()
    repo_id = get_repo_id()
    issue_id = get_issue_id(number)
    if not all([bot_id, repo_id, issue_id]):
        print(f"  ❌ Could not resolve IDs for GraphQL fallback")
        return False

    result = gh_gql("""mutation($issue:ID!,$bot:ID!,$repo:ID!,$instructions:String!) {
      addAssigneesToAssignable(input:{
        assignableId:$issue
        assigneeIds:[$bot]
        agentAssignment:{
          targetRepositoryId:$repo
          baseRef:"main"
          customInstructions:$instructions
          customAgent:""
          model:""
        }
      }) { assignable { ... on Issue { id } } }
    }""", issue=issue_id, bot=bot_id, repo=repo_id, instructions=instructions)

    # Note: GraphQL needs special header, try via gh api directly
    if not result or "errors" in result:
        # Last resort: comment @copilot mention
        print(f"  ⚠️  GraphQL fallback failed, posting @copilot comment")
        post_comment(number, f"@copilot {instructions}")
        return True

    print(f"  🤖 Copilot assigned via GraphQL")
    return True


def check_copilot_done(number):
    """Check if Copilot has finished working on an issue (PR exists)."""
    env = {**os.environ, "GH_TOKEN": GH_TOKEN}
    branch = f"copilot/fix-{number}"

    # Check for any PR linked to this issue or from copilot branches
    r = subprocess.run(
        ["gh", "pr", "list", "--repo", FULL_REPO, "--state", "open",
         "--json", "number,title,headRefName,author",
         "--jq", f'[.[] | select(.author.login == "copilot-swe-agent")]'],
        capture_output=True, text=True, env=env,
    )
    if r.returncode == 0 and r.stdout.strip():
        prs = json.loads(r.stdout)
        # Find PR that references this issue
        for pr in prs:
            title = pr.get("title", "").lower()
            if f"#{number}" in title or f"issue {number}" in title.lower():
                print(f"  ✅ Copilot PR found: #{pr['number']} — {pr['title']}")
                return True

    # Also check if copilot-swe-agent was unassigned (task completed)
    r2 = subprocess.run(
        ["gh", "issue", "view", str(number), "--repo", FULL_REPO,
         "--json", "assignees",
         "--jq", '[.assignees[].login] | map(select(. == "copilot-swe-agent")) | length'],
        capture_output=True, text=True, env=env,
    )
    if r2.returncode == 0:
        count = r2.stdout.strip()
        if count == "0":
            # Copilot was unassigned (finished or removed)
            # Check if a PR was merged or exists
            r3 = subprocess.run(
                ["gh", "pr", "list", "--repo", FULL_REPO,
                 "--state", "all", "--json", "number,title,author,state",
                 "--jq", f'[.[] | select(.author.login == "copilot-swe-agent")]'],
                capture_output=True, text=True, env=env,
            )
            if r3.returncode == 0 and r3.stdout.strip():
                prs = json.loads(r3.stdout)
                for pr in prs:
                    title = pr.get("title", "").lower()
                    if f"#{number}" in title or f"issue {number}" in title.lower():
                        print(f"  ✅ Copilot finished (unassigned), PR: #{pr['number']}")
                        return True
            # Also treat unassignment as done
            print(f"  ✅ Copilot unassigned (session finished)")
            return True

    # Check for recent copilot comments
    r4 = subprocess.run(
        ["gh", "issue", "view", str(number), "--repo", FULL_REPO,
         "--json", "comments",
         "--jq", '[.comments[] | select(.author.login == "copilot-swe-agent" or .author.login == "copilot-swe-agent[bot]")] | length'],
        capture_output=True, text=True, env=env,
    )
    if r4.returncode == 0:
        comment_count = r4.stdout.strip()
        if comment_count and int(comment_count) > 0:
            print(f"  ✅ Copilot posted {comment_count} comment(s)")
            return True

    print(f"  ⏳ Copilot still working on #{number}")
    return False


# ── Agent runner ──────────────────────────────────────────

def read_agent_instructions(column):
    """Read the .md agent file and return its content as instructions."""
    agent_path = f".github/agents/{column.lower()}.md"
    if not os.path.exists(agent_path):
        return None
    return open(agent_path).read()


# ── Testing CI runner ─────────────────────────────────────

def run_testing_ci(number):
    """
    Checkout the feature branch and run npm run ci.
    Returns (success: bool, output: str).
    """
    branch = f"feat/issue-{number}"
    env = {**os.environ, "GH_TOKEN": GH_TOKEN, "HUSKY": "0", "CI": "true"}
    run = lambda cmd, **kw: subprocess.run(
        cmd, capture_output=True, text=True, env=env, **kw,
    )

    # Git setup
    run(["git", "config", "user.name", "Board Agent"])
    run(["git", "config", "user.email", "board-agent@iron-dome.local"])
    run(["git", "fetch", "origin"])

    # Checkout feature branch
    checkout = run(["git", "checkout", branch])
    if checkout.returncode != 0:
        checkout = run(["git", "checkout", "-b", branch, f"origin/{branch}"])
        if checkout.returncode != 0:
            return False, f"Branch `{branch}` not found"
    else:
        run(["git", "pull", "origin", branch, "--rebase"])

    # Install deps on feature branch
    install = run(["npm", "ci"])
    if install.returncode != 0:
        run(["git", "checkout", "main", "--force"])
        stderr = install.stderr.strip()[-1000:]
        return False, f"npm ci (install) failed:\n```\n{stderr}\n```"

    # Run full CI pipeline
    ci = run(["npm", "run", "ci"], timeout=600)
    combined = (ci.stdout + "\n" + ci.stderr).strip()

    # Back to main
    run(["git", "checkout", "main", "--force"])

    if ci.returncode == 0:
        return True, "All CI checks passed successfully."
    else:
        return False, f"```\n{combined[-2000:]}\n```"


# ── Move card to named column ─────────────────────────────

def move_card_to(board, card, target_col):
    """Move a card to a specific named column. Updates card in-place."""
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
        old_col = card["column"]
        card["column"] = target_col
        print(f"  {'✅' if ok else '❌'} {old_col} → {target_col}")
    return ok


# ── Main processing ───────────────────────────────────────

def process_card(card, board):
    """
    Process a single card through columns recursively.
    Steps: label → detect column → find agent → execute → move → remove label → loop.
    """
    cols = board["columns"]
    last_col = cols[-1] if cols else "done"

    while True:
        n = card["number"]
        col = card["column"]

        # Stop if card reached done or has no column
        if col is None or col == last_col:
            print(f"  ℹ️  #{n} reached '{col or last_col}', stopping")
            break

        print(f"\n{'=' * 50}")
        print(f"🔄 #{n} — {card['title']} [{col}]")

        # Step 2: Check processing label
        if LABEL_PROCESSING in card.get("labels", []):
            print(f"  ⏭️  Already has '{LABEL_PROCESSING}', skipping")
            break

        # Step 5: Find agent
        agent_path = f".github/agents/{col.lower()}.md"
        if not os.path.exists(agent_path):
            msg = f"⚠️ No agent found for column `{col}` (`{agent_path}`)."
            print(f"  ⚠️  No agent for '{col}', posting comment and stopping")
            post_comment(n, msg)
            break

        # Step 3: Add processing label
        label_add(n, LABEL_PROCESSING)

        # Step 7: Special testing column — run CI directly
        if col.lower() == TESTING_COLUMN:
            handled = handle_testing(card, board)
            label_remove(n, LABEL_PROCESSING)
            if not handled:
                break
            continue  # Loop for the new column

        # Step 6: Regular columns — assign Copilot Coding Agent
        instructions = read_agent_instructions(col)
        context = (
            f"## Issue #{n}: {card['title']}\n\n"
            f"{card['body']}\n\n"
            f"---\n\n"
            f"{instructions}"
        )

        ok = assign_copilot(n, context)
        if ok:
            label_add(n, LABEL_COPILOT)
            post_comment(n, f"🤖 Copilot Coding Agent assigned for **{col}** phase.\n\n"
                            f"Instructions from `{agent_path}` sent.")
        else:
            post_comment(n, f"❌ Failed to assign Copilot for **{col}** phase.")

        # Step 8: Remove processing (Copilot works async, we stop here)
        label_remove(n, LABEL_PROCESSING)
        break  # Copilot is async — completion detected in next cron run


def handle_testing(card, board):
    """
    Run npm run ci on the feature branch.
    Pass → move to next column, return True.
    Fail → move BACK to dev, return True.
    Returns False only on critical error.
    """
    n = card["number"]
    print(f"  🧪 Running CI on feat/issue-{n}...")

    success, output = run_testing_ci(n)

    if success:
        post_comment(n, f"## ✅ Testing Passed — Issue #{n}\n\n{output}")
        moved = move_next(board, card["item_id"], TESTING_COLUMN)
        if moved:
            cols = board["columns"]
            idx = cols.index(TESTING_COLUMN)
            card["column"] = cols[idx + 1]
            print(f"  ➡️  CI passed, card now in '{card['column']}'")
            return True
        return False
    else:
        post_comment(n, f"## ❌ Testing Failed — Issue #{n}\n\n"
                        f"CI check failed. Moving back to **{DEV_COLUMN}**.\n\n{output}")
        moved = move_card_to(board, card, DEV_COLUMN)
        if moved:
            print(f"  🔙 CI failed, card moved back to '{DEV_COLUMN}'")
            return True
        return False


def process_copilot_card(card, board):
    """Check if Copilot finished and move the card forward, then loop."""
    n = card["number"]
    col = card["column"]

    if not check_copilot_done(n):
        return  # Still working

    label_add(n, LABEL_PROCESSING)
    label_remove(n, LABEL_COPILOT)

    post_comment(n, f"✅ Copilot completed **{col}** phase. Moving to next column.")
    moved = move_next(board, card["item_id"], col)

    if moved:
        cols = board["columns"]
        idx = cols.index(col)
        next_col = cols[idx + 1]
        card["column"] = next_col
        card["labels"] = [l for l in card["labels"] if l != LABEL_COPILOT]
        print(f"  ➡️  Card now in '{next_col}'")

        # Step 9: Recursively process the new column
        label_remove(n, LABEL_PROCESSING)
        process_card(card, board)
        return

    label_remove(n, LABEL_PROCESSING)


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
    print("🤖 Board Agent (Copilot Coding Agent mode)")
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

    processed = False

    # Phase 1: Check cards with "copilot-working" label (poll for completion)
    copilot_cards = [
        c for c in board["cards"]
        if c["column"] is not None
        and c["column"] != last_col
        and LABEL_COPILOT in c["labels"]
        and (not MANUAL_ISSUE or str(c["number"]) == MANUAL_ISSUE)
    ]
    if copilot_cards:
        processed = True
        print(f"\n   🔍 Checking {len(copilot_cards)} Copilot-working card(s)")
        for card in copilot_cards:
            print(f"\n{'=' * 50}")
            print(f"⏳ #{card['number']} — {card['title']} [{card['column']}]")
            process_copilot_card(card, board)

    # Phase 2: New cards to process
    new_cards = [
        c for c in board["cards"]
        if c["column"] is not None
        and c["column"] != last_col
        and LABEL_COPILOT not in c["labels"]
        and LABEL_PROCESSING not in c["labels"]
        and (not MANUAL_ISSUE or str(c["number"]) == MANUAL_ISSUE)
    ]
    if new_cards:
        processed = True
        print(f"\n   🆕 Processing {len(new_cards)} new card(s)")
        for card in new_cards:
            process_card(card, board)

    if not processed:
        print("ℹ️  No cards to process")

    print(f"\n✅ Board Agent finished")


if __name__ == "__main__":
    main()
