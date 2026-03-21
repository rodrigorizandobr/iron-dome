import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const client = new OpenAI({
  baseURL: 'https://models.github.ai/inference',
  apiKey: process.env.COPILOT_TOKEN,
});

async function run() {
  const issueTitle = process.env.ISSUE_TITLE || '';
  const issueBody = process.env.ISSUE_BODY || '';

  console.log('Analisando o código gerado pelo agente de desenvolvimento...');

  // 1. Descobre quais arquivos foram criados/modificados na branch atual
  let moddedFilesOutput = '';
  try {
    // Pega a lista de arquivos alterados comparado com a main
    moddedFilesOutput = execSync('git diff --name-only main...HEAD', { encoding: 'utf-8' });
  } catch (e) {
    console.log('Erro ao buscar diff. Tentando pegar do último commit...');
    moddedFilesOutput = execSync('git show --name-only --format="" HEAD', { encoding: 'utf-8' });
  }

  const files = moddedFilesOutput.split('\n').filter(f => f.trim() !== '' && f.endsWith('.ts') && !f.endsWith('.spec.ts'));

  if (files.length === 0) {
    console.log('Nenhum arquivo TypeScript de código fonte encontrado para testar. Encerrando agente de testes.');
    process.exit(0);
  }

  // 2. Lê o conteúdo desses arquivos para passar como contexto para a IA
  let sourceCodeContext = '';
  for (const file of files) {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      sourceCodeContext += `\n\n--- Arquivo: ${file} ---\n\`\`\`typescript\n${content}\n\`\`\``;
    }
  }

  // 3. Monta o prompt focado em QA, NestJS e AWS Serverless
  const prompt = `Você é um Engenheiro de Software QA / SDET especialista em Node.js, NestJS e AWS.
Sua tarefa é escrever os testes unitários usando Jest para os arquivos desenvolvidos para a issue: "${issueTitle}" - "${issueBody}".

Aqui está o código-fonte desenvolvido:
${sourceCodeContext}

REGRAS:
- Foque em atingir 100% de cobertura (branches, statements, functions).
- Use os padrões do NestJS (@nestjs/testing) para isolar módulos e injetar dependências.
- Moke (Mock) TODAS as chamadas externas, especialmente chamadas para AWS (DynamoDB, SQS, SNS, S3).

RETORNE APENAS UM JSON VÁLIDO. O formato DEVE ser um array de objetos:
[
  {
    "filePath": "src/modules/exemplo/exemplo.service.spec.ts",
    "content": "// código completo do teste aqui"
  }
]`;

  console.log('Solicitando os testes unitários ao Copilot...');
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2, // Temperatura baixa para focar na lógica do teste
  });

  let iaOutput = response.choices[0]?.message?.content || '[]';
  iaOutput = iaOutput.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    const testFiles = JSON.parse(iaOutput);
    for (const file of testFiles) {
      const fullPath = path.resolve(process.cwd(), file.filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, file.content, 'utf-8');
      console.log(`✅ Arquivo de teste gerado: ${file.filePath}`);
    }
  } catch (error) {
    console.error('Erro ao fazer o parse da resposta da IA. A resposta não era um JSON válido:', iaOutput);
    process.exit(1);
  }
}

run();