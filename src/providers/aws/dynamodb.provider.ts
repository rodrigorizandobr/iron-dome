import { Injectable } from '@nestjs/common';
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  ListTablesCommand,
  AttributeValue,
} from '@aws-sdk/client-dynamodb';
import { ConfigService } from '@nestjs/config';
import { BaseProvider } from '../base.provider';

/**
 * AWS DynamoDB Provider for Single Table Design operations.
 * Extends BaseProvider for standardized naming and logging.
 *
 * @example
 * ```typescript
 * constructor(private readonly dynamo: DynamoDBProvider) {}
 * const tableName = this.dynamo.getResourceName('dynamodb', 'main');
 * await this.dynamo.putItem(tableName, marshall(item));
 * ```
 */
@Injectable()
export class DynamoDBProvider extends BaseProvider {
  private client: DynamoDBClient;

  constructor(protected readonly configService: ConfigService) {
    super(DynamoDBProvider.name, configService);
    this.client = new DynamoDBClient({
      region: this.configService.get<string>('AWS_REGION'),
      endpoint: this.configService.get<string>('AWS_ENDPOINT'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || 'dummy',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || 'dummy',
      },
    });
  }

  /**
   * Inserts or replaces an item in a DynamoDB table.
   *
   * @param tableName - The DynamoDB table name.
   * @param item - The marshalled item attributes.
   */
  async putItem(tableName: string, item: Record<string, AttributeValue>) {
    this.logOperation('putItem', { tableName });
    try {
      const command = new PutItemCommand({ TableName: tableName, Item: item });
      return await this.client.send(command);
    } catch (error) {
      this.handleError('putItem', error);
    }
  }

  /**
   * Retrieves a single item by its primary key.
   *
   * @param tableName - The DynamoDB table name.
   * @param key - The marshalled key attributes (PK + SK).
   */
  async getItem(tableName: string, key: Record<string, AttributeValue>) {
    this.logOperation('getItem', { tableName });
    try {
      const command = new GetItemCommand({ TableName: tableName, Key: key });
      return await this.client.send(command);
    } catch (error) {
      this.handleError('getItem', error);
    }
  }

  /**
   * Checks DynamoDB connectivity by listing tables.
   * Used by health check endpoints.
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.client.send(new ListTablesCommand({ Limit: 1 }));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Queries items by partition key (PK).
   *
   * @param tableName - The DynamoDB table name.
   * @param pk - The partition key value.
   * @param options - Optional pagination params (limit, exclusiveStartKey).
   */
  async query(
    tableName: string,
    pk: string,
    options?: { limit?: number; exclusiveStartKey?: Record<string, AttributeValue> },
  ) {
    this.logOperation('query', { tableName, pk });
    try {
      const command = new QueryCommand({
        TableName: tableName,
        // eslint-disable-next-line i18next/no-literal-string
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': { S: pk } },
        ...(options?.limit && { Limit: options.limit }),
        ...(options?.exclusiveStartKey && { ExclusiveStartKey: options.exclusiveStartKey }),
      });
      return await this.client.send(command);
    } catch (error) {
      this.handleError('query', error);
    }
  }
}
