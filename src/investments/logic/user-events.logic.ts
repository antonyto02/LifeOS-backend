import { Injectable } from '@nestjs/common';
import { AllowedTokensState } from '../state/allowed-tokens.state';
import { ActiveTokensState } from '../state/active-tokens.state';
import { BinanceDepthStreamService } from '../stream/binance-depth-stream.service';
import { BinanceAggTradeStreamService } from '../stream/binance-aggtrade-stream.service';
import { StateUpdaterLogic } from './state-updater.logic';
import { SnapshotGateway } from '../snapshot/snapshot.gateway';
import placeSellOrder from '../bot/actions/placeSellOrder';
import placeBuyOrder from '../bot/actions/placeBuyOrder';



@Injectable()
export class UserEventsLogic {
  constructor(
    private readonly allowedTokens: AllowedTokensState,
    private readonly activeTokens: ActiveTokensState,
    private readonly depthStream: BinanceDepthStreamService,
    private readonly aggTradeStream: BinanceAggTradeStreamService,
    private readonly stateUpdater: StateUpdaterLogic,
    private readonly snapshotGateway: SnapshotGateway

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
      this.snapshotGateway.broadcastSnapshot();
      return;
    }

    if (execType === 'CANCELED') {
      const orderId = msg.i;
      await this.stateUpdater.cancelOrder(orderId);

      this.snapshotGateway.broadcastSnapshot();
      return;
    }



    if (execType === 'TRADE' && orderStatus === 'PARTIALLY_FILLED') {
      const orderId = msg.i;
      const filledQty = parseFloat(msg.l);
      const side = msg.S;

      this.stateUpdater.applyPartialFill(orderId, filledQty);

      if (side === 'BUY') {
        await placeSellOrder(symbol);
      } else if (side === 'SELL') {
        await placeBuyOrder();
      }

      this.snapshotGateway.broadcastSnapshot();

      return;
    }


    if (execType === 'TRADE' && orderStatus === 'FILLED') {
      const orderId = msg.i;
      const side = msg.S;
      await this.stateUpdater.cancelOrder(orderId);

      if (side === 'BUY') {
        await placeSellOrder(symbol);
      } else if (side === 'SELL') {
        console.log('[user-events] Orden SELL completada.');
        await placeBuyOrder();
      }

      this.snapshotGateway.broadcastSnapshot();
      return;
    }
  }
}
