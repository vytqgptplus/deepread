import { Injectable, Scope, Inject, Logger } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';
import { ConfigService } from '@nestjs/config';

/**
 * Application logger service that wraps Winston logger.
 * Provides structured logging with context support.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger {
  private context?: string;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: WinstonLogger,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Set the context (module/service name) for log messages.
   */
  setContext(context: string) {
    this.context = context;
  }

  /**
   * Log debug message.
   */
  debug(message: string, meta?: Record<string, unknown>) {
    this.logger.debug(message, { context: this.context, ...meta });
  }

  /**
   * Log info message.
   */
  info(message: string, meta?: Record<string, unknown>) {
    this.logger.info(message, { context: this.context, ...meta });
  }

  /**
   * Log warning message.
   */
  warn(message: string, meta?: Record<string, unknown>) {
    this.logger.warn(message, { context: this.context, ...meta });
  }

  /**
   * Log error message.
   */
  error(message: string, trace?: string, meta?: Record<string, unknown>) {
    this.logger.error(message, { context: this.context, trace, ...meta });
  }

  /**
   * Log fatal/critical message.
   */
  fatal(message: string, meta?: Record<string, unknown>) {
    this.logger.crit(message, { context: this.context, ...meta });
  }

  /**
   * Create a child logger with additional context.
   */
  child(context: string) {
    const childLogger = new AppLogger(this.logger, this.configService);
    childLogger.setContext(`${this.context || 'App'}:${context}`);
    return childLogger;
  }
}
