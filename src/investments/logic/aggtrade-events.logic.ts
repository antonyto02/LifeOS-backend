import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { SnapshotGateway } from '../snapshot/snapshot.gateway';
import { ActiveOrdersState } from '../state/active-orders.state';
import { CentralState } from '../state/central-state.state';
import { handleMarketEvent } from '../bot/decisions/handleMarketEvent';
import { StateUpdaterLogic } from './state-updater.logic';


@Injectable()
export class AggTradeEventsLogic {
  constructor(
    private readonly activeOrders: ActiveOrdersState,
    private readonly centralState: CentralState,
    private readonly snapshotGateway: SnapshotGateway,
    @Inject(forwardRef(() => StateUpdaterLogic))
    private readonly stateUpdater: StateUpdaterLogic,
  ) {}

  async handleAggTradeMessage(symbol: string, raw: string): Promise<void> {
    let msg: any;

    try {
      msg = JSON.parse(raw);
    } catch (err) {
      console.log(`[AGGTRADE] Error parseando JSON (${symbol})`, err);
      return;
    }

    // 🛑 Si no es un evento aggTrade → lo ignoramos
    if (msg.e !== 'aggTrade') return;

    // --- Datos relevantes ---
    const price = parseFloat(msg.p);   // precio de ejecución
    const qty = parseFloat(msg.q);     // cantidad ejecutada
    const isMaker = msg.m;             // true = SELL maker, false = BUY maker

    // ----------------------------------------------------------------------------------------------------------------
    // 1) ⭐ FUTURO: aquí vamos a actualizar el queue del usuario si tiene ordenes en este precio
    this.stateUpdater.updateUserQueuePosition(symbol, price, qty, isMaker);
    this.stateUpdater.updateCentralStateFromAggTrade(symbol, price, qty, isMaker);

    console.log('Memoria RAM actulizada');
    await handleMarketEvent(symbol);

    // ----------------------------------------------------------------------------------------------------------------

    // Por ahora únicamente avisamos al frontend para que se entere del trade
    this.snapshotGateway.broadcastSnapshot();
    console.log('Datos enviados al frontend');
  }

  // ⭐ Se crearán luego:
  // private updateUserQueuePosition(symbol: string, price: number, qty: number) {}
  // private updateCentralStateFromAggTrade(symbol: string, price: number, qty: number, isMaker: boolean) {}
}
