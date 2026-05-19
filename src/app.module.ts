import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppConfigModule } from './config/app-config.module';
import { LoggerModule } from './common/logger/logger.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BooksModule } from './books/books.module';
import { ConversationModule } from './conversations/conversation.module';
import { ChatModule } from './chats/chat.module';
import { RagModule } from './rag/rag.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

/**
 * Main application module.
 * Configures all feature modules and global providers.
 */
@Module({
  imports: [
    // Configuration
    AppConfigModule,
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    
    // Logging
    LoggerModule,
    
    // Feature modules
    AuthModule,
    UsersModule,
    BooksModule,
    ConversationModule,
    ChatModule,
    RagModule,
  ],
  providers: [
    // Global exception filter for consistent error handling
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // Logging interceptor for request/response tracking
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // Transform interceptor for API response formatting
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
