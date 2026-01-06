import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // 1. Importa esto
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { InvestmentsModule } from './investments/investments.module';
import { DeviceTokenModule } from './device-token/device-token.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // 2. Agrega esta línea
    AuthModule, 
    InvestmentsModule, 
    DeviceTokenModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}