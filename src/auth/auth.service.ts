import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { generateBcryptHash } from './utils/bcrypt-hasher';
import { verifyBcryptHash } from './utils/bcrypt-verifier';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const REQUIRED_ENV_VARS = [
  'ACCESS_TOKEN_EXPIRES_IN',
  'REFRESH_TOKEN_EXPIRES_IN',
  'ACCESS_TOKEN_SECRET',
] as const;

for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

type LoginMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

type LoginResult = {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresInMs: number;
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(
    payload: LoginDto,
    metadata: LoginMetadata,
  ): Promise<LoginResult> {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Invalid request body');
    }

    const email = typeof payload.email === 'string' ? payload.email.trim() : '';
    const password =
      typeof payload.password === 'string' ? payload.password : '';

    if (!email || password.trim().length === 0) {
      throw new BadRequestException('Email and password are required');
    }

    if (!EMAIL_REGEX.test(email)) {
      throw new BadRequestException('Invalid email format');
    }

    const normalizedEmail = email.toLowerCase();
    const ipAddress = normalizeIp(metadata?.ipAddress);
    const userAgent = normalizeUserAgent(metadata?.userAgent);

    const loginAttempt = await this.prisma.loginAttempt.create({
      data: {
        userId: null,
        emailAttempted: normalizedEmail,
        ipAddress,
        userAgent,
        success: false,
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive || user.deletedAt) {
      await this.prisma.loginAttempt.update({
        where: { id: loginAttempt.id },
        data: {
          userId: user.id,
          success: false,
        },
      });

      throw new ForbiddenException('Access denied');
    }

    const isPasswordValid = await verifyBcryptHash(password, user.passwordHash);

    if (!isPasswordValid) {
      await this.prisma.loginAttempt.update({
        where: { id: loginAttempt.id },
        data: {
          userId: user.id,
          success: false,
        },
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.loginAttempt.update({
      where: { id: loginAttempt.id },
      data: {
        userId: user.id,
        success: true,
      },
    });

    const { refreshToken, refreshTokenExpiresInMs } =
      this.generateRefreshToken();
    const accessToken = this.generateAccessToken(user.id, normalizedEmail);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + refreshTokenExpiresInMs),
        revokedReasonId: null,
        closedAt: null,
      },
    });

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresInMs,
    };
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
      throw new ConflictException(
        'Unable to register user with provided credentials',
      );
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

  private generateAccessToken(userId: string, email: string) {
    const expiresInMs = this.parseDurationToMilliseconds(
      this.getAccessTokenExpiryValue(),
    );
    const expiresInSeconds = Math.floor(expiresInMs / 1000);

    if (expiresInSeconds <= 0) {
      throw new Error('ACCESS_TOKEN_EXPIRES_IN must be greater than 0');
    }

    return this.signJwt({ sub: userId, email }, expiresInSeconds);
  }

  private generateRefreshToken() {
    const expiresInMs = this.parseDurationToMilliseconds(
      this.getRefreshTokenExpiryValue(),
    );

    if (expiresInMs <= 0) {
      throw new Error('REFRESH_TOKEN_EXPIRES_IN must be greater than 0');
    }

    return {
      refreshToken: this.toBase64Url(randomBytes(64)),
      refreshTokenExpiresInMs: expiresInMs,
    };
  }

  private getAccessTokenExpiryValue() {
    const value = process.env.ACCESS_TOKEN_EXPIRES_IN;

    if (!value) {
      throw new Error('ACCESS_TOKEN_EXPIRES_IN must be defined');
    }

    return value;
  }

  private getRefreshTokenExpiryValue() {
    const value = process.env.REFRESH_TOKEN_EXPIRES_IN;

    if (!value) {
      throw new Error('REFRESH_TOKEN_EXPIRES_IN must be defined');
    }

    return value;
  }

  private getAccessTokenSecret() {
    const secret = process.env.ACCESS_TOKEN_SECRET;

    if (!secret) {
      throw new Error('ACCESS_TOKEN_SECRET must be defined');
    }

    return secret;
  }

  private parseDurationToMilliseconds(value: string) {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d+)(ms|s|m|h|d)?$/i);

    if (!match) {
      throw new Error(`Invalid duration format: ${value}`);
    }

    const amount = Number(match[1]);
    const unit = (match[2] || 'm').toLowerCase();

    const unitToMs: Record<string, number> = {
      ms: 1,
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    const multiplier = unitToMs[unit];

    if (!multiplier) {
      throw new Error(`Unsupported duration unit: ${value}`);
    }

    return amount * multiplier;
  }

  private signJwt(payload: Record<string, unknown>, expiresInSeconds: number) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiration = issuedAt + expiresInSeconds;
    const body = { ...payload, iat: issuedAt, exp: expiration };
    const base64Header = this.base64UrlEncode(JSON.stringify(header));
    const base64Payload = this.base64UrlEncode(JSON.stringify(body));
    const data = `${base64Header}.${base64Payload}`;
    const signature = createHmac('sha256', this.getAccessTokenSecret())
      .update(data)
      .digest('base64')
      .replace(/=+$/u, '')
      .replace(/\+/gu, '-')
      .replace(/\//gu, '_');

    return `${data}.${signature}`;
  }

  private base64UrlEncode(value: string | Buffer) {
    return Buffer.from(value)
      .toString('base64')
      .replace(/=+$/u, '')
      .replace(/\+/gu, '-')
      .replace(/\//gu, '_');
  }

  private toBase64Url(buffer: Buffer) {
    return buffer
      .toString('base64')
      .replace(/=+$/u, '')
      .replace(/\+/gu, '-')
      .replace(/\//gu, '_');
  }
}

function normalizeIp(ip?: string) {
  const normalized =
    typeof ip === 'string' && ip.trim() ? ip.trim() : 'unknown';
  return normalized.slice(0, 255);
}

function normalizeUserAgent(userAgent?: string | null) {
  if (!userAgent || typeof userAgent !== 'string') {
    return null;
  }

  return userAgent.slice(0, 255);
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
