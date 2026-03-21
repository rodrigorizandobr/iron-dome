---
name: 'Terraform IaC'
description: 'Skill para definir e manter infraestrutura AWS via Terraform. Cobre nomenclatura corporativa no HCL, alinhamento com o código NestJS, LocalStack para dev local, e padrões de recursos (DynamoDB, S3, SQS, SNS, Lambda).'
---

# Skill: Terraform IaC (Infrastructure as Code)

## Quando usar esta skill

- Ao criar um **novo recurso AWS** (tabela, bucket, fila, tópico, lambda, secret).
- Ao modificar ou revisar `infra/terraform/main.tf`.
- Ao verificar se a infra está **alinhada** com o código NestJS.
- Ao configurar **LocalStack** para desenvolvimento local.

## Princípio Central

> Se não está no Terraform, não existe. Toda infraestrutura é definida em `infra/terraform/main.tf`.

## Estrutura do Terraform

```
infra/
└── terraform/
    └── main.tf    ← Arquivo único de definição de infra
```

### Variáveis e Locals

```hcl
variable "aws_region" { default = "us-east-1" }
variable "domain"     { default = "fintech" }
variable "subdomain"  { default = "core" }
variable "env"        { default = "dev" }  # Maps to AppEnvironment enum

locals {
  # Padrão: [AMBIENTE]-[DOMÍNIO]-[SUBDOMÍNIO]
  resource_prefix = "${var.env}-${var.domain}-${var.subdomain}"
}
```

> O `resource_prefix` gera nomes como `dev-fintech-core-`. O sufixo é sempre `-[TIPO_RECURSO]-[NOME_FUNCIONAL]`.

### Alinhamento com NestJS

| Terraform               | NestJS (BaseProvider)                                  |
| ----------------------- | ------------------------------------------------------ |
| `var.env`               | `AppEnvironment` enum (`dev`, `hml`, `sandbox`, `prd`) |
| `var.domain`            | `ConfigService.get('APP_DOMAIN')`                      |
| `var.subdomain`         | `ConfigService.get('APP_SUBDOMAIN')`                   |
| `local.resource_prefix` | `BaseProvider.getResourceName(type, name)`             |

**Resultado**: O nome gerado no Terraform é IDÊNTICO ao nome usado no código.

## Templates por Tipo de Recurso

### DynamoDB (Single Table)

```hcl
resource "aws_dynamodb_table" "main_table" {
  name           = "${local.resource_prefix}-dynamodb-main"
  billing_mode   = "PAY_PER_REQUEST"    # Serverless: sem provisioned capacity
  hash_key       = "PK"
  range_key      = "SK"

  attribute { name = "PK"         type = "S" }
  attribute { name = "SK"         type = "S" }
  attribute { name = "entityType" type = "S" }

  global_secondary_index {
    name            = "GSI1"
    hash_key        = "entityType"
    range_key       = "SK"
    projection_type = "ALL"
  }

  tags = { Environment = var.env, Project = "api-ai" }
}
```

**Regras DynamoDB**:

- Sempre `PAY_PER_REQUEST` (serverless).
- Sempre PK (String) + SK (String).
- GSI1 para queries cross-entity.
- Tags obrigatórias: `Environment` + `Project`.

### S3

```hcl
resource "aws_s3_bucket" "storage" {
  bucket = "${local.resource_prefix}-s3-storage"
  tags   = { Environment = var.env, Project = "api-ai" }
}

resource "aws_s3_bucket_versioning" "storage_versioning" {
  bucket = aws_s3_bucket.storage.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "storage_encryption" {
  bucket = aws_s3_bucket.storage.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
```

**Regras S3**:

- Versionamento habilitado.
- Encriptação server-side (AES256 ou KMS).
- Tags obrigatórias.

### SQS

```hcl
resource "aws_sqs_queue" "order_processor" {
  name                       = "${local.resource_prefix}-sqs-order-processor"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 86400  # 1 dia
  tags = { Environment = var.env, Project = "api-ai" }
}

# Dead Letter Queue (recomendado)
resource "aws_sqs_queue" "order_processor_dlq" {
  name = "${local.resource_prefix}-sqs-order-processor-dlq"
  tags = { Environment = var.env, Project = "api-ai" }
}
```

**Regras SQS**:

- Dead Letter Queue (DLQ) para cada fila principal.
- `visibility_timeout_seconds` alinhado com o tempo de processamento.
- Tags obrigatórias.

### SNS + SQS Subscription (Fan-out Pattern)

```hcl
resource "aws_sns_topic" "order_events" {
  name = "${local.resource_prefix}-sns-order-events"
  tags = { Environment = var.env, Project = "api-ai" }
}

# Subscribe order-processor SQS queue to the order-events SNS topic
resource "aws_sns_topic_subscription" "order_events_to_sqs" {
  topic_arn = aws_sns_topic.order_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.app_queue.arn
}
```

**Regras SNS**:

- Todo módulo com CUD publica eventos no seu SNS topic.
- Fan-out via `aws_sns_topic_subscription` para SQS.
- Tags obrigatórias.

### CloudWatch Log Group

```hcl
resource "aws_cloudwatch_log_group" "api_logs" {
  name              = "/api/${local.resource_prefix}-logs-api"
  retention_in_days = 30
  tags              = { Environment = var.env, Project = "api-ai" }
}
```

**Regras CloudWatch**:

- Retention obrigatório (30 dias dev, 90 dias prd).
- Tags obrigatórias.

### IAM Role for Lambda

```hcl
resource "aws_iam_role" "lambda_exec" {
  name = "${local.resource_prefix}-iam-lambda-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = { Environment = var.env, Project = "api-ai" }
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_app_policy" {
  name = "${local.resource_prefix}-iam-lambda-app-policy"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:*"]
        Resource = [aws_dynamodb_table.main_table.arn, "${aws_dynamodb_table.main_table.arn}/index/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:*"]
        Resource = [aws_s3_bucket.app_storage.arn, "${aws_s3_bucket.app_storage.arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:*"]
        Resource = [aws_sqs_queue.app_queue.arn, aws_sqs_queue.order_processor_dlq.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["sns:Publish"]
        Resource = [aws_sns_topic.order_events.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["logs:*"]
        Resource = ["${aws_cloudwatch_log_group.api_logs.arn}:*"]
      },
    ]
  })
}
```

**Regras IAM**:

- Princípio do menor privilégio.
- Referências cruzadas a recursos já definidos (ARNs).
- Tags obrigatórias.

### Lambda Function

```hcl
resource "aws_lambda_function" "api_handler" {
  function_name = "${local.resource_prefix}-lambda-api-handler"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "dist/lambda.handler"
  runtime       = "nodejs22.x"
  timeout       = 30
  memory_size   = 512
  filename      = "${path.module}/../../dist/lambda.zip"

  environment {
    variables = {
      NODE_ENV       = var.env
      APP_DOMAIN     = var.domain
      APP_SUBDOMAIN  = var.subdomain
      AWS_REGION_APP = var.aws_region
    }
  }

  tags = { Environment = var.env, Project = "api-ai" }
}
```

**Regras Lambda**:

- Handler aponta para `dist/lambda.handler` (NestJS via `@codegenie/serverless-express`).
- Runtime `nodejs22.x`.
- Env vars incluem naming variables para `BaseProvider.getResourceName()`.
- Tags obrigatórias.

### API Gateway v2 (HTTP API)

```hcl
resource "aws_apigatewayv2_api" "http_api" {
  name          = "${local.resource_prefix}-apigw-http"
  protocol_type = "HTTP"
  tags          = { Environment = var.env, Project = "api-ai" }
}

resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api_handler.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "default_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_apigatewayv2_stage" "default_stage" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true
  tags        = { Environment = var.env, Project = "api-ai" }
}

resource "aws_lambda_permission" "apigw_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}
```

**Regras API Gateway**:

- HTTP API (v2), não REST API (v1).
- `$default` route catch-all para NestJS routing.
- Lambda permission para invocação pelo API GW.
- Tags obrigatórias.

## LocalStack (Desenvolvimento Local)

A infra local roda via **LocalStack** no `docker-compose.yml`:

```yaml
services:
  localstack:
    image: localstack/localstack
    ports:
      - '4566:4566'
    environment:
      - SERVICES=dynamodb,s3,sqs,sns,lambda,secretsmanager
      - DEFAULT_REGION=us-east-1
```

### Aplicando via Terraform

```bash
# Inicializar
cd infra/terraform
terraform init

# Aplicar contra LocalStack
terraform apply -auto-approve
```

O provider AWS no `main.tf` já aponta para `http://localhost:4566`.

## Regras de Validação (Checklist)

- [ ] Todo recurso AWS tem nome seguindo `${local.resource_prefix}-[tipo]-[funcional]`.
- [ ] Toda variável de naming (`env`, `domain`, `subdomain`) tem default.
- [ ] Todo recurso tem `tags` com `Environment` e `Project`.
- [ ] DynamoDB usa `PAY_PER_REQUEST`.
- [ ] S3 tem versionamento e encriptação.
- [ ] SQS tem DLQ associada com `redrive_policy`.
- [ ] SNS topic tem subscription para SQS (fan-out).
- [ ] CloudWatch Log Group tem `retention_in_days`.
- [ ] Lambda handler aponta para `dist/lambda.handler`.
- [ ] Lambda runtime é `nodejs22.x`.
- [ ] IAM role segue princípio do menor privilégio.
- [ ] API Gateway v2 usa HTTP protocol com `$default` route.
- [ ] O nome no Terraform é idêntico ao gerado por `BaseProvider.getResourceName()`.
- [ ] O provider AWS aponta para LocalStack endpoints.

## Anti-Patterns (NUNCA fazer)

```hcl
# ❌ ERRADO: Nome hardcoded
resource "aws_dynamodb_table" "main" {
  name = "my-table"
}

# ❌ ERRADO: Provisioned capacity (não é serverless)
resource "aws_dynamodb_table" "main" {
  billing_mode   = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 5
}

# ❌ ERRADO: Sem tags
resource "aws_s3_bucket" "storage" {
  bucket = "${local.resource_prefix}-s3-storage"
}

# ✅ CORRETO: Nome corporativo + tags + serverless
resource "aws_dynamodb_table" "main_table" {
  name         = "${local.resource_prefix}-dynamodb-main"
  billing_mode = "PAY_PER_REQUEST"
  tags = { Environment = var.env, Project = "api-ai" }
}
```

## Adicionando um Novo Recurso (Workflow)

1. **Defina o recurso** no `main.tf` seguindo o template do tipo.
2. **Use `${local.resource_prefix}-[tipo]-[funcional]`** para o nome.
3. **Adicione tags** obrigatórias.
4. **Aplique no LocalStack**: `terraform apply -auto-approve`.
5. **No NestJS**, use `this.getResourceName('[tipo]', '[funcional]')` — o nome será idêntico.
6. **Teste** a conexão.
