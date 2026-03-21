import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SNSProvider } from '../../providers/aws/sns.provider';

/** Standard event payload published to SNS. */
export interface IOrderEvent {
  event: string;
  orderId: string;
  tenantId: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

/**
 * Order Event Publisher — publishes order lifecycle events to SNS.
 * Topic: `[env]-fintech-core-sns-order-events`
 */
@Injectable()
export class OrderEventPublisher {
  private readonly logger = new Logger(OrderEventPublisher.name);
  private readonly topicArn: string;

  constructor(
    private readonly sns: SNSProvider,
    private readonly configService: ConfigService,
  ) {
    const topicName = this.sns.getTopicName('order-events');
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const accountId = this.configService.get<string>('AWS_ACCOUNT_ID', '000000000000');
    // eslint-disable-next-line i18next/no-literal-string
    this.topicArn = `arn:aws:sns:${region}:${accountId}:${topicName}`;
  }

  /** Publish an order.created event. */
  async publishCreated(orderId: string, tenantId: string, data?: Record<string, unknown>) {
    return this.publishEvent('order.created', orderId, tenantId, data);
  }

  /** Publish an order.updated event. */
  async publishUpdated(orderId: string, tenantId: string, data?: Record<string, unknown>) {
    return this.publishEvent('order.updated', orderId, tenantId, data);
  }

  /** Publish an order.deleted event. */
  async publishDeleted(orderId: string, tenantId: string) {
    return this.publishEvent('order.deleted', orderId, tenantId);
  }

  /** Generic event publisher. */
  private async publishEvent(
    event: string,
    orderId: string,
    tenantId: string,
    data?: Record<string, unknown>,
  ) {
    const payload: IOrderEvent = {
      event,
      orderId,
      tenantId,
      timestamp: new Date().toISOString(),
      data,
    };

    try {
      await this.sns.publish(this.topicArn, payload as unknown as Record<string, unknown>);
      this.logger.log(`Published ${event} for order ${orderId}`);
    } catch (error) {
      this.logger.error(`Failed to publish ${event}: ${(error as Error).message}`);
    }
  }
}
