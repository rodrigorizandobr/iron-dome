#!/usr/bin/env python3
"""
Board Agent v3 — Copilot Coding Agent orchestrator.

Runs every 1 minute via cron. For each non-done card without
"processing" label:
  1. Check if card already has "processing" label → skip
  2. Add "processing" label
  3. Detect column (status) of the card
  4. Find agent file at .github/agents/{column}.agent.md
  5. Execute the agent (assign Copilot with custom_agent)
  6. Testing column: run npm run ci (pass→next, fail→dev loop)
  7. Remove "processing" label
  8. Re-process card at its new column (recursive loop)
"""

import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

# ── Environment ──────────────────────────────────────────

GH_TOKEN = os.environ["GH_TOKEN"]
PROJECT_NUMBER = int(os.environ["PROJECT_NUMBER"])
OWNER = os.environ["OWNER"]
REPO = os.environ["REPO"]
MANUAL_ISSUE = os.environ.get("MANUAL_ISSUE", "").strip()
TARGET_COLUMN = os.environ.get("TARGET_COLUMN", "").strip()

if "/" in REPO:
    REPO = REPO.split("/", 1)[1]
FULL_REPO = f"{OWNER}/{REPO}"

# ── Constants ────────────────────────────────────────────

LABEL_PROCESSING = "processing"
COPILOT_BOT = "copilot-swe-agent[bot]"
TESTING_COLUMN = "testing"
DEV_COLUMN = "dev"
DONE_COLUMN = "done"
TODO_COLUMN = "to-do"
PR_COLUMN = "pr"
AGENTS_DIR = ".github/agents"


# ── Helpers ──────────────────────────────────────────────


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
        print(f"  GQL error: {r.stderr.strip()}")
        return None
    return json.loads(r.stdout)


def label_add(n, label):
    """Create label if missing, then add to issue."""
    env = {**os.environ, "GH_TOKEN": GH_TOKEN}
    subprocess.run(
        ["gh", "label", "create", label, "--color", "fbca04",
         "--force", "--repo", FULL_REPO],
        capture_output=True, env=env,
    )
    subprocess.run(
        ["gh", "issue", "edit", str(n), "--add-label", label,
         "--repo", FULL_REPO],
        capture_output=True, env=env,
    )
    print(f"  label +{label}")


def label_remove(n, label):
    """Remove a label from issue."""
    subprocess.run(
        ["gh", "issue", "edit", str(n), "--remove-label", label,
         "--repo", FULL_REPO],
        capture_output=True,
        env={**os.environ, "GH_TOKEN": GH_TOKEN},
    )
    print(f"  label -{label}")


def has_label(card, label):
    """Check if a card has a specific label."""
    return label in card.get("labels", [])


def post_comment(n, body):
    """Post a markdown comment on an issue."""
    fd, tmp = tempfile.mkstemp(suffix=".md")
    try:
        with os.fdopen(fd, "w") as f:
            f.write(body)
        subprocess.run(
            ["gh", "issue", "comment", str(n), "--body-file", tmp,
             "--repo", FULL_REPO],
            capture_output=True,
            env={**os.environ, "GH_TOKEN": GH_TOKEN},
        )
    finally:
        os.unlink(tmp)
    print(f"  comment posted")


def log_decision(issue_number, decision):
    """Append a decision to .github/decisions.md."""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    entry = f"\n- **#{issue_number}** [{ts}]: {decision}"
    path = ".github/decisions.md"
    if os.path.exists(path):
        with open(path, "a") as f:
            f.write(entry)


def find_agent_file(column_name):
    """Find agent file at .github/agents/{column}.agent.md."""
    name = column_name.lower().strip()
    path = os.path.join(AGENTS_DIR, f"{name}.agent.md")
    if os.path.exists(path):
        return path
    return None


# ── Board ────────────────────────────────────────────────


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
              ... on PullRequest {
                number title body state isDraft
                labels(first: 10) { nodes { name } }
                assignees(first: 10) { nodes { login } }
                merged
                author { login }
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
        print("No Status field found")
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
        assignees = [
            a["login"] for a in c.get("assignees", {}).get("nodes", [])
        ]
        is_pr = "merged" in c  # PullRequest has 'merged' field
        cards.append({
            "item_id": item["id"],
            "number": c["number"],
            "title": c["title"],
            "body": c.get("body") or "",
            "column": col,
            "labels": labels,
            "assignees": assignees,
            "state": c.get("state", "OPEN"),
            "type": "pr" if is_pr else "issue",
            "merged": c.get("merged", False),
            "isDraft": c.get("isDraft", False),
            "author": c.get("author", {}).get("login", ""),
        })
    return {
        "id": proj["id"],
        "status_field": status,
        "columns": columns,
        "cards": cards,
    }


# ── Card movement ────────────────────────────────────────


def move_card_to(board, card, target_col):
    """Move a card to a specific named column."""
    opt = next(
        (o for o in board["status_field"]["options"]
         if o["name"] == target_col),
        None,
    )
    if not opt:
        print(f"  Column '{target_col}' not found")
        return False
    r = gh_gql(
        """mutation($p:ID!,$i:ID!,$f:ID!,$o:String!) {
          updateProjectV2ItemFieldValue(input:{
            projectId:$p itemId:$i fieldId:$f
            value:{singleSelectOptionId:$o}
          }) { projectV2Item { id } }
        }""",
        p=board["id"], i=card["item_id"],
        f=board["status_field"]["id"], o=opt["id"],
    )
    ok = r and "errors" not in r
    if ok:
        old_col = card["column"]
        card["column"] = target_col
        print(f"  {old_col} -> {target_col}")
        log_decision(card["number"],
                     f"Moved from {old_col} to {target_col}")
    return ok


def move_next(board, card):
    """Move a project card to the next sequential column."""
    cols = board["columns"]
    try:
        idx = cols.index(card["column"])
    except ValueError:
        return False
    if idx >= len(cols) - 1:
        return False
    return move_card_to(board, card, cols[idx + 1])


def add_issue_to_project(board, issue_number):
    """Add an issue to the project board if not already present."""
    data = gh_gql(
        """query($owner:String!,$repo:String!,$n:Int!) {
          repository(owner:$owner, name:$repo) {
            issue(number:$n) { id title body state }
          }
        }""",
        owner=OWNER, repo=REPO, n=int(issue_number),
    )
    if not data:
        return None
    issue = data["data"]["repository"]["issue"]
    if not issue:
        print(f"  Issue #{issue_number} not found")
        return None
    result = gh_gql(
        """mutation($proj:ID!, $content:ID!) {
          addProjectV2ItemById(input:{projectId:$proj contentId:$content}) {
            item { id }
          }
        }""",
        proj=board["id"], content=issue["id"],
    )
    if not result:
        return None
    item_id = result["data"]["addProjectV2ItemById"]["item"]["id"]
    first_col = board["columns"][0] if board["columns"] else None
    card = {
        "item_id": item_id, "number": int(issue_number),
        "title": issue["title"], "body": issue.get("body") or "",
        "column": first_col, "labels": [], "assignees": [],
        "state": issue.get("state", "OPEN"),
    }
    board["cards"].append(card)
    print(f"  Added #{issue_number} to project")
    return card


# ── Copilot ──────────────────────────────────────────────


def assign_copilot(number, agent_name):
    """Assign Copilot Coding Agent with a custom_agent name."""
    payload = json.dumps({
        "assignees": [COPILOT_BOT],
        "agent_assignment": {
            "target_repo": FULL_REPO,
            "base_branch": "main",
            "custom_instructions": "",
            "custom_agent": agent_name,
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
        print(f"  Copilot assigned (agent: {agent_name})")
        return True
    print(f"  REST assign failed: {r.stderr.strip()[:200]}")
    post_comment(number,
                 f"@copilot Use the `{agent_name}` agent for this task.")
    return True


def is_copilot_done(number):
    """Check if Copilot finished (PR exists or unassigned)."""
    env = {**os.environ, "GH_TOKEN": GH_TOKEN}
    # Check open PRs by Copilot mentioning this issue
    r = subprocess.run(
        ["gh", "pr", "list", "--repo", FULL_REPO,
         "--state", "open", "--json", "number,title,author",
         "--jq",
         '[.[] | select(.author.login == "copilot-swe-agent")]'],
        capture_output=True, text=True, env=env,
    )
    if r.returncode == 0 and r.stdout.strip():
        prs = json.loads(r.stdout)
        for pr in prs:
            t = pr.get("title", "").lower()
            if f"#{number}" in t or f"issue {number}" in t:
                return True
    # Check if Copilot unassigned itself
    r2 = subprocess.run(
        ["gh", "issue", "view", str(number), "--repo", FULL_REPO,
         "--json", "assignees", "--jq",
         '[.assignees[].login]'
         ' | map(select(. == "copilot-swe-agent")) | length'],
        capture_output=True, text=True, env=env,
    )
    if r2.returncode == 0 and r2.stdout.strip() == "0":
        return True
    return False


def wait_copilot(number, max_checks=60, interval=60):
    """Poll until Copilot finishes, up to max_checks times."""
    import time
    for i in range(max_checks):
        if is_copilot_done(number):
            print(f"  Copilot done (check {i + 1})")
            return True
        print(f"  Copilot working... ({i + 1}/{max_checks})")
        time.sleep(interval)
    print(f"  Copilot timeout after {max_checks} checks")
    return False


# ── Testing (CI) ─────────────────────────────────────────


def find_copilot_branch(number):
    """Find the branch Copilot used (copilot/* or feat/issue-N)."""
    env = {**os.environ, "GH_TOKEN": GH_TOKEN}
    # First: check PRs by Copilot for this issue
    r = subprocess.run(
        ["gh", "pr", "list", "--repo", FULL_REPO,
         "--state", "all", "--json", "number,title,headRefName,author",
         "--jq",
         '[.[] | select(.author.login == "copilot-swe-agent")]'],
        capture_output=True, text=True, env=env,
    )
    if r.returncode == 0 and r.stdout.strip():
        for pr in json.loads(r.stdout):
            t = pr.get("title", "").lower()
            if f"#{number}" in t or f"issue {number}" in t:
                branch = pr.get("headRefName", "")
                if branch:
                    print(f"  Found Copilot branch: {branch}")
                    return branch
    # Fallback: try conventional name
    r2 = subprocess.run(
        ["git", "ls-remote", "--heads", "origin", f"feat/issue-{number}"],
        capture_output=True, text=True, env=env,
    )
    if r2.returncode == 0 and r2.stdout.strip():
        return f"feat/issue-{number}"
    # Also check copilot/* branches
    r3 = subprocess.run(
        ["git", "ls-remote", "--heads", "origin"],
        capture_output=True, text=True, env=env,
    )
    if r3.returncode == 0:
        for line in r3.stdout.strip().split("\n"):
            if not line:
                continue
            ref = line.split("\t")[-1].replace("refs/heads/", "")
            if "copilot" in ref and str(number) in ref:
                print(f"  Found copilot branch: {ref}")
                return ref
    return None


def run_testing_ci(number):
    """Find the correct branch and run npm run ci."""
    branch = find_copilot_branch(number)
    if not branch:
        return False, f"No branch found for issue #{number}"
    env = {**os.environ, "GH_TOKEN": GH_TOKEN, "HUSKY": "0", "CI": "true"}
    run = lambda cmd, **kw: subprocess.run(
        cmd, capture_output=True, text=True, env=env, **kw,
    )
    run(["git", "config", "user.name", "Board Agent"])
    run(["git", "config", "user.email", "board-agent@iron-dome.local"])
    run(["git", "fetch", "origin"])
    checkout = run(["git", "checkout", branch])
    if checkout.returncode != 0:
        checkout = run(
            ["git", "checkout", "-b", branch, f"origin/{branch}"])
        if checkout.returncode != 0:
            run(["git", "checkout", "main", "--force"])
            return False, f"Branch {branch} not found on remote"
    else:
        run(["git", "pull", "origin", branch, "--rebase"])
    install = run(["npm", "ci"])
    if install.returncode != 0:
        run(["git", "checkout", "main", "--force"])
        return False, f"npm ci failed:\n{install.stderr.strip()[-1000:]}"
    ci = run(["npm", "run", "ci"], timeout=600)
    combined = (ci.stdout + "\n" + ci.stderr).strip()
    run(["git", "checkout", "main", "--force"])
    if ci.returncode == 0:
        return True, "All CI checks passed."
    return False, combined[-2000:]


# ── Core: process one card ───────────────────────────────


def process_card(card, board):
    """
    Process a single card following the 9-step flow:
    1. Skip if done/to-do
    2. Skip if already has "processing" label
    3. Add "processing" label
    4. Detect column name
    5. Find agent at .github/agents/{column}.agent.md
    6. Execute agent (assign Copilot) — or run CI for testing
    7. Remove "processing" label
    8. Re-process at new column (loop)
    """
    cols = board["columns"]
    last_col = cols[-1] if cols else DONE_COLUMN

    n = card["number"]
    col = card["column"]

    # Step 1: skip done / to-do / no column
    if col is None or col.lower() == last_col.lower():
        return
    if col.lower() == TODO_COLUMN.lower():
        return

    # Step 2: skip if already processing
    if has_label(card, LABEL_PROCESSING):
        print(f"  #{n} already has '{LABEL_PROCESSING}', skipping")
        return

    print(f"\n{'=' * 50}")
    print(f"Processing #{n} -- {card['title']} [{col}]")

    # Step 3: add processing label
    label_add(n, LABEL_PROCESSING)
    card["labels"].append(LABEL_PROCESSING)

    # Step 4: detect column
    col_lower = col.lower().strip()

    # Step 5: find agent file
    agent_file = find_agent_file(col_lower)
    if not agent_file:
        post_comment(n,
                     f"No agent found for column **{col}**.\n\n"
                     f"Expected file: `{AGENTS_DIR}/{col_lower}.agent.md`")
        log_decision(n, f"No agent for column '{col}'")
        label_remove(n, LABEL_PROCESSING)
        card["labels"] = [
            lb for lb in card["labels"] if lb != LABEL_PROCESSING
        ]
        return

    agent_name = col_lower  # agent name = column name (lowercase)
    print(f"  Agent: {agent_file}")

    # Step 6+7: execute agent
    if col_lower == TESTING_COLUMN:
        # Testing: run npm run ci directly
        success, output = run_testing_ci(n)
        if success:
            post_comment(n, f"## CI Passed\n\n{output}")
            log_decision(n, "CI passed -- advancing")
            move_next(board, card)
        else:
            post_comment(
                n,
                f"## CI Failed\n\nMoving back to **{DEV_COLUMN}**.\n\n"
                f"```\n{output}\n```")
            log_decision(n, f"CI failed -- returning to {DEV_COLUMN}")
            move_card_to(board, card, DEV_COLUMN)
    else:
        # All other columns: assign Copilot and wait
        assign_copilot(n, agent_name)
        post_comment(
            n,
            f"Copilot assigned -- **{col}** phase\n\n"
            f"Agent: `{agent_name}` | "
            f"File: `{agent_file}`")
        log_decision(n,
                     f"Copilot assigned for '{col}' (agent: {agent_name})")

        # Wait for Copilot to finish
        done = wait_copilot(n)
        if done:
            post_comment(n, f"Copilot completed **{col}**. Advancing.")
            log_decision(n, f"Copilot completed '{col}'")
            move_next(board, card)
        else:
            post_comment(n,
                         f"Copilot timeout on **{col}**. "
                         f"Will retry next run.")
            log_decision(n, f"Copilot timeout on '{col}'")

    # Step 8: remove processing label
    label_remove(n, LABEL_PROCESSING)
    card["labels"] = [
        lb for lb in card["labels"] if lb != LABEL_PROCESSING
    ]

    # Step 9: re-process at new column (recursive)
    new_col = card["column"]
    if (new_col and new_col.lower() != last_col.lower()
            and new_col.lower() != TODO_COLUMN.lower()
            and new_col != col):
        print(f"  Re-processing #{n} at new column '{new_col}'")
        process_card(card, board)


# ── Main ─────────────────────────────────────────────────


def main():
    """Board Agent v3 entry point."""
    print("Board Agent v3")
    print(f"  {FULL_REPO} -- Project #{PROJECT_NUMBER}")

    board = get_board()
    if not board:
        print("Could not load board")
        sys.exit(1)

    cols = board["columns"]
    print(f"  Columns: {' -> '.join(cols)}")

    # Manual issue: add to project if needed
    if MANUAL_ISSUE:
        found = any(
            str(c["number"]) == MANUAL_ISSUE for c in board["cards"])
        if not found:
            add_issue_to_project(board, MANUAL_ISSUE)

    # Manual column override
    if TARGET_COLUMN and MANUAL_ISSUE:
        target_card = next(
            (c for c in board["cards"]
             if str(c["number"]) == MANUAL_ISSUE), None)
        if target_card:
            move_card_to(board, target_card, TARGET_COLUMN)

    # ── Handle PR cards (move Copilot PRs to correct column) ──
    pr_cards = [
        c for c in board["cards"]
        if c.get("type") == "pr" and c["column"] is not None
    ]
    for pr_card in pr_cards:
        target = None
        if pr_card["merged"]:
            target = DONE_COLUMN
        elif pr_card["state"] == "MERGED":
            target = DONE_COLUMN
        elif pr_card["state"] == "CLOSED":
            target = DONE_COLUMN
        else:
            target = PR_COLUMN
        current = pr_card["column"].lower().strip()
        if current != target.lower():
            print(f"\n  PR #{pr_card['number']} "
                  f"({pr_card['column']}) -> {target}")
            move_card_to(board, pr_card, target)

    # ── Get all issue cards that are not done and not processing ──
    last_col = cols[-1] if cols else DONE_COLUMN
    eligible = [
        c for c in board["cards"]
        if c.get("type") == "issue"
        and c["column"] is not None
        and c["column"].lower() != last_col.lower()
        and c["column"].lower() != TODO_COLUMN.lower()
        and not has_label(c, LABEL_PROCESSING)
        and (not MANUAL_ISSUE or str(c["number"]) == MANUAL_ISSUE)
    ]

    if not eligible:
        print("No cards to process")
    else:
        print(f"\n  Processing {len(eligible)} card(s)")
        for card in eligible:
            process_card(card, board)

    print("\nBoard Agent v3 finished")


if __name__ == "__main__":
    main()
