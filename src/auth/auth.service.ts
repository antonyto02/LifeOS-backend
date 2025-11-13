import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BcryptService } from '../security/bcrypt.service';
import { RegisterDto } from './dto/register.dto';

interface RegistrationMetadata {
  clientIp: string | null;
  userAgent: string | null;
}

@Injectable()
export class AuthService {
  private readonly minPasswordLength = 8;
  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bcryptService: BcryptService,
  ) {}

  async register(dto: RegisterDto, _metadata: RegistrationMetadata): Promise<void> {
    const email = this.validateEmail(dto.email);
    const password = this.validatePassword(dto.password);

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Unable to complete registration.');
    }

    const passwordHash = await this.bcryptService.hash(password);

    await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        isActive: true,
        lastLogin: null,
        deletedAt: null,
      },
    });
  }

  private validateEmail(email?: string): string {
    if (!email || typeof email !== 'string') {
      throw new BadRequestException('Invalid email.');
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!this.emailRegex.test(normalizedEmail)) {
      throw new BadRequestException('Invalid email.');
    }

    return normalizedEmail;
  }

  private validatePassword(password?: string): string {
    if (typeof password !== 'string') {
      throw new BadRequestException('Invalid password.');
    }

    const trimmedPassword = password.trim();

    if (!trimmedPassword) {
      throw new BadRequestException('Invalid password.');
    }

    if (password.length < this.minPasswordLength) {
      throw new BadRequestException('Invalid password.');
    }

    return password;
  }
}
