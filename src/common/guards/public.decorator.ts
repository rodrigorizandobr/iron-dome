import { SetMetadata } from '@nestjs/common';

/** Metadata key for public routes that skip JWT auth. */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as public — bypasses JWT authentication.
 * Use on health checks, login, and other open endpoints.
 *
 * @example
 * ```typescript
 * @Public()
 * @Get('health')
 * getHealth() { return { status: 'ok' }; }
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
