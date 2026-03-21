/**
 * Script: dev-test
 * Purpose: GitHub Copilot test generator — Auto-generates Jest test files from modified source code
 * Usage: npx ts-node scripts/dev-test.ts
 * Required ENV: COPILOT_TOKEN, ISSUE_TITLE, ISSUE_BODY
 * Optional ENV: (none)
 * Exit codes: 0 = success (no files to test or tests written), 1 = error (API error, invalid JSON)
 * Example: COPILOT_TOKEN=token ISSUE_TITLE="..." ISSUE_BODY="..." npx ts-node scripts/dev-test.ts
 */
import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/* eslint-disable i18next/no-literal-string */
const REQUIRED_VARS = ['COPILOT_TOKEN', 'ISSUE_TITLE', 'ISSUE_BODY'];
const MISSING_VARS = REQUIRED_VARS.filter((v) => !process.env[v]);

if (MISSING_VARS.length) {
  console.error(`✗ Missing required env vars: ${MISSING_VARS.join(', ')}`);
  console.error(`  Usage: ${REQUIRED_VARS.join(', ')} npx ts-node scripts/dev-test.ts`);
  process.exit(1);
}

const COPILOT_TOKEN = process.env.COPILOT_TOKEN!;
const ISSUE_TITLE = process.env.ISSUE_TITLE!;
const ISSUE_BODY = process.env.ISSUE_BODY!;
const COPILOT_API_BASE = 'https://models.github.ai/inference';
const GPT_MODEL = 'gpt-4o';
const TEMPERATURE_TEST = 0.2;
/* eslint-enable i18next/no-literal-string */

interface IGeneratedFile {
  filePath: string;
  content: string;
}

const client = new OpenAI({
  baseURL: COPILOT_API_BASE,
  apiKey: COPILOT_TOKEN,
});

function getModifiedFiles(): string[] {
  try {
    /* eslint-disable-next-line i18next/no-literal-string */
    console.log('→ Fetching modified files from git diff (main...HEAD)...');
    return execSync('git diff --name-only main...HEAD', { encoding: 'utf-8' })
      .split('\n')
      .filter((f) => f.trim() !== '' && f.endsWith('.ts') && !f.endsWith('.spec.ts'));
  } catch (err1) {
    try {
      /* eslint-disable-next-line i18next/no-literal-string */
      console.warn('⚠ git diff main...HEAD failed, trying HEAD diff...');
      return execSync('git show --name-only --format="" HEAD', { encoding: 'utf-8' })
        .split('\n')
        .filter((f) => f.trim() !== '' && f.endsWith('.ts') && !f.endsWith('.spec.ts'));
    } catch (err2) {
      const err = err2 instanceof Error ? err2 : new Error(String(err2));
      /* eslint-disable-next-line i18next/no-literal-string */
      console.error(`✗ Failed to get modified files: ${err.message}`);
      throw error;
    }
  }
}

function readSourceCodeContext(files: string[]): string {
  let context = '';

  for (const file of files) {
    try {
      const filePath = path.resolve(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        /* eslint-disable-next-line i18next/no-literal-string */
        context += `\n\n--- File: ${file} ---\n\`\`\`typescript\n${content}\n\`\`\``;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      /* eslint-disable-next-line i18next/no-literal-string */
      console.warn(`⚠ Failed to read ${file}: ${err.message}`);
    }
  }

  return context;
}

async function generateTestsViaOpenAI(prompt: string): Promise<IGeneratedFile[]> {
  try {
    /* eslint-disable-next-line i18next/no-literal-string */
    console.log('→ Requesting test generation from GitHub Copilot...');
    const response = await client.chat.completions.create({
      model: GPT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: TEMPERATURE_TEST,
    });

    let iaOutput = response.choices[0]?.message?.content || '[]';

    /* eslint-disable-next-line i18next/no-literal-string */
    // Remove markdown code blocks
    iaOutput = iaOutput.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const files = JSON.parse(iaOutput) as IGeneratedFile[];
      if (!Array.isArray(files)) {
        throw new Error('Expected array of files');
      }
      return files;
    } catch (parseError) {
      const err = parseError instanceof Error ? parseError : new Error(String(parseError));
      /* eslint-disable-next-line i18next/no-literal-string */
      console.error(`✗ Invalid JSON from AI: ${err.message}`);
      /* eslint-disable-next-line i18next/no-literal-string */
      console.error(`  Response: ${iaOutput.substring(0, 200)}...`);
      throw new Error('AI response is not valid JSON');
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    /* eslint-disable-next-line i18next/no-literal-string */
    console.error(`✗ OpenAI API failed: ${err.message}`);
    throw error;
  }
}

async function writeTestFilesToDisk(files: IGeneratedFile[]): Promise<void> {
  for (const file of files) {
    try {
      const fullPath = path.resolve(process.cwd(), file.filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, file.content, 'utf-8');
      /* eslint-disable-next-line i18next/no-literal-string */
      console.log(`  ✓ ${file.filePath}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      /* eslint-disable-next-line i18next/no-literal-string */
      console.error(`  ✗ Failed to write ${file.filePath}: ${err.message}`);
      throw error;
    }
  }
}

async function main(): Promise<void> {
  try {
    /* eslint-disable-next-line i18next/no-literal-string */
    console.log('✓ Analyzing generated code for test coverage...');

    // Discover modified files
    const modifiedFiles = getModifiedFiles();

    if (modifiedFiles.length === 0) {
      /* eslint-disable-next-line i18next/no-literal-string */
      console.log('ℹ No TypeScript source files modified. No tests needed.');
      process.exit(0);
    }

    /* eslint-disable-next-line i18next/no-literal-string */
    console.log(`✓ Found ${modifiedFiles.length} source files to test`);

    // Read source code context
    const sourceCodeContext = readSourceCodeContext(modifiedFiles);

    // Build prompt for test generation
    const prompt = `Você é um Engenheiro de Software QA / SDET especialista em Node.js, NestJS e AWS.
Sua tarefa é escrever os testes unitários usando Jest para os arquivos desenvolvidos para a issue: "${ISSUE_TITLE}" - "${ISSUE_BODY}".

Aqui está o código-fonte desenvolvido:
${sourceCodeContext}

REGRAS:
- Foque em atingir 100% de cobertura (branches, statements, functions).
- Use os padrões do NestJS (@nestjs/testing) para isolar módulos e injetar dependências.
- Mock TODAS as chamadas externas, especialmente chamadas para AWS (DynamoDB, SQS, SNS, S3).
- Siga a estrutura de testes em https://github.com/rodrigorizandobr/iron-dome/blob/main/jest-unit.json

RETORNE APENAS UM JSON VÁLIDO. O formato DEVE ser um array de objetos:
[
  {
    "filePath": "src/modules/exemplo/exemplo.service.spec.ts",
    "content": "// código completo do teste aqui"
  }
]`;

    // Request tests from Copilot
    const testFiles = await generateTestsViaOpenAI(prompt);

    if (testFiles.length === 0) {
      /* eslint-disable-next-line i18next/no-literal-string */
      console.log('ℹ No tests generated by AI');
      process.exit(0);
    }

    /* eslint-disable-next-line i18next/no-literal-string */
    console.log(`→ Writing ${testFiles.length} test files...`);
    await writeTestFilesToDisk(testFiles);

    /* eslint-disable-next-line i18next/no-literal-string */
    console.log('✓ Test generation complete. Files written to disk.');
    process.exit(0);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    /* eslint-disable-next-line i18next/no-literal-string */
    console.error(`✗ Test generation failed: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();
