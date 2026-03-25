# Testing Agent

Runs the full CI pipeline and reports results.

## Execute

````bash
echo "## 🔄 Testing — Issue #${ISSUE_NUMBER}"
echo ""

npm run ci > /tmp/ci_output.txt 2>&1
CI_EXIT=$?

if [ $CI_EXIT -eq 0 ]; then
  echo "### ✅ CI Passed"
  echo ""
  echo "All gates passed successfully."
else
  echo "### ❌ CI Failed (exit ${CI_EXIT})"
  echo ""
  echo '```'
  tail -30 /tmp/ci_output.txt
  echo '```'
fi

echo ""
echo "---"
echo "*Testing completed by Board Agent.*"
````
