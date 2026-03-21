import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SqsConsumerService, ISqsMessage } from '../../common/consumers/sqs-consumer.service';

/**
 * Order Processor — consumes messages from the order-processor SQS queue.
 * Handles order lifecycle events (created, updated, deleted).
 */
@Injectable()
export class OrderProcessorService extends SqsConsumerService {
  private readonly processorLogger = new Logger(OrderProcessorService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  /** Process order events from the queue. */
  /* eslint-disable i18next/no-literal-string */
  private static readonly EVENT_CREATED = 'order.created';
  private static readonly EVENT_UPDATED = 'order.updated';
  private static readonly EVENT_DELETED = 'order.deleted';
  /* eslint-enable i18next/no-literal-string */

  protected async handleMessage(message: ISqsMessage): Promise<void> {
    const { body, messageId } = message;
    const event = body.event as string;
    const orderId = body.orderId as string;

    // eslint-disable-next-line i18next/no-literal-string
    this.processorLogger.log(`Processing event=${event} orderId=${orderId} messageId=${messageId}`);

    switch (event) {
      case OrderProcessorService.EVENT_CREATED:
        await this.onOrderCreated(body);
        break;
      case OrderProcessorService.EVENT_UPDATED:
        await this.onOrderUpdated(body);
        break;
      case OrderProcessorService.EVENT_DELETED:
        await this.onOrderDeleted(body);
        break;
      default:
        // eslint-disable-next-line i18next/no-literal-string
        this.processorLogger.warn(`Unknown event: ${event}`);
    }
  }

  /** Handle order creation events. */
  private async onOrderCreated(body: Record<string, unknown>) {
    // eslint-disable-next-line i18next/no-literal-string
    this.processorLogger.log(`Order created: ${body.orderId}`);
  }

  /** Handle order update events. */
  private async onOrderUpdated(body: Record<string, unknown>) {
    // eslint-disable-next-line i18next/no-literal-string
    this.processorLogger.log(`Order updated: ${body.orderId}`);
  }

  /** Handle order deletion events. */
  private async onOrderDeleted(body: Record<string, unknown>) {
    // eslint-disable-next-line i18next/no-literal-string
    this.processorLogger.log(`Order deleted: ${body.orderId}`);
  }
}
