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
  const hasAcceptanceCriteria = /\([x ]\)|[\-\*]\s*\[|\-\s*criterion|criteria de aceite/i.test(body);
  const hasTechnicalDetails = /technical|arquitetura|module|módulo|src\/|service|database|dynamo|lambda|rest|api|endpoint/i.test(body);

  const resumo = title.substring(0, 150) || 'Issue sem título';
  const criterios = !hasAcceptanceCriteria
    ? '- [ ] Validar escopo com Product\n- [ ] Definir dependências externas\n- [ ] Identificar impacto em outros módulos'
    : 'Critérios mencionados na descrição';

  const abordagem = !hasTechnicalDetails
    ? '- **Módulo**: `src/modules/[x]` (a definir com PM)\n- **Arquivos**: Analisar durante fase dev\n- **Padrões**: BaseResourceService, JWT, i18n, AuditTrail, SNS/SQS'
    : 'Abordagem técnica sugerida na descrição';

  return `## 🔍 Refinement Complete

**Resumo**: ${resumo}

**Critérios de Aceite**:
${criterios}

**Abordagem Técnica**:
${abordagem}

**Próximos Passos**:
- ✅ Refinement concluído
- 👉 Mover para Dev quando pronto

**Perguntas em Aberto**:
- Qual é o deadline?
- Necessário review design antes de implementação?
- Há dependências com outras tasks?`;
}

// Run
runRefinement().catch((e) => {
  console.error('❌ Refinement Agent Error:', e);
  process.exit(1);
});
