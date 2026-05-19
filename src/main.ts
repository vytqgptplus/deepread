import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

/**
 * Bootstrap function to start the NestJS application.
 * Configures global middleware, validation pipes, and Swagger documentation.
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Create NestJS application
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // Get configuration
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 9430);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // Global validation pipe for DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties without decorators
      forbidNonWhitelisted: true, // Throw error for unknown properties
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Enable type conversion
      },
    }),
  );

  // Enable CORS for frontend integration
  app.enableCors({
    origin: true, // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Enable shutdown hooks for graceful shutdown
  app.enableShutdownHooks();

  // Swagger API documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('DeepRead API')
    .setDescription('AI-powered book reading platform API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token',
      },
      'JWT-auth',
    )
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Conversations', 'Conversation management')
    .addTag('Chats', 'Chat and messaging with AI')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    customSiteTitle: 'DeepRead API Documentation',
  });

  // Start the server
  await app.listen(port);
  
  logger.log(`🚀 DeepRead API running on port ${port}`);
  logger.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
  logger.log(`🌍 Environment: ${nodeEnv}`);

  // Graceful shutdown handler
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });
}

bootstrap();
