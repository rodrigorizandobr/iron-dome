import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DynamoDBProvider } from '../../providers/aws/dynamodb.provider';
import { I18nService } from './i18n.service';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

/**
 * Enterprise Base CRUD Service for DynamoDB (NoSQL).
 *
 * Architecture: 100% Serverless, Multi-tenant, Single Table Design.
 * Isolation: Logical via TenantId prefix in PK.
 * Deletion: Soft-delete (attribute `deleted: true`).
 *
 * @example
 * ```typescript
 * // 1. Define your entity and DTOs
 * interface User { id: string; tenantId: string; name: string; email: string; }
 * interface CreateUserDto { tenantId: string; name: string; email: string; }
 * interface UpdateUserDto { name?: string; email?: string; }
 *
 * // 2. Create your service extending BaseResourceService
 * @Injectable()
 * export class UsersService extends BaseResourceService<User, CreateUserDto, UpdateUserDto> {
 *   constructor(dynamo: DynamoDBProvider, i18n: I18nService) {
 *     super(dynamo, 'USER', i18n);
 *   }
 * }
 *
 * // 3. Use it in your controller
 * const users = await this.usersService.findAll('tenant-abc');
 * const user  = await this.usersService.findOne('tenant-abc', '12345');
 * const created = await this.usersService.create({ tenantId: 'tenant-abc', name: 'Rodrigo', email: 'r@ci9.com' });
 * const updated = await this.usersService.update('tenant-abc', '12345', { name: 'Rodrigo S.' });
 * const removed = await this.usersService.remove('tenant-abc', '12345'); // Soft-delete
 * ```
 *
 * ## DynamoDB Key Design (Single Table):
 * | Key | Format                           | Example                      |
 * |-----|----------------------------------|------------------------------|
 * | PK  | `TENANT#[tenantId]#[ENTITY]`     | `TENANT#abc#USER`            |
 * | SK  | `[ENTITY]#[id]`                  | `USER#12345`                 |
 */
export interface IBaseResource<T, CreateDto, UpdateDto> {
  create(data: CreateDto): Promise<T>;
  findAll(tenantId: string, options?: IPaginationOptions): Promise<IPaginatedResult<T>>;
  findOne(tenantId: string, id: string): Promise<T>;
  update(tenantId: string, id: string, data: UpdateDto): Promise<T>;
  remove(tenantId: string, id: string): Promise<T>;
}

/** Options for cursor-based DynamoDB pagination. */
export interface IPaginationOptions {
  limit?: number;
  cursor?: string;
}

/** Paginated result with items and optional next cursor. */
export interface IPaginatedResult<T> {
  items: T[];
  cursor?: string;
}

type DynamoAttributeValue = import('@aws-sdk/client-dynamodb').AttributeValue;

@Injectable()
export abstract class BaseResourceService<T, CreateDto, UpdateDto>
  implements IBaseResource<T, CreateDto, UpdateDto>
{
  protected readonly tableName: string;

  constructor(
    protected readonly dynamo: DynamoDBProvider,
    protected readonly entityName: string,
    protected readonly i18n?: I18nService,
  ) {
    this.tableName = this.dynamo.getResourceName('dynamodb', 'main');
  }

  /** PK: `TENANT#[tenantId]#[ENTITY]` */
  protected getPk(tenantId: string): string {
    // eslint-disable-next-line i18next/no-literal-string
    return `TENANT#${tenantId}#${this.entityName}`;
  }

  /** SK: `[ENTITY]#[id]` */
  protected getSk(id: string): string {
    return `${this.entityName}#${id}`;
  }

  async create(data: CreateDto & { id?: string; tenantId?: string }): Promise<T> {
    const id = data.id || Date.now().toString();
    const tenantId = data.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant isolation requires tenantId');
    }

    const item = {
      ...data,
      PK: this.getPk(tenantId),
      SK: this.getSk(id),
      id,
      entityType: this.entityName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deleted: false,
    };

    try {
      await this.dynamo.putItem(this.tableName, marshall(item));
      return item as unknown as T;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const message = this.i18n
        ? this.i18n.translate('errors.create_failed', { model: this.entityName })
        // eslint-disable-next-line i18next/no-literal-string
        : `Error creating ${this.entityName}: ${errMsg}`;
      throw new BadRequestException(message);
    }
  }

  async findOne(tenantId: string, id: string): Promise<T> {
    const key = {
      PK: { S: this.getPk(tenantId) },
      SK: { S: this.getSk(id) },
    };

    const result = await this.dynamo.getItem(this.tableName, key);

    if (!result || !result.Item) {
      const message = this.i18n
        ? this.i18n.translate('errors.not_found', { model: this.entityName, id })
        // eslint-disable-next-line i18next/no-literal-string
        : `${this.entityName} with ID ${id} not found`;
      throw new NotFoundException(message);
    }

    const item = unmarshall(result.Item) as Record<string, unknown>;
    if (item.deleted) {
      const msg = this.i18n
        ? this.i18n.translate('errors.not_found', { model: this.entityName, id })
        // eslint-disable-next-line i18next/no-literal-string
        : `${this.entityName} with ID ${id} not found`;
      throw new NotFoundException(msg);
    }

    return item as T;
  }

  async findAll(tenantId: string, options?: IPaginationOptions): Promise<IPaginatedResult<T>> {
    const pk = this.getPk(tenantId);
    try {
      const queryOptions: { limit?: number; exclusiveStartKey?: Record<string, DynamoAttributeValue> } = {};

      if (options?.limit) {
        queryOptions.limit = options.limit;
      }
      if (options?.cursor) {
        queryOptions.exclusiveStartKey = JSON.parse(
          Buffer.from(options.cursor, 'base64').toString('utf-8'),
        ) as Record<string, DynamoAttributeValue>;
      }

      const result = await this.dynamo.query(this.tableName, pk, queryOptions);

      if (!result || !result.Items) return { items: [] };

      const items = result.Items
        .map((item) => unmarshall(item) as Record<string, unknown>)
        .filter((item) => !item.deleted) as unknown as T[];

      const cursor = result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined;

      return { items, cursor };
    } catch {
      throw new BadRequestException(`Failed to fetch records for ${this.entityName}`);
    }
  }

  async update(tenantId: string, id: string, data: UpdateDto): Promise<T> {
    const existing = await this.findOne(tenantId, id);
    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    await this.dynamo.putItem(this.tableName, marshall(updated));
    return updated as unknown as T;
  }

  async remove(tenantId: string, id: string): Promise<T> {
    const existing = await this.findOne(tenantId, id);
    const deleted = {
      ...existing,
      deleted: true,
      updatedAt: new Date().toISOString(),
    };
    await this.dynamo.putItem(this.tableName, marshall(deleted));
    return deleted as unknown as T;
  }
}
