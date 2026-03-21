/**
 * Script: refinament
 * Purpose: GitHub Copilot refinement assistant — Generate technical refinement for GitHub issues
 * Usage: npx ts-node scripts/refinament.ts
 * Required ENV: COPILOT_TOKEN, ISSUE_TITLE, ISSUE_BODY, ISSUE_NUMBER, GITHUB_REPOSITORY
 * Optional ENV: GH_TOKEN (defaults to GITHUB_TOKEN)
 * Exit codes: 0 = success, 1 = error (missing env, API error, invalid response)
 * Example: COPILOT_TOKEN=token ISSUE_TITLE="..." ISSUE_BODY="..." ISSUE_NUMBER=123 GITHUB_REPOSITORY=owner/repo npx ts-node scripts/refinament.ts
 */
import { OpenAI } from 'openai';

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
  console.error(`  Usage: ${REQUIRED_VARS.join(', ')} npx ts-node scripts/refinament.ts`);
  process.exit(1);
}

const COPILOT_TOKEN = process.env.COPILOT_TOKEN!;
const ISSUE_TITLE = process.env.ISSUE_TITLE!;
const ISSUE_BODY = process.env.ISSUE_BODY!;
const ISSUE_NUMBER = process.env.ISSUE_NUMBER!;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY!;
const GH_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const COPILOT_API_BASE = 'https://models.github.ai/inference';
const GITHUB_API_BASE = 'https://api.github.com';
const GPT_MODEL = 'gpt-4o';
const TEMPERATURE_REFINEMENT = 0.5;
/* eslint-enable i18next/no-literal-string */

const client = new OpenAI({
  baseURL: COPILOT_API_BASE,
  apiKey: COPILOT_TOKEN,
});

async function generateRefinement(issueTitle: string, issueBody: string): Promise<string> {
  try {
    /* eslint-disable-next-line i18next/no-literal-string */
    console.log('→ Generating technical refinement from GitHub Copilot...');

    const prompt = `Você é um Arquiteto de Software e Tech Lead sênior especialista em Node.js, NestJS e AWS (DynamoDB, SQS, SNS, S3) em arquitetura 100% Serverless.
Sua tarefa é refinar a seguinte issue de trabalho:
Título: "${issueTitle}"
Descrição: "${issueBody}"

Retorne SUA ANÁLISE EM MARKDOWN contendo obrigatoriamente:
1. **Resumo do Entendimento**: O que precisa ser feito de forma clara.
2. **Proposta de Arquitetura**: Como os serviços da AWS e os módulos/services do NestJS devem interagir para resolver isso.
3. **Critérios de Aceite**: Uma checklist técnica do que deve estar pronto para a task ser considerada "Done".
4. **Pontos de Atenção**: Possíveis gargalos (ex: limites de leitura do DynamoDB, concorrência no SQS, idempotência, etc).`;

    const response = await client.chat.completions.create({
      model: GPT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: TEMPERATURE_REFINEMENT,
    });

    const iaResponse = response.choices[0]?.message?.content;
    if (!iaResponse) {
      throw new Error('AI returned empty response');
    }

    return iaResponse;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    /* eslint-disable-next-line i18next/no-literal-string */
    console.error(`✗ OpenAI API failed: ${err.message}`);
    throw error;
  }
}

async function postCommentToGitHub(
  refinementContent: string,
  issueNumber: string,
  repo: string,
  token?: string,
): Promise<void> {
  try {
    if (!token) {
      /* eslint-disable-next-line i18next/no-literal-string */
      console.warn('⚠ GH_TOKEN not set, skipping GitHub comment');
      return;
    }

    /* eslint-disable-next-line i18next/no-literal-string */
    console.log('→ Posting refinement comment to GitHub issue...');

    const commentPayload = {
      /* eslint-disable-next-line i18next/no-literal-string */
      body: `🤖 **Refinamento Técnico (Iron Dome Tech Lead)**\n\n${refinementContent}`,
    };

    /* eslint-disable-next-line i18next/no-literal-string */
    const url = `${GITHUB_API_BASE}/repos/${repo}/issues/${issueNumber}/comments`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        /* eslint-disable-next-line i18next/no-literal-string */
        Authorization: `Bearer ${token}`,
        /* eslint-disable-next-line i18next/no-literal-string */
        Accept: 'application/vnd.github.v3+json',
        /* eslint-disable-next-line i18next/no-literal-string */
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commentPayload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      /* eslint-disable-next-line i18next/no-literal-string */
      throw new Error(`HTTP ${response.status}: ${errorBody}`);
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    /* eslint-disable-next-line i18next/no-literal-string */
    console.error(`✗ Failed to post comment to GitHub: ${err.message}`);
    throw error;
  }
}

async function main(): Promise<void> {
  try {
    /* eslint-disable-next-line i18next/no-literal-string */
    console.log(`✓ Starting refinement for issue #${ISSUE_NUMBER}...`);

    // Generate refinement from Copilot
    const refinementContent = await generateRefinement(ISSUE_TITLE, ISSUE_BODY);

    // Post to GitHub (optional, if token is available)
    await postCommentToGitHub(refinementContent, ISSUE_NUMBER, GITHUB_REPOSITORY, GH_TOKEN);

    /* eslint-disable-next-line i18next/no-literal-string */
    console.log('✓ Refinement generation complete.');
    process.exit(0);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    /* eslint-disable-next-line i18next/no-literal-string */
    console.error(`✗ Refinement failed: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();
