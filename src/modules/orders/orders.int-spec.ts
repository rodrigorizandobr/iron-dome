import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { OrdersModule } from './orders.module';
import { AuthModule } from '../../common/guards/auth.module';

describe('OrdersController (integration)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let token: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        AuthModule,
        OrdersModule,
      ],
    }).compile();

    app = module.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwtService = module.get<JwtService>(JwtService);
    token = jwtService.sign({ sub: 'user-1', tenantId: 'tenant-int' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/orders', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .post('/v1/orders')
        .send({ productName: 'Widget', amount: 1000 })
        .expect(401);
    });

    it('should create an order with valid token', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .set('x-tenant-id', 'tenant-int')
        .send({ productName: 'Widget', amount: 1000 })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.productName).toBe('Widget');
      expect(res.body.tenantId).toBe('tenant-int');
      expect(res.body.deleted).toBe(false);
    });

    it('should reject invalid DTO (missing productName)', async () => {
      await request(app.getHttpServer())
        .post('/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .set('x-tenant-id', 'tenant-int')
        .send({ amount: 1000 })
        .expect(400);
    });
  });

  describe('GET /v1/orders', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get('/v1/orders')
        .expect(401);
    });

    it('should list orders for tenant', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .set('x-tenant-id', 'tenant-int')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /v1/orders/:id', () => {
    it('should return 404 for nonexistent order', async () => {
      await request(app.getHttpServer())
        .get('/v1/orders/nonexistent-id')
        .set('Authorization', `Bearer ${token}`)
        .set('x-tenant-id', 'tenant-int')
        .expect(404);
    });
  });

  describe('DELETE /v1/orders/:id (soft-delete)', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .delete('/v1/orders/some-id')
        .expect(401);
    });
  });
});
