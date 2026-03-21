import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { OrdersModule } from './orders.module';
import { AuthModule } from '../../common/guards/auth.module';
import { OrderResponseDto } from './dto/order-response.dto';

/* eslint-disable i18next/no-literal-string */
const ORDERS_PATH = '/v1/orders';
const TENANT_ID = 'tenant-int';
const PRODUCT_NAME = 'Widget';
const USER_SUB = 'user-1';
const AUTH_HEADER = 'Authorization';
const TENANT_HEADER = 'x-tenant-id';
/* eslint-enable i18next/no-literal-string */

describe('OrdersController (integration)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let token: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, OrdersModule],
    }).compile();

    app = module.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
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
      // eslint-disable-next-line i18next/no-literal-string
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

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /v1/orders/:id', () => {
    it('should return 404 for nonexistent order', async () => {
      await request(app.getHttpServer())
        // eslint-disable-next-line i18next/no-literal-string
        .get(`${ORDERS_PATH}/nonexistent-id`)
        .set(AUTH_HEADER, `Bearer ${token}`)
        .set(TENANT_HEADER, TENANT_ID)
        .expect(404);
    });
  });

  describe('DELETE /v1/orders/:id (soft-delete)', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        // eslint-disable-next-line i18next/no-literal-string
        .delete(`${ORDERS_PATH}/some-id`)
        .expect(401);
    });
  });
});
