---
name: 'Internationalization (i18n)'
description: 'Skill para implementar internacionalização em toda a aplicação. Cobre I18nService, catálogos JSON, detecção de idioma por header, plugin ESLint i18next, e boas práticas para mensagens user-facing.'
---

# Skill: Internationalization (i18n)

## Quando usar esta skill

- Ao criar **qualquer mensagem voltada ao usuário** (erros, validações, notificações).
- Ao adicionar **novas chaves** nos catálogos de tradução.
- Ao criar um novo **módulo/service** que retorna mensagens.
- Ao configurar ou debugar o plugin ESLint `i18next/no-literal-string`.

## Princípio Central

> Toda mensagem voltada ao usuário DEVE usar `I18nService.translate(key, args)`. Strings literais em código são apenas para logging e infraestrutura.

## Arquitetura

```
HTTP Request
  │ Header: Accept-Language: pt-BR
  ▼
I18nService (Scope: REQUEST)
  │ 1. Lê Accept-Language do header
  │ 2. Carrega catálogo JSON correspondente
  │ 3. Fallback para en.json se idioma não encontrado
  ▼
translate('errors.not_found', { model: 'ORDER', id: '123' })
  │
  ▼
"Ordem 123 não encontrada" (pt-BR) ou "Order 123 not found" (en)
```

## Componentes

### 1. I18nService (`src/common/core/i18n.service.ts`)

- **Scope**: `REQUEST` — nova instância por requisição.
- **Detecção**: `Accept-Language` header, fallback `pt-BR`.
- **Catálogos**: JSON em `src/common/i18n/`.
- **Chaves**: Dot notation (`errors.not_found`).
- **Placeholders**: `{argName}` substituídos automaticamente.

```typescript
// Uso no service
const message = this.i18n.translate('errors.not_found', {
  model: 'ORDER',
  id: '123',
});
// → "Order 123 not found" (en)
// → "Ordem 123 não encontrada" (pt-BR)
```

### 2. Catálogos JSON

**`src/common/i18n/en.json`**:

```json
{
  "WELCOME": "Welcome to Boilerplate",
  "ERROR_INTERNAL": "Internal server error",
  "AUTH_FAILED": "Authentication failed",
  "errors": {
    "not_found": "{model} with ID {id} not found",
    "create_failed": "Error creating {model}",
    "update_failed": "Error updating {model}",
    "delete_failed": "Error deleting {model}",
    "tenant_required": "Tenant isolation requires tenantId",
    "validation_failed": "Validation failed for {field}"
  }
}
```

**`src/common/i18n/pt-BR.json`**:

```json
{
  "WELCOME": "Bem-vindo ao Boilerplate",
  "ERROR_INTERNAL": "Erro interno do servidor",
  "AUTH_FAILED": "Falha na autenticação",
  "errors": {
    "not_found": "{model} com ID {id} não encontrado",
    "create_failed": "Erro ao criar {model}",
    "update_failed": "Erro ao atualizar {model}",
    "delete_failed": "Erro ao remover {model}",
    "tenant_required": "Isolamento de tenant requer tenantId",
    "validation_failed": "Validação falhou para {field}"
  }
}
```

### 3. ESLint Enforcement (`eslint.config.mjs`)

O plugin `i18next/no-literal-string` bloqueia strings literais em código business:

```javascript
'i18next/no-literal-string': ['error', {
  mode: 'all',
  onlyFunctions: ['t', 'translate'],
  ignoreFunctions: [
    'Logger.*',           // Logs técnicos OK
    'ConfigService.get',  // Config keys OK
    'ApiProperty',        // Swagger OK
    'logOperation',       // Provider logging OK
    'handleError',        // Provider errors OK
    // ... demais funções de infraestrutura
  ],
}],
```

## Como adicionar uma nova chave i18n

### Passo a passo

1. **Defina a chave** com dot notation e placeholders `{arg}`:

```json
// en.json
{ "orders": { "status_changed": "Order {id} status changed to {status}" } }

// pt-BR.json
{ "orders": { "status_changed": "Pedido {id} mudou para status {status}" } }
```

2. **Use no service**:

```typescript
const msg = this.i18n.translate('orders.status_changed', {
  id: order.id,
  status: 'paid',
});
```

3. **SEMPRE adicione em AMBOS os catálogos** (en.json + pt-BR.json).

## Uso nos Services e Filters

### No BaseResourceService (erros CRUD)

```typescript
// create() — erro com i18n
const message = this.i18n
  ? this.i18n.translate('errors.create_failed', { model: this.entityName })
  : `Error creating ${this.entityName}: ${error.message}`;
throw new BadRequestException(message);

// findOne() — not found com i18n
const message = this.i18n
  ? this.i18n.translate('errors.not_found', { model: this.entityName, id })
  : `${this.entityName} with ID ${id} not found`;
throw new NotFoundException(message);
```

### No GlobalExceptionFilter

O filter usa `ObfuscationService` para sanitizar e retorna mensagem consistente.

## Regras de Validação (Checklist)

- [ ] Toda mensagem de erro voltada ao usuário usa `I18nService.translate()`.
- [ ] Toda nova chave existe em **ambos** catálogos (`en.json` + `pt-BR.json`).
- [ ] Chaves usam dot notation (`module.action_result`).
- [ ] Placeholders usam `{argName}` (não template literals).
- [ ] Strings de logging e infraestrutura estão no `ignoreFunctions` do ESLint.
- [ ] O service que usa i18n recebe `I18nService` no constructor.
- [ ] `npm run lint` passa sem warnings de `i18next/no-literal-string`.

## Anti-Patterns (NUNCA fazer)

```typescript
// ❌ ERRADO: String literal como mensagem de erro
throw new BadRequestException('Order not found');

// ❌ ERRADO: Template literal como mensagem
throw new BadRequestException(`Order ${id} not found`);

// ❌ ERRADO: Adicionar chave em apenas um catálogo
// en.json tem a chave, pt-BR.json não

// ✅ CORRETO: Sempre via i18n
throw new BadRequestException(this.i18n.translate('errors.not_found', { model: 'ORDER', id }));
```

## Testes

```typescript
describe('I18nService', () => {
  it('should translate with placeholders', () => {
    const result = i18nService.translate('errors.not_found', {
      model: 'USER',
      id: '123',
    });
    expect(result).toBe('User with ID 123 not found');
  });

  it('should fallback to key when translation missing', () => {
    const result = i18nService.translate('unknown.key');
    expect(result).toBe('unknown.key');
  });

  it('should detect language from Accept-Language header', () => {
    // req.headers['accept-language'] = 'pt-BR'
    expect(i18nService.getLang()).toBe('pt-BR');
  });
});
```
