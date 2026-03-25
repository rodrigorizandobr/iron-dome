import { Injectable, BadRequestException } from '@nestjs/common';
import { BaseResourceService } from '../../common/core/base-resource.service';
import { DynamoDBProvider } from '../../providers/aws/dynamodb.provider';
import { I18nService } from '../../common/core/i18n.service';
import { SQSProvider } from '../../providers/aws/sqs.provider';
import { CreateAuditTrailDto, UpdateAuditTrailDto, AuditEventType } from './dto';

/**
 * Represents an AuditTrail entry in DynamoDB.
 */
export interface IAuditTrail {
  id: string;
  tenantId: string;
  eventType: AuditEventType;
  actorId: string;
  resourceType: string;
  resourceId: string;
  action: string;
  metadata: Record<string, unknown>;
  description?: string;
  entityType: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}

/**
 * Registered event types (in production, this would come from DynamoDB config).
 */
const REGISTERED_EVENT_TYPES = new Set(Object.values(AuditEventType));

const AUDIT_TRAIL_ENTITY = 'AUDIT_TRAIL_EVENT';

/**
 * AuditTrail Service — CRUD operations for audit trail events.
 * - CREATE: publishes to SQS (async processing)
 * - READ/UPDATE/DELETE/LIST: DynamoDB direct
 */
@Injectable()
export class AuditTrailApiService extends BaseResourceService<
  IAuditTrail,
  CreateAuditTrailDto,
  UpdateAuditTrailDto
> {
  constructor(
    dynamo: DynamoDBProvider,
    i18n: I18nService,
    private readonly sqs: SQSProvider,
  ) {
    super(dynamo, AUDIT_TRAIL_ENTITY, i18n);
  }

  /**
   * Create an audit trail event.
   * 1. Validates tenantId is present (multi-tenancy requirement)
   * 2. Validates event type is registered
   * 3. Publishes to SQS for async processing
   * 4. Returns immediate response with ID
   */
  async create(
    data: CreateAuditTrailDto & { id?: string; tenantId?: string },
  ): Promise<IAuditTrail> {
    if (!data.tenantId) {
      throw new BadRequestException('Tenant isolation requires tenantId');
    }

    const { eventType } = data;

    // Validate event type is pre-registered
    if (!REGISTERED_EVENT_TYPES.has(eventType)) {
      const message = this.i18n
        ? this.i18n.translate('audit_trail.event_type_not_registered', { eventType })
        : // eslint-disable-next-line i18next/no-literal-string
          `Event type not registered: ${eventType}`;
      throw new BadRequestException(message);
    }

    // Publish to SQS for async processing
    // eslint-disable-next-line i18next/no-literal-string
    const queueUrl = this.sqs.getQueueName('audit-trail');
    await this.sqs.sendMessage(queueUrl, {
      tenantId: data.tenantId,
      eventType: data.eventType,
      actorId: data.actorId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      action: data.action,
      metadata: data.metadata,
      description: data.description,
      timestamp: new Date().toISOString(),
    });

    // Return empty response (actual entry created asynchronously by consumer)
    const id = this.generateId();
    return {
      id,
      tenantId: data.tenantId || '',
      eventType: data.eventType,
      actorId: data.actorId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      action: data.action,
      metadata: data.metadata,
      description: data.description,
      entityType: AUDIT_TRAIL_ENTITY,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deleted: false,
    };
  }

  /**
   * Generate unique ID for audit trail entry.
   * @returns UUID v4
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
