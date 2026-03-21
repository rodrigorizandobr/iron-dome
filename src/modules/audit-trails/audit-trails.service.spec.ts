import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AuditTrailsService } from './audit-trails.service';
import { DynamoDBProvider } from '../../providers/aws/dynamodb.provider';
import { I18nService } from '../../common/core/i18n.service';

describe('AuditTrailsService', () => {
  let service: AuditTrailsService;

  const mockDynamo = {
    getResourceName: jest.fn().mockReturnValue('test-table'),
    getItem: jest.fn(),
    query: jest.fn(),
  };

  const mockI18n = {
    translate: jest.fn((key: string) => key),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditTrailsService,
        { provide: DynamoDBProvider, useValue: mockDynamo },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    service = module.get<AuditTrailsService>(AuditTrailsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated audit trail entries for the tenant', async () => {
      const { marshall } = await import('@aws-sdk/util-dynamodb');
      mockDynamo.query.mockResolvedValueOnce({
        Items: [
          marshall({
            PK: 'TENANT#t1#AUDIT',
            SK: 'AUDIT#2026-03-20T12:00:00.000Z#ORDER#123',
            tenantId: 't1',
            action: 'CREATE',
            resourceType: 'ORDER',
            resourceId: '123',
            timestamp: '2026-03-20T12:00:00.000Z',
            entityType: 'AUDIT',
          }),
        ],
      });

      const result = await service.findAll('t1', { limit: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].tenantId).toBe('t1');
      expect(result.items[0].action).toBe('CREATE');
      expect(result.items[0].resourceType).toBe('ORDER');
      expect(result.items[0].resourceId).toBe('123');
      expect(result.items[0].entityType).toBe('AUDIT');
      expect(result.items[0].id).toBeDefined();
      expect(result.cursor).toBeUndefined();
    });

    it('should return empty list when no items found', async () => {
      mockDynamo.query.mockResolvedValueOnce({ Items: [] });
      const result = await service.findAll('t1', {});
      expect(result.items).toEqual([]);
    });

    it('should return empty list when result is null', async () => {
      mockDynamo.query.mockResolvedValueOnce({});
      const result = await service.findAll('t1', {});
      expect(result.items).toEqual([]);
    });

    it('should filter by resourceType when provided', async () => {
      const { marshall } = await import('@aws-sdk/util-dynamodb');
      mockDynamo.query.mockResolvedValueOnce({
        Items: [
          marshall({
            PK: 'TENANT#t1#AUDIT',
            SK: 'AUDIT#2026-03-20T12:00:00.000Z#ORDER#123',
            tenantId: 't1',
            action: 'CREATE',
            resourceType: 'ORDER',
            resourceId: '123',
            timestamp: '2026-03-20T12:00:00.000Z',
            entityType: 'AUDIT',
          }),
          marshall({
            PK: 'TENANT#t1#AUDIT',
            SK: 'AUDIT#2026-03-20T13:00:00.000Z#USER#456',
            tenantId: 't1',
            action: 'DELETE',
            resourceType: 'USER',
            resourceId: '456',
            timestamp: '2026-03-20T13:00:00.000Z',
            entityType: 'AUDIT',
          }),
        ],
      });

      const result = await service.findAll('t1', { resourceType: 'ORDER' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].resourceType).toBe('ORDER');
    });

    it('should filter by action when provided', async () => {
      const { marshall } = await import('@aws-sdk/util-dynamodb');
      mockDynamo.query.mockResolvedValueOnce({
        Items: [
          marshall({
            PK: 'TENANT#t1#AUDIT',
            SK: 'AUDIT#2026-03-20T12:00:00.000Z#ORDER#123',
            tenantId: 't1',
            action: 'CREATE',
            resourceType: 'ORDER',
            resourceId: '123',
            timestamp: '2026-03-20T12:00:00.000Z',
            entityType: 'AUDIT',
          }),
          marshall({
            PK: 'TENANT#t1#AUDIT',
            SK: 'AUDIT#2026-03-20T13:00:00.000Z#ORDER#456',
            tenantId: 't1',
            action: 'DELETE',
            resourceType: 'ORDER',
            resourceId: '456',
            timestamp: '2026-03-20T13:00:00.000Z',
            entityType: 'AUDIT',
          }),
        ],
      });

      const result = await service.findAll('t1', { action: 'CREATE' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].action).toBe('CREATE');
    });

    it('should include cursor when DynamoDB returns LastEvaluatedKey', async () => {
      const { marshall } = await import('@aws-sdk/util-dynamodb');
      mockDynamo.query.mockResolvedValueOnce({
        Items: [
          marshall({
            PK: 'TENANT#t1#AUDIT',
            SK: 'AUDIT#2026-03-20T12:00:00.000Z#ORDER#123',
            tenantId: 't1',
            action: 'CREATE',
            resourceType: 'ORDER',
            resourceId: '123',
            timestamp: '2026-03-20T12:00:00.000Z',
            entityType: 'AUDIT',
          }),
        ],
        LastEvaluatedKey: { PK: { S: 'TENANT#t1#AUDIT' }, SK: { S: 'AUDIT#...' } },
      });

      const result = await service.findAll('t1', { limit: 1 });
      expect(result.cursor).toBeDefined();
    });

    it('should throw BadRequestException on DynamoDB error', async () => {
      mockDynamo.query.mockRejectedValueOnce(new Error('DynamoDB unreachable'));
      await expect(service.findAll('t1', {})).rejects.toThrow(BadRequestException);
    });

    it('should query with tenant-scoped PK', async () => {
      mockDynamo.query.mockResolvedValueOnce({ Items: [] });
      await service.findAll('tenant-X', {});
      expect(mockDynamo.query).toHaveBeenCalledWith('test-table', 'TENANT#tenant-X#AUDIT', {});
    });
  });

  describe('findOne', () => {
    it('should return the audit entry when found', async () => {
      const { marshall } = await import('@aws-sdk/util-dynamodb');
      const sk = 'AUDIT#2026-03-20T12:00:00.000Z#ORDER#123';
      const id = Buffer.from(sk).toString('base64url');
      mockDynamo.getItem.mockResolvedValueOnce({
        Item: marshall({
          PK: 'TENANT#t1#AUDIT',
          SK: sk,
          tenantId: 't1',
          action: 'CREATE',
          resourceType: 'ORDER',
          resourceId: '123',
          timestamp: '2026-03-20T12:00:00.000Z',
          entityType: 'AUDIT',
        }),
      });

      const result = await service.findOne('t1', id);
      expect(result.id).toBe(id);
      expect(result.action).toBe('CREATE');
      expect(result.resourceType).toBe('ORDER');
      expect(result.resourceId).toBe('123');
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      mockDynamo.getItem.mockResolvedValueOnce({});
      const id = Buffer.from('AUDIT#nonexistent').toString('base64url');
      await expect(service.findOne('t1', id)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when result Item is null', async () => {
      mockDynamo.getItem.mockResolvedValueOnce({ Item: null });
      const id = Buffer.from('AUDIT#nonexistent').toString('base64url');
      await expect(service.findOne('t1', id)).rejects.toThrow(NotFoundException);
    });
  });
});
