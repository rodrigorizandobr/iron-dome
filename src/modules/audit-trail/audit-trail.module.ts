import { Module } from '@nestjs/common';
import { AuditTrailService } from './audit-trail.service';
import { AuditTrailController } from './audit-trail.controller';
import { DynamoDBProvider } from '@/providers/aws/dynamodb.provider';
import { AuditTrailService } from '@/common/core/audit-trail.service';
import { I18nService } from '@/common/core/i18n.service';

@Module({
  providers: [DynamoDBProvider, AuditTrailService, I18nService, AuditTrailService],
  controllers: [AuditTrailController],
  exports: [AuditTrailService],
})
export class AuditTrailModule {}
