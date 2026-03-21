import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to handle multi-tenancy by extracting tenant information from headers.
 * Following SOLID principles for request isolation.
 */
@Injectable()
export class MultiTenancyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    /* eslint-disable i18next/no-literal-string */
    const tenantId = req.headers['x-tenant-id'] || 'default';
    /* eslint-enable i18next/no-literal-string */
    const extendedReq = req as Request & { tenantId: string | string[] };
    extendedReq.tenantId = tenantId;
    next();
  }
}
