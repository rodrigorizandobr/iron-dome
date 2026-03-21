# 🤖 Board Agents — Automated Development Pipeline

## 🎯 Fluxo Automático de IA por Etapas

O sistema **Board Agents** automatiza o ciclo completo de desenvolvimento:

```
[Refinement] → [Dev] → [Dev-Test] → [Testing] → [PR] → [Done]
```

Cada etapa é executada por um **agente especializado**.

---

## 🚀 Como Usar (Manual Dispatch - Mais Confiável)

### **Fluxo Recomendado:**

1. **Crie uma issue** no GitHub com título e descrição clara
   ```
   Título: Implementar autenticação JWT para user endpoints
   Descrição: Adicionar proteção JWT aos endpoints GET/POST/PUT/DELETE
   ```

2. **Vá a GitHub Actions** → **Autonomous Board Agents**

3. **Clique "Run workflow"** e preencha:
   - **Stage**: Comece com `refinament` (padrão)
   - **Issue number**: O número da issue que você criou

4. **Acompanhe em tempo real** no GitHub Actions → Logs

---

## 📋 Etapas do Pipeline (Em Ordem)

| # | Stage | O que faz | Condição para avançar |
| --- | --- | --- | --- |
| 1️⃣ | `refinament` | Analisa issue, refina escopo | ✅ Manual (workflow_dispatch) |
| 2️⃣ | `dev` | Implementa código | ✅ Anterior concluído |
| 3️⃣ | `dev-test` | Cria testes unitários | ✅ Anterior concluído |
| 4️⃣ | `testing` | Executa testes + coverage | ✅ Anterior concluído |
| 5️⃣ | `pr` | Cria PR, run CI final | ✅ Anterior concluído |

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
├─ Executa: npm run test:integrated
├─ Se PASSOU → cria PR + move para done
├─ Se FALHOU → volta para: dev
└─ Comenta resultado na issue
```

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

| Label | Quando adicionado |
| --- | --- |
| `dev` | Após refinament concluído |
| `dev-test` | Após dev concluído |
| `testing` | Após dev-test concluído |
| `pr` | Após testing bem-sucedido |
| `done` | Após PR criado com sucesso |

> **Sem necessidade de adicionar labels manualmente!**

---

## ⚠️ Troubleshooting

### **"All jobs skipped"**
- ✅ Fixado! Removemos o `detect-stage` job que causava problemas
- Use `workflow_dispatch` com inputs explícitos

### **"Issue not found"**
- Verifique o número da issue
- Issue deve existir no repositório

### **"Branch not found" (nos stages depois de dev)**
- O branch `feat/issue-{number}` precisa existir
- Rode a etapa `dev` antes de `dev-test`

### **"Tests failed"**
- Verifique os logs no GitHub Actions
- O pipeline volta automaticamente para `dev` para conserto

---

## 🎯 Casos de Uso

### **Caso 1: Nova Feature Completa**

```
User Action: Cria issue
          ↓
1. run workflow_dispatch (stage=refinament)
          ↓
2. run workflow_dispatch (stage=dev)
          ↓
3. run workflow_dispatch (stage=dev-test)
          ↓
4. run workflow_dispatch (stage=testing)
          ↓
5. run workflow_dispatch (stage=pr)
          ↓
✅ PR criado e pronto para merge!
```

### **Caso 2: Testes Falharam**

```
4. Testing executou → FALHOU ❌
          ↓
Label "dev" adicionado automaticamente
          ↓
User: run workflow_dispatch (stage=dev) novamente
          ↓
Refaz implementação
          ↓
...cycle continua até PASSAR
```

---

## 🔧 Variáveis Esperadas

Na conta do GitHub, configure (se usar auto-triggers):

```yaml
PROJECT_NUMBER: [seu github projects número, ex: 42]
```

Para secrets (agentes que usam APIs):

```yaml
COPILOT_TOKEN: [seu token da IA/Copilot]
```

> Note: Atualmente usamos `workflow_dispatch`, então essas variáveis são opcionais.

---

## 📝 Próximos Passos

- [ ] Integrar realmente com Claude/Copilot API (scripts/agents/*.ts)
- [ ] Testar pipeline completo com issue real
- [ ] Validar que todos os agents rodando geram código correto
- [ ] Adicionar hooks de feedback em cada etapa
- [ ] Dashboard para acompanhar múltiplos boards simultâneos
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
