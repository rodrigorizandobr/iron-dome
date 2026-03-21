import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/guards/public.decorator';
import { DynamoDBProvider } from '../../providers/aws/dynamodb.provider';

interface IHealthDependency {
  status: string;
}

interface IReadinessResponse {
  status: string;
  uptime: string;
  dependencies: Record<string, IHealthDependency>;
}

/**
 * Health Controller to provide observability endpoints.
 * Used by load balancers and container orchestrators (K8s/AWS ECS).
 */
@Public()
@ApiTags('monitoring')
@Controller('health')
export class HealthController {
  constructor(private readonly dynamoDBProvider: DynamoDBProvider) {}

  @Get()
  @ApiOperation({ summary: 'Liveness check' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Service is alive' })
  getHealth(): Record<string, string> {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check with dependency verification' })
  @ApiResponse({ status: HttpStatus.OK, description: 'All dependencies healthy' })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'One or more dependencies unhealthy',
  })
  async getReady(): Promise<IReadinessResponse> {
    const dynamoOk = await this.dynamoDBProvider.checkHealth();

    return {
      status: dynamoOk ? 'ready' : 'degraded',
      uptime: process.uptime().toFixed(2),
      dependencies: {
        dynamodb: { status: dynamoOk ? 'up' : 'down' },
      },
    };
  }
}
