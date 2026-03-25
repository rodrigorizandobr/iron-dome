# PR Agent

Creates a Pull Request from the feature branch to main.

## Execute

```bash
BRANCH="feat/issue-${ISSUE_NUMBER}"

echo "## 📦 PR — Issue #${ISSUE_NUMBER}"
echo ""

# Create PR (or get existing one)
PR_URL=$(gh pr create \
  --title "feat: ${ISSUE_TITLE} (closes #${ISSUE_NUMBER})" \
  --body "Closes #${ISSUE_NUMBER}" \
  --base main \
  --head "${BRANCH}" \
  --repo "${FULL_REPO}" 2>/dev/null) || true

if [ -z "$PR_URL" ]; then
  PR_URL=$(gh pr view "${BRANCH}" --repo "${FULL_REPO}" --json url -q .url 2>/dev/null || echo "")
fi

if [ -n "$PR_URL" ]; then
  echo "**PR:** ${PR_URL}"
else
  echo "⚠️ Could not create or find PR for branch \`${BRANCH}\`"
fi

echo ""
echo "---"
echo "*PR created by Board Agent.*"
```
