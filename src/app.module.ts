import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { InvestmentsModule } from './investments/investments.module';
import { DeviceTokenModule } from './device-token/device-token.module';

@Module({
  imports: [AuthModule, InvestmentsModule, DeviceTokenModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
