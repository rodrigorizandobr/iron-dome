import { Injectable } from '@nestjs/common';
import { BaseResourceService } from '@/common/core/base-resource.service';
import { DynamoDBProvider } from '@/providers/aws/dynamodb.provider';
import { AuditTrailService } from '@/common/core/audit-trail.service';
import { I18nService } from '@/common/core/i18n.service';

@Injectable()
export class AuditTrailService extends BaseResourceService<AuditTrailEntity> {
  constructor(
    dynamoDBProvider: DynamoDBProvider,
    auditTrailService: AuditTrailService,
    i18nService: I18nService,
  ) {
    super('AUDIT-TRAIL', dynamoDBProvider, auditTrailService, i18nService);
  }
}

export interface AuditTrailEntity {
  id: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}
