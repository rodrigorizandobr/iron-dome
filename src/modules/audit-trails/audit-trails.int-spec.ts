import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AuditTrailsModule } from './audit-trails.module';
import { AuthModule } from '../../common/guards/auth.module';

 
const AUDIT_TRAILS_PATH = '/v1/audit-trails';
const TENANT_ID = 'tenant-int';
const USER_SUB = 'user-1';
const AUTH_HEADER = 'Authorization';
const TENANT_HEADER = 'x-tenant-id';
 

describe('AuditTrailsController (integration)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let token: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, AuditTrailsModule],
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

  describe('GET /v1/audit-trails', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer()).get(AUDIT_TRAILS_PATH).expect(401);
    });

    it('should list audit trail entries for tenant', async () => {
      await request(app.getHttpServer())
        .get(AUDIT_TRAILS_PATH)
        .set(AUTH_HEADER, `Bearer ${token}`)
        .set(TENANT_HEADER, TENANT_ID)
        .expect(200);
    });
  });

  describe('GET /v1/audit-trails/:id', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
         
        .get(`${AUDIT_TRAILS_PATH}/some-id`)
        .expect(401);
    });

    it('should return 404 for nonexistent audit trail entry', async () => {
       
      const fakeId = Buffer.from('AUDIT#nonexistent').toString('base64url');
      await request(app.getHttpServer())
        .get(`${AUDIT_TRAILS_PATH}/${fakeId}`)
        .set(AUTH_HEADER, `Bearer ${token}`)
        .set(TENANT_HEADER, TENANT_ID)
        .expect(404);
    });
  });
});
