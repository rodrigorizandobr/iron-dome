import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditTrailApiService } from './audit-trail.service';
import { DynamoDBProvider } from '../../providers/aws/dynamodb.provider';
import { I18nService } from '../../common/core/i18n.service';
import { SQSProvider } from '../../providers/aws/sqs.provider';
import { AuditEventType } from './dto';

describe('AuditTrailApiService', () => {
  let service: AuditTrailApiService;

  const mockDynamo = {
    getResourceName: jest.fn().mockReturnValue('test-table'),
    putItem: jest.fn().mockResolvedValue({}),
    getItem: jest.fn(),
    query: jest.fn(),
  };

  const mockI18n = {
    translate: jest.fn((key: string) => key),
  };

  const mockSqs = {
    getQueueName: jest.fn().mockReturnValue('http://localhost:4566/000000000000/test-queue'),
    sendMessage: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditTrailApiService,
        { provide: DynamoDBProvider, useValue: mockDynamo },
        { provide: I18nService, useValue: mockI18n },
        { provide: SQSProvider, useValue: mockSqs },
      ],
    }).compile();
    service = module.get<AuditTrailApiService>(AuditTrailApiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const validPayload = {
      tenantId: 'tenant-A',
      eventType: AuditEventType.TRANSACTION_CREATED,
      actorId: 'user-123',
      resourceType: 'TRANSACTION',
      resourceId: 'txn-456',
      action: 'CREATE',
      metadata: { amount: 1000, currency: 'BRL' },
      description: 'Payment created',
    };

    it('should throw BadRequestException if tenantId is missing', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tenantId: _tenantId, ...withoutTenant } = validPayload;
      await expect(service.create(withoutTenant as never)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for unregistered event type', async () => {
      await expect(
        service.create({
          ...validPayload,
          eventType: 'INVALID_EVENT_TYPE' as AuditEventType,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should publish to SQS for registered event type', async () => {
      const result = await service.create(validPayload);

      expect(mockSqs.sendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          tenantId: 'tenant-A',
          eventType: AuditEventType.TRANSACTION_CREATED,
          actorId: 'user-123',
          resourceType: 'TRANSACTION',
          resourceId: 'txn-456',
          action: 'CREATE',
          metadata: { amount: 1000, currency: 'BRL' },
        }),
      );
      expect(result).toBeDefined();
    });

    it('should return immediate response without writing to DynamoDB', async () => {
      const result = await service.create(validPayload);

      expect(mockDynamo.putItem).not.toHaveBeenCalled();
      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('tenant-A');
      expect(result.eventType).toBe(AuditEventType.TRANSACTION_CREATED);
      expect(result.actorId).toBe('user-123');
      expect(result.resourceType).toBe('TRANSACTION');
      expect(result.resourceId).toBe('txn-456');
      expect(result.action).toBe('CREATE');
      expect(result.deleted).toBe(false);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should support all registered event types', async () => {
      for (const eventType of Object.values(AuditEventType)) {
        jest.clearAllMocks();
        mockSqs.sendMessage.mockResolvedValue({});
        const result = await service.create({ ...validPayload, eventType });
        expect(result.eventType).toBe(eventType);
        expect(mockSqs.sendMessage).toHaveBeenCalledTimes(1);
      }
    });

    it('should include timestamp in SQS message', async () => {
      await service.create(validPayload);
      const [[, sentMsg]] = mockSqs.sendMessage.mock.calls as [[string, Record<string, unknown>]];
      expect(sentMsg).toHaveProperty('timestamp');
    });
  });

  describe('findOne', () => {
    it('should return an item when found and not deleted', async () => {
      const { marshall } = await import('@aws-sdk/util-dynamodb');
      mockDynamo.getItem.mockResolvedValueOnce({
        Item: marshall({
          PK: 'TENANT#t1#AUDIT_TRAIL_EVENT',
          SK: 'AUDIT_TRAIL_EVENT#123',
          id: '123',
          tenantId: 't1',
          eventType: AuditEventType.ACCOUNT_CREATED,
          actorId: 'user-1',
          resourceType: 'ACCOUNT',
          resourceId: 'acc-1',
          action: 'CREATE',
          metadata: {},
          deleted: false,
        }),
      });

      const item = await service.findOne('t1', '123');
      expect(item.id).toBe('123');
      expect(item.eventType).toBe(AuditEventType.ACCOUNT_CREATED);
    });

    it('should throw NotFoundException if item is soft-deleted', async () => {
      const { marshall } = await import('@aws-sdk/util-dynamodb');
      mockDynamo.getItem.mockResolvedValueOnce({
        Item: marshall({
          PK: 'TENANT#t1#AUDIT_TRAIL_EVENT',
          SK: 'AUDIT_TRAIL_EVENT#456',
          id: '456',
          deleted: true,
        }),
      });

      await expect(service.findOne('t1', '456')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if item does not exist', async () => {
      mockDynamo.getItem.mockResolvedValueOnce({});

      await expect(service.findOne('t1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return only non-deleted items for the tenant', async () => {
      const { marshall } = await import('@aws-sdk/util-dynamodb');
      mockDynamo.query.mockResolvedValueOnce({
        Items: [
          marshall({
            id: '1',
            eventType: AuditEventType.USER_LOGIN,
            deleted: false,
          }),
          marshall({
            id: '2',
            eventType: AuditEventType.USER_LOGOUT,
            deleted: true,
          }),
        ],
      });

      const results = await service.findAll('t1');
      expect(results.items).toHaveLength(1);
      expect(results.items[0].eventType).toBe(AuditEventType.USER_LOGIN);
    });

    it('should return empty array when no items', async () => {
      mockDynamo.query.mockResolvedValueOnce({ Items: [] });
      const results = await service.findAll('t1');
      expect(results.items).toEqual([]);
    });
  });

  describe('remove (soft-delete)', () => {
    it('should mark item as deleted instead of physical delete', async () => {
      const { marshall } = await import('@aws-sdk/util-dynamodb');
      mockDynamo.getItem.mockResolvedValueOnce({
        Item: marshall({
          PK: 'TENANT#t1#AUDIT_TRAIL_EVENT',
          SK: 'AUDIT_TRAIL_EVENT#123',
          id: '123',
          tenantId: 't1',
          eventType: AuditEventType.BALANCE_UPDATED,
          actorId: 'user-1',
          resourceType: 'ACCOUNT',
          resourceId: 'acc-1',
          action: 'UPDATE',
          metadata: {},
          deleted: false,
        }),
      });

      const result = await service.remove('t1', '123');
      expect(result.deleted).toBe(true);
      expect(result.updatedAt).toBeDefined();
      expect(mockDynamo.putItem).toHaveBeenCalled();
    });
  });

  describe('tenant isolation', () => {
    it('should query with tenant-scoped PK', async () => {
      const { marshall } = await import('@aws-sdk/util-dynamodb');
      mockDynamo.query.mockResolvedValueOnce({
        Items: [marshall({ id: '1', deleted: false })],
      });

      await service.findAll('tenant-X');
      expect(mockDynamo.query).toHaveBeenCalledWith(
        'test-table',
        'TENANT#tenant-X#AUDIT_TRAIL_EVENT',
        {},
      );
    });
  });
});
