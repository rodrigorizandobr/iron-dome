import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ObfuscationService } from '../core/obfuscation.service';
import { ErrorCode } from '../core/error-codes';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Global Exception Filter with obfuscation and structured logging.
 * Catches all unhandled exceptions, sanitizes sensitive data,
 * and writes structured error logs to storage/log/error.log.
 */
@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly obfuscationService: ObfuscationService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : // eslint-disable-next-line i18next/no-literal-string
          'Internal server error';

    const tenantId = (request as Request & { tenantId?: string }).tenantId;
    const resolvedMessage =
      typeof message === 'string'
        ? message
        : ((message as Record<string, unknown>)?.message ?? message);

    const errorBody = {
      statusCode: status,
      errorCode: this.resolveErrorCode(status),
      timestamp: new Date().toISOString(),
      path: request.url,
      tenantId,
      message: resolvedMessage,
    };

    if (status >= 500) {
      const safeBody = this.obfuscationService.obfuscate(
        errorBody as unknown as Record<string, unknown>,
      ) as Record<string, unknown>;
      this.logger.error(`[${request.method}] ${JSON.stringify(safeBody)}`);
      this.writeToErrorFile(safeBody);
    }

    response.status(status).json(errorBody);
  }

  private writeToErrorFile(log: Record<string, unknown>) {
    try {
      const logDir = join(process.cwd(), 'storage', 'log');
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }
      appendFileSync(join(logDir, 'error.log'), JSON.stringify(log) + '\n');
    } catch (err) {
      this.logger.error(`Failed to write error log: ${(err as Error).message}`);
    }
  }

  private resolveErrorCode(status: number): string {
    const statusMap: Record<number, ErrorCode> = {
      [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_FAILED,
      [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
      [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
      [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.SERVICE_UNAVAILABLE,
    };
    return statusMap[status] || ErrorCode.INTERNAL_ERROR;
  }
}
