import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

/**
 * JWT Authentication Guard.
 * Protects routes by validating JWT tokens.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * CanActivate checks if route is public or requires authentication.
   */
  canActivate(context: ExecutionContext) {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * Handle unauthorized requests.
   */
  handleRequest<TUser>(err: Error | null, user: TUser, info: Error | undefined) {
    if (err || !user) {
      if (info?.name === 'TokenExpiredError') {
        this.logger.warn('JWT token expired');
      } else if (info?.name === 'JsonWebTokenError') {
        this.logger.warn(`Invalid JWT token: ${info.message}`);
      }
      throw err || new Error('Unauthorized');
    }
    return user;
  }
}
