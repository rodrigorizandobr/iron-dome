provider "aws" {
  region                      = var.aws_region
  access_key                  = "mock_access_key"
  secret_key                  = "mock_secret_key"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  endpoints {
    dynamodb       = "http://localhost:4566"
    s3             = "http://s3.localhost.localstack.cloud:4566"
    sqs            = "http://localhost:4566"
    sns            = "http://localhost:4566"
    lambda         = "http://localhost:4566"
    iam            = "http://localhost:4566"
    cloudwatchlogs = "http://localhost:4566"
    apigateway     = "http://localhost:4566"
  }
}

variable "aws_region" { default = "us-east-1" }
variable "domain"     { default = "fintech" }
variable "subdomain"  { default = "core" }
variable "env"        { default = "dev" } # Maps to AppEnvironment.DEVELOPMENT

locals {
  # Pattern: [AMBIENTE]-[DOMÍNIO]-[SUBDOMÍNIO]
  resource_prefix = "${var.env}-${var.domain}-${var.subdomain}"
}

# --- DynamoDB Single Table (Functional: main) ---
resource "aws_dynamodb_table" "main_table" {
  name         = "${local.resource_prefix}-dynamodb-main"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "entityType"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI1"
    projection_type = "ALL"
    hash_key        = "entityType"
    range_key       = "SK"
  }

  tags = { Environment = var.env, Project = "iron-dome" }
}

# --- S3 (Functional: storage) ---
resource "aws_s3_bucket" "app_storage" {
  bucket = "${local.resource_prefix}-s3-storage"
  tags   = { Environment = var.env, Project = "iron-dome" }
}

resource "aws_s3_bucket_versioning" "app_storage_versioning" {
  bucket = aws_s3_bucket.app_storage.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "app_storage_encryption" {
  bucket = aws_s3_bucket.app_storage.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# --- SQS (Functional: order-processor) ---
resource "aws_sqs_queue" "order_processor_dlq" {
  name = "${local.resource_prefix}-sqs-order-processor-dlq"
  tags = { Environment = var.env, Project = "iron-dome" }
}

resource "aws_sqs_queue" "app_queue" {
  name                       = "${local.resource_prefix}-sqs-order-processor"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 86400

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.order_processor_dlq.arn
    maxReceiveCount     = 3
  })

  tags = { Environment = var.env, Project = "iron-dome" }
}

# --- SNS (Functional: order-events) ---
resource "aws_sns_topic" "order_events" {
  name = "${local.resource_prefix}-sns-order-events"
  tags = { Environment = var.env, Project = "iron-dome" }
}

# Subscribe order-processor SQS queue to the order-events SNS topic
resource "aws_sns_topic_subscription" "order_events_to_sqs" {
  topic_arn = aws_sns_topic.order_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.app_queue.arn
}

# --- CloudWatch Log Group (Functional: api) ---
resource "aws_cloudwatch_log_group" "api_logs" {
  name              = "/api/${local.resource_prefix}-logs-api"
  retention_in_days = 30
  tags              = { Environment = var.env, Project = "iron-dome" }
}

# --- IAM Role for Lambda ---
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

  tags = { Environment = var.env, Project = "iron-dome" }
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
        Resource = [
          aws_sqs_queue.app_queue.arn,
          aws_sqs_queue.order_processor_dlq.arn,
          aws_sqs_queue.audit_trail_queue.arn,
          aws_sqs_queue.audit_trail_dlq.arn
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["sns:Publish"]
        Resource = [
          aws_sns_topic.order_events.arn,
          aws_sns_topic.audit_trail_events.arn
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["logs:*"]
        Resource = ["${aws_cloudwatch_log_group.api_logs.arn}:*"]
      },
    ]
  })
}

# --- Lambda Function (Functional: api-handler) ---
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

  tags = { Environment = var.env, Project = "iron-dome" }
}

# --- SQS (Functional: audit-trail) ---
resource "aws_sqs_queue" "audit_trail_dlq" {
  name = "${local.resource_prefix}-sqs-audit-trail-dlq"
  tags = { Environment = var.env, Project = "iron-dome" }
}

resource "aws_sqs_queue" "audit_trail_queue" {
  name                       = "${local.resource_prefix}-sqs-audit-trail"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 86400

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.audit_trail_dlq.arn
    maxReceiveCount     = 3
  })

  tags = { Environment = var.env, Project = "iron-dome" }
}

# --- SNS (Functional: audit-trail-events) ---
resource "aws_sns_topic" "audit_trail_events" {
  name = "${local.resource_prefix}-sns-audit-trail-events"
  tags = { Environment = var.env, Project = "iron-dome" }
}

# Subscribe audit-trail SQS queue to the audit-trail-events SNS topic
resource "aws_sns_topic_subscription" "audit_trail_events_to_sqs" {
  topic_arn = aws_sns_topic.audit_trail_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.audit_trail_queue.arn
}

# --- API Gateway (REST API) ---
resource "aws_api_gateway_rest_api" "http_api" {
  name = "${local.resource_prefix}-apigw-http"
  tags = { Environment = var.env, Project = "iron-dome" }
}

resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.http_api.id
  parent_id   = aws_api_gateway_rest_api.http_api.root_resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "proxy_any" {
  rest_api_id   = aws_api_gateway_rest_api.http_api.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda_integration" {
  rest_api_id             = aws_api_gateway_rest_api.http_api.id
  resource_id             = aws_api_gateway_resource.proxy.id
  http_method             = aws_api_gateway_method.proxy_any.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api_handler.invoke_arn
}

resource "aws_api_gateway_deployment" "api_deployment" {
  rest_api_id = aws_api_gateway_rest_api.http_api.id
  depends_on  = [aws_api_gateway_integration.lambda_integration]
}

resource "aws_api_gateway_stage" "default_stage" {
  deployment_id = aws_api_gateway_deployment.api_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.http_api.id
  stage_name    = var.env
  tags          = { Environment = var.env, Project = "iron-dome" }
}

resource "aws_lambda_permission" "apigw_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.http_api.execution_arn}/*/*"
}
