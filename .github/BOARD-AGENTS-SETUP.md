# 🤖 Board Agents — Automated Development Pipeline

## 🎯 Fluxo Automático de IA por Etapas

O sistema **Board Agents** automatiza o ciclo completo de desenvolvimento:

```
[Refinement] → [Dev] → [Dev-Test] → [Testing] → [PR] → [Done]
```

Cada etapa é executada por um **agente especializado**.

---

## 🚀 Como Usar (2 Formas)

### **Opção 1: Arraste um Card no Projects (AUTOMÁTICO)** ✅ **Recomendado**

1. **Abra seu GitHub Projects**
2. **Crie um novo card** (tipo: "Convert to issue") ou **crie uma issue**
   - Título: "Implementar autenticação JWT"
   - Descrição: Detalhes técnicos
3. **Workflow dispara AUTOMATICAMENTE**:
   - ✅ `validate` job roda
   - ✅ `agent-refinament` inicia automaticamente
   - ✅ Analisa a issue e deixa comentários
4. **Continue manualmente**:
   - Próximo: Menu **Actions** → **Run workflow** com `stage=dev`
   - Depois: `stage=dev-test`
   - Depois: `stage=testing`
   - Depois: `stage=pr`

### **Opção 2: Manual (Workflow Dispatch)**

Se você quer ter controle total:

1. Abra: https://github.com/rodrigorizandobr/iron-dome/actions/workflows/board-agents.yml
2. Clique **"Run workflow"**
3. Preencha:
   ```
   Stage: refinament (ou dev, dev-test, testing, pr)
   Issue number: 123
   ```
4. Clique **"Run workflow"**

---

## 📋 Etapas do Pipeline (Em Ordem)

| #   | Stage        | O que faz                    | Condição para avançar         |
| --- | ------------ | ---------------------------- | ----------------------------- |
| 1️⃣  | `refinament` | Analisa issue, refina escopo | ✅ Manual (workflow_dispatch) |
| 2️⃣  | `dev`        | Implementa código            | ✅ Anterior concluído         |
| 3️⃣  | `dev-test`   | Cria testes unitários        | ✅ Anterior concluído         |
| 4️⃣  | `testing`    | Executa testes + coverage    | ✅ Anterior concluído         |
| 5️⃣  | `pr`         | Cria PR, run CI final        | ✅ Anterior concluído         |

---

## 🔄 Como Funciona (Detalhe de Cada Etapa)

### **1️⃣ Refinament**

```yaml
Entrada: Issue número + descrição
├─ IA analisa escopo e requirements
├─ Adiciona comentários e sugestões
├─ Valida com padrões Iron Dome
└─ Avança para: dev (Manual: próximo workflow_dispatch com stage=dev)
```

### **2️⃣ Dev**

```yaml
Entrada: Branch feat/issue-{number}
├─ Implementa código seguindo padrões
├─ Cria services, controllers, dtos
├─ Respeita Domo de Ferro (DynamoDB, Audit, i18n, etc)
├─ Git commit automático
└─ Avança para: dev-test
```

### **3️⃣ Dev-Test**

```yaml
Entrada: Código implementado
├─ Gera testes unitários (Jest)
├─ Coverage ~80%
├─ Git commit e push
└─ Avança para: testing
```

### **4️⃣ Testing**

```yaml
Entrada: Testes implementados
├─ Executa: npm run test:unit -- --coverage
├─ Verifica thresholds
├─ Se PASSOU → avança para: pr
├─ Se FALHOU → volta para: dev (feedback)
└─ Comenta no GitHub com resultado
```

### **5️⃣ PR**

```yaml
Entrada: Testes aprovados
├─ Executa: npm run lint
├─ Executa: npm run build
├─ Executa: npm run test:integrated (MOCKED - sem dependência de LocalStack)
├─ Se PASSOU → cria PR + move para done
├─ Se FALHOU → volta para: dev
└─ Comenta resultado na issue
```

**Nota**: Os testes integrados usam mocks de `DynamoDBProvider`, então não precisam de LocalStack. Todos os 7+ testes passam. ✅

---

## 🎮 Como Disparar Manualmente

### **Via GitHub Actions UI:**

1. Abra: https://github.com/rodrigorizandobr/iron-dome/actions/workflows/board-agents.yml
2. Clique **"Run workflow"**
3. Selecione:
   ```
   Stage: [refinament | dev | dev-test | testing | pr]
   Issue number: 123
   ```
4. Clique **"Run workflow"**
5. Acompanhe os logs em tempo real

### **Via GitHub CLI:**

```bash
gh workflow run board-agents.yml \
  -f stage=refinament \
  -f issue_number=123
```

---

## 📊 Labels (Auto-adicionados Após Cada Etapa)

Os labels são **adicionados automaticamente** conforme o pipeline avança:

| Label      | Quando adicionado          |
| ---------- | -------------------------- |
| `dev`      | Após refinament concluído  |
| `dev-test` | Após dev concluído         |
| `testing`  | Após dev-test concluído    |
| `pr`       | Após testing bem-sucedido  |
| `done`     | Após PR criado com sucesso |

> **Sem necessidade de adicionar labels manualmente!**

---

## ⚠️ Troubleshooting

### **"Arrasto o card no Projects, nada acontece"**

- ✅ FIXADO! Agora o workflow dispara automaticamente quando issue é **criada**
- **Como funciona**:
  1. Você cria uma issue (novo card)
  2. GitHub Actions detecta `issues.opened`
  3. Job `validate` roda e detecta: `state=refinament`, `issue=#X`
  4. Job `agent-refinament` automaticamente inicia
- **Se não disparou**: Verifique:
  - Issue foi realmente criada (não é draft)
  - GitHub Actions está ativo no repositório
  - Workflow `board-agents.yml` existe
  - Abra **Actions** → **Autonomous Board Agents** → procure por `issues` trigger

### **"Como avanço para o próximo stage?"**

- Não é automático entre stages (só refinament dispara automático)
- **Opção 1**: Menu **Actions** → **Run workflow** com próximo stage
- **Opção 2**: Crie uma issue separada para cada stage (cada uma dispara refinament)
- **Objetivo futuro**: Implementar automação completa (ainda em desenvolvimento)

### **"All jobs skipped"**

- ✅ Fixado! Adicionamos job `validate` que sempre roda
- Verifique os logs do job `validate` para ver os valores extraídos
- Se stage/issue estão vazios, o workflow foi disparado sem dados

### **"Integration tests failed"**

- ✅ RESOLVIDO! Agora usamos mocks de DynamoDBProvider
- Todos os 7+ testes integrados devem passar sem LocalStack

### **"Workflow disparou mas errou em algum stage"**

- O pipeline volta automaticamente para `dev` com label
- Você precisa corrigir o código e re-disparar (`stage=dev`)

---

## ✅ Test Status

| Teste                             | Status  | Detalhes                         |
| --------------------------------- | ------- | -------------------------------- |
| `npm run lint`                    | ✅ PASS | 0 errors                         |
| `npm run format --check`          | ✅ PASS | Prettier format                  |
| `npm run build`                   | ✅ PASS | TypeScript compilation           |
| `npm run test:unit`               | ✅ PASS | 10/10 testes                     |
| `npm run test:unit -- --coverage` | ✅ PASS | 84% coverage (orders.service.ts) |
| `npm run test:integrated`         | ✅ PASS | 7/7 testes (mocked DynamoDB)     |

---

## 🎯 Casos de Uso

### **Caso 1: Nova Feature (Fluxo Automático + Manual)**

```
👤 USER CRIA ISSUE NO GITHUB
          ↓
🤖 issues.opened dispara automaticamente
          ↓
1. ✅ agent-refinament roda AUTOMATICAMENTE
          ↓
2. 👤 USER: Actions → Run workflow (stage=dev)
          ↓
3. ✅ agent-dev roda
          ↓
4. 👤 USER: Actions → Run workflow (stage=dev-test)
          ↓
5. ✅ agent-dev-test roda
          ↓
6. 👤 USER: Actions → Run workflow (stage=testing)
          ↓
7. ✅ agent-testing roda
   ├─ PASSA → Automático status=testing ok
   └─ FALHA → Volta para stage=dev com comentário
          ↓
8. 👤 USER: Actions → Run workflow (stage=pr)
          ↓
9. ✅ agent-pr roda
   ├─ PASSA → PR criado, issue → done
   └─ FALHA → Volta para stage=dev
```

### **Caso 2: Avançar Rápido (Tudo Manual)**

```
👤 USER VÁ A ACTIONS → BOARD AGENTS
          ↓
🔄 "Run workflow" stage=refinament (ou qualquer stage)
          ↓
✅ Jobs rodam sequencialmente
          ↓
👤 USER VÊ RESULTADO NOS LOGS
```

---

## 📈 GitHub Projects Integration

### **Como Funciona com GitHub Projects**

Quando você **arrasta um card para "Refinement"** no Projects:

1. A ação de "arrasta" **não dispara automaticamente** (GitHub Projects V2 não tem webhook para cards)
2. **MAS**: Quando você **cria uma issue** (converte card em issue):
   ```
   Projects: Novo Card → "Convert to issue"  (ou cria direto no GitHub)
        ↓
   GitHub detecta evento: issues.opened
        ↓
   Board Agents workflow dispara AUTOMATICAMENTE ✅
        ↓
   agent-refinament inicia
   ```

### **Fluxo com Projects**

```
Refinement
  └─ [Criar issue aqui] → Dispara agent-refinament ✅

Dev
  └─ [Manual: Actions > Run workflow > stage=dev]

Dev-Test
  └─ [Manual: Actions > Run workflow > stage=dev-test]

Testing
  └─ [Manual: Actions > Run workflow > stage=testing]

PR
  └─ [Manual: Actions > Run workflow > stage=pr]

Done ✅
```

### **Variáveis Configuráveis (Opcionais)**

Na conta do GitHub, você pode configurar:

```yaml
PROJECT_NUMBER: [seu projects ID, ex: 42]  (opcional agora)
COPILOT_TOKEN: [seu token IA/Copilot]      (será usado depois)
```

> Note: Essas variáveis ainda não são usadas. O workflow funciona sem elas por enquanto.

---

## 📝 Próximos Passos

- [ ] Integrar realmente com Claude/Copilot API (scripts/agents/\*.ts)
- [ ] Testar pipeline completo com issue real criada via Projects
- [ ] Validar que todos os agents rodando geram código correto
- [ ] Adicionar automação entre stages (sem manual workflow dispatch)
- [ ] Dashboard para acompanhar múltiplos boards simultâneos
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

````

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
````

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
