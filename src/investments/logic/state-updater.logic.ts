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
      buyMap[price.toString()] = qty;
    }

    const sortedAsks = [...asks].sort((a, b) => a[0] - b[0]);

    for (const [price, qty] of sortedAsks) {
      sellMap[price.toString()] = qty;
    }
    this.depthState.setSnapshot(symbol, buyMap, sellMap);
  }

  updateCentralState(symbol: string): void {
    const depth = this.depthState.getAll()[symbol];
    if (!depth) return;

    const buyLevels = Object.keys(depth.BUY).map((p) => parseFloat(p));
    const sellLevels = Object.keys(depth.SELL).map((p) => parseFloat(p));

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
    orderId: number,
  ): void {
    const priceKey = price.toString();
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
          const ordersAtPrice = ordersAtSide[price];

          for (const order of ordersAtPrice) {
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
    this.activeOrders.deleteOrder(symbol, side, price, orderId);
    console.log(`[cancelOrder] Orden ${orderId} eliminada de ${symbol} ${side} @ ${price}`);

    // 2. Verificar si siguen existiendo órdenes en ese mismo precio
    const remainingAtPrice = this.activeOrders.getOrder(symbol, side, price);

    if (!remainingAtPrice || remainingAtPrice.length === 0) {
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
      `[applyPartialFill] Orden ${orderId} actualizada → filled=${newFilled}, pending=${remaining}`,
    );
  }

  applyDelta(
    symbol: string,
    bids: Array<[string | number, string | number]>,
    asks: Array<[string | number, string | number]>,
  ): void {
    const normalizePrice = (price: string | number): string =>
      parseFloat(price as string).toString();
    const toNumber = (value: string | number): number => parseFloat(value as string);

    // Asegurar que exista el contenedor en depthState
    if (!this.depthState.getAll()[symbol]) {
      this.depthState.setSnapshot(symbol, {}, {});
    }

    const current = this.depthState.getAll()[symbol];
    const buyLevels = current.BUY;
    const sellLevels = current.SELL;

    const normalizedBids: Array<[number, number]> = [];
    const normalizedAsks: Array<[number, number]> = [];

    const applySide = (
      updates: Array<[string | number, string | number]>,
      levels: Record<string, number>,
      normalized: Array<[number, number]>,
      side: 'BUY' | 'SELL',
    ): void => {
      for (const [rawPrice, rawQty] of updates) {
        const key = normalizePrice(rawPrice);
        const qty = toNumber(rawQty);

        if (Number.isNaN(qty)) continue;

        const previous = levels[key];

        if (qty === 0) {
          if (previous !== undefined) {
            delete levels[key];
            console.log(
              `[DEPTH] ${symbol} ${side} precio:${key} eliminado (antes ${previous})`,
            );
          }
        } else {
          levels[key] = qty;
          if (previous !== qty) {
            console.log(
              `[DEPTH] ${symbol} ${side} precio:${key} cambiado de ${previous ?? 0} a ${qty}`,
            );
          }
        }

        normalized.push([parseFloat(key), qty]);
      }
    };

    applySide(bids, buyLevels, normalizedBids, 'BUY');
    applySide(asks, sellLevels, normalizedAsks, 'SELL');

    this.updateQueuePositionsAfterDepthDelta(symbol, normalizedBids, normalizedAsks);
  }

  updateUserQueuePosition(
    symbol: string,
    price: number,
    qty: number,
    isMaker: boolean,
  ): void {
    const allOrders = this.activeOrders.getAll();
    const tokenOrders = allOrders[symbol];

    if (!tokenOrders) {
      console.log(`[AggTrade][queue] No hay órdenes activas para ${symbol}`);
      return;
    }
    
    const side: 'BUY' | 'SELL' = isMaker ? 'BUY' : 'SELL';
    const priceKey = price.toString();
    const ordersAtPrice = tokenOrders[side]?.[priceKey];

    if (!ordersAtPrice || ordersAtPrice.length === 0) {
      console.log(
        `[AggTrade][queue] No se encontró orden en ${symbol} ${side} @ ${priceKey}`,
      );
      return;
    }

    for (const order of ordersAtPrice) {
      const previousQueue = order.queue_position;
      const newQueue = Math.max(previousQueue - qty, 0);
      order.queue_position = newQueue;

      this.activeOrders.setOrder(symbol, side, priceKey, order);

      console.log(
        `[AggTrade][queue] ${symbol} ${side} @ ${priceKey} → queue ${previousQueue} -> ${newQueue} (executed=${qty})`,
      );
    }
  }

  updateCentralStateFromAggTrade(
    symbol: string,
    price: number,
    qty: number,
    isMaker: boolean,
  ): void {
    const executedSide: 'BUY' | 'SELL' = isMaker ? 'BUY' : 'SELL';

    this.centralState.get(symbol); // ensure exists

    if (executedSide === 'BUY') {
      this.centralState.addExecutedBuy(symbol, qty);
    } else {
      this.centralState.addExecutedSell(symbol, qty);
    }

    const snapshot = this.centralState.get(symbol);

    console.log(
      `[AggTrade][central] ${symbol} ${executedSide} @ ${price} → executedSinceBuy=${snapshot.executedSinceBuyPriceChange}, executedSinceSell=${snapshot.executedSinceSellPriceChange}`,
    );
  }

  private updateQueuePositionsAfterDepthDelta(
    symbol: string,
    bids: Array<[number, number]>,
    asks: Array<[number, number]>,
  ): void {
    const active = this.activeOrders.getAll()[symbol];
    if (!active) return;

    // BUY SIDE — revisar cambios en bids
    for (const [price, newDepth] of bids) {
      const key = price.toString();
      const ordersAtPrice = active.BUY?.[key];
      if (!ordersAtPrice || ordersAtPrice.length === 0) continue;

      for (const order of ordersAtPrice) {
        const combined = order.queue_position + order.pending_amount;

        if (newDepth < combined) {
          const newQueue = Math.max(newDepth - order.pending_amount, 0);
          order.queue_position = newQueue;
          this.activeOrders.setOrder(symbol, 'BUY', key, order);

          console.log(
            `[Δ BUY] ${symbol} @ ${key} → newDepth=${newDepth}, combined=${combined}, newQueue=${newQueue}`,
          );
        }
      }
    }

    // SELL SIDE — revisar cambios en asks
    for (const [price, newDepth] of asks) {
      const key = price.toString();
      const ordersAtPrice = active.SELL?.[key];
      if (!ordersAtPrice || ordersAtPrice.length === 0) continue;

      for (const order of ordersAtPrice) {
        const combined = order.queue_position + order.pending_amount;

        if (newDepth < combined) {
          const newQueue = Math.max(newDepth - order.pending_amount, 0);
          order.queue_position = newQueue;
          this.activeOrders.setOrder(symbol, 'SELL', key, order);

          console.log(
            `[Δ SELL] ${symbol} @ ${key} → newDepth=${newDepth}, combined=${combined}, newQueue=${newQueue}`,
          );
        }
      }
    }
  }
}
