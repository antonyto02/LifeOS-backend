import { Injectable } from '@nestjs/common';
import { ActiveTokensState } from '../state/active-tokens.state';
import { BinanceDepthStreamService } from '../stream/binance-depth-stream.service';
import { BinanceAggTradeStreamService } from '../stream/binance-aggtrade-stream.service';

@Injectable()
export class StateUpdaterLogic {
  constructor(
    private readonly activeTokens: ActiveTokensState,
    private readonly depthStream: BinanceDepthStreamService,
    private readonly aggTradeStream: BinanceAggTradeStreamService,
  ) {}

  maybeActivateToken(symbol: string): void {
    if (!this.activeTokens.has(symbol)) {
      this.activeTokens.add(symbol);
      this.depthStream.openDepthStream(symbol);
      this.aggTradeStream.openAggTradeStream(symbol);
    }
  }
}
