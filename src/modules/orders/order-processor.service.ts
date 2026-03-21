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
  protected async handleMessage(message: ISqsMessage): Promise<void> {
    const { body, messageId } = message;
    const event = body.event as string;
    const orderId = body.orderId as string;

    this.processorLogger.log(
      `Processing event=${event} orderId=${orderId} messageId=${messageId}`,
    );

    switch (event) {
      case 'order.created':
        await this.onOrderCreated(body);
        break;
      case 'order.updated':
        await this.onOrderUpdated(body);
        break;
      case 'order.deleted':
        await this.onOrderDeleted(body);
        break;
      default:
        this.processorLogger.warn(`Unknown event: ${event}`);
    }
  }

  /** Handle order creation events. */
  private async onOrderCreated(body: Record<string, unknown>) {
    this.processorLogger.log(`Order created: ${body.orderId}`);
  }

  /** Handle order update events. */
  private async onOrderUpdated(body: Record<string, unknown>) {
    this.processorLogger.log(`Order updated: ${body.orderId}`);
  }

  /** Handle order deletion events. */
  private async onOrderDeleted(body: Record<string, unknown>) {
    this.processorLogger.log(`Order deleted: ${body.orderId}`);
  }
}
