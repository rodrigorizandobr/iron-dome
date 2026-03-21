import { Injectable } from '@nestjs/common';
import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  PutLogEventsCommand,
  ResourceAlreadyExistsException,
} from '@aws-sdk/client-cloudwatch-logs';
import { ConfigService } from '@nestjs/config';
import { BaseProvider } from '../base.provider';

/**
 * AWS CloudWatch Logs Provider.
 * Supports structured log shipping to CloudWatch Log Groups.
 */
@Injectable()
export class CloudWatchLogsProvider extends BaseProvider {
  private client: CloudWatchLogsClient;
  private sequenceToken?: string;
  private logGroupName: string;
  private logStreamName: string;

  constructor(protected readonly configService: ConfigService) {
    super(CloudWatchLogsProvider.name, configService);
    this.client = new CloudWatchLogsClient({
      region: this.configService.get<string>('AWS_REGION'),
      endpoint: this.configService.get<string>('AWS_ENDPOINT'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || 'dummy',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || 'dummy',
      },
    });
    this.logGroupName = this.getResourceName('logs', 'api');
    // eslint-disable-next-line i18next/no-literal-string
    this.logStreamName = `stream-${Date.now()}`;
  }

  /** Ensures the log group and stream exist. */
  async ensureLogGroup(): Promise<void> {
    try {
      await this.client.send(new CreateLogGroupCommand({ logGroupName: this.logGroupName }));
    } catch (error) {
      if (!(error instanceof ResourceAlreadyExistsException)) {
        this.handleError('createLogGroup', error);
      }
    }
    try {
      await this.client.send(new CreateLogStreamCommand({
        logGroupName: this.logGroupName,
        logStreamName: this.logStreamName,
      }));
    } catch (error) {
      if (!(error instanceof ResourceAlreadyExistsException)) {
        this.handleError('createLogStream', error);
      }
    }
  }

  /**
   * Ships a structured log entry to CloudWatch.
   *
   * @param message - JSON-stringified log payload.
   */
  async putLog(message: string): Promise<void> {
    this.logOperation('putLog', { logGroup: this.logGroupName });
    try {
      const result = await this.client.send(new PutLogEventsCommand({
        logGroupName: this.logGroupName,
        logStreamName: this.logStreamName,
        sequenceToken: this.sequenceToken,
        logEvents: [{ timestamp: Date.now(), message }],
      }));
      this.sequenceToken = result.nextSequenceToken;
    } catch (error) {
      this.handleError('putLog', error);
    }
  }
}
