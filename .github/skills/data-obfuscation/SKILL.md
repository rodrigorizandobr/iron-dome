---
name: 'Data Obfuscation'
description: 'Skill para implementar ofuscação de dados sensíveis em logs, respostas de erro e auditoria. Cobre ObfuscationService, campos sensíveis, integração com filters, e regras de segurança LGPD/PCI.'
---

# Skill: Data Obfuscation

## Quando usar esta skill

- Ao fazer **logging de qualquer objeto** que possa conter dados sensíveis.
- Ao criar ou revisar **exception filters** que retornam detalhes ao cliente.
- Ao implementar **auditoria** ou **tracing** que persiste dados.
- Ao revisar se dados sensíveis estão expostos em logs ou respostas.

## Princípio Central

> Use `ObfuscationService.obfuscate(obj)` **antes** de qualquer `console.log`, `logger.error`, ou gravação em arquivo. Dados sensíveis NUNCA devem aparecer em logs.

## Campos Sensíveis (Lista Padrão)

| Campo         | Tipo       | Exemplo                   |
| ------------- | ---------- | ------------------------- |
| `password`    | Credencial | `"abc123"` → `"********"` |
| `secret`      | Credencial | Token secreto             |
| `token`       | Auth       | JWT, API key              |
| `key`         | Auth       | Access key, secret key    |
| `auth`        | Auth       | Authorization header      |
| `credit_card` | PCI        | Número do cartão          |
| `cvv`         | PCI        | Código de segurança       |
| `cpf`         | LGPD       | Documento pessoal         |
| `rg`          | LGPD       | Documento pessoal         |
| `document`    | LGPD       | Documento genérico        |
| `payload`     | Genérico   | Payload com dados mistos  |

> O match é feito via `includes()` no nome do campo (case-insensitive). `userPassword`, `authToken`, `creditCard` — todos são detectados.

## Componentes

### 1. ObfuscationService (`src/common/core/obfuscation.service.ts`)

```typescript
@Injectable()
export class ObfuscationService {
  private sensitivePatterns: string[] = [
    'password',
    'secret',
    'token',
    'key',
    'auth',
    'credit_card',
    'cvv',
    'cpf',
    'rg',
    'document',
    'payload',
  ];

  /**
   * Deep traversal obfuscation.
   * Replaces sensitive fields with '********'.
   */
  obfuscate(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((i) => this.obfuscate(i));

    const result = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const isSensitive = this.sensitivePatterns.some((p) => key.toLowerCase().includes(p));
        if (isSensitive) result[key] = '********';
        else if (typeof obj[key] === 'object') result[key] = this.obfuscate(obj[key]);
        else result[key] = obj[key];
      }
    }
    return result;
  }
}
```

### 2. Integração com GlobalExceptionFilter

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly obfuscationService: ObfuscationService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    // Ofusca ANTES de logar
    const errorBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      tenantId: (request as any).tenantId,
      detail: this.obfuscationService.obfuscate(message), // ← Ofuscado
    };

    this.logger.error(`Critical Error: ${JSON.stringify(errorBody)}`);
    this.writeToErrorFile(errorBody);

    // Response também é ofuscada
    response.status(status).json(errorBody);
  }
}
```

### 3. Uso em Providers (via BaseProvider)

```typescript
// No BaseProvider, o logOperation deve ofuscar dados:
logOperation(operation: string, details: any) {
  const safeDetails = this.obfuscationService
    ? this.obfuscationService.obfuscate(details)
    : details;
  this.logger.log(`[${operation}] ${JSON.stringify(safeDetails)}`);
}
```

## Uso Correto

```typescript
// Em qualquer service ou controller:
constructor(private readonly obfuscation: ObfuscationService) {}

// Antes de logar
const safeData = this.obfuscation.obfuscate(userData);
this.logger.log(`User data: ${JSON.stringify(safeData)}`);

// Antes de gravar auditoria
await this.auditService.log(this.obfuscation.obfuscate(event));
```

## Regras de Validação (Checklist)

- [ ] Todo `logger.error()`, `logger.warn()`, `logger.log()` com objetos usa `obfuscate()` antes.
- [ ] O `GlobalExceptionFilter` ofusca o `detail` antes de logar e retornar.
- [ ] Novos campos sensíveis são adicionados ao array `sensitivePatterns`.
- [ ] Campos com `password`, `token`, `key`, `auth`, `cpf`, `cvv`, `document` nunca aparecem em logs.
- [ ] O ESLint plugin `no-secrets` está ativo para detectar segredos hardcoded.
- [ ] Arquivos de log em `storage/log/` contêm apenas dados ofuscados.

## Anti-Patterns (NUNCA fazer)

```typescript
// ❌ ERRADO: Logar objeto sem ofuscar
this.logger.log(`User: ${JSON.stringify(user)}`);
// Log: { name: 'John', cpf: '123.456.789-00', password: 'abc123' }

// ❌ ERRADO: Retornar dados sensíveis na response de erro
response.json({ error: exception.message, userData: user });

// ❌ ERRADO: Gravar auditoria sem ofuscar
fs.appendFileSync('audit.log', JSON.stringify(event));

// ✅ CORRETO: Sempre ofuscar
this.logger.log(`User: ${JSON.stringify(this.obfuscation.obfuscate(user))}`);
// Log: { name: 'John', cpf: '********', password: '********' }
```

## Como adicionar novos campos sensíveis

No `ObfuscationService`, adicione ao array `sensitivePatterns`:

```typescript
private sensitivePatterns: string[] = [
  'password', 'secret', 'token', 'key', 'auth',
  'credit_card', 'cvv', 'cpf', 'rg', 'document', 'payload',
  'social_security',  // ← Novo campo
  'bank_account',     // ← Novo campo
];
```

## Testes

```typescript
describe('ObfuscationService', () => {
  it('should obfuscate sensitive fields', () => {
    const input = { name: 'John', cpf: '123.456.789-00', email: 'j@test.com' };
    const result = service.obfuscate(input);

    expect(result.name).toBe('John');
    expect(result.cpf).toBe('********');
    expect(result.email).toBe('j@test.com');
  });

  it('should handle nested objects', () => {
    const input = { user: { name: 'John', password: 'secret123' } };
    const result = service.obfuscate(input);

    expect(result.user.name).toBe('John');
    expect(result.user.password).toBe('********');
  });

  it('should handle arrays', () => {
    const input = [{ token: 'abc' }, { token: 'xyz' }];
    const result = service.obfuscate(input);

    expect(result[0].token).toBe('********');
    expect(result[1].token).toBe('********');
  });

  it('should return null/undefined as-is', () => {
    expect(service.obfuscate(null)).toBeNull();
    expect(service.obfuscate(undefined)).toBeUndefined();
  });
});
```
