import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

/** JWT payload shape from Cognito or custom issuer. */
export interface IJwtPayload {
  sub: string;
  email?: string;
  tenantId?: string;
  iat?: number;
  exp?: number;
}

/**
 * JWT Strategy for Passport.
 * Validates Bearer tokens from Authorization header.
 * Compatible with AWS Cognito, Auth0, or any JWT issuer.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'dev-secret-change-me'),
    });
  }

  /** Called after token is verified. Returns the user payload attached to request. */
  validate(payload: IJwtPayload): IJwtPayload {
    if (!payload.sub) {
      throw new UnauthorizedException();
    }
    return payload;
  }
}
