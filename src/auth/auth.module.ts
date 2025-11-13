import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BcryptService } from '../security/bcrypt.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, BcryptService],
})
export class AuthModule {}
