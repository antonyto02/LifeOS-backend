import { Injectable } from '@nestjs/common';
import { DepthState } from '../state/depth.state';
import { CentralState, CentralStateEntry } from '../state/central-state.state';
import { ActiveOrdersState, ActiveOrder } from '../state/active-orders.state';

export interface SnapshotUserOrder {
  id: number;
  amount: number;
  queue_postion: number; // nombre igual que en tu JSON
}

export interface SnapshotLevel {
  price: number;
  side: 'BUY' | 'SELL';
  marketAmount: number;
  userOrders: SnapshotUserOrder[];
}

export interface SnapshotProbabilityRowEntry {
  price: number;
  side: 'BUY' | 'SELL';
  prob: number;
}

export interface TokenSnapshot {
  levels: SnapshotLevel[];
  probabilityRow: SnapshotProbabilityRowEntry[];
  centralState: CentralStateEntry;
}

@Injectable()
export class SnapshotBuilder {
  constructor(
    private readonly depthState: DepthState,
    private readonly centralState: CentralState,
    private readonly activeOrders: ActiveOrdersState,
  ) {}

  /**
   * Construye el snapshot completo:
   * {
   *   "ACAUSDT": { levels: [...], probabilityRow: [...], centralState: {...} },
   *   "OTROTOKEN": { ... }
   * }
   *
   * Solo incluye tokens que existan en ActiveOrdersState.
   */
  buildFullSnapshot(): Record<string, TokenSnapshot> {
    const result: Record<string, TokenSnapshot> = {};

    const allActiveOrders = this.activeOrders.getAll();
    const tokens = Object.keys(allActiveOrders);

    for (const symbol of tokens) {
      result[symbol] = this.buildTokenSnapshot(symbol);
    }

    return result;
  }

  /**
   * Snapshot para un solo token.
   */
  buildTokenSnapshot(symbol: string): TokenSnapshot {
    const levels = this.buildLevels(symbol);
    const probabilityRow = this.buildProbabilityRow(symbol);
    const central = this.centralState.get(symbol);

    return {
      levels,
      probabilityRow,
      centralState: central,
    };
  }

  /**
   * Construye los 6 niveles (3 BUY + 3 SELL) centrados en los precios centrales.
   * Si no hay suficientes niveles, manda los que existan (máx 3 por lado).
   */
  private buildLevels(symbol: string): SnapshotLevel[] {
    const depthAll = this.depthState.getAll();
    const tokenDepth = depthAll[symbol];

    if (!tokenDepth) {
      return [];
    }

    const central = this.centralState.get(symbol);
    const centralBuyPrice = central.centralBuyPrice;
    const centralSellPrice = central.centralSellPrice;

    const buyPrices = Object.keys(tokenDepth.BUY).map((p) => parseFloat(p)).sort((a, b) => a - b);
    const sellPrices = Object.keys(tokenDepth.SELL).map((p) => parseFloat(p)).sort((a, b) => a - b);

    const selectedBuyPrices: number[] = [];
    const selectedSellPrices: number[] = [];

    // BUY: 3 niveles alrededor del centralBuy (si existe), expandiendo hacia
    // ambos lados antes de recurrir a fallback.
    if (buyPrices.length > 0) {
      if (centralBuyPrice != null) {
        const idx = buyPrices.findIndex((p) => p === centralBuyPrice);

        if (idx !== -1) {
          selectedBuyPrices.push(buyPrices[idx]);

          let left = idx - 1;
          let right = idx + 1;

          while (selectedBuyPrices.length < 3 && (left >= 0 || right < buyPrices.length)) {
            if (left >= 0) {
              selectedBuyPrices.push(buyPrices[left]);
              left -= 1;
            }

            if (selectedBuyPrices.length >= 3) break;

            if (right < buyPrices.length) {
              selectedBuyPrices.push(buyPrices[right]);
              right += 1;
            }
          }
        } else {
          // Fallback: últimos 3 niveles BUY
          selectedBuyPrices.push(...buyPrices.slice(-3));
        }
      } else {
        // Fallback: últimos 3 niveles BUY
        selectedBuyPrices.push(...buyPrices.slice(-3));
      }
    }

    // SELL: 3 niveles alrededor del centralSell (si existe), expandiendo hacia
    // ambos lados antes de recurrir a fallback.
    if (sellPrices.length > 0) {
      if (centralSellPrice != null) {
        const idx = sellPrices.findIndex((p) => p === centralSellPrice);

        if (idx !== -1) {
          selectedSellPrices.push(sellPrices[idx]);

          let left = idx - 1;
          let right = idx + 1;

          while (selectedSellPrices.length < 3 && (left >= 0 || right < sellPrices.length)) {
            if (left >= 0) {
              selectedSellPrices.push(sellPrices[left]);
              left -= 1;
            }

            if (selectedSellPrices.length >= 3) break;

            if (right < sellPrices.length) {
              selectedSellPrices.push(sellPrices[right]);
              right += 1;
            }
          }
        } else {
          // Fallback: primeros 3 niveles SELL
          selectedSellPrices.push(...sellPrices.slice(0, 3));
        }
      } else {
        // Fallback: primeros 3 niveles SELL
        selectedSellPrices.push(...sellPrices.slice(0, 3));
      }
    }

    // Construir niveles
    const activeAll = this.activeOrders.getAll();
    const tokenOrders = activeAll[symbol];

    const levels: SnapshotLevel[] = [];

    // BUY levels
    for (const price of selectedBuyPrices) {
      const priceKey = price.toString();
      const marketAmount = tokenDepth.BUY[priceKey] ?? 0;

      const userOrders: SnapshotUserOrder[] = [];
      const sideOrders = tokenOrders?.BUY;
      const order: ActiveOrder | undefined = sideOrders?.[priceKey];

      if (order) {
        userOrders.push({
          id: order.id,
          amount: order.pending_amount,
          queue_postion: order.queue_position,
        });
      }

      levels.push({
        price,
        side: 'BUY',
        marketAmount,
        userOrders,
      });
    }

    // SELL levels
    for (const price of selectedSellPrices) {
      const priceKey = price.toString();
      const marketAmount = tokenDepth.SELL[priceKey] ?? 0;

      const userOrders: SnapshotUserOrder[] = [];
      const sideOrders = tokenOrders?.SELL;
      const order: ActiveOrder | undefined = sideOrders?.[priceKey];

      if (order) {
        userOrders.push({
          id: order.id,
          amount: order.pending_amount,
          queue_postion: order.queue_position,
        });
      }

      levels.push({
        price,
        side: 'SELL',
        marketAmount,
        userOrders,
      });
    }

    // Ordenar niveles finales de menor a mayor price
    levels.sort((a, b) => a.price - b.price);

    // Máximo 6 niveles (3 BUY + 3 SELL)
    return levels.slice(0, 6);
  }

  /**
   * Construye probabilityRow para un token.
   *
   * Estructura:
   * [
   *   { price: <inferior a centralBuy>, side: "BUY",  prob: probUp },
   *   { price: <centralSell>,          side: "BUY",  prob: probDown },
   *   { price: <centralBuy>,           side: "SELL", prob: probUp },
   *   { price: <siguiente a centralSell>, side: "SELL", prob: probDown }
   * ]
   *
   * Donde:
   *   probUp   = amountBuyCentral / (amountBuyCentral + amountSellCentral)
   *   probDown = amountSellCentral / (amountBuyCentral + amountSellCentral)
   */
  private buildProbabilityRow(symbol: string): SnapshotProbabilityRowEntry[] {
    const depthAll = this.depthState.getAll();
    const tokenDepth = depthAll[symbol];

    if (!tokenDepth) return [];

    const central = this.centralState.get(symbol);
    const centralBuyPrice = central.centralBuyPrice;
    const centralSellPrice = central.centralSellPrice;

    if (centralBuyPrice == null || centralSellPrice == null) {
      return [];
    }

    const buyPrices = Object.keys(tokenDepth.BUY).map((p) => parseFloat(p)).sort((a, b) => a - b);
    const sellPrices = Object.keys(tokenDepth.SELL).map((p) => parseFloat(p)).sort((a, b) => a - b);

    const buyIdx = buyPrices.findIndex((p) => p === centralBuyPrice);
    const sellIdx = sellPrices.findIndex((p) => p === centralSellPrice);

    // Necesitamos:
    // - precio inferior a centralBuy (buyIdx - 1)
    // - centralSell (sellIdx)
    // - centralBuy (buyIdx)
    // - precio superior a centralSell (sellIdx + 1)
    if (buyIdx <= 0) return [];
    if (sellIdx < 0 || sellIdx >= sellPrices.length - 1) return [];

    const lowerBuyPrice = buyPrices[buyIdx - 1];
    const nextSellPrice = sellPrices[sellIdx + 1];

    const centralBuyKey = centralBuyPrice.toString();
    const centralSellKey = centralSellPrice.toString();

    const amountBuyCentral = tokenDepth.BUY[centralBuyKey] ?? 0;
    const amountSellCentral = tokenDepth.SELL[centralSellKey] ?? 0;

    const total = amountBuyCentral + amountSellCentral;
    if (total <= 0) return [];

    const probUp = amountBuyCentral / total;
    const probDown = amountSellCentral / total;

    return [
      {
        price: lowerBuyPrice,
        side: 'BUY',
        prob: probUp,
      },
      {
        price: centralSellPrice,
        side: 'BUY',
        prob: probDown,
      },
      {
        price: centralBuyPrice,
        side: 'SELL',
        prob: probUp,
      },
      {
        price: nextSellPrice,
        side: 'SELL',
        prob: probDown,
      },
    ];
  }
}
