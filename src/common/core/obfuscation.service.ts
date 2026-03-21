import { Injectable, Logger } from '@nestjs/common';

/**
 * Dedicated service for data obfuscation across the application.
 * Centralizes the list of sensitive fields and rules.
 *
 * @example
 * ```typescript
 * // Inject and use
 * constructor(private readonly obfuscation: ObfuscationService) {}
 *
 * // Obfuscate an object before logging
 * const safeData = this.obfuscation.obfuscate({ name: 'John', cpf: '123.456.789-00' });
 * // => { name: 'John', cpf: '********' }
 *
 * console.log(safeData); // Safe for logs
 * ```
 */
@Injectable()
export class ObfuscationService {
  private readonly logger = new Logger(ObfuscationService.name);

  /* eslint-disable i18next/no-literal-string */
  private sensitivePatterns: string[] = [
    'password',
    'secret',
    'token',
    'key',
    'auth',
    'credit_card',
    'cvv',
    'cpf',
    'rg',
    'document',
    'payload',
  ];
  /* eslint-enable i18next/no-literal-string */

  /**
   * Obfuscates sensitive keys in any object.
   * Deep traversal for nested objects.
   *
   * @param obj - The object to obfuscate.
   * @returns A new object with sensitive fields replaced by '********'.
   */
  obfuscate(obj: Record<string, unknown> | unknown): Record<string, unknown> | unknown {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map((item: unknown) => this.obfuscate(item as Record<string, unknown>));
    }

    const source = obj as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = this.sensitivePatterns.some((pattern) => lowerKey.includes(pattern));

        if (isSensitive) {
          result[key] = '********';
        } else if (typeof source[key] === 'object') {
          result[key] = this.obfuscate(source[key] as Record<string, unknown>);
        } else {
          result[key] = source[key];
        }
      }
    }
    return result;
  }
}
