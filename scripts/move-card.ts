/**
 * Script: move-card
 * Purpose: GitHub Copilot automation — Move issues on GitHub Project board when workflow changes
 * Usage: npx ts-node scripts/move-card.ts <columnName>
 * Required ENV: ISSUE_NUMBER, GITHUB_REPOSITORY, PROJECT_NUMBER
 * Optional ENV: (none)
 * Exit codes: 0 = success, 1 = error (missing args, API error, missing column)
 * Example: npx ts-node scripts/move-card.ts "Dev"
 */
import { execSync } from 'child_process';

/* eslint-disable i18next/no-literal-string */
// Validate required env vars
const REQUIRED_ENV_VARS = ['ISSUE_NUMBER', 'GITHUB_REPOSITORY', 'PROJECT_NUMBER'];
const MISSING_ENV_VARS = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);

if (MISSING_ENV_VARS.length) {
  console.error(`✗ Missing required env vars: ${MISSING_ENV_VARS.join(', ')}`);
  console.error(`  Usage: ${REQUIRED_ENV_VARS.join(', ')} npx ts-node move-card.ts <columnName>`);
  process.exit(1);
}

// Validate required CLI arguments
const TARGET_COLUMN = process.argv[2];
if (!TARGET_COLUMN) {
  console.error('✗ Missing required argument: <columnName>');
  console.error('  Usage: npx ts-node scripts/move-card.ts <columnName>');
  console.error('  Example: npx ts-node scripts/move-card.ts "Dev"');
  process.exit(1);
}

const ISSUE_NUMBER = process.env.ISSUE_NUMBER!;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY!;
const PROJECT_NUMBER = process.env.PROJECT_NUMBER!;
/* eslint-enable i18next/no-literal-string */

interface IProjectResponse {
  id: string;
}

interface IFieldOption {
  id: string;
  name: string;
}

interface IStatusField {
  id: string;
  name: string;
  options: IFieldOption[];
}

interface IFieldsResponse {
  fields: IStatusField[];
}

interface IProjectItem {
  id: string;
}

interface IIssueResponse {
  projectItems: IProjectItem[];
}

interface IAddItemResponse {
  id: string;
}

function parseJsonResponse<T>(jsonString: string, context: string): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    /* eslint-disable-next-line i18next/no-literal-string */
    throw new Error(`Failed to parse JSON response for ${context}: ${err.message}`);
  }
}

function executeGhCommand(command: string, context: string): string {
  try {
    /* eslint-disable-next-line i18next/no-literal-string */
    return execSync(command, { encoding: 'utf-8' });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    /* eslint-disable-next-line i18next/no-literal-string */
    throw new Error(`GitHub CLI failed for ${context}: ${err.message}`);
  }
}

async function main(): Promise<void> {
  try {
    const owner = GITHUB_REPOSITORY.split('/')[0];

    /* eslint-disable-next-line i18next/no-literal-string */
    console.log(`✓ Moving issue #${ISSUE_NUMBER} to '${TARGET_COLUMN}' on GitHub Project...`);

    // 1. Fetch project ID
    /* eslint-disable-next-line i18next/no-literal-string */
    console.log('  → Fetching project ID...');
    const projOutput = executeGhCommand(
      `gh project view ${PROJECT_NUMBER} --owner ${owner} --format json`,
      'project view',
    );
    const projectData = parseJsonResponse<IProjectResponse>(projOutput, 'project view');
    const projectId = projectData.id;

    // 2. Fetch fields (Status column)
    /* eslint-disable-next-line i18next/no-literal-string */
    console.log('  → Fetching project fields...');
    const fieldsOutput = executeGhCommand(
      `gh project field-list ${PROJECT_NUMBER} --owner ${owner} --format json`,
      'field-list',
    );
    const fieldsData = parseJsonResponse<IFieldsResponse>(fieldsOutput, 'field-list');
    const statusField = fieldsData.fields.find((f) => f.name === 'Status');

    if (!statusField) {
      /* eslint-disable-next-line i18next/no-literal-string */
      throw new Error('Status field not found in project board');
    }

    // 3. Find the target column option
    /* eslint-disable-next-line i18next/no-literal-string */
    console.log(`  → Searching for column '${TARGET_COLUMN}'...`);
    const targetOption = statusField.options.find(
      (o) => o.name.toLowerCase() === TARGET_COLUMN.toLowerCase(),
    );

    if (!targetOption) {
      /* eslint-disable-next-line i18next/no-literal-string */
      throw new Error(
        `Column '${TARGET_COLUMN}' not found. Available columns: ${statusField.options.map((o) => o.name).join(', ')}`,
      );
    }

    // 4. Fetch issue's project items
    /* eslint-disable-next-line i18next/no-literal-string */
    console.log('  → Fetching issue project item ID...');
    const issueOutput = executeGhCommand(
      `gh issue view ${ISSUE_NUMBER} --json projectItems`,
      'issue view',
    );
    const issueData = parseJsonResponse<IIssueResponse>(issueOutput, 'issue view');
    let itemId = issueData.projectItems.length > 0 ? issueData.projectItems[0].id : null;

    // 5. If issue not on board, add it first
    if (!itemId) {
      /* eslint-disable-next-line i18next/no-literal-string */
      console.log('  → Issue not on board yet. Adding to project...');
      const addOutput = executeGhCommand(
        `gh project item-add ${PROJECT_NUMBER} --owner ${owner} --url https://github.com/${GITHUB_REPOSITORY}/issues/${ISSUE_NUMBER} --format json`,
        'item-add',
      );
      const addData = parseJsonResponse<IAddItemResponse>(addOutput, 'item-add');
      itemId = addData.id;
    }

    // 6. Move the item to target column
    /* eslint-disable-next-line i18next/no-literal-string */
    console.log(`  → Moving item to column '${targetOption.name}'...`);
    executeGhCommand(
      `gh project item-edit --id ${itemId} --project-id ${projectId} --field-id ${statusField.id} --single-select-option-id ${targetOption.id}`,
      'item-edit',
    );

    // 7. Update issue label for visual consistency
    /* eslint-disable-next-line i18next/no-literal-string */
    console.log('  → Updating issue label...');
    executeGhCommand(
      `gh issue edit ${ISSUE_NUMBER} --add-label "${TARGET_COLUMN.toLowerCase()}"`,
      'issue edit',
    );

    /* eslint-disable-next-line i18next/no-literal-string */
    console.log(`✓ Issue #${ISSUE_NUMBER} successfully moved to '${targetOption.name}'`);
    process.exit(0);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    /* eslint-disable-next-line i18next/no-literal-string */
    console.error(`✗ Failed to move card: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();
