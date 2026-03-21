import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { VersioningType, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ObfuscationService } from './common/core/obfuscation.service';
import { validateEnv } from './common/core/validate-env';

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  /** CORS — configurable origin list via CORS_ORIGINS env var */
  const origins = configService.get<string>('CORS_ORIGINS', '*');
  app.enableCors({
    origin: origins === '*' ? '*' : origins.split(','),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: origins !== '*',
  });

  /** Enable URI versioning as per rule (Standard v1 prefix) */
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  /** Apply global exception filter with obfuscation (DI) and validation pipes */
  const obfuscationService = app.get(ObfuscationService);
  app.useGlobalFilters(new GlobalExceptionFilter(obfuscationService));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  /** Configure Swagger documentation at /doc */
  const config = new DocumentBuilder()
    .setTitle('API AI')
    .setDescription('100% Serverless NestJS API for Fintech/SaaS')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('monitoring')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('doc', app, document);

  await app.listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
