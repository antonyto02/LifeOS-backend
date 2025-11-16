import { Module } from '@nestjs/common';
import { TradingService } from './trading.service';
import { TradingController } from './trading.controller';
import { BinanceClient } from './binance.client';
import { TradingGateway } from './trading.gateway';
import { StateBuilder } from './state.builder';

@Module({
  controllers: [TradingController],
  providers: [
    TradingService,
    BinanceClient,
    TradingGateway,
    StateBuilder   // ← FALTABA ESTO
  ],
  exports: [
    TradingService,
    TradingGateway,
  ],
})
export class TradingModule {}
