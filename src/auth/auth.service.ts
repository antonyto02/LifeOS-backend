import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { generateBcryptHash } from './utils/bcrypt-hasher';
import { verifyBcryptHash } from './utils/bcrypt-verifier';
import { signJwt } from './utils/jwt-sign';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';
const MAX_TEXT_LENGTH = 255;

@Injectable()
export class AuthService {
  private readonly accessTokenSecret: string;
  private readonly accessTokenExpiresInSeconds: number;
  private readonly refreshTokenExpiresInMilliseconds: number;

  constructor(private readonly prisma: PrismaService) {
    const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
    if (!accessTokenSecret) {
      throw new Error('ACCESS_TOKEN_SECRET is not configured');
    }

    const accessTokenExpiresIn = process.env.ACCESS_TOKEN_EXPIRES_IN;
    const refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN;

    if (!accessTokenExpiresIn) {
      throw new Error('ACCESS_TOKEN_EXPIRES_IN is not configured');
    }

    if (!refreshTokenExpiresIn) {
      throw new Error('REFRESH_TOKEN_EXPIRES_IN is not configured');
    }

    this.accessTokenSecret = accessTokenSecret;
    this.accessTokenExpiresInSeconds = this.parseDurationToSeconds(
      accessTokenExpiresIn,
    );
    this.refreshTokenExpiresInMilliseconds =
      this.parseDurationToSeconds(refreshTokenExpiresIn) * 1000;
  }

  async register(payload: RegisterDto) {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Invalid request body');
    }

    const email = typeof payload.email === 'string' ? payload.email.trim() : '';
    const password =
      typeof payload.password === 'string' ? payload.password : '';

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    if (!EMAIL_REGEX.test(email)) {
      throw new BadRequestException('Invalid email format');
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException('Password does not meet requirements');
    }

    const normalizedEmail = email.toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser && (existingUser.isActive || !existingUser.deletedAt)) {
      throw new ConflictException('Unable to register user with provided credentials');
    }

    const passwordHash = await generateBcryptHash(password);

    try {
      await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          isActive: true,
          lastLogin: null,
          deletedAt: null,
        },
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Unable to register user with provided credentials',
        );
      }

      throw error;
    }

    return { message: 'User created successfully' };
  }

  async login(
    payload: LoginDto,
    context: { ipAddress?: string; userAgent?: string } = {},
  ) {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Invalid request body');
    }

    const email = typeof payload.email === 'string' ? payload.email.trim() : '';
    const password =
      typeof payload.password === 'string' ? payload.password : '';

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    if (!EMAIL_REGEX.test(email)) {
      throw new BadRequestException('Invalid email format');
    }

    const normalizedEmail = email.toLowerCase();
    const ipAddress = this.sanitizeText(context.ipAddress) || 'unknown';
    const userAgent = this.sanitizeText(context.userAgent) || 'unknown';

    const preliminaryAttempt = await this.prisma.loginAttempt.create({
      data: {
        userId: null,
        emailAttempted: email,
        ipAddress,
        userAgent,
        success: false,
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.loginAttempt.update({
      where: { id: preliminaryAttempt.id },
      data: { userId: user.id },
    });

    if (!user.isActive || user.deletedAt) {
      throw new ForbiddenException('User is not allowed to login');
    }

    const passwordIsValid = await verifyBcryptHash(password, user.passwordHash);

    if (!passwordIsValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const now = new Date();
    const accessToken = signJwt(
      {
        sub: user.id,
        email: user.email,
      },
      this.accessTokenSecret,
      this.accessTokenExpiresInSeconds,
    );

    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = this.hashToken(refreshToken);
    const refreshTokenExpiresAt = new Date(
      now.getTime() + this.refreshTokenExpiresInMilliseconds,
    );

    await this.prisma.loginAttempt.update({
      where: { id: preliminaryAttempt.id },
      data: { success: true },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: now },
    });

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        ipAddress,
        userAgent,
        expiresAt: refreshTokenExpiresAt,
        revokedReasonId: null,
        closedAt: null,
      },
    });

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt,
    };
  }

  createRefreshTokenCookie(token: string, expiresAt: Date) {
    const maxAgeSeconds = Math.floor(
      this.refreshTokenExpiresInMilliseconds / 1000,
    );

    const cookieSegments = [
      `${REFRESH_TOKEN_COOKIE_NAME}=${token}`,
      `Expires=${expiresAt.toUTCString()}`,
      `Max-Age=${maxAgeSeconds}`,
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      'Path=/',
    ];

    return cookieSegments.join('; ');
  }

  private sanitizeText(value?: string) {
    if (!value) {
      return '';
    }

    return value.slice(0, MAX_TEXT_LENGTH);
  }

  private parseDurationToSeconds(value: string) {
    const trimmed = value.trim();

    const match = trimmed.match(/^(\d+)([smhd])?$/i);
    if (!match) {
      throw new Error(`Invalid duration format: ${value}`);
    }

    const amount = Number(match[1]);
    const unit = (match[2] || 'm').toLowerCase();

    const multiplier = this.getUnitMultiplier(unit);
    return amount * multiplier;
  }

  private getUnitMultiplier(unit: string) {
    switch (unit) {
      case 's':
        return 1;
      case 'm':
        return 60;
      case 'h':
        return 3600;
      case 'd':
        return 86400;
      default:
        throw new Error(`Unsupported duration unit: ${unit}`);
    }
  }

  private generateRefreshToken() {
    return randomBytes(48).toString('base64url');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
