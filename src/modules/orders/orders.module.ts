import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { DynamoDBProvider } from '../../providers/aws/dynamodb.provider';
import { SNSProvider } from '../../providers/aws/sns.provider';
import { OrderEventPublisher } from './order-event.publisher';
import { OrderProcessorService } from './order-processor.service';
import { AuditTrailService } from '../../common/core/audit-trail.service';
import { I18nService } from '../../common/core/i18n.service';

/**
 * Orders Module — full CRUD + event-driven architecture.
 * Publishes SNS events on mutations, consumes SQS for async processing.
 */
@Module({
  controllers: [OrdersController],
  providers: [
    OrdersService,
    DynamoDBProvider,
    SNSProvider,
    OrderEventPublisher,
    OrderProcessorService,
    AuditTrailService,
    I18nService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
