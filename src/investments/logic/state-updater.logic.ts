import { Inject, Injectable, forwardRef } from '@nestjs/common';
import fetch from 'node-fetch';
import { ActiveTokensState } from '../state/active-tokens.state';
import { BinanceDepthStreamService } from '../stream/binance-depth-stream.service';
import { BinanceAggTradeStreamService } from '../stream/binance-aggtrade-stream.service';
import { DepthState } from '../state/depth.state';
import { CentralState } from '../state/central-state.state';
import { ActiveOrdersState, ActiveOrder } from '../state/active-orders.state';



export interface DepthData {
  bids: Array<[number, number]>;
  asks: Array<[number, number]>;
}

@Injectable()
export class StateUpdaterLogic {
  constructor(
    private readonly activeTokens: ActiveTokensState,
    @Inject(forwardRef(() => BinanceDepthStreamService))
    private readonly depthStream: BinanceDepthStreamService,
    private readonly aggTradeStream: BinanceAggTradeStreamService,
    private readonly depthState: DepthState,
    private readonly centralState: CentralState,
    private readonly activeOrders: ActiveOrdersState,


  ) {}

  private normalizePriceKey(price: number | string): string {
    const numeric = Number(price);

    return Number.isFinite(numeric) ? numeric.toString() : price.toString();
  }

  private findExistingPriceKey(
    levels: Record<string, number | ActiveOrder>,
    price: number | string,
  ): string | null {
    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice)) {
      return null;
    }

    const normalized = this.normalizePriceKey(numericPrice);

    if (normalized in levels) {
      return normalized;
    }

    for (const key of Object.keys(levels)) {
      const numericKey = Number(key);

      if (Number.isFinite(numericKey) && numericKey === numericPrice) {
        return key;
      }
    }

    return null;
  }

  maybeActivateToken(symbol: string): void {
    if (!this.activeTokens.has(symbol)) {
      this.activeTokens.add(symbol);

      this.depthStream.openDepthStream(symbol);
      this.aggTradeStream.openAggTradeStream(symbol);
    }
  }


  async fetchDepth(symbol: string): Promise<DepthData> {
    const url = `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=20`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Binance depth request failed: ${response.status}`);
      }

      const json = await response.json() as {
        bids: [string, string][],
        asks: [string, string][],
      };

      const bids: Array<[number, number]> = json.bids.map(
        (b: [string, string]) => [parseFloat(b[0]), parseFloat(b[1])]
      );

      const asks: Array<[number, number]> = json.asks.map(
        (a: [string, string]) => [parseFloat(a[0]), parseFloat(a[1])]
      );

      return {
        bids,
        asks,
      };

    } catch (err) {
      console.error(`[fetchDepth] Error obteniendo profundidad para ${symbol}`, err);

      return {
        bids: [],
        asks: [],
      };
    }
  }
  updateDepthState(symbol: string, depth: DepthData): void {
    const { bids, asks } = depth;
    this.depthState.resetToken(symbol);
    const buyMap: Record<string, number> = {};
    const sellMap: Record<string, number> = {};
    const sortedBids = [...bids].sort((a, b) => a[0] - b[0]);

    for (const [price, qty] of sortedBids) {
      const key = this.normalizePriceKey(price);
      buyMap[key] = qty;
    }

    const sortedAsks = [...asks].sort((a, b) => a[0] - b[0]);

    for (const [price, qty] of sortedAsks) {
      const key = this.normalizePriceKey(price);
      sellMap[key] = qty;
    }
    this.depthState.setSnapshot(symbol, buyMap, sellMap);
  }
updateCentralState(symbol: string): void {
  const depth = this.depthState.getAll()[symbol];
  if (!depth) return;

  const buyLevels = Object.keys(depth.BUY).map(p => parseFloat(p));
  const sellLevels = Object.keys(depth.SELL).map(p => parseFloat(p));

  if (buyLevels.length === 0 || sellLevels.length === 0) {
    return;
  }

  const centralBuy = Math.max(...buyLevels);
  const centralSell = Math.min(...sellLevels);

  this.centralState.updateCentralBuyPrice(symbol, centralBuy);
  this.centralState.updateCentralSellPrice(symbol, centralSell);
}

createOrUpdateOrder(
  symbol: string,
  side: 'BUY' | 'SELL',
  price: number,
  qty: number,
  depth: DepthData,
  orderId: number
): void {


  const priceKey = this.normalizePriceKey(price);
  let marketDepthAtPrice = 0;

  if (side === 'BUY') {
    const level = depth.bids.find(([p]) => p === price);
    marketDepthAtPrice = level ? level[1] : 0;
  } else {
    const level = depth.asks.find(([p]) => p === price);
    marketDepthAtPrice = level ? level[1] : 0;
  }

  const queuePos = Math.max(marketDepthAtPrice - qty, 0);
  const order = {
    id: orderId,
    pending_amount: qty,
    queue_position: queuePos,
    filled_amount: 0,

    token: symbol,
    side,
    price,
  };
  this.activeOrders.setOrder(symbol, side, priceKey, order);
}

findOrderById(orderId: number): {
  symbol: string;
  side: 'BUY' | 'SELL';
  price: string;
  order: ActiveOrder;
} | null {

  const all = this.activeOrders.getAll();

  for (const symbol of Object.keys(all)) {
    const sides = all[symbol];

    for (const side of ['BUY', 'SELL'] as const) {
      const ordersAtSide = sides[side];

      for (const price of Object.keys(ordersAtSide)) {
        const order = ordersAtSide[price];

        if (order.id === orderId) {
          return {
            symbol,
            side,
            price,
            order,
          };
        }
      }
    }
  }

  return null;
}

async cancelOrder(orderId: number): Promise<void> {
  const found = this.findOrderById(orderId);

  if (!found) {
    console.warn(`[cancelOrder] Orden ${orderId} no encontrada`);
    return;
  }

  const { symbol, side, price } = found;

  // 1. Eliminar la orden puntual
  this.activeOrders.deleteOrder(symbol, side, price);
  console.log(`[cancelOrder] Orden ${orderId} eliminada de ${symbol} ${side} @ ${price}`);

  // 2. Verificar si siguen existiendo órdenes en ese mismo precio
  const remainingAtPrice = this.activeOrders.getOrder(symbol, side, price);

  if (!remainingAtPrice) {
    console.log(`[cancelOrder] No quedan órdenes en el precio ${price}, limpiando price-key...`);
    this.activeOrders.deleteOrder(symbol, side, price);
  }

  // 3. Revisar si el token sigue teniendo órdenes
  const tokenOrders = this.activeOrders.getAll()[symbol];
  const hasAnyBuy = tokenOrders?.BUY && Object.keys(tokenOrders.BUY).length > 0;
  const hasAnySell = tokenOrders?.SELL && Object.keys(tokenOrders.SELL).length > 0;

  const stillHasOrders = hasAnyBuy || hasAnySell;

  // 4. Si YA NO QUEDAN ÓRDENES → limpiar todo completamente
  if (!stillHasOrders) {
    console.log(`[cancelOrder] Ya no existen órdenes en ${symbol}. Limpiando estado completo.`);
    this.activeTokens.remove(symbol);
    this.depthState.clearToken(symbol);
    this.centralState.clearToken(symbol);
    this.activeOrders.clearToken(symbol);
    this.depthStream.closeDepthStream(symbol);
    this.aggTradeStream.closeAggTradeStream(symbol);

    return; 
  }

  // 5. SI TODAVÍA QUEDAN ÓRDENES → actualizar depth + central state
  const depth = await this.fetchDepth(symbol);
  this.updateDepthState(symbol, depth);
  this.updateCentralState(symbol);

  return;
}


applyPartialFill(orderId: number, filledQty: number): void {
  const found = this.findOrderById(orderId);

  if (!found) {
    console.warn(`[applyPartialFill] Orden ${orderId} no encontrada`);
    return;
  }

  const { symbol, side, price, order } = found;

  // No permitir que se pase del máximo
  const newFilled = order.filled_amount + filledQty;
  const remaining = Math.max(order.pending_amount - filledQty, 0);

  order.filled_amount = newFilled;
  order.pending_amount = remaining;

  // Actualizamos la orden
  this.activeOrders.setOrder(symbol, side, price, order);

  console.log(
    `[applyPartialFill] Orden ${orderId} actualizada → filled=${newFilled}, pending=${remaining}`
  );
}

applyDelta(
  symbol: string,
  bids: Array<[number, number]>,
  asks: Array<[number, number]>
): void {

  // Asegurar que exista el contenedor en depthState
  if (!this.depthState.getAll()[symbol]) {
    this.depthState.setSnapshot(symbol, {}, {});
  }

  const current = this.depthState.getAll()[symbol];
  const buyLevels = current.BUY;
  const sellLevels = current.SELL;

  // 👉 Actualizar BIDS
  for (const [price, qty] of bids) {
    const existingKey = this.findExistingPriceKey(buyLevels, price);

    if (!existingKey) continue;

    if (qty === 0) delete buyLevels[existingKey];
    else buyLevels[existingKey] = qty;
  }

  // 👉 Actualizar ASKS
  for (const [price, qty] of asks) {
    const existingKey = this.findExistingPriceKey(sellLevels, price);

    if (!existingKey) continue;

    if (qty === 0) delete sellLevels[existingKey];
    else sellLevels[existingKey] = qty;
  }
  this.updateQueuePositionsAfterDepthDelta(symbol, bids, asks);

}

private updateQueuePositionsAfterDepthDelta(
  symbol: string,
  bids: Array<[number, number]>,
  asks: Array<[number, number]>
): void {

  const active = this.activeOrders.getAll()[symbol];
  if (!active) return;

  // BUY SIDE — revisar cambios en bids
  for (const [price, newDepth] of bids) {
    const existingKey = this.findExistingPriceKey(active.BUY ?? {}, price);
    if (!existingKey) continue;

    const order = active.BUY?.[existingKey];
    if (!order) continue;

    const combined = order.queue_position + order.pending_amount;

    if (newDepth < combined) {
      const newQueue = Math.max(newDepth - order.pending_amount, 0);
      order.queue_position = newQueue;
      this.activeOrders.setOrder(symbol, 'BUY', existingKey, order);

      console.log(
        `[Δ BUY] ${symbol} @ ${existingKey} → newDepth=${newDepth}, combined=${combined}, newQueue=${newQueue}`
      );
    }
  }

  // SELL SIDE — revisar cambios en asks
  for (const [price, newDepth] of asks) {
    const existingKey = this.findExistingPriceKey(active.SELL ?? {}, price);
    if (!existingKey) continue;

    const order = active.SELL?.[existingKey];
    if (!order) continue;

    const combined = order.queue_position + order.pending_amount;

    if (newDepth < combined) {
      const newQueue = Math.max(newDepth - order.pending_amount, 0);
      order.queue_position = newQueue;
      this.activeOrders.setOrder(symbol, 'SELL', existingKey, order);

      console.log(
        `[Δ SELL] ${symbol} @ ${existingKey} → newDepth=${newDepth}, combined=${combined}, newQueue=${newQueue}`
      );
    }
  }
}


}
