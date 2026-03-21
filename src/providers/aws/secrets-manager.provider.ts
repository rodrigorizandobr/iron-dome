import { Injectable } from '@nestjs/common';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { ConfigService } from '@nestjs/config';
import { BaseProvider } from '../base.provider';

/**
 * AWS Secrets Manager Provider for secure credential retrieval.
 *
 * @example
 * ```typescript
 * // Inject and use
 * constructor(private readonly secrets: SecretsManagerProvider) {}
 *
 * // Get a secret name following corporate naming
 * const secretName = this.secrets.getSecretName('database-credentials');
 * // => "dev-fintech-core-secret-database-credentials"
 *
 * // Retrieve the secret value
 * const credentials = await this.secrets.getSecret(secretName);
 * ```
 */
@Injectable()
export class SecretsManagerProvider extends BaseProvider {
  private client: SecretsManagerClient;

  constructor(protected readonly configService: ConfigService) {
    super(SecretsManagerProvider.name, configService);
    this.client = new SecretsManagerClient({
      region: this.configService.get<string>('AWS_REGION'),
      endpoint: this.configService.get<string>('AWS_ENDPOINT'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || 'dummy',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || 'dummy',
      },
    });
  }

  /**
   * Generates the secret name following the corporate naming standard.
   *
   * @param functionalName - The purpose of the secret (e.g., 'database-credentials', 'api-keys').
   * @returns The full secret name: `dev-fintech-core-secret-database-credentials`
   */
  getSecretName(functionalName: string): string {
    return this.getResourceName('secret', functionalName);
  }

  /**
   * Retrieve a secret value by its name.
   * Parses the SecretString as JSON.
   *
   * @param secretName - The full name or ARN of the secret.
   * @returns The parsed JSON secret, or null if SecretString is empty.
   */
  async getSecret(secretName: string): Promise<Record<string, unknown> | null> {
    this.logOperation('getSecret', { secretName });
    try {
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await this.client.send(command);

      if ('SecretString' in response && response.SecretString) {
        return JSON.parse(response.SecretString) as Record<string, unknown>;
      }
      return null;
    } catch (error) {
      this.handleError('getSecret', error);
      return null;
    }
  }
}
