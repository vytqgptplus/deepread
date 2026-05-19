import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Get the current authenticated user from the request.
 * Usage: @CurrentUser() user: User
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user) {
      return null;
    }

    return data ? (user as Record<string, unknown>)[data] : user;
  },
);
