import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that logs every incoming HTTP request with
 * method, URL, status code, response time, and tenant context.
 */
@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl } = req;
    const tenantId = (req as Request & { tenantId?: string }).tenantId;

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;

      type LogLevel = 'error' | 'warn' | 'log';
      // eslint-disable-next-line i18next/no-literal-string
      const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'log';
      const message =
        // eslint-disable-next-line i18next/no-literal-string
        `${method} ${originalUrl} ${statusCode} ${duration}ms` +
        (tenantId ? ` [tenant:${tenantId}]` : '');

      this.logger[level](message);
    });

    next();
  }
}
