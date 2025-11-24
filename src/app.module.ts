import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { InvestmentsModule } from './investments/investments.module';

@Module({
  imports: [AuthModule, InvestmentsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
