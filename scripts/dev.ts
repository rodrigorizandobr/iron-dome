import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';

const client = new OpenAI({
  baseURL: 'https://models.github.ai/inference',
  apiKey: process.env.COPILOT_TOKEN,
});

async function run() {
  const issueTitle = process.env.ISSUE_TITLE || '';
  const issueBody = process.env.ISSUE_BODY || '';
  const issueNumber = process.env.ISSUE_NUMBER;
  const repo = process.env.GITHUB_REPOSITORY;
  const ghToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

  console.log(`Analisando a issue #${issueNumber} para desenvolvimento...`);

  // 1. Procura por erros de testes (Feedback Loop)
  let feedbackErro = '';
  try {
    const commentsResponse = await fetch(
      `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`,
      {
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );

    if (commentsResponse.ok) {
      const comments = await commentsResponse.json();
      // Busca o último comentário que indica falha nos testes do pipeline
      const lastErrorComment = comments
        .reverse()
        .find((c: any) => c.body.includes('❌ **Testes Falharam.**'));

      if (lastErrorComment) {
        console.log(
          '🚨 Detectado um erro de testes anterior. A IA vai entrar em modo de correção.',
        );
        feedbackErro = `\n\nATENÇÃO: A sua implementação anterior falhou nos testes de pipeline. Leia o log de erro abaixo e corrija os arquivos correspondentes:\n${lastErrorComment.body}`;
      }
    }
  } catch (err) {
    console.log('Sem histórico de falhas ou erro ao ler a API do GitHub.');
  }

  // 2. Monta o Prompt para gerar os arquivos TypeScript
  const prompt = `Você é um Desenvolvedor Sênior especialista em Node.js, NestJS e AWS Serverless.
Sua tarefa é escrever ou corrigir o código para resolver a seguinte issue: "${issueTitle}" - "${issueBody}".${feedbackErro}

REGRAS ESTritas:
1. Respeite a arquitetura do NestJS (Controllers, Services, Modules).
2. Não escreva os arquivos de teste (.spec.ts) agora. Isso será feito por outro agente.

RETORNE APENAS UM JSON VÁLIDO. NENHUM TEXTO FORA DO JSON. O formato DEVE ser um array de objetos contendo o caminho do arquivo e o código:
[
  {
    "filePath": "src/modules/exemplo/exemplo.service.ts",
    "content": "// código completo do arquivo aqui"
  }
]`;

  console.log('Solicitando código ao Copilot...');
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1, // Temperatura bem baixa para garantir sintaxe de código estável e JSON válido
  });

  let iaOutput = response.choices[0]?.message?.content || '[]';

  // Remove blocos de markdown que a IA costuma colocar em volta do JSON
  iaOutput = iaOutput
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  try {
    const files = JSON.parse(iaOutput);
    for (const file of files) {
      const fullPath = path.resolve(process.cwd(), file.filePath);

      // Cria a estrutura de pastas automaticamente caso a IA tenha inventado um módulo novo
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });

      // Salva o arquivo no repositório
      fs.writeFileSync(fullPath, file.content, 'utf-8');
      console.log(`✅ Arquivo criado/modificado: ${file.filePath}`);
    }
  } catch (error) {
    console.error('Erro fatal: A resposta da IA não é um JSON válido e não pôde ser parseada.');
    console.error('Saída da IA:', iaOutput);
    process.exit(1);
  }
}

run();
