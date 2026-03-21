# 🤖 Board Agents — Como Usar

## Fluxo Automático de IA por Etapas

O sistema **Board Agents** automatiza todo o ciclo de desenvolvimento:

```
[Refinement] → [Dev] → [Dev-Test] → [Testing] → [PR] → [Done]
```

Cada etapa é executada por um **agent especializado** em sua tarefa.

---

## 🚀 Como Iniciar Um Projeto

### **Opção 1: Começar com uma Issue (Recomendado)**

1. **Crie uma issue** no GitHub com o título e descrição da funcionalidade
   - Exemplo: "Implementar autenticação JWT para user endpoints"

2. **Adicione a label** `refinament` à issue
   - GitHub Actions dispara automaticamente
   - Agent **Refinement** analisa e refina a issue
   - Ao terminar, remove `refinament` e adiciona `dev`

3. **Workflow continua automaticamente**:
   - ✅ `dev` → Agent Dev gera código
   - ✅ `dev-test` → Agent Test gera testes
   - ✅ `testing` → Testes são executados
   - ✅ `pr` → PR é criado automaticamente
   - ✅ `done` → Issue movida para Done no board

### **Opção 2: Via GitHub Projects Card**

1. Crie um card no GitHub Projects
2. **Clique no card** → Abre a issue correspondente
3. Na issue, **adicione a label** `refinament`
4. O workflow é acionado automaticamente

---

## 📋 Labels Available

| Label | Etapa | Descri <PRESIDIO_ANONYMIZED_EMAIL_ADDRESS>ção | Agente |
| --- | --- | --- | --- |
| `refinament` | 1️⃣ | Análise e refinamento da issue | Agent Refinement |
| `dev` | 2️⃣ | Desenvolvimento do código | Agent Dev |
| `dev-test` | 3️⃣ | Desenvolvimento dos testes | Agent Test |
| `testing` | 4️⃣ | Execução dos testes e feedback | Test Runner |
| `pr` | 5️⃣ | Criação do PR e CI | CI Agent |
| `done` | ✅ | Issue resolvida | - |

---

## 🔄 Fluxo Detalhado

### **Etapa 1: Refinement** (`refinament`)

```
👤 Você cria issue
    ↓
🤖 Agent Refinement:
   - Lê o título e descrição
   - Refina o escopo
   - Define acceptance criteria
   - Comenta na issue com sugestões
    ↓
✅ Remove label "refinament"
✅ Adiciona label "dev"
```

### **Etapa 2: Dev** (`dev`)

```
🤖 Agent Dev:
   - Cria branch `feat/issue-{number}`
   - Implementa o código
   - Segue padrões da Iron Dome
   - Commit automático
    ↓
✅ Remove label "dev"
✅ Adiciona label "dev-test"
```

### **Etapa 3: Dev-Test** (`dev-test`)

```
🤖 Agent Test:
   - Cria testes unitários
   - Mocks DynamoDB, services, etc.
   - Target: 80%+ coverage
   - Commit automático
    ↓
✅ Remove label "dev-test"
✅ Adiciona label "testing"
```

### **Etapa 4: Testing** (`testing`)

```
🤖 Test Runner:
   - Executa: npm run test:unit -- --coverage
   - Checa coverage
   - Se PASS: Move para "pr"
   - Se FAIL: Volta para "dev" com logs de erro
```

### **Etapa 5: PR** (`pr`)

```
🤖 CI Agent:
   - Executa: npm run lint, build, test:integrated
   - Se PASS: Cria PR automático
   - Comenta no issue
   - Move para "done"
   - Se FAIL: Volta para "dev"
```

### **Etapa 6: Done** (`done`)

```
🎉 Issue resolvida
   - PR criado e disponível para merge
   - Testes passando
   - Coverage > 80%
```

---

## ⚡ Exemplos

### **Exemplo 1: Criar nova feature**

```bash
# 1. Crie a issue manualmente
# Título: "Implement order cancellation endpoint"
# Descrição: "Add POST /orders/{id}/cancel endpoint..."

# 2. No GitHub, adicione label "refinament"

# 3. Observe a mágica acontecer:
# - Agent Refinement comenta com detalhes técnicos ✅
# - Agent Dev implementa o endpoint ✅
# - Agent Test escreve testes ✅
# - Testes rodam e passam ✅
# - PR é criado automaticamente ✅
```

---

## 🛠️ Troubleshooting

### **"This job was skipped"**

**Causa**: Label não foi adicionada à issue, ou o script não existe

**Solução**:
1. Verifique se a **label foi realmente adicionada**
2. Verifique se o **script existe**: `scripts/agents/{stage}.ts`
3. Rode manualmente: `npx ts-node scripts/agents/refinament.ts`

### **Testes falhando**

**Esperado**: Workflow move a issue volta para `dev` com logs de erro

**A IA vai tentar arrumar e voltar automaticamente**

### **PR já existe**

**Descrição**: Mensagem durante etapa "pr"

**Não é erro**: Workflow detectou que o PR já foi criado (merge anterior meio)

---

## 🔐 Permissões Necessárias

O GitHub Actions precisa de:
- `contents: write` — Fazer commits e push
- `issues: write` — Adicionar/remover labels e comentar
- `pull-requests: write` — Criar PRs

Já configuradas em `.github/workflows/board-agents.yml`

---

## 📚 Próximos Passos

1. **Crie uma issue** com escopo claro
2. **Adicione label** `refinament`
3. **Observe o workflow** em Actions → Board Agents
4. **Acompanhe os comentários** na issue

---

**🎯 Objetivo**: Zero-touch deployment do conceito até o merge!
