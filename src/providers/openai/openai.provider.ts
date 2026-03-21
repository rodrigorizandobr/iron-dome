import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { BaseProvider } from '../base.provider';

/**
 * OpenAI Provider for AI-driven completions and content analysis.
 *
 * @example
 * ```typescript
 * // Inject and use
 * constructor(private readonly ai: OpenAIProvider) {}
 *
 * // Simple chat completion
 * const response = await this.ai.createChatCompletion([
 *   { role: 'system', content: 'You are a helpful assistant.' },
 *   { role: 'user', content: 'Explain DynamoDB Single Table Design.' },
 * ]);
 *
 * // Higher-level content analysis (i18n ready)
 * const analysis = await this.ai.analyze('Invoice #123 total $500', (key) => i18n.translate(key));
 * ```
 */
@Injectable()
export class OpenAIProvider extends BaseProvider {
  private client: OpenAI;

  constructor(protected readonly configService: ConfigService) {
    super(OpenAIProvider.name, configService);
    this.client = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * Create a chat completion using specific messages.
   *
   * @param messages - Array of chat messages following OpenAI format.
   * @returns The full OpenAI response object.
   */
  async createChatCompletion(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]) {
    this.logOperation('createChatCompletion');
    try {
      return await this.client.chat.completions.create({
        model: 'gpt-4',
        messages,
      });
    } catch (error) {
      this.handleError('createChatCompletion', error);
    }
  }

  /**
   * Higher-level AI helper for content analysis.
   * Uses i18n translation function for multilingual prompts.
   *
   * @param content - The raw content to analyze.
   * @param t - A translation function (e.g., `i18n.translate`).
   * @returns The AI-generated analysis string.
   */
  async analyze(content: string, t: (key: string) => string) {
    this.logOperation('analyze');
    try {
      const response = await this.createChatCompletion([
        { role: 'system', content: t('ai.system_facilitator_prompt') },
        { role: 'user', content: `${t('ai.analyze_content_prefix')} ${content}` },
      ]);
      return response?.choices[0].message.content;
    } catch (error) {
      this.handleError('analyze', error);
    }
  }
}
