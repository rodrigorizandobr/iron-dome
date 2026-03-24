import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { MultiTenancyMiddleware } from './common/middlewares/multi-tenancy.middleware';
import { RequestLoggingMiddleware } from './common/middlewares/request-logging.middleware';
import { ObfuscationService } from './common/core/obfuscation.service';
import { AuditTrailService } from './common/core/audit-trail.service';
import { S3Provider } from './providers/aws/s3.provider';
import { SQSProvider } from './providers/aws/sqs.provider';
import { SNSProvider } from './providers/aws/sns.provider';
import { DynamoDBProvider } from './providers/aws/dynamodb.provider';
import { OpenAIProvider } from './providers/openai/openai.provider';
import { SecretsManagerProvider } from './providers/aws/secrets-manager.provider';
import { CloudWatchLogsProvider } from './providers/aws/cloudwatch-logs.provider';
import { I18nService } from './common/core/i18n.service';
import { HealthModule } from './modules/health/health.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AuditTrailModule } from './modules/audit-trail/audit-trail.module';
import { AuthModule } from './common/guards/auth.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    AuthModule,
    HealthModule,
    OrdersModule,
    AuditTrailModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    ObfuscationService,
    AuditTrailService,
    I18nService,
    S3Provider,
    SQSProvider,
    SNSProvider,
    DynamoDBProvider,
    OpenAIProvider,
    SecretsManagerProvider,
    CloudWatchLogsProvider,
  ],
  exports: [
    ObfuscationService,
    AuditTrailService,
    I18nService,
    S3Provider,
    SQSProvider,
    SNSProvider,
    DynamoDBProvider,
    OpenAIProvider,
    SecretsManagerProvider,
    CloudWatchLogsProvider,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MultiTenancyMiddleware, RequestLoggingMiddleware).forRoutes('*');
  }
}
