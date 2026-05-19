import { Module, Global, Provider } from '@nestjs/common';
import { WinstonModule, WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Create Winston logger configuration based on environment.
 * In development: console output with colors and detailed formatting.
 * In production: file rotation with daily files.
 */
function createWinstonOptions(configService: ConfigService): WinstonModuleOptions {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const logDir = configService.get<string>('LOG_DIR', 'logs');
  const logLevel = configService.get<string>('LOG_LEVEL', 'debug');

  const transports: winston.transport[] = [];

  // Ensure log directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Console transport for all environments
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.colorize({ all: true }),
        winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `[${timestamp}] [${level}] [${context || 'App'}] ${message} ${metaStr}`;
        }),
      ),
    }),
  );

  // Daily rotate file for all logs
  transports.push(
    new DailyRotateFile({
      dirname: logDir,
      filename: 'deepread-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json(),
      ),
      maxSize: '20m',
      maxFiles: '30d',
      handleExceptions: true,
    }),
  );

  // Separate error log file
  transports.push(
    new DailyRotateFile({
      dirname: logDir,
      filename: 'deepread-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json(),
      ),
      maxSize: '20m',
      maxFiles: '30d',
      handleExceptions: true,
    }),
  );

  return {
    level: logLevel,
    transports,
    exitOnError: false,
    handleExceptions: true,
  };
}

/**
 * Global logging module that provides Winston logger across the application.
 */
@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: createWinstonOptions,
    }),
  ],
  exports: [WinstonModule],
})
export class LoggerModule {}
