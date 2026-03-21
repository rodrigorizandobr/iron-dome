import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/* eslint-disable i18next/no-literal-string */
const ENV_AWS_REGION = 'AWS_REGION';
const ENV_AWS_ENDPOINT = 'AWS_ENDPOINT';
const ENV_AWS_ACCESS_KEY_ID = 'AWS_ACCESS_KEY_ID';
const ENV_AWS_SECRET_ACCESS_KEY = 'AWS_SECRET_ACCESS_KEY';
const DUMMY_CREDENTIAL = 'dummy';
/* eslint-enable i18next/no-literal-string */

export { ENV_AWS_REGION, ENV_AWS_ENDPOINT, ENV_AWS_ACCESS_KEY_ID, ENV_AWS_SECRET_ACCESS_KEY, DUMMY_CREDENTIAL };

/** Standard AWS client configuration shape. */
export interface IAwsClientConfig {
  region: string;
  endpoint: string;
  credentials: { accessKeyId: string; secretAccessKey: string };
}

/**
 * Valid Environments for the platform.
 */
export enum AppEnvironment {
  DEVELOPMENT = 'dev',
  STAGING = 'hml',
  SANDBOX = 'sandbox',
  PRODUCTION = 'prd',
}

/**
 * Valid Service Types in the architecture.
 * Used for resources that are execution units (Lambda, SQS, etc).
 */
export enum AppServiceType {
  API = 'api',
  WORKER = 'worker',
  JOB = 'job',
  FRONTEND = 'frontend',
}

/**
 * Enterprise Base Provider.
 * Centralizes logging, error handling and corporate naming conventions for all AWS and external services.
 */
export abstract class BaseProvider {
  protected readonly logger: Logger;

  constructor(
    protected readonly providerName: string,
    protected readonly configService: ConfigService,
  ) {
    this.logger = new Logger(providerName);
  }

  /** Returns standard AWS client config from environment variables. */
  protected getAwsConfig(): IAwsClientConfig {
    return {
      region: this.configService.get<string>(ENV_AWS_REGION, 'us-east-1'),
      endpoint: this.configService.get<string>(ENV_AWS_ENDPOINT, 'http://localhost:4566'),
      credentials: {
        accessKeyId: this.configService.get<string>(ENV_AWS_ACCESS_KEY_ID) || DUMMY_CREDENTIAL,
        secretAccessKey: this.configService.get<string>(ENV_AWS_SECRET_ACCESS_KEY) || DUMMY_CREDENTIAL,
      },
    };
  }

  /**
   * Generates a corporate standard resource name.
   * Pattern: [ENV]-[DOMAIN]-[SUBDOMAIN]-[TYPE]-[FUNCTIONAL]
   */
  public getResourceName(resourceType: string, functionalName: string): string {
    const env = this.configService.get<AppEnvironment>('NODE_ENV', AppEnvironment.DEVELOPMENT);
    const domain = this.configService.get<string>('APP_DOMAIN', 'fintech');
    const subdomain = this.configService.get<string>('APP_SUBDOMAIN', 'core');
    return `${env}-${domain}-${subdomain}-${resourceType}-${functionalName}`.toLowerCase();
  }

  protected logOperation(operation: string, details?: Record<string, unknown>) {
    this.logger.log(`[${operation}] Executing operation: ${JSON.stringify(details || {})}`);
  }

  protected handleError(operation: string, error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    this.logger.error(`[${operation}] Error: ${err.message}`, err.stack);
    throw err;
  }
}
