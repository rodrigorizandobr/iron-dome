import { Module } from '@nestjs/common';
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
 * - POST creates events to SQS (async)
 * - GET/PATCH/DELETE read/modify from DynamoDB
 * - SQS consumer processes and stores events on module init
 */
@Module({
  controllers: [AuditTrailController],
  providers: [
    AuditTrailApiService,
    AuditTrailEventPublisher,
    AuditTrailProcessorService,
    ConfigService,
    DynamoDBProvider,
    SNSProvider,
    SQSProvider,
    I18nService,
    AuditTrailService,
  ],
  exports: [AuditTrailApiService, AuditTrailEventPublisher],
})
export class AuditTrailModule {}
