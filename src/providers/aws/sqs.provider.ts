import { Injectable } from '@nestjs/common';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { ConfigService } from '@nestjs/config';
import { BaseProvider } from '../base.provider';

/**
 * AWS SQS Provider for message queuing operations.
 *
 * @example
 * ```typescript
 * // Inject and use
 * constructor(private readonly sqs: SQSProvider) {}
 *
 * // Get a queue URL following corporate naming
 * const queueUrl = this.sqs.getQueueUrl('order-processor');
 * // => "https://sqs.us-east-1.amazonaws.com/000000000000/dev-fintech-core-sqs-order-processor"
 *
 * // Send a message
 * await this.sqs.sendMessage(queueUrl, { orderId: '123', status: 'pending' });
 * ```
 */
@Injectable()
export class SQSProvider extends BaseProvider {
  private client: SQSClient;

  constructor(protected readonly configService: ConfigService) {
    super(SQSProvider.name, configService);
    this.client = new SQSClient({
      region: this.configService.get<string>('AWS_REGION'),
      endpoint: this.configService.get<string>('AWS_ENDPOINT'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || 'dummy',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || 'dummy',
      },
    });
  }

  /**
   * Generates the queue name following the corporate naming standard.
   *
   * @param functionalName - The purpose of the queue (e.g., 'order-processor', 'email-sender').
   * @returns The full queue name: `dev-fintech-core-sqs-order-processor`
   */
  getQueueName(functionalName: string): string {
    return this.getResourceName('sqs', functionalName);
  }

  /**
   * Send a JSON message to a specific SQS queue.
   *
   * @param queueUrl - The full URL of the SQS queue.
   * @param body - The message payload as a JSON object.
   */
  async sendMessage(queueUrl: string, body: Record<string, unknown>) {
    this.logOperation('sendMessage', { queueUrl });
    try {
      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(body),
      });
      return await this.client.send(command);
    } catch (error) {
      this.handleError('sendMessage', error);
    }
  }
}
