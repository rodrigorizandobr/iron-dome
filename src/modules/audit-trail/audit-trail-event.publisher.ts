import { Injectable } from '@nestjs/common';
import { SNSProvider } from '../../providers/aws/sns.provider';

/**
 * Publishes audit trail events to SNS topic.
 */
@Injectable()
export class AuditTrailEventPublisher {
  constructor(private readonly sns: SNSProvider) {}

  /**
   * Publish audit trail event created.
   * @param id - Event ID
   * @param tenantId - Tenant ID
   * @param eventData - Event details
   */
  async publishCreated(id: string, tenantId: string, eventData: Record<string, unknown>): Promise<void> {
    const topicArn = this.sns.getTopicArn('audit-trail');
    await this.sns.publish(topicArn, {
      event: 'audit_trail.created',
      id,
      tenantId,
      data: eventData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Publish audit trail event updated.
   * @param id - Event ID
   * @param tenantId - Tenant ID
   * @param eventData - Updated details
   */
  async publishUpdated(id: string, tenantId: string, eventData: Record<string, unknown>): Promise<void> {
    const topicArn = this.sns.getTopicArn('audit-trail');
    await this.sns.publish(topicArn, {
      event: 'audit_trail.updated',
      id,
      tenantId,
      data: eventData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Publish audit trail event deleted.
   * @param id - Event ID
   * @param tenantId - Tenant ID
   */
  async publishDeleted(id: string, tenantId: string): Promise<void> {
    const topicArn = this.sns.getTopicArn('audit-trail');
    await this.sns.publish(topicArn, {
      event: 'audit_trail.deleted',
      id,
      tenantId,
      timestamp: new Date().toISOString(),
    });
  }
}
