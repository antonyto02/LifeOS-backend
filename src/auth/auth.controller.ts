import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.login(body, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const maxAgeSeconds = Math.floor(result.refreshTokenExpiresInMs / 1000);
    const cookieSegments = [
      `refresh_token=${result.refreshToken}`,
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      'Path=/',
      `Max-Age=${Math.max(maxAgeSeconds, 0)}`,
      `Expires=${new Date(
        Date.now() + result.refreshTokenExpiresInMs,
      ).toUTCString()}`,
    ];

    reply.header('Set-Cookie', cookieSegments.join('; '));

    return {
      access_token: result.accessToken,
    };
  }
}
