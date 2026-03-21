import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { DynamoDBProvider } from '../../providers/aws/dynamodb.provider';
import { I18nService } from '../../common/core/i18n.service';
import { OrderEventPublisher } from './order-event.publisher';
import { AuditTrailService } from '../../common/core/audit-trail.service';

describe('OrdersService', () => {
  let service: OrdersService;

  const mockDynamo = {
    getResourceName: jest.fn().mockReturnValue('test-table'),
    putItem: jest.fn().mockResolvedValue({}),
    getItem: jest.fn(),
    query: jest.fn(),
  };

  const mockI18n = {
    translate: jest.fn((key: string) => key),
  };

  const mockEventPublisher = {
    publishCreated: jest.fn().mockResolvedValue(undefined),
    publishUpdated: jest.fn().mockResolvedValue(undefined),
    publishDeleted: jest.fn().mockResolvedValue(undefined),
  };

  const mockAudit = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: DynamoDBProvider, useValue: mockDynamo },
        { provide: I18nService, useValue: mockI18n },
        { provide: OrderEventPublisher, useValue: mockEventPublisher },
        { provide: AuditTrailService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw BadRequestException if tenantId is missing', async () => {
      await expect(service.create({ productName: 'Widget', amount: 100 } as never)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create an order with tenant isolation', async () => {
      const result = await service.create({
        tenantId: 'tenant-A',
        productName: 'Widget',
        amount: 9990,
      } as never);

      expect(result.tenantId).toBe('tenant-A');
      expect(result.productName).toBe('Widget');
      expect(result.amount).toBe(9990);
      expect(result.entityType).toBe('ORDER');
      expect(result.deleted).toBe(false);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(mockDynamo.putItem).toHaveBeenCalledWith('test-table', expect.anything());
      expect(mockEventPublisher.publishCreated).toHaveBeenCalledWith(result.id, 'tenant-A', {
        productName: 'Widget',
        amount: 9990,
      });
    });
  });

  describe('findOne', () => {
    it('should return an item when found and not deleted', async () => {
      const { marshall } = await import('@aws-sdk/util-dynamodb');
      mockDynamo.getItem.mockResolvedValueOnce({
        Item: marshall({
          PK: 'TENANT#t1#ORDER',
          SK: 'ORDER#123',
          id: '123',
          tenantId: 't1',
          productName: 'Widget',
          amount: 50,
          deleted: false,
        }),
      });

      const item = await service.findOne('t1', '123');
      expect(item.id).toBe('123');
      expect(item.productName).toBe('Widget');
    });

    it('should throw NotFoundException if item is soft-deleted', async () => {
      const { marshall } = await import('@aws-sdk/util-dynamodb');
      mockDynamo.getItem.mockResolvedValueOnce({
        Item: marshall({
          PK: 'TENANT#t1#ORDER',
          SK: 'ORDER#456',
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
          marshall({ id: '1', productName: 'Active', deleted: false }),
          marshall({ id: '2', productName: 'Deleted', deleted: true }),
        ],
      });

      const results = await service.findAll('t1');
      expect(results.items).toHaveLength(1);
      expect(results.items[0].productName).toBe('Active');
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
          PK: 'TENANT#t1#ORDER',
          SK: 'ORDER#123',
          id: '123',
          tenantId: 't1',
          productName: 'Widget',
          deleted: false,
        }),
      });

      const result = await service.remove('t1', '123');
      expect(result.deleted).toBe(true);
      expect(result.updatedAt).toBeDefined();
      expect(mockDynamo.putItem).toHaveBeenCalled();
      expect(mockEventPublisher.publishDeleted).toHaveBeenCalledWith('123', 't1');
    });
  });

  describe('tenant isolation', () => {
    it('should query with tenant-scoped PK', async () => {
      const { marshall } = await import('@aws-sdk/util-dynamodb');
      mockDynamo.query.mockResolvedValueOnce({
        Items: [marshall({ id: '1', deleted: false })],
      });

      await service.findAll('tenant-X');
      expect(mockDynamo.query).toHaveBeenCalledWith('test-table', 'TENANT#tenant-X#ORDER', {});
    });
  });
});
