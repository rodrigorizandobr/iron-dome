import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Express } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ObfuscationService } from './common/core/obfuscation.service';

type LambdaHandler = (event: unknown, context: unknown, callback: unknown) => Promise<unknown>;
type ServerlessExpressFactory = (options: { app: Express }) => LambdaHandler;

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const serverlessExpress: ServerlessExpressFactory = require('@codegenie/serverless-express');

let cachedServer: LambdaHandler;

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

  const expressApp = app.getHttpAdapter().getInstance() as Express;
  return serverlessExpress({ app: expressApp });
}

/** AWS Lambda handler entry point. */
export const handler: LambdaHandler = async (event, context, callback) => {
  if (!cachedServer) {
    cachedServer = await bootstrap();
  }
  return cachedServer(event, context, callback);
};
