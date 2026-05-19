import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

/**
 * JWT Strategy for Passport authentication.
 * Validates JWT tokens from Authorization header.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'default_jwt_secret'),
    });
  }

  /**
   * Validate JWT payload and return user object.
   * Called by JwtAuthGuard to attach user to request.
   */
  async validate(payload: { sub: string; email: string }) {
    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    this.logger.debug(`JWT validated for user: ${payload.email}`);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }
}
