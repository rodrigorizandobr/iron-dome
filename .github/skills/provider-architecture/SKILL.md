---
name: "Provider Architecture"
description: "Skill para criar novos Providers AWS ou externos seguindo o padrão corporativo. Cobre herança de BaseProvider, injeção de ConfigService, logging padronizado e naming automático."
---

# Skill: Provider Architecture

## Quando usar esta skill
- Ao criar um **novo provider AWS** (ex: EventBridge, Cognito, CloudWatch).
- Ao criar um **provider externo** (ex: Stripe, Twilio, SendGrid).
- Ao revisar se um provider existente segue a arquitetura padrão.

## Anatomia de um Provider

Todo provider neste projeto segue este contrato:

```
BaseProvider (abstract)
  ├── logger          ← Logger automático com nome do provider
  ├── configService   ← Acesso a variáveis de ambiente
  ├── getResourceName(type, name) ← Naming corporativo automático
  ├── logOperation(op, details)   ← Log padronizado
  └── handleError(op, error)      ← Error handling padronizado

      DynamoDBProvider extends BaseProvider
      S3Provider       extends BaseProvider
      SQSProvider      extends BaseProvider
      SNSProvider      extends BaseProvider
      SecretsManagerProvider extends BaseProvider
      OpenAIProvider   extends BaseProvider
```

## Como criar um novo Provider AWS

### Template

```typescript
import { Injectable } from '@nestjs/common';
import { [CLIENT], [COMMAND] } from '@aws-sdk/client-[SERVICE]';
import { ConfigService } from '@nestjs/config';
import { BaseProvider } from '../base.provider';

/**
 * AWS [SERVICE_NAME] Provider for [purpose].
 *
 * @example
 * ```typescript
 * constructor(private readonly myProvider: MyProvider) {}
 * const resourceName = this.myProvider.getResourceName('[type]', '[name]');
 * ```
 */
@Injectable()
export class MyProvider extends BaseProvider {
  private client: [CLIENT];

  constructor(protected readonly configService: ConfigService) {
    super(MyProvider.name, configService);
    //    ^^^^^^^^^^^^^^   ^^^^^^^^^^^^^
    //    Nome do Logger   Passa para BaseProvider
    
    this.client = new [CLIENT]({
      region: this.configService.get<string>('AWS_REGION'),
      endpoint: this.configService.get<string>('AWS_ENDPOINT'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || 'dummy',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || 'dummy',
      },
    });
  }

  /**
   * [Describe the operation].
   */
  async myOperation(param: string) {
    this.logOperation('myOperation', { param });
    try {
      const command = new [COMMAND]({ /* ... */ });
      return await this.client.send(command);
    } catch (error) {
      this.handleError('myOperation', error);
    }
  }
}
```

### Checklist para novo Provider

- [ ] Herda de `BaseProvider`
- [ ] Construtor recebe `ConfigService` como `protected readonly`
- [ ] Chama `super(ProviderName.name, configService)` no construtor
- [ ] Usa `this.logOperation()` no início de cada método
- [ ] Usa `this.handleError()` no `catch`
- [ ] Usa `this.getResourceName()` para gerar nomes de recursos
- [ ] Tem JSDoc com `@example` em cada método público
- [ ] Registrado no `AppModule` em `providers` e `exports`
- [ ] Máximo 200 linhas

## Providers Existentes

| Provider                 | Recurso AWS       | Métodos Helper                          |
|--------------------------|-------------------|-----------------------------------------|
| `DynamoDBProvider`       | DynamoDB          | `putItem`, `getItem`, `query`           |
| `S3Provider`             | S3                | `getBucketName(functional)`             |
| `SQSProvider`            | SQS               | `getQueueName(functional)`, `sendMessage` |
| `SNSProvider`            | SNS               | `getTopicName(functional)`, `publish`   |
| `SecretsManagerProvider` | Secrets Manager   | `getSecretName(functional)`, `getSecret`|
| `CloudWatchLogsProvider` | CloudWatch Logs   | `putLogEvents`, `createLogStream`       |
| `OpenAIProvider`         | OpenAI (externo)  | `createChatCompletion`, `analyze`       |

## Como registrar no AppModule

```typescript
// src/app.module.ts
import { MyProvider } from './providers/aws/my.provider';

@Module({
  providers: [MyProvider, /* ...outros */],
  exports: [MyProvider, /* ...outros */],
})
```

## Regras
1. **NUNCA** crie um client AWS diretamente em um Service. Sempre via Provider.
2. **NUNCA** instancie um provider sem `ConfigService`. Nunca hardcode credenciais.
3. **SEMPRE** use `getResourceName()` para nomes de recursos. Nunca hardcode.
4. **SEMPRE** adicione cada novo provider ao `AppModule`.
