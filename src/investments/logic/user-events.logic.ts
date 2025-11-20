import { Injectable } from '@nestjs/common';
import { AllowedTokensState } from '../state/allowed-tokens.state';
import { ActiveTokensState } from '../state/active-tokens.state';
import { BinanceDepthStreamService } from '../stream/binance-depth-stream.service';
import { BinanceAggTradeStreamService } from '../stream/binance-aggtrade-stream.service';
import { StateUpdaterLogic } from './state-updater.logic';

@Injectable()
export class UserEventsLogic {
  constructor(
    private readonly allowedTokens: AllowedTokensState,
    private readonly activeTokens: ActiveTokensState,
    private readonly depthStream: BinanceDepthStreamService,
    private readonly aggTradeStream: BinanceAggTradeStreamService,
    private readonly stateUpdater: StateUpdaterLogic
  ) {}

  handleUserExecutionReport(msg: any) {
    const symbol = msg.s;
    const orderType = msg.o;
    const execType = msg.x;
    const orderStatus = msg.X;

    if (!this.allowedTokens.has(symbol)) return;

    if (orderType !== 'LIMIT') return;

    if (execType === 'NEW') {
      this.stateUpdater.maybeActivateToken(symbol);
      return;
    }

    if (execType === 'CANCELED') {
      this.activeTokens.remove(symbol);

      this.depthStream.closeDepthStream(symbol);
      this.aggTradeStream.closeAggTradeStream(symbol);

      return;
    }

    if (execType === 'TRADE' && orderStatus === 'PARTIALLY_FILLED') {
      return;
    }

    if (execType === 'TRADE' && orderStatus === 'FILLED') {
      return;
    }
  }
}
