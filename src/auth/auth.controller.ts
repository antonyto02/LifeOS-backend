import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: RegisterDto, @Req() request: Request) {
    const clientIp = this.extractClientIp(request);
    const userAgent = this.extractUserAgent(request);

    await this.authService.register(body ?? {}, { clientIp, userAgent });

    return { message: 'User created successfully' };
  }

  private extractClientIp(request: Request): string | null {
    if (request.ip) {
      return request.ip;
    }

    if (request.headers['x-forwarded-for']) {
      const forwarded = Array.isArray(request.headers['x-forwarded-for'])
        ? request.headers['x-forwarded-for'][0]
        : request.headers['x-forwarded-for'];
      if (forwarded) {
        return forwarded.split(',')[0].trim();
      }
    }

    return request.socket?.remoteAddress ?? null;
  }

  private extractUserAgent(request: Request): string | null {
    const header = request.headers['user-agent'];
    return Array.isArray(header) ? header.join(' ') : header ?? null;
  }
}
