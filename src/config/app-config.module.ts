import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validate } from './configuration';

/**
 * Configuration module that provides environment variables across the application.
 * Uses @nestjs/config for environment variable management with validation.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [
        () => {
          // Support loading from .env file
          const fs = require('fs');
          const path = require('path');
          const envPath = path.join(process.cwd(), '.env');

          let envConfig: Record<string, string> = {};
          if (fs.existsSync(envPath)) {
            envConfig = require('dotenv').config({ path: envPath })?.parsed || {};
          }

          return { ...envConfig, ...process.env };
        },
      ],
      validate,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST', 'localhost'),
        port: configService.get<number>('DATABASE_PORT', 5432),
        username: configService.get<string>('DATABASE_USER', 'deepread'),
        password: configService.get<string>('DATABASE_PASSWORD', 'deepread_secret'),
        database: configService.get<string>('DATABASE_NAME', 'deepread'),
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        synchronize: configService.get<boolean>('DATABASE_SYNC', false),
        logging: configService.get<string>('NODE_ENV', 'development') === 'development',
        autoLoadEntities: true,
      }),
    }),
  ],
  exports: [ConfigModule, TypeOrmModule],
})
export class AppConfigModule {}
