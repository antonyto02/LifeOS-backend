import { Injectable } from '@nestjs/common';
import { StateUpdaterLogic } from './state-updater.logic';
import { SnapshotGateway } from '../snapshot/snapshot.gateway';

@Injectable()
export class DepthEventsLogic {
  constructor(
    private readonly stateUpdater: StateUpdaterLogic,
    private readonly snapshotGateway: SnapshotGateway,
  ) {}

  handleDepthMessage(symbol: string, raw: string): void {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      console.log(`[DEPTH] Error parseando JSON para ${symbol}`, e);
      return;
    }

    if (msg.e !== 'depthUpdate') return;

    const bids = msg.b || [];
    const asks = msg.a || [];

    // 👉 Actualizar depth state (usa tu lógica oficial)
    this.stateUpdater.applyDelta(symbol, bids, asks);

    // 👉 Recalcular central buy/sell
    this.stateUpdater.updateCentralState(symbol);

    // 👉 Avisar al frontend
    this.snapshotGateway.broadcastSnapshot();
  }
}
