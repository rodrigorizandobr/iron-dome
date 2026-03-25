import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SNSProvider } from '../../providers/aws/sns.provider';

/** Standard event payload published to SNS. */
export interface IAuditTrailEvent {
  event: string;
  id: string;
  tenantId: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

/**
 * Audit Trail Event Publisher — publishes lifecycle events to SNS.
 * Topic: `[env]-fintech-core-sns-audit-trail-events`
 */
@Injectable()
export class AuditTrailEventPublisher {
  private readonly logger = new Logger(AuditTrailEventPublisher.name);
  private readonly topicArn: string;

  /* eslint-disable i18next/no-literal-string */
  private static readonly EVENT_CREATED = 'audit_trail.created';
  private static readonly EVENT_UPDATED = 'audit_trail.updated';
  private static readonly EVENT_DELETED = 'audit_trail.deleted';
  private static readonly TOPIC_NAME = 'audit-trail-events';
  /* eslint-enable i18next/no-literal-string */

  constructor(
    private readonly sns: SNSProvider,
    private readonly configService: ConfigService,
  ) {
    const topicName = this.sns.getTopicName(AuditTrailEventPublisher.TOPIC_NAME);
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const accountId = this.configService.get<string>('AWS_ACCOUNT_ID', '000000000000');
    // eslint-disable-next-line i18next/no-literal-string
    this.topicArn = `arn:aws:sns:${region}:${accountId}:${topicName}`;
  }

  /** Publish an audit_trail.created event. */
  async publishCreated(id: string, tenantId: string, data?: Record<string, unknown>) {
    return this.publishEvent(AuditTrailEventPublisher.EVENT_CREATED, id, tenantId, data);
  }

  /** Publish an audit_trail.updated event. */
  async publishUpdated(id: string, tenantId: string, data?: Record<string, unknown>) {
    return this.publishEvent(AuditTrailEventPublisher.EVENT_UPDATED, id, tenantId, data);
  }

  /** Publish an audit_trail.deleted event. */
  async publishDeleted(id: string, tenantId: string) {
    return this.publishEvent(AuditTrailEventPublisher.EVENT_DELETED, id, tenantId);
  }

  /** Generic event publisher. */
  private async publishEvent(
    event: string,
    id: string,
    tenantId: string,
    data?: Record<string, unknown>,
  ) {
    const payload: IAuditTrailEvent = {
      event,
      id,
      tenantId,
      timestamp: new Date().toISOString(),
      data,
    };

    try {
      await this.sns.publish(this.topicArn, payload as unknown as Record<string, unknown>);
      this.logger.log(`Published ${event} for audit ${id}`);
    } catch (error) {
      this.logger.error(`Failed to publish ${event}: ${(error as Error).message}`);
    }
  }
}
