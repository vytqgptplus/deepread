import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Logging interceptor that logs all incoming requests and responses.
 * Measures request duration and logs success/failure status.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, url, body } = request;
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Log incoming request
    this.logger.log(
      `[${requestId}] Incoming request: ${method} ${url}`,
      {
        requestId,
        method,
        url,
        body: method !== 'GET' ? body : undefined,
        userAgent: request.get('user-agent'),
        ip: request.ip,
      },
    );

    // Add request ID to response headers
    response.setHeader('X-Request-ID', requestId);

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log(
            `[${requestId}] Response: ${method} ${url} - ${response.statusCode} (${duration}ms)`,
            {
              requestId,
              method,
              url,
              statusCode: response.statusCode,
              duration,
            },
          );
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `[${requestId}] Error response: ${method} ${url} - ${error.message} (${duration}ms)`,
            error.stack,
            {
              requestId,
              method,
              url,
              duration,
            },
          );
        },
      }),
    );
  }
}
