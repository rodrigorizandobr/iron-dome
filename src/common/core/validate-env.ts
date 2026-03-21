import { Logger } from '@nestjs/common';

/** Required environment variables that must be set before application starts. */
const REQUIRED_VARS = [
  'AWS_REGION',
  'AWS_ENDPOINT',
  'NODE_ENV',
  'JWT_SECRET',
];

/**
 * Validates that all required environment variables are set.
 * Call this in main.ts before app creation to fail fast.
 */
export function validateEnv(): void {
  const logger = new Logger('EnvValidation');
  const missing: string[] = [];

  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    // eslint-disable-next-line i18next/no-literal-string
    const msg = `Missing required env vars: ${missing.join(', ')}`;
    logger.error(msg);
    throw new Error(msg);
  }

  logger.log('All required environment variables are set');
}
