// src/trading/state.builder.ts

export class StateBuilder {

  constructor() {}

  async buildState(
    buyOrders: any[],
    sellOrders: any[],
    depthByToken: Map<string, any>,
  ) {
    const finalState: any = {};
    const tokens = this.extractTokens(buyOrders, sellOrders, depthByToken);

    for (const token of tokens) {
      const depth = depthByToken.get(token) ?? { bids: [], asks: [] };
      finalState[token] = this.buildTokenState(token, buyOrders, sellOrders, depth);
    }

    return finalState;
  }

  private extractTokens(
    buyOrders: any[],
    sellOrders: any[],
    depthByToken: Map<string, any>,
  ) {
    const set = new Set<string>();
    for (const o of buyOrders) if (o?.token) set.add(o.token);
    for (const o of sellOrders) if (o?.token) set.add(o.token);
    for (const token of depthByToken.keys()) set.add(token);
    return Array.from(set);
  }

  private buildTokenState(token: string, buys: any[], sells: any[], depth: any) {
    return {
      levels: this.buildSixLevels(buys, sells, depth),
      probabilityRow: this.buildProbabilityRow(depth),
    };
  }

  // ============================================================
  // 3 BUY + 3 SELL usando precios reales
  // ============================================================
  private buildSixLevels(buys: any[], sells: any[], depth: any) {
    const levels: any[] = [];

    const bids = (depth?.bids ?? []).slice(0, 3);
    const asks = (depth?.asks ?? []).slice(0, 3);

    const buyLevels = bids.map(([price, qty]: [number, number]) => ({
      price: Number(price),
      side: "BUY",
      marketAmount: Number(qty),
      userOrders: buys
        .filter(o => Number(o.price) === Number(price))
        .map(o => ({
          id: o.id,
          amount: o.amount,
          position: o.position,
          min_delante: o.min_delante,
          max_delante: o.max_delante,
        })),
    }));

    // SELL → en el orden natural (asks ya vienen crecientes)
    const sellLevels = asks.map(([price, qty]: [number, number]) => ({
      price: Number(price),
      side: "SELL",
      marketAmount: Number(qty),
      userOrders: sells
        .filter(o => Number(o.price) === Number(price))
        .map(o => ({
          id: o.id,
          amount: o.amount,
          position: o.position,
          min_delante: o.min_delante,
          max_delante: o.max_delante,
        })),
    }));

    return [...buyLevels, ...sellLevels];
  }

  // ============================================================
  // ProbabilityRow usando precios reales del depth
  // ============================================================
  private buildProbabilityRow(depth: any) {
    if (!depth || !depth.bids?.length || !depth.asks?.length) return [];

    const bid0 = depth.bids[0];
    const bid1 = depth.bids[1];
    const ask0 = depth.asks[0];
    const ask1 = depth.asks[1];

    const highestBidPrice = Number(bid0[0]);
    const highestBidAmount = Number(bid0[1]);

    const lowestAskPrice = Number(ask0[0]);
    const lowestAskAmount = Number(ask0[1]);

    const totalVol = highestBidAmount + lowestAskAmount;
    if (totalVol === 0) return [];

    const probAsk = highestBidAmount / totalVol;
    const probBid = lowestAskAmount / totalVol;

    return [
      {
        price: bid1 ? Number(Number(bid1[0]).toFixed(5)) : null,
        side: "BUY",
        prob: probBid,
      },
      {
        price: Number(Number(ask0[0]).toFixed(5)),
        side: "BUY",
        prob: probAsk,
      },
      {
        price: Number(Number(bid0[0]).toFixed(5)),
        side: "SELL",
        prob: probBid,
      },
      {
        price: ask1 ? Number(Number(ask1[0]).toFixed(5)) : null,
        side: "SELL",
        prob: probAsk,
      },
    ];
  }
}
