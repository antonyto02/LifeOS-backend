import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TradingModule } from './trading/trading.module';

@Module({
  imports: [AuthModule, TradingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
