import { Injectable, Logger } from '@nestjs/common';
import { SqsConsumerService } from '../../common/consumers/sqs-consumer.service';
import { SQSProvider } from '../../providers/aws/sqs.provider';
import { DynamoDBProvider } from '../../providers/aws/dynamodb.provider';
import { AuditEventType } from './dto';

/**
 * SQS Consumer for audit trail events.
 * Processes messages from the audit-trail SQS queue and stores them in DynamoDB.
 */
@Injectable()
export class AuditTrailProcessorService extends SqsConsumerService {
  private readonly logger = new Logger(AuditTrailProcessorService.name);

  constructor(
    private readonly sqs: SQSProvider,
    private readonly dynamo: DynamoDBProvider,
  ) {
    super();
  }

  /**
   * Process a single audit trail message.
   * Validates event type and stores to DynamoDB.
   * @param message - SQS message body (JSON)
   */
  async processMessage(message: unknown): Promise<void> {
    if (typeof message !== 'object' || !message) {
      this.logger.error('Invalid message format');
      return;
    }

    const msg = message as Record<string, unknown>;
    const {
      tenantId,
      eventType,
      actorId,
      resourceType,
      resourceId,
      action,
      metadata,
      description,
      timestamp,
    } = msg;

    // Validate required fields
    if (
      !tenantId ||
      !eventType ||
      !actorId ||
      !resourceType ||
      !resourceId ||
      !action ||
      !timestamp
    ) {
      this.logger.error(`Missing required fields: ${JSON.stringify(msg)}`);
      return;
    }

    // Validate event type is registered
    if (!Object.values(AuditEventType).includes(eventType as AuditEventType)) {
      this.logger.warn(`Unregistered event type: ${eventType}`);
      return;
    }

    // Generate audit trail ID
    const id = this.generateId();
    const now = new Date().toISOString();

    // Insert into DynamoDB
    const pk = `TENANT#${tenantId}#AUDIT_TRAIL_EVENT`;
    const sk = `AUDIT_TRAIL_EVENT#${id}`;

    await this.dynamo.putItem({
      PK: pk,
      SK: sk,
      id,
      tenantId: String(tenantId),
      eventType: String(eventType),
      actorId: String(actorId),
      resourceType: String(resourceType),
      resourceId: String(resourceId),
      action: String(action),
      metadata: metadata as Record<string, unknown>,
      description: description as string | undefined,
      entityType: 'AUDIT_TRAIL_EVENT',
      createdAt: String(timestamp),
      updatedAt: now,
      deleted: false,
    });

    this.logger.log(`Audit trail event saved: ${id} (${eventType})`);
  }

  /**
   * Start consuming messages from the audit-trail SQS queue.
   */
  async start(): Promise<void> {
    const queueUrl = this.sqs.getQueueName('audit-trail');
    this.logger.log(`Starting audit trail consumer: ${queueUrl}`);

    while (true) {
      try {
        // Long-poll with 20s wait time
        const messages = await this.sqs.receiveMessage(queueUrl, 10, 20);

        for (const message of messages) {
          try {
            const body = JSON.parse(message.Body || '{}');
            await this.processMessage(body);

            // Delete message after successful processing
            if (message.ReceiptHandle) {
              await this.sqs.deleteMessage(queueUrl, message.ReceiptHandle);
            }
          } catch (error) {
            this.logger.error(`Failed to process message: ${error}`);
          }
        }
      } catch (error) {
        this.logger.error(`Consumer error: ${error}`);
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  /**
   * Generate unique ID for audit trail entry.
   * @returns ID string
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
