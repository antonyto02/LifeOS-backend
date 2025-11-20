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

    async handleUserExecutionReport(msg: any) {
    const symbol = msg.s;
    const orderType = msg.o;
    const execType = msg.x;
    const orderStatus = msg.X;

    if (!this.allowedTokens.has(symbol)) return;

    if (orderType !== 'LIMIT') return;

    if (execType === 'NEW') {
      this.stateUpdater.maybeActivateToken(symbol);
      const depth = await this.stateUpdater.fetchDepth(symbol);
      this.stateUpdater.updateDepthState(symbol, depth);
      this.stateUpdater.updateCentralState(symbol);
      const side = msg.S;
      const price = parseFloat(msg.p);
      const qty = parseFloat(msg.q);
      const orderId = msg.i;

      this.stateUpdater.createOrUpdateOrder(
        symbol,
        side,
        price,
        qty,
        depth,
        orderId
      );
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
