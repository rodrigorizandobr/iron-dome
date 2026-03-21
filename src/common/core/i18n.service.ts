import { Injectable, Scope, Inject, Logger } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Enterprise I18n Service.
 * Supports request-based language detection and JSON catalogs.
 */
@Injectable({ scope: Scope.REQUEST })
export class I18nService {
  private readonly logger = new Logger(I18nService.name);
  private lang: string = 'pt-BR';
  private translations: Record<string, unknown> = {};

  constructor(@Inject(REQUEST) private request: Request) {
    this.lang = this.request.headers['accept-language']?.split(',')[0] || 'pt-BR';
    this.loadTranslations();
  }

  private loadTranslations() {
    try {
      const filePath = path.join(process.cwd(), `src/common/i18n/${this.lang}.json`);
      if (fs.existsSync(filePath)) {
        this.translations = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
      } else {
        // Fallback to English if current lang is not found
        const fallbackPath = path.join(process.cwd(), 'src/common/i18n/en.json');
        this.translations = JSON.parse(fs.readFileSync(fallbackPath, 'utf8')) as Record<string, unknown>;
      }
    } catch (error) {
      this.logger.error(`Error loading translations: ${(error as Error).message}`);
    }
  }

  /**
   * Translates a key. Supports dot notation (e.g., 'errors.user_not_found').
   */
  translate(key: string, args: Record<string, string> = {}): string {
    const value: string | undefined = key
      .split('.')
      .reduce((obj: Record<string, unknown> | undefined, k: string) => {
        if (obj && typeof obj === 'object' && k in obj) {
          return obj[k] as Record<string, unknown>;
        }
        return undefined;
      }, this.translations as unknown as Record<string, unknown>) as unknown as string | undefined;

    if (!value || typeof value !== 'string') return key;

    // Replace placeholders {argName}
    let result = value;
    Object.entries(args).forEach(([k, v]) => {
      result = result.replace(new RegExp(`{${k}}`, 'g'), v);
    });

    return result;
  }

  getLang(): string {
    return this.lang;
  }
}
