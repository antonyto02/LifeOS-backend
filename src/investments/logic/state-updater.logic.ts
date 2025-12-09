import { Inject, Injectable, forwardRef } from '@nestjs/common';
import fetch from 'node-fetch';
import { ActiveTokensState } from '../state/active-tokens.state';
import { BinanceDepthStreamService } from '../stream/binance-depth-stream.service';
import { BinanceAggTradeStreamService } from '../stream/binance-aggtrade-stream.service';
import { DepthState } from '../state/depth.state';
import { CentralState } from '../state/central-state.state';
import { ActiveOrdersState, ActiveOrder } from '../state/active-orders.state';
import { calculateDepthLevel } from './depth-level.helper';
import { alertNotification } from '../notifications/alertNotification';

const formatDepthAmount = (qty: number | null): string =>
  qty != null ? qty.toLocaleString('en-US', { maximumFractionDigits: 2 }) : 'N/A';

const resolveDirection = (
  previousLevel: number | null,
  nextLevel: number | null,
): 'subió' | 'bajó' => {
  if (previousLevel == null || nextLevel == null) return 'subió';

  return nextLevel > previousLevel ? 'subió' : 'bajó';
};

type CentralUpdateSummary = {
  centralBuyPrice: number | null;
  centralSellPrice: number | null;
  centralBuyDepth: number | null;
  centralSellDepth: number | null;
  previousCentralBuyPrice: number | null;
  previousCentralSellPrice: number | null;
  previousCentralBuyDepth: number | null;
  buyPriceChanged: boolean;
  sellPriceChanged: boolean;
};



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

  updateCentralState(symbol: string): CentralUpdateSummary | null {
    const depth = this.depthState.getAll()[symbol];
    if (!depth) return null;

    const buyLevels = Object.keys(depth.BUY).map((p) => parseFloat(p));
    const sellLevels = Object.keys(depth.SELL).map((p) => parseFloat(p));

    if (buyLevels.length === 0 || sellLevels.length === 0) {
      return null;
    }

    const centralBuy = Math.max(...buyLevels);
    const centralSell = Math.min(...sellLevels);
    const entry = this.centralState.get(symbol);

    const previousCentralBuyPrice = entry.centralBuyPrice;
    const previousCentralSellPrice = entry.centralSellPrice;
    const previousCentralBuyDepth = entry.centralBuyDepth;

    const centralBuyDepth = depth.BUY[centralBuy.toString()] ?? null;
    const centralSellDepth = depth.SELL[centralSell.toString()] ?? null;

    this.centralState.updateCentralBuyPrice(symbol, centralBuy);
    this.centralState.updateCentralSellPrice(symbol, centralSell);
    this.centralState.updateCentralDepths(symbol, centralBuyDepth, centralSellDepth);

    return {
      centralBuyPrice: centralBuy,
      centralSellPrice: centralSell,
      centralBuyDepth,
      centralSellDepth,
      previousCentralBuyPrice,
      previousCentralSellPrice,
      previousCentralBuyDepth,
      buyPriceChanged: previousCentralBuyPrice !== centralBuy,
      sellPriceChanged: previousCentralSellPrice !== centralSell,
    };
  }

  async evaluateCentralLevels(
    symbol: string,
    centralUpdate?: CentralUpdateSummary,
  ): Promise<void> {
    const depth = this.depthState.getAll()[symbol];
    if (!depth) return;

    const central = this.centralState.get(symbol);

    const centralBuyPrice = centralUpdate?.centralBuyPrice ?? central.centralBuyPrice;
    const centralSellPrice = centralUpdate?.centralSellPrice ?? central.centralSellPrice;

    const centralBuyDepth =
      centralUpdate?.centralBuyDepth ??
      (centralBuyPrice != null ? depth.BUY[centralBuyPrice.toString()] ?? null : null);
    const centralSellDepth =
      centralUpdate?.centralSellDepth ??
      (centralSellPrice != null ? depth.SELL[centralSellPrice.toString()] ?? null : null);

    const buyLevel = calculateDepthLevel(centralBuyDepth);
    const sellLevel = calculateDepthLevel(centralSellDepth);

    const levelsChanged =
      buyLevel !== central.buyCurrentLevel || sellLevel !== central.sellCurrentLevel;
    const levelsAreDifferent =
      buyLevel != null && sellLevel != null && buyLevel !== sellLevel;
    const buyLevelChanged = buyLevel !== central.buyCurrentLevel;
    const sellLevelChanged = sellLevel !== central.sellCurrentLevel;

    const buildChangeMessage = (
      side: 'BUY' | 'SELL',
      price: number | null,
      depthQty: number | null,
      previousLevel: number | null,
      nextLevel: number | null,
    ): string | null => {
      if (price == null || nextLevel == null) return null;

      const direction = resolveDirection(previousLevel, nextLevel);
      const formattedDepth = formatDepthAmount(depthQty);
      const sideLabel = side === 'BUY' ? 'comprar' : 'vender';

      return `Orderbook de ${sideLabel} para ${symbol} en ${price} ${direction} a nivel ${nextLevel}[${formattedDepth}]`;
    };

    if (levelsChanged && levelsAreDifferent) {
      const changes: string[] = [];

      if (buyLevelChanged) {
        const message = buildChangeMessage(
          'BUY',
          centralBuyPrice,
          centralBuyDepth,
          central.buyCurrentLevel,
          buyLevel,
        );
        if (message) changes.push(message);
      }

      if (sellLevelChanged) {
        const message = buildChangeMessage(
          'SELL',
          centralSellPrice,
          centralSellDepth,
          central.sellCurrentLevel,
          sellLevel,
        );
        if (message) changes.push(message);
      }

      for (const change of changes) {
        console.log(change);
      }
    }

    if (levelsChanged) {
      this.centralState.updateCurrentLevels(symbol, buyLevel, sellLevel);
    }

    if (centralUpdate) {
      await this.handleAlertNotifications(
        symbol,
        { centralBuyPrice, centralSellPrice, centralBuyDepth, centralSellDepth },
        centralUpdate,
      );
    }
  }

  private formatMagnitude(value: number | null): string {
    if (value == null) return 'N/A';

    if (Math.abs(value) >= 1000) {
      const scaled = value / 1000;
      const decimals = Math.abs(scaled) >= 100 ? 0 : 1;
      return `${scaled.toFixed(decimals)}k`;
    }

    return value.toFixed(0);
  }

  private getQueueExtremes(
    symbol: string,
    side: 'BUY' | 'SELL',
    price: number | null,
  ): { nearest: number | null; furthest: number | null } {
    if (price == null) return { nearest: null, furthest: null };

    const orders = this.activeOrders.getOrder(symbol, side, price.toString());
    if (!orders || orders.length === 0) return { nearest: null, furthest: null };

    const positions = orders.map((o) => o.queue_position);
    return { nearest: Math.min(...positions), furthest: Math.max(...positions) };
  }

  private buildAlertBody(
    symbol: string,
    centralBuyPrice: number | null,
    centralSellPrice: number | null,
    centralBuyDepth: number | null,
    centralSellDepth: number | null,
  ): string {
    const buyQueue = this.getQueueExtremes(symbol, 'BUY', centralBuyPrice);
    const sellQueue = this.getQueueExtremes(symbol, 'SELL', centralSellPrice);

    const formatPrice = (price: number | null) => (price != null ? price.toString() : 'N/A');
    const buyDepthText = this.formatMagnitude(centralBuyDepth);
    const sellDepthText = this.formatMagnitude(centralSellDepth);

    const buyNearest = this.formatMagnitude(buyQueue.nearest);
    const buyFurthest = this.formatMagnitude(buyQueue.furthest);
    const sellNearest = this.formatMagnitude(sellQueue.nearest);
    const sellFurthest = this.formatMagnitude(sellQueue.furthest);

    const labelWidth = 'Furthest:'.length + 1;
    const padLabel = (label: string) => label.padEnd(labelWidth, ' ');
    const symbolPrefix = `[${symbol}] `;
    const emptyPrefix = ' '.repeat(symbolPrefix.length);

    const line1 = `${symbolPrefix}${padLabel('Buy:')} ${formatPrice(centralBuyPrice)}|${buyDepthText} | ${padLabel('Sell:')} ${formatPrice(centralSellPrice)}|${sellDepthText}`;
    const line2 = `${emptyPrefix}${padLabel('Nearest:')} ${buyNearest} | ${padLabel('Nearest:')} ${sellNearest}`;
    const line3 = `${emptyPrefix}${padLabel('Furthest:')} ${buyFurthest} | ${padLabel('Furthest:')} ${sellFurthest}`;

    return [line1, line2, line3].join('\n');
  }

  private async maybeNotifyBuyDepthDrop(
    symbol: string,
    centralBuyPrice: number | null,
    centralBuyDepth: number | null,
    previousCentralBuyDepth: number | null,
    alertBody: string,
  ): Promise<void> {
    if (centralBuyPrice == null || centralBuyDepth == null || previousCentralBuyDepth == null) {
      return;
    }

    const thresholds = [400000, 300000, 200000, 100000];

    for (const threshold of thresholds) {
      if (previousCentralBuyDepth > threshold && centralBuyDepth <= threshold) {
        const title = `[${symbol}] Buy queue is below ${this.formatMagnitude(threshold)}.`;
        console.log(
          `[alerts] ${symbol}: profundidad BUY cayó de ${this.formatMagnitude(previousCentralBuyDepth)} a ${this.formatMagnitude(centralBuyDepth)} (umbral ${this.formatMagnitude(threshold)}) – enviando notificación`,
        );
        await alertNotification(symbol, title, alertBody);
      }
    }
  }

  private async handleAlertNotifications(
    symbol: string,
    snapshot: {
      centralBuyPrice: number | null;
      centralSellPrice: number | null;
      centralBuyDepth: number | null;
      centralSellDepth: number | null;
    },
    centralUpdate: CentralUpdateSummary,
  ): Promise<void> {
    const { centralBuyPrice, centralSellPrice, centralBuyDepth, centralSellDepth } = snapshot;
    const alertBody = this.buildAlertBody(
      symbol,
      centralBuyPrice,
      centralSellPrice,
      centralBuyDepth,
      centralSellDepth,
    );

    if (centralUpdate.buyPriceChanged || centralUpdate.sellPriceChanged) {
      console.log(
        `[alerts] ${symbol}: cambio de precio detectado (BUY: ${centralUpdate.previousCentralBuyPrice} -> ${centralBuyPrice} | SELL: ${centralUpdate.previousCentralSellPrice} -> ${centralSellPrice}). Enviando notificación.`,
      );
      await alertNotification(symbol, `[${symbol}] Price changed.`, alertBody);
    }

    await this.maybeNotifyBuyDepthDrop(
      symbol,
      centralBuyPrice,
      centralBuyDepth,
      centralUpdate.previousCentralBuyDepth,
      alertBody,
    );
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
          }
        } else {
          levels[key] = qty;
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
      return;
    }
    
    const side: 'BUY' | 'SELL' = isMaker ? 'BUY' : 'SELL';
    const priceKey = price.toString();
    const ordersAtPrice = tokenOrders[side]?.[priceKey];

    if (!ordersAtPrice || ordersAtPrice.length === 0) {
      return;
    }

    for (const order of ordersAtPrice) {
      const previousQueue = order.queue_position;
      const newQueue = Math.max(previousQueue - qty, 0);
      order.queue_position = newQueue;

      this.activeOrders.setOrder(symbol, side, priceKey, order);
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
