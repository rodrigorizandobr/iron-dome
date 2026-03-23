#!/usr/bin/env ts-node
/**
 * Agent Refinement — Analiza e refina issues
 * Lê a issue, analisa com IA, comenta com refinamento estruturado
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const issueNumber = process.env.ISSUE_NUMBER || '0';
const ghToken = process.env.GH_TOKEN || '';
const copilotToken = process.env.COPILOT_TOKEN || '';
const agentInstructions = process.env.AGENT_INSTRUCTIONS || '';

/**
 * Fetch issue details from GitHub API
 */
async function getIssueDetails(issueNum: string) {
  try {
    const { stdout } = await execAsync(
      `gh issue view ${issueNum} --json title,body --jq '.title + "\\n---\\n" + .body'`,
      { env: { ...process.env, GH_TOKEN: ghToken } }
    );
    const [title, ...bodyLines] = stdout.trim().split('\n---\n');
    return { title, body: bodyLines.join('\n---\n') };
  } catch (e) {
    console.error('❌ Failed to fetch issue:', e);
    return { title: 'Unknown', body: '' };
  }
}

/**
 * Post refinement comment on issue
 */
async function postRefinementComment(issueNum: string, refinement: string) {
  try {
    const { stdout } = await execAsync(
      `gh issue comment ${issueNum} --body "${refinement.replace(/"/g, '\\"')}"`,
      { env: { ...process.env, GH_TOKEN: ghToken }, maxBuffer: 10 * 1024 * 1024 }
    );
    console.log('✅ Comment posted');
    return true;
  } catch (e) {
    console.error('⚠️ Failed to post comment:', e);
    return false;
  }
}

/**
 * Main refinement flow
 */
async function runRefinement() {
  console.log(`🔍 Refinement Agent Started for Issue #${issueNumber}`);

  // 1. Fetch issue
  const issue = await getIssueDetails(issueNumber);
  console.log(`📋 Title: ${issue.title}`);
  console.log(`📄 Body length: ${issue.body.length} chars`);

  // 2. For now, generate a template-based refinement
  // In production, you'd call Claude here with agentInstructions
  const refinement = generateRefinementComment(issue.title, issue.body);

  console.log('\n📝 Generated Refinement:');
  console.log(refinement);

  // 3. Post comment
  await postRefinementComment(issueNumber, refinement);

  console.log('✅ Refinement Agent Completed');
}

/**
 * Generate structured refinement comment
 */
function generateRefinementComment(title: string, body: string): string {
  // Extract basic info from issue
  const hasAcceptanceCriteria = body.toLowerCase().includes('([x ]|[ ][x ])');
  const hasTechnicalDetails = body.toLowerCase().includes('technical|arquitetura|module|módulo');

  const resumo = title.substring(0, 100);
  const criiteriosPlaceholder = !hasAcceptanceCriteria
    ? '- [ ] Definir escopo claro\n- [ ] Identificar dependências\n- [ ] Validar com PM'
    : 'Já definidos na issue';

  const abordagem = !hasTechnicalDetails
    ? '- Módulo: `src/modules/[x]` (a definir)\n- Arquivos: (a definir)\n- Padrões: BaseResourceService, JWT, i18n, AuditTrail'
    : 'Já mencionada na issue';

  return `## 🔍 Refinement Complete

**Resumo**: ${resumo}

**Critérios de Aceite**:
${criiteriosPlaceholder}

**Abordagem Técnica**:
${abordagem}

**Perguntas em Aberto**:
- Qual é o prazo esperado?
- Há dependências com outras issues?
- Necessário design review antes de iniciar?

> ✅ Pronto para dev. Arraste para coluna Dev quando pronto.`;
}

// Run
runRefinement().catch(console.error);
