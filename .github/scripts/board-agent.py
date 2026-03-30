#!/usr/bin/env python3
"""
Board Agent v2 -- Native Copilot Coding Agent orchestrator.

Uses GitHub native custom agent assignment (custom_agent field)
instead of sending inline instructions. Copilot reads .agent.md
files directly from the repository.

Flow:
  1. Poll board -> find cards without "processing" label
  2. For each card: detect column -> assign Copilot with custom_agent
  3. Testing column: run npm run ci directly (pass->pr, fail->dev)
  4. Poll copilot-working cards for completion
  5. Log decisions to .github/decisions.md
"""

import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

# --- Environment ---
GH_TOKEN = os.environ["GH_TOKEN"]
PROJECT_NUMBER = int(os.environ["PROJECT_NUMBER"])
OWNER = os.environ["OWNER"]
REPO = os.environ["REPO"]
MANUAL_ISSUE = os.environ.get("MANUAL_ISSUE", "").strip()
TARGET_COLUMN = os.environ.get("TARGET_COLUMN", "").strip()

if "/" in REPO:
    REPO = REPO.split("/", 1)[1]
FULL_REPO = f"{OWNER}/{REPO}"

# --- Constants ---
LABEL_PROCESSING = "processing"
LABEL_COPILOT = "copilot-working"
COPILOT_BOT = "copilot-swe-agent[bot]"
TESTING_COLUMN = "testing"
DEV_COLUMN = "dev"
DONE_COLUMN = "done"
TODO_COLUMN = "to-do"

# Maps board column names to .agent.md file names (without extension).
# Copilot reads .github/agents/{name}.agent.md automatically.
AGENT_MAP = {
    "refinement": "refinement",
    "dev": "dev",
    "dev-test": "dev-test",
    "testing": "testing",
    "pr": "pr",
}


# ── Helpers ──────────────────────────────────────────────


def gh_gql(query, **variables):
    """Execute a GitHub GraphQL query via gh CLI."""
    cmd = ["gh", "api", "graphql", "-f", f"query={query}"]
    for k, v in variables.items():
        flag = "-F" if isinstance(v, int) else "-f"
        cmd += [flag, f"{k}={v}"]
    r = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        env={**os.environ, "GH_TOKEN": GH_TOKEN},
    )
    if r.returncode != 0:
        print(f"  GQL error: {r.stderr.strip()}")
        return None
    return json.loads(r.stdout)


def label_add(n, label):
    """Create label if missing, then add to issue."""
    env = {**os.environ, "GH_TOKEN": GH_TOKEN}
    color = "fbca04" if label == LABEL_PROCESSING else "1d76db"
    subprocess.run(
        [
            "gh", "label", "create", label,
            "--color", color, "--force", "--repo", FULL_REPO,
        ],
        capture_output=True, env=env,
    )
    subprocess.run(
        [
            "gh", "issue", "edit", str(n),
            "--add-label", label, "--repo", FULL_REPO,
        ],
        capture_output=True, env=env,
    )
    print(f"  label +{label}")


def label_remove(n, label):
    """Remove a label from issue."""
    subprocess.run(
        [
            "gh", "issue", "edit", str(n),
            "--remove-label", label, "--repo", FULL_REPO,
        ],
        capture_output=True,
        env={**os.environ, "GH_TOKEN": GH_TOKEN},
    )
    print(f"  label -{label}")


def post_comment(n, body):
    """Post a markdown comment on an issue."""
    fd, tmp = tempfile.mkstemp(suffix=".md")
    try:
        with os.fdopen(fd, "w") as f:
            f.write(body)
        subprocess.run(
            [
                "gh", "issue", "comment", str(n),
                "--body-file", tmp, "--repo", FULL_REPO,
            ],
            capture_output=True,
            env={**os.environ, "GH_TOKEN": GH_TOKEN},
        )
    finally:
        os.unlink(tmp)
    print(f"  comment posted")


def log_decision(issue_number, decision):
    """Append a decision to .github/decisions.md (shared memory)."""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    entry = f"\n- **#{issue_number}** [{ts}]: {decision}"
    path = ".github/decisions.md"
    if os.path.exists(path):
        with open(path, "a") as f:
            f.write(entry)


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
        "item_id": item_id,
        "number": int(issue_number),
        "title": issue["title"],
        "body": issue.get("body") or "",
        "column": first_col,
        "labels": [],
        "assignees": [],
        "state": issue.get("state", "OPEN"),
    }
    board["cards"].append(card)
    print(f"  Added #{issue_number} to project")
    return card


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
        p=board["id"],
        i=card["item_id"],
        f=board["status_field"]["id"],
        o=opt["id"],
    )
    ok = r and "errors" not in r
    if ok:
        old_col = card["column"]
        card["column"] = target_col
        print(f"  {old_col} -> {target_col}")
        log_decision(
            card["number"], f"Moved from {old_col} to {target_col}",
        )
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


# ── Copilot assignment ───────────────────────────────────


def assign_copilot(number, custom_agent_name):
    """Assign Copilot Coding Agent using native custom_agent field."""
    payload = json.dumps({
        "assignees": [COPILOT_BOT],
        "agent_assignment": {
            "target_repo": FULL_REPO,
            "base_branch": "main",
            "custom_instructions": "",
            "custom_agent": custom_agent_name,
            "model": "",
        },
    })
    r = subprocess.run(
        [
            "gh", "api", "--method", "POST",
            "-H", "Accept: application/vnd.github+json",
            "-H", "X-GitHub-Api-Version: 2022-11-28",
            f"/repos/{FULL_REPO}/issues/{number}/assignees",
            "--input", "-",
        ],
        input=payload,
        capture_output=True,
        text=True,
        env={**os.environ, "GH_TOKEN": GH_TOKEN},
    )
    if r.returncode == 0:
        print(f"  Copilot assigned (agent: {custom_agent_name})")
        return True
    print(f"  REST failed: {r.stderr.strip()[:200]}")
    # Fallback: mention-based assignment
    post_comment(
        number,
        f"@copilot Use the `{custom_agent_name}` agent for this task.",
    )
    return True


def check_copilot_done(number):
    """Check if Copilot has finished working on an issue."""
    env = {**os.environ, "GH_TOKEN": GH_TOKEN}

    # Check for open PRs by Copilot referencing this issue
    r = subprocess.run(
        [
            "gh", "pr", "list", "--repo", FULL_REPO,
            "--state", "open", "--json", "number,title,headRefName,author",
            "--jq",
            '[.[] | select(.author.login == "copilot-swe-agent")]',
        ],
        capture_output=True, text=True, env=env,
    )
    if r.returncode == 0 and r.stdout.strip():
        for pr in json.loads(r.stdout):
            title = pr.get("title", "").lower()
            if f"#{number}" in title or f"issue {number}" in title:
                print(f"  Copilot PR found: #{pr['number']}")
                return True

    # Check if Copilot unassigned itself (session finished)
    r2 = subprocess.run(
        [
            "gh", "issue", "view", str(number), "--repo", FULL_REPO,
            "--json", "assignees",
            "--jq",
            '[.assignees[].login] '
            '| map(select(. == "copilot-swe-agent")) | length',
        ],
        capture_output=True, text=True, env=env,
    )
    if r2.returncode == 0 and r2.stdout.strip() == "0":
        # Copilot unassigned — check all PRs (including merged)
        r3 = subprocess.run(
            [
                "gh", "pr", "list", "--repo", FULL_REPO,
                "--state", "all", "--json", "number,title,author",
                "--jq",
                '[.[] | select(.author.login == "copilot-swe-agent")]',
            ],
            capture_output=True, text=True, env=env,
        )
        if r3.returncode == 0 and r3.stdout.strip():
            for pr in json.loads(r3.stdout):
                title = pr.get("title", "").lower()
                if f"#{number}" in title or f"issue {number}" in title:
                    print(f"  Copilot finished, PR: #{pr['number']}")
                    return True
        print(f"  Copilot unassigned (session finished)")
        return True

    # Check comments from Copilot
    r4 = subprocess.run(
        [
            "gh", "issue", "view", str(number), "--repo", FULL_REPO,
            "--json", "comments", "--jq",
            '[.comments[] | select('
            '.author.login == "copilot-swe-agent" or '
            '.author.login == "copilot-swe-agent[bot]"'
            ')] | length',
        ],
        capture_output=True, text=True, env=env,
    )
    if r4.returncode == 0 and r4.stdout.strip():
        count = int(r4.stdout.strip())
        if count > 0:
            print(f"  Copilot posted {count} comment(s)")
            return True

    print(f"  Copilot still working on #{number}")
    return False


# ── Testing (CI) ─────────────────────────────────────────


def run_testing_ci(number):
    """Checkout the feature branch and run npm run ci."""
    branch = f"feat/issue-{number}"
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
            ["git", "checkout", "-b", branch, f"origin/{branch}"],
        )
        if checkout.returncode != 0:
            return False, f"Branch {branch} not found"
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
        return True, "All CI checks passed (7/7)."
    return False, combined[-2000:]


def handle_testing(card, board):
    """Run npm run ci. Pass -> next. Fail -> back to dev."""
    n = card["number"]
    print(f"  Running CI on feat/issue-{n}...")
    success, output = run_testing_ci(n)
    if success:
        post_comment(n, f"## CI Passed (7/7)\n\n{output}")
        log_decision(n, "CI passed -- advancing to pr")
        moved = move_next(board, card)
        if moved:
            print(f"  CI passed, now in '{card['column']}'")
            return True
        return False

    post_comment(
        n,
        f"## CI Failed\n\nMoving back to **{DEV_COLUMN}**.\n\n"
        f"```\n{output}\n```",
    )
    log_decision(n, f"CI failed -- returning to {DEV_COLUMN}")
    moved = move_card_to(board, card, DEV_COLUMN)
    if moved:
        print(f"  CI failed, back to '{DEV_COLUMN}'")
        return True
    return False


# ── Card processing ──────────────────────────────────────


def process_card(card, board):
    """Process a single card using native custom_agent assignment."""
    cols = board["columns"]
    last_col = cols[-1] if cols else DONE_COLUMN

    while True:
        n = card["number"]
        col = card["column"]

        if col is None or col == last_col or col == TODO_COLUMN:
            print(f"  #{n} in '{col}', skipping")
            break

        print(f"\n{'=' * 50}")
        print(f"Processing #{n} -- {card['title']} [{col}]")

        if LABEL_PROCESSING in card.get("labels", []):
            print(f"  Already processing, skipping")
            break

        agent_name = AGENT_MAP.get(col.lower())
        if not agent_name:
            print(f"  No agent for column '{col}'")
            break

        label_add(n, LABEL_PROCESSING)

        # Testing column runs CI directly (synchronous)
        if col.lower() == TESTING_COLUMN:
            handled = handle_testing(card, board)
            label_remove(n, LABEL_PROCESSING)
            if not handled:
                break
            continue

        # All other columns: assign Copilot with custom_agent
        ok = assign_copilot(n, agent_name)
        if ok:
            label_add(n, LABEL_COPILOT)
            post_comment(
                n,
                f"Copilot assigned -- **{col}** phase\n\n"
                f"Agent: `{agent_name}` | "
                f"File: `.github/agents/{agent_name}.agent.md`\n\n"
                f"Reads repo instructions + "
                f"`.github/decisions.md` for shared context.",
            )
            log_decision(
                n, f"Copilot assigned for '{col}' (agent: {agent_name})",
            )
        else:
            post_comment(n, f"Failed to assign Copilot for **{col}**.")

        label_remove(n, LABEL_PROCESSING)
        break


def process_copilot_card(card, board):
    """Check if Copilot finished and advance the card."""
    n = card["number"]
    col = card["column"]

    if not check_copilot_done(n):
        return

    label_add(n, LABEL_PROCESSING)
    label_remove(n, LABEL_COPILOT)
    post_comment(n, f"Copilot completed **{col}**. Advancing.")
    log_decision(n, f"Copilot completed '{col}' -- advancing")

    moved = move_next(board, card)
    if moved:
        card["labels"] = [
            lb for lb in card["labels"] if lb != LABEL_COPILOT
        ]
        print(f"  Now in '{card['column']}'")
        label_remove(n, LABEL_PROCESSING)
        # Recursively process next column
        process_card(card, board)
        return

    label_remove(n, LABEL_PROCESSING)


# ── Main ─────────────────────────────────────────────────


def main():
    """Board Agent v2 entry point."""
    print("Board Agent v2 (Native Custom Agents)")
    print(f"  {FULL_REPO} -- Project #{PROJECT_NUMBER}")

    board = get_board()
    if not board:
        print("Could not load board")
        sys.exit(1)

    cols = board["columns"]
    last_col = cols[-1] if cols else DONE_COLUMN
    print(f"  Columns: {' -> '.join(cols)}")

    # Add manual issue to project if not present
    if MANUAL_ISSUE:
        found = any(
            str(c["number"]) == MANUAL_ISSUE for c in board["cards"]
        )
        if not found:
            add_issue_to_project(board, MANUAL_ISSUE)

    # Override column for manual dispatch
    if TARGET_COLUMN and MANUAL_ISSUE:
        target_card = next(
            (c for c in board["cards"]
             if str(c["number"]) == MANUAL_ISSUE),
            None,
        )
        if target_card:
            move_card_to(board, target_card, TARGET_COLUMN)

    processed = False

    # Phase 1: Poll copilot-working cards
    copilot_cards = [
        c for c in board["cards"]
        if c["column"] is not None
        and c["column"] != last_col
        and LABEL_COPILOT in c["labels"]
        and (not MANUAL_ISSUE or str(c["number"]) == MANUAL_ISSUE)
    ]
    if copilot_cards:
        processed = True
        print(f"\n  Polling {len(copilot_cards)} Copilot-working card(s)")
        for card in copilot_cards:
            print(f"\n{'=' * 50}")
            print(
                f"Checking #{card['number']} -- "
                f"{card['title']} [{card['column']}]",
            )
            process_copilot_card(card, board)

    # Phase 2: Process new cards (skip to-do and done)
    new_cards = [
        c for c in board["cards"]
        if c["column"] is not None
        and c["column"] != last_col
        and c["column"] != TODO_COLUMN
        and LABEL_COPILOT not in c["labels"]
        and LABEL_PROCESSING not in c["labels"]
        and (not MANUAL_ISSUE or str(c["number"]) == MANUAL_ISSUE)
    ]
    if new_cards:
        processed = True
        print(f"\n  Processing {len(new_cards)} new card(s)")
        for card in new_cards:
            process_card(card, board)

    if not processed:
        print("No cards to process")

    print("\nBoard Agent v2 finished")


if __name__ == "__main__":
    main()
