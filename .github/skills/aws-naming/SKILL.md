---
name: 'AWS Naming Convention'
description: 'Skill para gerar nomes de recursos AWS seguindo o padrão corporativo híbrido funcional: [ENV]-[DOMAIN]-[SUBDOMAIN]-[RESOURCE_TYPE]-[FUNCTIONAL_NAME]. Ele sabe quais Enums usar, quais variáveis de ambiente configurar, e como alinhar o Terraform com o código NestJS.'
---

# Skill: AWS Naming Convention

## Quando usar esta skill

- Ao criar um **novo recurso AWS** (tabela, bucket, fila, tópico, lambda, secret).
- Ao verificar se um recurso existente segue o padrão corporativo.
- Ao configurar variáveis de ambiente para um novo ambiente (staging, produção).

## O Padrão Corporativo

```
[AMBIENTE]-[DOMÍNIO]-[SUBDOMÍNIO]-[TIPO_RECURSO]-[NOME_FUNCIONAL]
```

### Componentes

| Segmento       | Fonte             | Enum/Type        | Exemplos                                           |
| -------------- | ----------------- | ---------------- | -------------------------------------------------- |
| AMBIENTE       | `NODE_ENV`        | `AppEnvironment` | `dev`, `hml`, `sandbox`, `prd`                     |
| DOMÍNIO        | `APP_DOMAIN`      | `string`         | `fintech`, `ecommerce`, `health`                   |
| SUBDOMÍNIO     | `APP_SUBDOMAIN`   | `string`         | `core`, `payments`, `identity`                     |
| TIPO_RECURSO   | Passado no código | `string`         | `dynamodb`, `s3`, `sqs`, `sns`, `lambda`, `secret` |
| NOME_FUNCIONAL | Passado no código | `string`         | `main`, `attachments`, `order-processor`           |

### Enums (definidos em `src/providers/base.provider.ts`)

```typescript
export enum AppEnvironment {
  DEVELOPMENT = 'dev',
  STAGING = 'hml',
  SANDBOX = 'sandbox',
  PRODUCTION = 'prd',
}

export enum AppServiceType {
  API = 'api',
  WORKER = 'worker',
  JOB = 'job',
  FRONTEND = 'frontend',
}
```

> `AppServiceType` é usado para Lambdas e recursos de execução, não para recursos de dados.

## Como usar no código

```typescript
// Em qualquer provider que herda de BaseProvider:
const tableName = this.getResourceName('dynamodb', 'main'); // dev-fintech-core-dynamodb-main
const bucketName = this.getResourceName('s3', 'attachments'); // dev-fintech-core-s3-attachments
const queueName = this.getResourceName('sqs', 'order-processor'); // dev-fintech-core-sqs-order-processor
const topicName = this.getResourceName('sns', 'payment-events'); // dev-fintech-core-sns-payment-events
const secretName = this.getResourceName('secret', 'db-credentials'); // dev-fintech-core-secret-db-credentials
```

## Como alinhar com Terraform

Em `infra/terraform/main.tf`:

```hcl
variable "env"       { default = "dev" }
variable "domain"    { default = "fintech" }
variable "subdomain" { default = "core" }

locals {
  resource_prefix = "${var.env}-${var.domain}-${var.subdomain}"
}

resource "aws_dynamodb_table" "main_table" {
  name = "${local.resource_prefix}-dynamodb-main"
}

resource "aws_s3_bucket" "attachments" {
  bucket = "${local.resource_prefix}-s3-attachments"
}
```

## Variáveis de Ambiente `.env`

```env
NODE_ENV=dev
APP_DOMAIN=fintech
APP_SUBDOMAIN=core
```

## Regras de Validação

1. Todo nome de recurso deve ser **lowercase**.
2. Nunca hardcode um nome de recurso. Sempre use `getResourceName()`.
3. O Terraform e o código NestJS **DEVEM** gerar nomes idênticos.
4. Se o recurso é de dados (DynamoDB, S3), o último segmento é o **propósito funcional**.
5. Se o recurso é de execução (Lambda), o último segmento pode incluir o `AppServiceType`.
