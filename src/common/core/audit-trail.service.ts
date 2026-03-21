import { Injectable, Logger } from '@nestjs/common';
import { DynamoDBProvider } from '../../providers/aws/dynamodb.provider';
import { marshall } from '@aws-sdk/util-dynamodb';

/** Supported audit actions. */
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

interface AuditEntry {
  PK: string;
  SK: string;
  entityType: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  tenantId: string;
  performedBy?: string;
  timestamp: string;
  changes?: Record<string, unknown>;
}

/**
 * Records immutable audit trail entries in DynamoDB.
 * PK: `TENANT#[tenantId]#AUDIT`, SK: `AUDIT#[timestamp]#[resourceType]#[id]`
 */
@Injectable()
export class AuditTrailService {
  private readonly logger = new Logger(AuditTrailService.name);
  private readonly tableName: string;

  constructor(private readonly dynamo: DynamoDBProvider) {
    this.tableName = this.dynamo.getResourceName('dynamodb', 'main');
  }

  /** Records an audit event. Fire-and-forget — never throws to callers. */
  async record(
    tenantId: string,
    action: AuditAction,
    resourceType: string,
    resourceId: string,
    performedBy?: string,
    changes?: Record<string, unknown>,
  ): Promise<void> {
    const timestamp = new Date().toISOString();

    const entry: AuditEntry = {
      // eslint-disable-next-line i18next/no-literal-string
      PK: `TENANT#${tenantId}#AUDIT`,
      // eslint-disable-next-line i18next/no-literal-string
      SK: `AUDIT#${timestamp}#${resourceType}#${resourceId}`,
      entityType: 'AUDIT',
      action,
      resourceType,
      resourceId,
      tenantId,
      performedBy,
      timestamp,
      changes,
    };

    try {
      await this.dynamo.putItem(this.tableName, marshall(entry));
    } catch (error) {
      // Audit must never break the main flow
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Audit write failed: ${msg}`);
    }
  }
}
