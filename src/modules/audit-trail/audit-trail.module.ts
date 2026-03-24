import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditTrailController } from './audit-trail.controller';
import { AuditTrailApiService } from './audit-trail.service';
import { AuditTrailEventPublisher } from './audit-trail-event.publisher';
import { AuditTrailProcessorService } from './audit-trail-processor.service';
import { DynamoDBProvider } from '../../providers/aws/dynamodb.provider';
import { SNSProvider } from '../../providers/aws/sns.provider';
import { SQSProvider } from '../../providers/aws/sqs.provider';
import { I18nService } from '../../common/core/i18n.service';
import { AuditTrailService } from '../../common/core/audit-trail.service';

/**
 * Audit Trail Module.
 * Provides CRUD operations for audit trail events with SQS/DynamoDB integration.
 * - POST creates events to SQS (async)
 * - GET/PATCH/DELETE read/modify from DynamoDB
 * - SQS consumer processes and stores events
 */
@Module({
  controllers: [AuditTrailController],
  providers: [
    AuditTrailApiService,
    AuditTrailEventPublisher,
    AuditTrailProcessorService,
    DynamoDBProvider,
    SNSProvider,
    SQSProvider,
    I18nService,
    AuditTrailService,
  ],
  exports: [AuditTrailApiService, AuditTrailEventPublisher],
})
export class AuditTrailModule implements OnModuleInit {
  constructor(private readonly processor: AuditTrailProcessorService) {}

  /**
   * Start SQS consumer on module initialization.
   * Processes audit trail events asynchronously.
   */
  onModuleInit(): void {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.processor.start();
  }
}
