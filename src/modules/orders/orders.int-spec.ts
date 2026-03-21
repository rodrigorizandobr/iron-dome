import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { OrdersModule } from './orders.module';
import { AuthModule } from '../../common/guards/auth.module';
import { MultiTenancyMiddleware } from '../../common/middlewares/multi-tenancy.middleware';
import { OrderResponseDto } from './dto/order-response.dto';
import { DynamoDBProvider } from '../../providers/aws/dynamodb.provider';
// In ESM mode (--experimental-vm-modules), jest globals must be imported explicitly
import { jest } from '@jest/globals';

const ORDERS_PATH = '/v1/orders';
const TENANT_ID = 'tenant-int';
const PRODUCT_NAME = 'Widget';
const USER_SUB = 'user-1';
const AUTH_HEADER = 'Authorization';
const TENANT_HEADER = 'x-tenant-id';
const ORDER_ID = 'mock-order-id';

// Mock DynamoDB responses (no LocalStack needed)
// Uses mockImplementation to avoid TypeScript generic inference issues with @jest/globals
const mockOrder = {
  id: ORDER_ID,
  tenantId: TENANT_ID,
  productName: PRODUCT_NAME,
  amount: 1000,
  deleted: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockDynamoDBProvider = {
  getResourceName: jest.fn().mockImplementation(() => 'test-table'),
  putItem: jest.fn().mockImplementation(() => Promise.resolve({})),
  getItem: jest.fn().mockImplementation((_pk: unknown, sk: unknown) => {
    if (typeof sk === 'string' && sk.includes('nonexistent')) {
      return Promise.resolve(null);
    }
    return Promise.resolve(mockOrder);
  }),
  query: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ items: [mockOrder], cursor: undefined })),
  updateItem: jest.fn().mockImplementation(() => Promise.resolve({})),
};

describe('OrdersController (integration)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let token: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, OrdersModule],
    })
      .overrideProvider(DynamoDBProvider)
      .useValue(mockDynamoDBProvider)
      .compile();

    app = module.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.use(new MultiTenancyMiddleware().use.bind(new MultiTenancyMiddleware()));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwtService = module.get<JwtService>(JwtService);
    token = jwtService.sign({ sub: USER_SUB, tenantId: TENANT_ID });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/orders', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .post(ORDERS_PATH)
        .send({ productName: PRODUCT_NAME, amount: 1000 })
        .expect(401);
    });

    it('should create an order with valid token', async () => {
      const res = await request(app.getHttpServer())
        .post(ORDERS_PATH)
        .set(AUTH_HEADER, `Bearer ${token}`)
        .set(TENANT_HEADER, TENANT_ID)
        .send({ productName: PRODUCT_NAME, amount: 1000 })
        .expect(201);

      const body = res.body as OrderResponseDto;
      expect(res.body).toHaveProperty('id');
      expect(body.productName).toBe(PRODUCT_NAME);
      expect(body.tenantId).toBe(TENANT_ID);
      expect(body.deleted).toBe(false);
    });

    it('should reject invalid DTO (missing productName)', async () => {
      await request(app.getHttpServer())
        .post(ORDERS_PATH)
        .set(AUTH_HEADER, `Bearer ${token}`)
        .set(TENANT_HEADER, TENANT_ID)
        .send({ amount: 1000 })
        .expect(400);
    });
  });

  describe('GET /v1/orders', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer()).get(ORDERS_PATH).expect(401);
    });

    it('should list orders for tenant', async () => {
      const res = await request(app.getHttpServer())
        .get(ORDERS_PATH)
        .set(AUTH_HEADER, `Bearer ${token}`)
        .set(TENANT_HEADER, TENANT_ID)
        .expect(200);

      expect(Array.isArray((res.body as { items: unknown[] }).items)).toBe(true);
    });
  });

  describe('GET /v1/orders/:id', () => {
    it('should return 404 for nonexistent order', async () => {
      await request(app.getHttpServer())
        .get(`${ORDERS_PATH}/nonexistent-id`)
        .set(AUTH_HEADER, `Bearer ${token}`)
        .set(TENANT_HEADER, TENANT_ID)
        .expect(404);
    });
  });

  describe('DELETE /v1/orders/:id (soft-delete)', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer()).delete(`${ORDERS_PATH}/some-id`).expect(401);
    });
  });
});
