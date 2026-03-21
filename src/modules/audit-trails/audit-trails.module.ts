import { Module } from '@nestjs/common';
import { AuditTrailsController } from './audit-trails.controller';
import { AuditTrailsService } from './audit-trails.service';
import { DynamoDBProvider } from '../../providers/aws/dynamodb.provider';
import { I18nService } from '../../common/core/i18n.service';

/**
 * Audit Trails Module — read-only REST API for audit trail records.
 * Audit entries are created internally via AuditTrailService on every CUD operation.
 */
@Module({
  controllers: [AuditTrailsController],
  providers: [AuditTrailsService, DynamoDBProvider, I18nService],
  exports: [AuditTrailsService],
})
export class AuditTrailsModule {}
