import { Module } from '@nestjs/common';
import { BinanceUserStreamService } from './binance-user-stream.service';

@Module({
  providers: [
    BinanceUserStreamService
],
  exports: [
    BinanceUserStreamService
  ],
})
export class StreamModule {}