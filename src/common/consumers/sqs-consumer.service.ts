import { Injectable, OnModuleInit } from '@nestjs/common';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { ConfigService } from '@nestjs/config';
import { BaseProvider } from '../../providers/base.provider';

/** Shape of a processed SQS message. */
export interface ISqsMessage {
  messageId: string;
  body: Record<string, unknown>;
  receiptHandle: string;
}

/**
 * SQS Consumer Service.
 * Polls messages from the order-processor queue on startup.
 * Override `handleMessage()` in subclasses for custom processing.
 */
@Injectable()
export class SqsConsumerService extends BaseProvider implements OnModuleInit {
  private readonly client: SQSClient;
  private readonly queueUrl: string;
  private polling = false;

  constructor(protected readonly configService: ConfigService) {
    super(SqsConsumerService.name, configService);
    this.client = new SQSClient(this.getAwsConfig());

    const queueName = this.getResourceName('sqs', 'order-processor');
    const { endpoint, region } = this.getAwsConfig();
    const accountId = this.configService.get<string>('AWS_ACCOUNT_ID', '000000000000');
    this.queueUrl = `${endpoint}/${accountId}/${queueName}`;
    this.logger.log(`Queue URL: ${this.queueUrl}, Region: ${region}`);
  }

  /** Starts polling on module initialization. */
  onModuleInit() {
    const enabled = this.configService.get<string>('SQS_CONSUMER_ENABLED', 'false');
    if (enabled === 'true') {
      this.startPolling();
    }
  }

  /** Begin long-polling the SQS queue. */
  private startPolling() {
    this.polling = true;
    this.logger.log('SQS Consumer started polling');
    void this.poll();
  }

  /** Stop the polling loop. */
  stop() {
    this.polling = false;
    this.logger.log('SQS Consumer stopped');
  }

  /** Main polling loop. */
  private async poll() {
    while (this.polling) {
      try {
        const command = new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20,
        });
        const response = await this.client.send(command);

        if (response.Messages) {
          for (const msg of response.Messages) {
            if (!msg.Body || !msg.ReceiptHandle) continue;
            const parsed: ISqsMessage = {
              messageId: msg.MessageId || '',
              body: JSON.parse(msg.Body) as Record<string, unknown>,
              receiptHandle: msg.ReceiptHandle,
            };
            await this.handleMessage(parsed);
            await this.deleteMessage(msg.ReceiptHandle);
          }
        }
      } catch (error) {
        this.handleError('poll', error);
        await this.sleep(5000);
      }
    }
  }

  /** Process a single message. Override in subclasses. */
  protected async handleMessage(message: ISqsMessage): Promise<void> {
    this.logOperation('handleMessage', { messageId: message.messageId });
  }

  /** Delete a message after successful processing. */
  private async deleteMessage(receiptHandle: string) {
    const command = new DeleteMessageCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle,
    });
    await this.client.send(command);
  }

  /** Utility sleep for backoff on errors. */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
