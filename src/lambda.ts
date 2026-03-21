import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ObfuscationService } from './common/core/obfuscation.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serverlessExpress = require('@codegenie/serverless-express');

let cachedServer: ReturnType<typeof serverlessExpress>;

/**
 * Bootstraps the NestJS app as an AWS Lambda handler.
 * Uses @codegenie/serverless-express to bridge API Gateway events.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  const obfuscationService = app.get(ObfuscationService);
  app.useGlobalFilters(new GlobalExceptionFilter(obfuscationService));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.init();

  const expressApp = app.getHttpAdapter().getInstance();
  return serverlessExpress({ app: expressApp });
}

/** AWS Lambda handler entry point. */
export const handler = async (event: unknown, context: unknown, callback: unknown) => {
  if (!cachedServer) {
    cachedServer = await bootstrap();
  }
  return cachedServer(event, context, callback);
};
