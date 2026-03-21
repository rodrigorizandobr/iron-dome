import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  /**
   * Generates a corporate standard resource name.
   * Pattern: [AMBIENTE]-[DOMÍNIO]-[SUBDOMÍNIO]-[TIPO_RECURSO]-[NOME_FUNCIONAL]
   * 
   * @param resourceType The type of AWS resource (e.g., 'dynamodb', 's3', 'sqs', 'sns', 'lambda')
   * @param functionalName The specific name/purpose of the resource (e.g., 'main', 'attachments', 'orders-handler')
   * @returns The formatted resource name string.
   */
  public getResourceName(resourceType: string, functionalName: string): string {
    const env = this.configService.get<AppEnvironment>('NODE_ENV', AppEnvironment.DEVELOPMENT);
    const domain = this.configService.get<string>('APP_DOMAIN', 'fintech');
    const subdomain = this.configService.get<string>('APP_SUBDOMAIN', 'core');

    // Enforces the standard pattern: [ENV]-[DOMAIN]-[SUBDOMAIN]-[TYPE]-[FUNCTIONAL]
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
