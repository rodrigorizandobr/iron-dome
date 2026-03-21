import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DynamoDBProvider } from '../../providers/aws/dynamodb.provider';

/**
 * Health Module for application monitoring.
 */
@Module({
  controllers: [HealthController],
  providers: [DynamoDBProvider],
})
export class HealthModule {}
