import { Module } from '@nestjs/common';
import { BinanceUserStreamService } from './binance-user-stream.service';
import { BinanceDepthStreamService } from './binance-depth-stream.service';
import { BinanceAggTradeStreamService } from './binance-aggtrade-stream.service';
import { LogicModule } from '../logic/logic.module';

@Module({
  imports: [
    LogicModule
  ],
  providers: [
    BinanceUserStreamService,
    BinanceDepthStreamService,
    BinanceAggTradeStreamService,
  ],
  exports: [
    BinanceUserStreamService,
    BinanceDepthStreamService,
    BinanceAggTradeStreamService,
  ],
})
export class StreamModule {}
