import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { DynamoDBProvider } from '../../providers/aws/dynamodb.provider';
import { I18nService } from '../../common/core/i18n.service';
import { IPaginatedResult, IPaginationOptions } from '../../common/core/base-resource.service';
import { AuditTrailResponseDto } from './dto/audit-trail-response.dto';
import { AuditTrailQueryDto } from './dto/audit-trail-query.dto';

const AUDIT_ENTITY = 'AUDIT';

/**
 * Audit Trails Query Service — read-only access to audit trail entries.
 *
 * Audit entries are written by AuditTrailService and stored under:
 * - PK: `TENANT#[tenantId]#AUDIT`
 * - SK: `AUDIT#[timestamp]#[resourceType]#[resourceId]`
 *
 * The external `id` field is base64-encoded SK for stable, URL-safe retrieval.
 */
@Injectable()
export class AuditTrailsService {
  private readonly tableName: string;

  constructor(
    private readonly dynamo: DynamoDBProvider,
    private readonly i18n: I18nService,
  ) {
    this.tableName = this.dynamo.getResourceName('dynamodb', 'main');
  }

  /** PK for audit entries: `TENANT#[tenantId]#AUDIT` */
  private getPk(tenantId: string): string {
    // eslint-disable-next-line i18next/no-literal-string
    return `TENANT#${tenantId}#${AUDIT_ENTITY}`;
  }

  /** Encode DynamoDB SK to a URL-safe base64 string used as the entry id. */
  private encodeId(sk: string): string {
    return Buffer.from(sk).toString('base64url');
  }

  /** Decode a base64url entry id back to the DynamoDB SK. */
  private decodeId(id: string): string {
    return Buffer.from(id, 'base64url').toString('utf-8');
  }

  /** Map a raw DynamoDB item to a response DTO with a stable `id`. */
  private toResponse(raw: Record<string, unknown>): AuditTrailResponseDto {
    const sk = raw.SK as string;
    return {
      id: this.encodeId(sk),
      tenantId: raw.tenantId as string,
      action: raw.action as AuditTrailResponseDto['action'],
      resourceType: raw.resourceType as string,
      resourceId: raw.resourceId as string,
      performedBy: raw.performedBy as string | undefined,
      timestamp: raw.timestamp as string,
      changes: raw.changes as Record<string, unknown> | undefined,
      entityType: AUDIT_ENTITY,
    };
  }

  /**
   * List all audit trail entries for a tenant with optional filters.
   * Supports cursor-based pagination and filtering by resourceType and action.
   */
  async findAll(
    tenantId: string,
    query: AuditTrailQueryDto,
  ): Promise<IPaginatedResult<AuditTrailResponseDto>> {
    const pk = this.getPk(tenantId);
    const options: IPaginationOptions = { limit: query.limit, cursor: query.cursor };
    const queryOptions: {
      limit?: number;
      exclusiveStartKey?: Record<string, AttributeValue>;
    } = {};

    if (options.limit) queryOptions.limit = options.limit;
    if (options.cursor) {
      queryOptions.exclusiveStartKey = JSON.parse(
        Buffer.from(options.cursor, 'base64').toString('utf-8'),
      ) as Record<string, AttributeValue>;
    }

    try {
      const result = await this.dynamo.query(this.tableName, pk, queryOptions);
      if (!result?.Items) return { items: [] };

      let items = result.Items.map((item) => unmarshall(item) as Record<string, unknown>);

      if (query.resourceType) {
        items = items.filter((item) => item.resourceType === query.resourceType);
      }
      if (query.action) {
        items = items.filter((item) => item.action === query.action);
      }

      const cursor = result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined;

      return { items: items.map((item) => this.toResponse(item)), cursor };
    } catch {
      throw new BadRequestException(
        this.i18n.translate('errors.create_failed', { model: AUDIT_ENTITY }),
      );
    }
  }

  /**
   * Retrieve a single audit trail entry by its base64url-encoded id.
   * The id encodes the DynamoDB SK for a deterministic lookup.
   */
  async findOne(tenantId: string, id: string): Promise<AuditTrailResponseDto> {
    const sk = this.decodeId(id);
    const key = {
      PK: { S: this.getPk(tenantId) },
      SK: { S: sk },
    };

    const result = await this.dynamo.getItem(this.tableName, key);
    if (!result?.Item) {
      throw new NotFoundException(
        this.i18n.translate('errors.not_found', { model: AUDIT_ENTITY, id }),
      );
    }

    const raw = unmarshall(result.Item) as Record<string, unknown>;
    return this.toResponse(raw);
  }
}
