import { execSync } from 'child_process';

// O nome da coluna destino passado pelo YML (ex: "Dev", "Testing", "PR")
const targetColumn = process.argv[2];
const issueNumber = process.env.ISSUE_NUMBER;
const repoInfo = process.env.GITHUB_REPOSITORY; // formato: owner/repo
const projectNumber = process.env.PROJECT_NUMBER;

if (!targetColumn || !issueNumber || !repoInfo || !projectNumber) {
  console.error('Uso: npx ts-node move-card.ts <NomeDaColuna>');
  process.exit(1);
}

const owner = repoInfo.split('/')[0];

try {
  console.log(`Consultando a API do GitHub para mover para '${targetColumn}'...`);

  // 1. Descobre o ID do Projeto
  const projJson = execSync(`gh project view ${projectNumber} --owner ${owner} --format json`, {
    encoding: 'utf8',
  });
  const projectId = JSON.parse(projJson).id;

  // 2. Descobre os IDs do Campo "Status" e da Opção (Coluna) desejada
  const fieldsJson = execSync(
    `gh project field-list ${projectNumber} --owner ${owner} --format json`,
    { encoding: 'utf8' },
  );
  const fields = JSON.parse(fieldsJson).fields;

  const statusField = fields.find((f: any) => f.name === 'Status');
  const option = statusField.options.find(
    (o: any) => o.name.toLowerCase() === targetColumn.toLowerCase(),
  );

  if (!option) {
    throw new Error(`A coluna '${targetColumn}' não existe no seu board.`);
  }

  // 3. Descobre o ID do card vinculado a esta Issue
  const issueJson = execSync(`gh issue view ${issueNumber} --json projectItems`, {
    encoding: 'utf8',
  });
  const projectItems = JSON.parse(issueJson).projectItems;

  let itemId = projectItems.length > 0 ? projectItems[0].id : null;

  // Se a issue for nova e não estiver no board, o script adiciona ela automaticamente
  if (!itemId) {
    console.log('Issue não está no board. Adicionando primeiro...');
    const addJson = execSync(
      `gh project item-add ${projectNumber} --owner ${owner} --url https://github.com/${repoInfo}/issues/${issueNumber} --format json`,
      { encoding: 'utf8' },
    );
    itemId = JSON.parse(addJson).id;
  }

  // 4. Executa a movimentação com os IDs exatos
  execSync(
    `gh project item-edit --id ${itemId} --project-id ${projectId} --field-id ${statusField.id} --single-select-option-id ${option.id}`,
  );

  // 5. Atualiza a label no repositório para manter o padrão visual
  execSync(`gh issue edit ${issueNumber} --add-label "${targetColumn.toLowerCase()}"`);

  console.log(`✅ Issue #${issueNumber} movida com sucesso para '${option.name}'!`);
} catch (error: any) {
  console.error('Erro ao mover o card:', error.message || error);
  process.exit(1);
}
