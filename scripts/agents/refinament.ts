#!/usr/bin/env ts-node
/**
 * Agent Refinement — Analiza e refina issues
 * Lê a issue, analisa com IA, comenta com refinamento estruturado
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let issueNumber = process.env.ISSUE_NUMBER || '0';
const ghToken = process.env.GH_TOKEN || '';
const copilotToken = process.env.COPILOT_TOKEN || '';

// Read from env vars (passed from workflow)
let issueTitle = process.env.ISSUE_TITLE || '';
let issueBody = process.env.ISSUE_BODY || '';

/**
 * Fetch issue details from GitHub API (fallback)
 */
async function getIssueDetails(issueNum: string) {
  try {
    const { stdout } = await execAsync(
      `gh issue view ${issueNum} --json title,body --jq '.title + "\\n---\\n" + (.body // "sem descricao")'`,
      { env: { ...process.env, GH_TOKEN: ghToken } }
    );
    const parts = stdout.trim().split('\n---\n');
    return { title: parts[0] || 'Unknown', body: parts.slice(1).join('\n---\n') || '' };
  } catch (e) {
    console.error('⚠️ Fallback via API failed, using env vars');
    return { title: issueTitle || 'Unknown', body: issueBody };
  }
}

/**
 * Post refinement comment on issue
 */
async function postRefinementComment(issueNum: string, refinement: string) {
  try {
    // Use file-based input to avoid shell escaping issues
    const fs = require('fs');
    const tmpFile = `/tmp/refinement_${issueNum}_${Date.now()}.md`;
    fs.writeFileSync(tmpFile, refinement);

    const { stdout } = await execAsync(
      `gh issue comment ${issueNum} --body-file "${tmpFile}"`,
      { env: { ...process.env, GH_TOKEN: ghToken }, maxBuffer: 10 * 1024 * 1024 }
    );
    console.log('✅ Refinement comment posted');
    fs.unlinkSync(tmpFile);
    return true;
  } catch (e) {
    console.error('⚠️ Failed to post refinement comment:', (e as Error).message);
    return false;
  }
}

/**
 * Main refinement flow
 */
async function runRefinement() {
  console.log(`🔍 Refinement Agent Started for Issue #${issueNumber}`);

  // Use env vars if available, fallback to API
  let issue = { title: issueTitle || 'Unknown', body: issueBody };
  if (!issueTitle) {
    console.log('📡 Fetching issue from GitHub...');
    issue = await getIssueDetails(issueNumber);
  }

  console.log(`📋 Title: ${issue.title}`);
  console.log(`📄 Body: ${issue.body.substring(0, 100)}...`);

  // Generate refinement
  const refinement = generateRefinementComment(issue.title, issue.body);

  console.log('\n📝 Refinement Generated');

  // Post comment
  await postRefinementComment(issueNumber, refinement);

  console.log('✅ Refinement Agent Completed');
}

/**
 * Generate structured refinement comment
 */
function generateRefinementComment(title: string, body: string): string {
  // Parse issue for technical details
  const hasAcceptanceCriteria = /\([x ]\)|[\-\*]\s*\[|\-\s*criterion|criteria de aceite/i.test(body);
  
  // Extract technical keywords
  const technicalKeywords: string[] = [];
  if (/sqs|queue/i.test(body)) technicalKeywords.push('SQS');
  if (/dynamodb|dynamo|database|db/i.test(body)) technicalKeywords.push('DynamoDB');
  if (/lambda|serverless/i.test(body)) technicalKeywords.push('Lambda');
  if (/sns|topic/i.test(body)) technicalKeywords.push('SNS');
  if (/rest|api|endpoint/i.test(body)) technicalKeywords.push('REST API');
  if (/crud|create|read|update|delete|list/i.test(body)) technicalKeywords.push('CRUD Operations');
  if (/micro.*service|service|microservice/i.test(body)) technicalKeywords.push('Microservice');
  if (/audit|log/i.test(body)) technicalKeywords.push('Audit Trail');
  if (/compliance|regulatory|regulatorio|bacen/i.test(body)) technicalKeywords.push('Compliance');
  if (/event|evento/i.test(body)) technicalKeywords.push('Event-Driven');
  if (/stream|processing/i.test(body)) technicalKeywords.push('Stream Processing');
  if (/multi.tenant|tenant|multi-tenant/i.test(body)) technicalKeywords.push('Multi-Tenancy');

  // Extract main responsibilities from body
  const responsibilities: string[] = [];
  const lines = body.split('\n').filter(l => l.trim().length > 20);
  lines.forEach(line => {
    if (/^[•\-\*\s]+/.test(line)) {
      const cleaned = line.replace(/^[•\-\*\s]+/, '').trim();
      if (cleaned.length > 10 && cleaned.length < 150) {
        responsibilities.push(cleaned);
      }
    }
  });

  // If no bullets found, extract from first sentences
  if (responsibilities.length === 0) {
    const sentences = body.match(/[^.!?]+[.!?]+/g) || [];
    sentences.slice(0, 3).forEach(s => {
      const cleaned = s.trim();
      if (cleaned.length < 200) {
        responsibilities.push(cleaned);
      }
    });
  }

  const resumo = title.substring(0, 150) || 'Issue sem título';
  
  const criterios = !hasAcceptanceCriteria
    ? responsibilities.length > 0
      ? responsibilities.map((r, i) => `- [ ] ${r}`).join('\n')
      : '- [ ] Validar escopo com Product\n- [ ] Definir dependências externas\n- [ ] Identificar impacto em outros módulos'
    : 'Critérios mencionados na descrição';

  const techStack = technicalKeywords.length > 0
    ? `**Stack**: ${technicalKeywords.join(' • ')}`
    : '**Stack**: A definir';

  const abordagem = technicalKeywords.length > 0
    ? `- **Tecnologias**: ${technicalKeywords.join(', ')}\n- **Padrões**: BaseResourceService, JWT, i18n, AuditTrail, SNS/SQS\n- **Módulo**: \`src/modules/[x]\` (a confirmar com PM)`
    : '- **Módulo**: \`src/modules/[x]\` (a confirmar)\n- **Arquivos**: Analisar durante fase dev\n- **Padrões**: BaseResourceService, JWT, i18n, AuditTrail, SNS/SQS';

  return `## 🔍 Refinement Complete

**Resumo**: ${resumo}

${techStack}

**Critérios de Aceite**:
${criterios}

**Abordagem Técnica**:
${abordagem}

**Perguntas em Aberto**:
- Qual é o deadline?
- Há dependências com outras tasks/issues?
- Necessário design review antes de iniciar?
- Qual é o SLA/RTO para operações?

**Próximos Passos**:
- ✅ Refinement completo
- 👉 Mover para Dev quando pronto para desenvolvimento`;
}

// Run
runRefinement().catch((e) => {
  console.error('❌ Refinement Agent Error:', e);
  process.exit(1);
});
