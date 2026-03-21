import { Injectable } from '@nestjs/common';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { ConfigService } from '@nestjs/config';
import { BaseProvider } from '../base.provider';

/**
 * AWS SNS Provider for pub/sub notification operations.
 *
 * @example
 * ```typescript
 * // Inject and use
 * constructor(private readonly sns: SNSProvider) {}
 *
 * // Get a topic name following corporate naming
 * const topicName = this.sns.getTopicName('payment-events');
 * // => "dev-fintech-core-sns-payment-events"
 *
 * // Publish a notification
 * await this.sns.publish(topicArn, { event: 'payment.completed', amount: 100 });
 * ```
 */
@Injectable()
export class SNSProvider extends BaseProvider {
  private client: SNSClient;

  constructor(protected readonly configService: ConfigService) {
    super(SNSProvider.name, configService);
    this.client = new SNSClient({
      region: this.configService.get<string>('AWS_REGION'),
      endpoint: this.configService.get<string>('AWS_ENDPOINT'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || 'dummy',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || 'dummy',
      },
    });
  }

  /**
   * Generates the topic name following the corporate naming standard.
   *
   * @param functionalName - The purpose of the topic (e.g., 'payment-events', 'user-notifications').
   * @returns The full topic name: `dev-fintech-core-sns-payment-events`
   */
  getTopicName(functionalName: string): string {
    return this.getResourceName('sns', functionalName);
  }

  /**
   * Publish a notification message to a specific SNS topic.
   *
   * @param topicArn - The ARN of the SNS topic.
   * @param message - The message payload as a JSON object.
   */
  async publish(topicArn: string, message: Record<string, unknown>) {
    this.logOperation('publish', { topicArn });
    try {
      const command = new PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify(message),
      });
      return await this.client.send(command);
    } catch (error) {
      this.handleError('publish', error);
    }
  }
}
