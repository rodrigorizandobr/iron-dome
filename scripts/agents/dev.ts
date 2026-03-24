import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface CodeFile {
  path: string;
  content: string;
  description: string;
}

interface GeneratedCode {
  files: CodeFile[];
  branch: string;
  summary: string;
}

/**
 * Dev Agent — Autonomous code generation agent.
 * Reads issue → Generates code via Claude → Creates branch → Commits → Pushes
 */
async function devAgent(): Promise<void> {
  const issueNumber = process.env.ISSUE_NUMBER ?? '';
  const issueTitle = process.env.ISSUE_TITLE ?? 'No title';
  const issueBody = process.env.ISSUE_BODY ?? 'No description';
  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';

  if (!issueNumber) {
    console.error('❌ ISSUE_NUMBER env var is required.');
    process.exit(1);
  }

  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY env var is required.');
    process.exit(1);
  }

  console.log(`🚀 Dev Agent — Issue #${issueNumber}: ${issueTitle}`);

  const branchName = `feat/issue-${issueNumber}`;

  try {
    // 1. Create and checkout branch
    console.log(`📦 Creating branch: ${branchName}`);
    checkoutBranch(branchName);

    // 2. Generate code via Claude
    console.log('🤖 Generating code via Claude...');
    const code = await generateCode(issueNumber, issueTitle, issueBody, apiKey);

    // 3. Write files
    console.log('📝 Writing files to disk...');
    for (const file of code.files) {
      writeFile(file.path, file.content);
      console.log(`   ✅ ${file.path}`);
    }

    // 4. Commit
    console.log('📋 Committing changes...');
    commitChanges(issueNumber, code.summary);

    // 5. Push
    console.log('🚀 Pushing to remote...');
    pushBranch(branchName);

    // 6. Comment on issue
    console.log('💬 Posting comment on issue...');
    postComment(issueNumber, code);

    console.log(`\n✅ Dev Agent completed successfully!`);
    console.log(`💾 Branch: ${branchName}`);
    console.log(`📦 Files created: ${code.files.length}`);
  } catch (error) {
    console.error(`❌ Dev Agent failed: ${error}`);
    process.exit(1);
  }
}

/**
 * Create and checkout a git branch.
 */
function checkoutBranch(branchName: string): void {
  try {
    // Try to create new branch, or checkout if exists
    execSync(
      `git fetch origin && git checkout -b ${branchName} 2>/dev/null || git checkout ${branchName}`,
      {
        stdio: 'inherit',
      },
    );
  } catch {
    // Branch might already exist
    execSync(`git checkout ${branchName} || git checkout -b ${branchName}`, { stdio: 'inherit' });
  }
}

/**
 * Generate code using Claude API.
 */
async function generateCode(
  issueNumber: string,
  title: string,
  body: string,
  apiKey: string,
): Promise<GeneratedCode> {
  const client = new Anthropic({ apiKey });

  const prompt = `You are a senior NestJS architect for a 100% Serverless Fintech/SaaS API (Iron Dome).

Issue #${issueNumber}: ${title}

Description:
${body}

CRITICAL RULES:
- Use ONLY DynamoDB (BaseResourceService)
- PK: TENANT#[tenantId]#[ENTITY], SK: [ENTITY]#[id]
- Extend BaseResourceService<T, CreateDto, UpdateDto>
- Use @ApiBearerAuth() on controllers
- Multi-tenancy: ITenantRequest type
- Soft-delete: deleted: true + updatedAt
- Pagination: cursor-based PaginatedResult<T>
- i18n: I18nService.translate()
- Max 200 lines/file, JSDoc on public methods
- Code in English, user messages via i18n

Generate a COMPLETE, PRODUCTION-READY implementation.

Output ONLY valid JSON (NO markdown, NO backticks):
{
  "entityName": "string (PascalCase, singular)",
  "description": "string",
  "files": [
    {
      "path": "src/modules/[entity]/dto/create-[entity].dto.ts",
      "content": "full TypeScript content"
    }
  ]
}

Include files:
1. DTOs (create, update, response)
2. Service (extends BaseResourceService)
3. Controller (CRUD routes with JWT)
4. Module
5. Index barrel export
6. Test stubs (*.spec.ts)`;

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  const text = content && 'text' in content ? content.text : '';

  let parsed: { entityName: string; description: string; files: CodeFile[] };
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    console.error('Failed to parse Claude response:', text.slice(0, 500));
    throw new Error('Claude response not valid JSON');
  }

  return {
    files: parsed.files,
    branch: `feat/issue-${issueNumber}`,
    summary: parsed.description,
  };
}

/**
 * Write file to disk, creating directories as needed.
 */
function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Commit changes to git.
 */
function commitChanges(issueNumber: string, summary: string): void {
  execSync('git add .', { stdio: 'inherit' });
  execSync(`git commit -m "feat(issue-${issueNumber}): ${summary}"`, {
    stdio: 'inherit',
  });
}

/**
 * Push branch to remote.
 */
function pushBranch(branchName: string): void {
  execSync(`git push -u origin ${branchName}`, { stdio: 'inherit' });
}

/**
 * Post completion comment on GitHub issue.
 */
function postComment(issueNumber: string, code: GeneratedCode): void {
  const body = `✅ **Dev Agent Implementation Complete!**

Generated ${code.files.length} files:
${code.files.map((f) => `- \`${f.path}\``).join('\n')}

Branch: \`${code.branch}\`
Summary: ${code.summary}

Advancing to Dev-Test for test generation...`;

  const tmpFile = `/tmp/dev_comment_${issueNumber}.md`;
  fs.writeFileSync(tmpFile, body);

  try {
    execSync(`gh issue comment ${issueNumber} --body-file "${tmpFile}"`, {
      stdio: 'inherit',
    });
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

// Main execution
devAgent().catch(console.error);
