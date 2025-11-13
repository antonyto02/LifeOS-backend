import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import type { RegisterDto } from './dto/register.dto';
import { generateBcryptHash } from './utils/bcrypt-hasher';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

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
}
