/**
 * Script: dev
 * Purpose: GitHub Copilot agent runner — Auto-generates TypeScript code from GitHub issues
 * Usage: npx ts-node scripts/dev.ts
 * Required ENV: COPILOT_TOKEN, ISSUE_TITLE, ISSUE_BODY, ISSUE_NUMBER, GITHUB_REPOSITORY
 * Optional ENV: GH_TOKEN (defaults to GITHUB_TOKEN), OPENAI_API_KEY_OVERRIDE
 * Exit codes: 0 = success, 1 = error (missing env, API error, invalid JSON)
 * eslint-disable no-secrets/no-secrets
 */
import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';

/* eslint-disable i18next/no-literal-string */
const REQUIRED_VARS = [
  'COPILOT_TOKEN',
  'ISSUE_TITLE',
  'ISSUE_BODY',
  'ISSUE_NUMBER',
  'GITHUB_REPOSITORY',
];
const MISSING_VARS = REQUIRED_VARS.filter((v) => !process.env[v]);

if (MISSING_VARS.length) {
  console.error(`✗ Missing required env vars: ${MISSING_VARS.join(', ')}`);
  console.error(`  Usage: ${REQUIRED_VARS.join(', ')} npx ts-node scripts/dev.ts`);
  process.exit(1);
}

const COPILOT_TOKEN = process.env.COPILOT_TOKEN!;
const ISSUE_TITLE = process.env.ISSUE_TITLE!;
const ISSUE_BODY = process.env.ISSUE_BODY!;
const ISSUE_NUMBER = process.env.ISSUE_NUMBER!;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY!;
const GH_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const GITHUB_API_BASE = 'https://api.github.com';
const COPILOT_API_BASE = 'https://models.github.ai/inference';
const GPT_MODEL = 'gpt-4o';
const TEMPERATURE = 0.1;
/* eslint-enable i18next/no-literal-string */

interface IGeneratedFile {
  filePath: string;
  content: string;
}

const client = new OpenAI({
  baseURL: COPILOT_API_BASE,
  apiKey: COPILOT_TOKEN,
});

async function fetchGitHubComments(issueNumber: string, repo: string): Promise<string> {
  try {
    if (!GH_TOKEN) {
      /* eslint-disable-next-line i18next/no-literal-string */
      console.warn('⚠ GH_TOKEN not set, skipping feedback loop from GitHub comments');
      return '';
    }

    /* eslint-disable-next-line i18next/no-literal-string */
    const url = `${GITHUB_API_BASE}/repos/${repo}/issues/${issueNumber}/comments`;
    const response = await fetch(url, {
      headers: {
        /* eslint-disable-next-line i18next/no-literal-string */
        Authorization: `Bearer ${GH_TOKEN}`,
        /* eslint-disable-next-line i18next/no-literal-string */
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      /* eslint-disable-next-line i18next/no-literal-string */
      console.warn(`⚠ GitHub API error: HTTP ${response.status}`);
      return '';
    }

    const comments = (await response.json()) as Array<{ body: string }>;
    const lastErrorComment = comments
      .reverse()
      .find((c) => c.body.includes('❌ **Testes Falharam.**'));

    if (lastErrorComment) {
      /* eslint-disable-next-line i18next/no-literal-string */
      console.log('🚨 Detected previous test failure. AI enters fix mode.');
      /* eslint-disable-next-line i18next/no-literal-string */
      return `\n\nATENÇÃO: A sua implementação anterior falhou nos testes de pipeline. Leia o log de erro abaixo e corrija os arquivos correspondentes:\n${lastErrorComment.body}`;
    }

    return '';
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    /* eslint-disable-next-line i18next/no-literal-string */
    console.warn(`⚠ Failed to fetch GitHub comments: ${err.message}`);
    return '';
  }
}

async function generateCodeViaOpenAI(prompt: string): Promise<IGeneratedFile[]> {
  try {
    /* eslint-disable-next-line i18next/no-literal-string */
    console.log('→ Requesting code generation from GitHub Copilot...');
    const response = await client.chat.completions.create({
      model: GPT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: TEMPERATURE,
    });

    let iaOutput = response.choices[0]?.message?.content || '[]';

    /* eslint-disable-next-line i18next/no-literal-string */
    // Remove markdown code blocks that AI may wrap around JSON
    iaOutput = iaOutput
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    try {
      const files = JSON.parse(iaOutput) as IGeneratedFile[];
      if (!Array.isArray(files)) {
        /* eslint-disable-next-line i18next/no-literal-string */
        throw new Error('Expected array of files');
      }
      return files;
    } catch (parseError) {
      const err = parseError instanceof Error ? parseError : new Error(String(parseError));
      /* eslint-disable-next-line i18next/no-literal-string */
      console.error(`✗ Invalid JSON from AI: ${err.message}`);
      /* eslint-disable-next-line i18next/no-literal-string */
      console.error(`  Response: ${iaOutput.substring(0, 200)}...`);
      /* eslint-disable-next-line i18next/no-literal-string */
      throw new Error('AI response is not valid JSON');
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    /* eslint-disable-next-line i18next/no-literal-string */
    console.error(`✗ OpenAI API failed: ${err.message}`);
    throw error;
  }
}

async function writeFilesToDisk(files: IGeneratedFile[]): Promise<void> {
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
    console.log(`✓ Analyzing issue #${ISSUE_NUMBER} for development...`);

    // Fetch previous test failures from GitHub (optional feedback loop)
    const feedbackErro = await fetchGitHubComments(ISSUE_NUMBER, GITHUB_REPOSITORY);

    // Build prompt for Copilot
    /* eslint-disable-next-line i18next/no-literal-string */
    const prompt = `Você é um Desenvolvedor Sênior especialista em Node.js, NestJS e AWS Serverless.
Sua tarefa é escrever ou corrigir o código para resolver a seguinte issue: "${ISSUE_TITLE}" - "${ISSUE_BODY}".${feedbackErro}

REGRAS ESTRITAS:
1. Respeite a arquitetura do NestJS (Controllers, Services, Modules).
2. Não escreva os arquivos de teste (.spec.ts) agora. Isso será feito por outro agente.
3. Siga todas as regras em https://github.com/rodrigorizandobr/iron-dome/blob/main/.github/copilot-instructions.md

RETORNE APENAS UM JSON VÁLIDO. NENHUM TEXTO FORA DO JSON. O formato DEVE ser um array de objetos contendo o caminho do arquivo e o código:
[
  {
    "filePath": "src/modules/exemplo/exemplo.service.ts",
    "content": "// código completo do arquivo aqui"
  }
]`;

    // Request code from Copilot
    const files = await generateCodeViaOpenAI(prompt);

    if (files.length === 0) {
      /* eslint-disable-next-line i18next/no-literal-string */
      console.warn('⚠ No files generated by AI');
      process.exit(0);
    }

    /* eslint-disable-next-line i18next/no-literal-string */
    console.log(`→ Writing ${files.length} generated files...`);
    await writeFilesToDisk(files);

    /* eslint-disable-next-line i18next/no-literal-string */
    console.log('✓ Code generation complete. Files written to disk.');
    process.exit(0);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    /* eslint-disable-next-line i18next/no-literal-string */
    console.error(`✗ Code generation failed: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();
