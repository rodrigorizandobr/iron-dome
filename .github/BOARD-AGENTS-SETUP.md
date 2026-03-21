# 🤖 Board Agents — SEM LABELS! (Totalmente Automático)

## Fluxo Automático de IA por Etapas

O sistema **Board Agents** automatiza todo o ciclo de desenvolvimento:

```
[Refinement] → [Dev] → [Dev-Test] → [Testing] → [PR] → [Done]
```

Cada etapa é executada por um **agent especializado** em sua tarefa.

---

## 🚀 Como Iniciar Um Projeto (SEM LABELS)

### **Opção 1: Criar uma Issue (Recomendado)**

1. **Crie uma issue** no GitHub com o título e descrição
   - Exemplo: "Implementar autenticação JWT para user endpoints"

2. **Ou no GitHub Projects**: Crie um card que cria uma issue automaticamente

3. **O workflow dispara AUTOMATICAMENTE**:
   - ✅ Agent **Refinement** analisa e refina a issue
   - ✅ Agent **Dev** gera código
   - ✅ Agent **Test** gera testes
   - ✅ **Testes** são executados
   - ✅ **PR** é criado automaticamente
   - ✅ Issue movida para **Done**

**Nenhum label necessário!** O workflow detecta automaticamente.

### **Opção 2: Disparo Manual (Workflow Dispatch)**

Se você quiser rodar um stage específico manualmente:

1. Vá para **GitHub Actions** → **Autonomous Board Agents**
2. Clique **"Run workflow"**
3. Selecione:
   - **Stage**: `refinament`, `dev`, `dev-test`, `testing`, ou `pr`
   - **Issue number**: O número da issue
4. Clique **"Run workflow"**

---

## 📋 Labels (Agora Automáticos - Optional)

| Label | Etapa | Descrição | Auto-adicionado? |
| --- | --- | --- | --- |
| `refinament` | 1️⃣ | Análise e refinamento da issue | ✅ Sim (ao criar issue) |
| `dev` | 2️⃣ | Desenvolvimento do código | ✅ Sim (após refinement) |
| `dev-test` | 3️⃣ | Desenvolvimento dos testes | ✅ Sim (após dev) |
| `testing` | 4️⃣ | Execução dos testes e feedback | ✅ Sim (após dev-test) |
| `pr` | 5️⃣ | Criação do PR e CI | ✅ Sim (se testes passem) |
| `done` | ✅ | Issue resolvida | ✅ Sim (ao criar PR) |

---

## 🔄 Como Funciona (Fluxo Automático)

### **Etapa 1: Você cria uma Issue**

```
👤 Cria issue no GitHub
        ↓
🤖 Workflow detecta `issues.opened`
   - Inicia o agente Refinement automaticamente
   - Adiciona label "refinament" (auto)
```

### **Etapa 2: Agent Refinement executa**

```
🤖 Agent Refinement:
   - Lê título e descrição
   - Refina escopo e acceptance criteria
   - Comenta na issue com sugestões
        ↓
✅ Remove "refinament"
✅ Adiciona "dev" (auto)
```

### **Etapa 3: Agent Dev executa**

```
🤖 Agent Dev:
   - Cria branch `feat/issue-{number}`
   - Implementa código
   - Segue padrões Iron Dome
   - Commit automático
        ↓
✅ Adiciona "dev-test"
```

### **Etapa 4: Agent Test executa**

```
🤖 Agent Test:
   - Cria testes unitários
   - Target: 80%+ coverage
   - Commit automático
        ↓
✅ Adiciona "testing"
```

### **Etapa 5: Test Runner executa**

```
🤖 Test Runner:
   - Executa: npm run test:unit -- --coverage
   
   SE PASS ✅ → Adiciona "pr"
   SE FAIL ❌ → Volta para "dev"
```

### **Etapa 6: CI Agent executa**

```
🤖 CI Agent:
   - Executa: npm run lint, build, test:integrated
   
   SE PASS ✅ → Cria PR automático
              → Adiciona "done"
   SE FAIL ❌ → Volta para "dev"
```

### **Etapa 7: Done**

```
🎉 Issue resolvida completamente
   - PR criado e mergeável
   - Testes passando
   - Coverage > 80%
```

---

## ⚡ Exemplo Prático

### **Teste Agora (2 minutos)**

```bash
# 1. Crie uma issue no GitHub (UI)
# Título: "Add CORS configuration endpoint"
# Descrição: "Need POST /config/cors endpoint for dynamic CORS settings"

# 2. Não adicione nenhum label (automático!)

# 3. Observe em: GitHub Actions → Autonomous Board Agents
# Veja os agents trabalhando em tempo real

# 4. Acompanhe progresso na issue via comentários automáticos
```

### **Result Esperado**

```
Issue Created
    ↓
[Refinement Agent] Analisa o escopo
    ↓ (auto-label: dev)
[Dev Agent] Gera POST /config/cors endpoint
    ↓ (auto-label: dev-test)
[Test Agent] Gera testes unitários
    ↓ (auto-label: testing)
[Test Runner] npm run test:unit -- --coverage
    ↓ (auto-label: pr, se passar)
[CI Agent] npm run lint && npm run test:integrated
    ↓ (auto-label: done, se passar)
PR Criado e Issue Movida para Done ✅
```

---

## 🛠️ Troubleshooting

### **"This job was skipped"**

**Causa**: Workflow dispatch não foi chamado corretamente

**Solução**:
1. Se criou issue normalmente → Just wait, workflow deve disparar em segundos
2. Se quer rodar manualmente → Actions → Autonomous Board Agents → "Run workflow"
3. Verifique se o GitHub Actions está ativo no repositório

### **Issue não avança de etapa**

**Causa**: Script do agent não gerou output

**Solução**:
1. Verifique logs em: GitHub Actions → Board Agents → Log detalhado
2. Verifique se `COPILOT_TOKEN` está configurado em Secrets
3. Verifique se `PROJECT_NUMBER` está em Vars

### **Testes falhando**

**Esperado**: Workflow move issue volta para `dev` com logs

**Próximo passo**: Agent Dev tenta corrigir automaticamente

---

## 🔐 Configuração Necessária (One-time)

O GitHub Actions precisa de:
- `contents: write` — Fazer commits e push
- `issues: write` — Adicionar/remover labels e comentar
- `pull-requests: write` — Criar PRs

Já configuradas em `.github/workflows/board-agents.yml`

### Secrets Necessários:

**Adicione em Settings → Secrets → Actions:**

```
COPILOT_TOKEN = seu token de acesso (para integração IA)
```

### Vars Necessários:

**Adicione em Settings → Variables → Actions:**

```
PROJECT_NUMBER = número do seu GitHub Projects (ex: 5)
```

---

## 📚 Próximos Passos

1. **Crie uma issue** com escopo claro
2. **Deixe o workflow rodar** (nenhuma ação manual necessária!)
3. **Acompanhe na issue** os comentários automation
4. **Verifique PR** quando estiver pronto

---

## ✨ Fluxo Resumido

```
┌─ Issue Criada ─┐
│                │
└────────────────┘
     ↓ auto
┌─ Refinement ───┐
│ (análise)      │
└────────────────┘
     ↓ auto
┌─ Dev ─────────┐
│ (código)       │
└────────────────┘
     ↓ auto
┌─ Dev-Test ────┐
│ (testes)       │
└────────────────┘
     ↓ auto
┌─ Testing ─────┐
│ (executa)      │
└────────────────┘
     ↓ if pass
┌─ PR ──────────┐
│ (CI + merge)   │
└────────────────┘
     ↓ if pass
┌─ Done ────────┐
│ ✅ Resolvida! │
└────────────────┘
```

**Nenhum label adicionar manualmente!** Tudo é automático.

---

**🎯 Objetivo**: Zero-click development — Da ideia ao merge, sem intervenção manual!
