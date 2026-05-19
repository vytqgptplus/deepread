import { plainToClass } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

enum NodeEnvironment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Environment variables configuration class.
 * Validates all env vars at application startup.
 */
class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  @IsOptional()
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 9430;

  // Database
  @IsString()
  DATABASE_HOST: string = 'localhost';

  @IsNumber()
  @IsOptional()
  DATABASE_PORT: number = 5432;

  @IsString()
  DATABASE_USER: string = 'deepread';

  @IsString()
  DATABASE_PASSWORD: string = 'deepread_secret';

  @IsString()
  DATABASE_NAME: string = 'deepread';

  @IsBoolean()
  @IsOptional()
  DATABASE_SYNC: boolean = false;

  // Redis
  @IsString()
  REDIS_HOST: string = 'localhost';

  @IsNumber()
  @IsOptional()
  REDIS_PORT: number = 6379;

  // JWT
  @IsString()
  JWT_SECRET: string = 'default_jwt_secret';

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '7d';

  @IsString()
  JWT_REFRESH_SECRET: string = 'default_refresh_secret';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = '30d';

  // OpenRouter
  @IsString()
  OPENROUTER_API_KEY: string = '';

  @IsString()
  @IsOptional()
  OPENROUTER_BASE_URL: string = 'https://openrouter.ai/api/v1';

  @IsString()
  @IsOptional()
  OPENROUTER_MODEL: string = 'anthropic/claude-3-haiku';

  // Logging
  @IsString()
  @IsOptional()
  LOG_LEVEL: string = 'debug';

  @IsString()
  @IsOptional()
  LOG_DIR: string = 'logs';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed: ${errors.toString()}`);
  }

  return validatedConfig;
}
