import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TokenResponseDto } from './dto/token-response.dto';

/**
 * Auth service handling authentication business logic.
 * Manages user registration, login, and JWT token generation.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a new user.
   */
  async register(registerDto: RegisterDto): Promise<TokenResponseDto> {
    const { email, password, name } = registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = this.userRepository.create({
      email,
      passwordHash,
      name,
    });

    await this.userRepository.save(user);
    this.logger.log(`User registered: ${email}`);

    // Generate tokens
    return this.generateTokens(user);
  }

  /**
   * Login with email and password.
   */
  async login(loginDto: LoginDto): Promise<TokenResponseDto> {
    const { email, password } = loginDto;

    // Find user
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`User logged in: ${email}`);

    // Generate tokens
    return this.generateTokens(user);
  }

  /**
   * Refresh access token using refresh token.
   */
  async refreshToken(refreshToken: string): Promise<TokenResponseDto> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Check if refresh token is expired
      if (user.refreshTokenExp && user.refreshTokenExp < new Date()) {
        throw new UnauthorizedException('Refresh token expired');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Generate access and refresh tokens for a user.
   */
  private async generateTokens(user: User): Promise<TokenResponseDto> {
    const payload = { sub: user.id, email: user.email };

    // Access token
    const accessToken = this.jwtService.sign(payload);

    // Refresh token (longer expiry)
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d'),
    });

    // Calculate refresh token expiry
    const refreshExpDays = parseInt(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d'),
    );
    const refreshTokenExp = new Date();
    refreshTokenExp.setDate(refreshTokenExp.getDate() + refreshExpDays);

    // Save refresh token to user
    user.refreshToken = refreshToken;
    user.refreshTokenExp = refreshTokenExp;
    await this.userRepository.save(user);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '7d'),
    };
  }

  /**
   * Validate user by ID.
   */
  async validateUser(userId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id: userId } });
  }
}
