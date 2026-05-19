import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { Public } from '../common/decorators/public.decorator';

/**
 * Auth controller handling authentication endpoints.
 * Provides registration, login, and token refresh.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user account.
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  @ApiBody({ type: RegisterDto })
  async register(@Body() registerDto: RegisterDto): Promise<TokenResponseDto> {
    this.logger.log(`Registration request for: ${registerDto.email}`);
    return this.authService.register(registerDto);
  }

  /**
   * Login with email and password.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiBody({ type: LoginDto })
  async login(@Body() loginDto: LoginDto): Promise<TokenResponseDto> {
    this.logger.log(`Login request for: ${loginDto.email}`);
    return this.authService.login(loginDto);
  }

  /**
   * Refresh access token using refresh token.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<TokenResponseDto> {
    this.logger.log('Token refresh request');
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }
}
