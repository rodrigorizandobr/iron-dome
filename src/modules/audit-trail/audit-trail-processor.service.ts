import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { DynamoDBProvider } from '../../providers/aws/dynamodb.provider';
import { BaseProvider } from '../../providers/base.provider';
import { marshall } from '@aws-sdk/util-dynamodb';
import { AuditEventType } from './dto';
import { ISqsMessage } from '../../common/consumers/sqs-consumer.service';

const ENTITY_TYPE = 'AUDIT_TRAIL_EVENT';
const QUEUE_NAME = 'audit-trail';

/**
 * SQS Consumer for audit trail events.
 * Polls messages from the audit-trail queue and stores them in DynamoDB.
 */
@Injectable()
export class AuditTrailProcessorService extends BaseProvider implements OnModuleInit {
  private readonly client: SQSClient;
  private readonly queueUrl: string;
  private polling = false;

  constructor(
    protected readonly configService: ConfigService,
    private readonly dynamo: DynamoDBProvider,
  ) {
    super(AuditTrailProcessorService.name, configService);
    this.client = new SQSClient(this.getAwsConfig());

    const queueName = this.getResourceName('sqs', QUEUE_NAME);
    const { endpoint } = this.getAwsConfig();
    const accountId = this.configService.get<string>('AWS_ACCOUNT_ID', '000000000000');
    this.queueUrl = `${endpoint}/${accountId}/${queueName}`;
  }

  /** Starts polling on module initialization. */
  onModuleInit() {
    const enabled = this.configService.get<string>('SQS_CONSUMER_ENABLED', 'false');
    if (enabled === 'true') {
      this.startPolling();
    }
  }

  /** Begin long-polling. */
  startPolling() {
    this.polling = true;
    this.logger.log('Audit trail consumer started');
    void this.poll();
  }

  /** Stop polling. */
  stop() {
    this.polling = false;
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

  /** Process a single audit trail message. */
  private async handleMessage(message: ISqsMessage): Promise<void> {
    const body = message.body;
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
    } = body;

    if (
      !tenantId ||
      !eventType ||
      !actorId ||
      !resourceType ||
      !resourceId ||
      !action ||
      !timestamp
    ) {
      this.logger.error('Missing required fields in audit trail message');
      return;
    }

    if (!Object.values(AuditEventType).includes(eventType as AuditEventType)) {
      this.logger.warn(`Unregistered event type: ${String(eventType)}`);
      return;
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = new Date().toISOString();
    const tableName = this.getResourceName('dynamodb', ENTITY_TYPE);

    // eslint-disable-next-line i18next/no-literal-string
    const pk = `TENANT#${String(tenantId)}#${ENTITY_TYPE}`;
    const sk = `${ENTITY_TYPE}#${id}`;

    await this.dynamo.putItem(
      tableName,
      marshall({
        PK: pk,
        SK: sk,
        id,
        tenantId: String(tenantId),
        eventType: String(eventType),
        actorId: String(actorId),
        resourceType: String(resourceType),
        resourceId: String(resourceId),
        action: String(action),
        metadata: metadata ?? {},
        description: description ? String(description) : undefined,
        entityType: ENTITY_TYPE,
        createdAt: String(timestamp),
        updatedAt: now,
        deleted: false,
      }),
    );

    this.logger.log(`Audit event saved: ${id}`);
  }

  /** Delete message after processing. */
  private async deleteMessage(receiptHandle: string) {
    const command = new DeleteMessageCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle,
    });
    await this.client.send(command);
  }

  /** Utility sleep for backoff. */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
