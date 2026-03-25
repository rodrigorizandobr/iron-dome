import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
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
    getQueueName: jest.fn().mockReturnValue('test-audit-trail-queue'),
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
    it('should throw BadRequestException for unregistered event type', async () => {
      await expect(
        service.create({
          tenantId: 'tenant-A',
          eventType: 'UNREGISTERED_TYPE' as AuditEventType,
          actorId: 'user-1',
          resourceType: 'ACCOUNT',
          resourceId: 'acc-123',
          action: 'CREATE',
          metadata: {},
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should publish to SQS and return populated audit trail event', async () => {
      const result = await service.create({
        tenantId: 'tenant-A',
        eventType: AuditEventType.TRANSACTION_CREATED,
        actorId: 'user-1',
        resourceType: 'TRANSACTION',
        resourceId: 'txn-123',
        action: 'CREATE',
        metadata: { amount: 1000, currency: 'BRL' },
        description: 'Transaction initiated',
      });

      expect(result.tenantId).toBe('tenant-A');
      expect(result.eventType).toBe(AuditEventType.TRANSACTION_CREATED);
      expect(result.actorId).toBe('user-1');
      expect(result.resourceType).toBe('TRANSACTION');
      expect(result.resourceId).toBe('txn-123');
      expect(result.action).toBe('CREATE');
      expect(result.metadata).toEqual({ amount: 1000, currency: 'BRL' });
      expect(result.deleted).toBe(false);
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(mockSqs.sendMessage).toHaveBeenCalled();
      expect(mockDynamo.putItem).not.toHaveBeenCalled();
    });

    it('should use i18n for unregistered event type error message', async () => {
      await expect(
        service.create({
          tenantId: 'tenant-A',
          eventType: 'INVALID' as AuditEventType,
          actorId: 'user-1',
          resourceType: 'ACCOUNT',
          resourceId: 'acc-123',
          action: 'CREATE',
          metadata: {},
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockI18n.translate).toHaveBeenCalledWith(
        'audit_trail.event_type_not_registered',
        expect.objectContaining({ eventType: 'INVALID' }),
      );
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
          eventType: AuditEventType.TRANSACTION_CREATED,
          actorId: 'user-1',
          resourceType: 'TRANSACTION',
          resourceId: 'txn-123',
          action: 'CREATE',
          metadata: {},
          deleted: false,
        }),
      });

      const item = await service.findOne('t1', '123');
      expect(item.id).toBe('123');
      expect(item.eventType).toBe(AuditEventType.TRANSACTION_CREATED);
    });

    it('should throw NotFoundException if item is soft-deleted', async () => {
      const { marshall } = await import('@aws-sdk/util-dynamodb');
      const { NotFoundException } = await import('@nestjs/common');
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
  });

  describe('findAll', () => {
    it('should return only non-deleted items for the tenant', async () => {
      const { marshall } = await import('@aws-sdk/util-dynamodb');
      mockDynamo.query.mockResolvedValueOnce({
        Items: [
          marshall({ id: '1', eventType: AuditEventType.USER_LOGIN, deleted: false }),
          marshall({ id: '2', eventType: AuditEventType.USER_LOGOUT, deleted: true }),
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
