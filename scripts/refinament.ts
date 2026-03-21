import { OpenAI } from 'openai';

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

  console.log(`Iniciando refinamento da issue #${issueNumber}...`);

  const prompt = `Você é um Arquiteto de Software e Tech Lead sênior especialista em Node.js, NestJS e AWS (DynamoDB, SQS, SNS, S3) em arquitetura 100% Serverless.
Sua tarefa é refinar a seguinte issue de trabalho:
Título: "${issueTitle}"
Descrição: "${issueBody}"

Retorne SUA ANÁLISE EM MARKDOWN contendo obrigatoriamente:
1. **Resumo do Entendimento**: O que precisa ser feito de forma clara.
2. **Proposta de Arquitetura**: Como os serviços da AWS e os módulos/services do NestJS devem interagir para resolver isso.
3. **Critérios de Aceite**: Uma checklist técnica do que deve estar pronto para a task ser considerada "Done".
4. **Pontos de Atenção**: Possíveis gargalos (ex: limites de leitura do DynamoDB, concorrência no SQS, idempotência, etc).`;

  console.log('Consultando a IA do Copilot via GitHub Models...');

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5, // Temperatura média para balancear criatividade arquitetural com precisão técnica
  });

  const iaResponse = response.choices[0]?.message?.content;

  if (!iaResponse) {
    console.error('A IA não retornou uma resposta válida.');
    process.exit(1);
  }

  console.log('Refinamento gerado! Postando como comentário na Issue...');

  // Faz a requisição para a API do GitHub para comentar na Issue
  const commentPayload = {
    body: `🤖 **Refinamento Técnico (Iron Dome Tech Lead)**\n\n${iaResponse}`
  };

  const ghResponse = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ghToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commentPayload)
  });

  if (!ghResponse.ok) {
    const errorBody = await ghResponse.text();
    console.error(`Falha ao comentar na issue: ${ghResponse.status} - ${errorBody}`);
    process.exit(1);
  }

  console.log('✅ Comentário de refinamento postado com sucesso!');
}

run();