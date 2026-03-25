# Testing Agent

This column is handled directly by the Board Agent (not by Copilot Coding Agent).

## Behavior

The Board Agent will:

1. Checkout branch `feat/issue-{N}`.
2. Run `npm ci` to install dependencies.
3. Run `npm run ci` to execute the full CI pipeline (lint, build, unit tests, integration tests).
4. If **all checks pass** (zero errors, zero warnings, minimum coverage met): move to the next column.
5. If **any check fails**: move the card **back to dev** column for fixes. This creates a dev → testing loop until CI passes.
