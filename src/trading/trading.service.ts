import { Injectable, OnModuleInit } from '@nestjs/common';
import WebSocket from 'ws';
import { BinanceClient } from './binance.client';
import { TradingGateway } from './trading.gateway';
import { StateBuilder } from './state.builder';

type DepthLevelUserOrder = {
  id: any;
  amount: any;
  position: any;
  min_delante: any;
  max_delante: any;
};

type DepthLevel = {
  price: number;
  side: 'BUY' | 'SELL';
  marketAmount: number;
  userOrders: DepthLevelUserOrder[];
};

@Injectable()
export class TradingService implements OnModuleInit {

  private allowedTokens = new Set<string>([
    'ACAUSDT',
    'NKNUSDT',
    'ACTUSDT',
    'VANRYUSDT',
  ]);

  public buyOrders: any[] = [];
  public sellOrders: any[] = [];
  public activeTokens: Set<string> = new Set();

  private stateBuilder: StateBuilder;
  private orderBooks: Record<string, { bids: Map<number, number>; asks: Map<number, number> }> = {};
  private depthByToken: Map<string, any> = new Map();
  private depthStreams: Map<string, WebSocket> = new Map();
  private tradeStreams: Map<string, WebSocket> = new Map();

  constructor(
    private readonly binanceClient: BinanceClient,
    private readonly gateway: TradingGateway,
  ) {
    this.stateBuilder = new StateBuilder();
  }

  async onModuleInit() {
    await this.binanceClient.init();
  }

  // ============================================================
  //               FILTROS DE TOKEN
  // ============================================================
  isAllowedToken(symbol: string): boolean {
    return this.allowedTokens.has(symbol);
  }

  // ============================================================
  //               ROUTER DE EVENTOS
  // ============================================================
  async handleEvent(order: any) {
    if (order.eventType === 'NEW') {
      return this.handleNewOrder(order);
    }

    if (order.eventType === 'CANCELED') {
      return this.handleCanceledOrder(order);
    }

    if (order.eventType === 'TRADE') {
      return this.handleTradeOrder(order);
    }
  }

  // ============================================================
  //               PASO 1: NUEVA ORDEN
  // ============================================================
  async handleNewOrder(order: any) {
    this.ensureStreamsForSymbol(order.symbol);

    const newOrder = {
      id: order.orderId,
      token: order.symbol,
      price: Number(order.price),
      amount: Number(order.qty),
      min_delante: null,
      max_delante: null,
      position: null,
      side: order.side,
    };

    if (order.side === 'BUY') {
      this.buyOrders.push(newOrder);
      console.log('🟢 Nueva BUY order guardada:', newOrder);
    } else {
      this.sellOrders.push(newOrder);
      console.log('🔴 Nueva SELL order guardada:', newOrder);
    }

    const depth = await this.fetchDepth(newOrder.token);

    // calcular depth, min/max, position
    await this.processDepthForOrder(newOrder, depth);

    // enviar estado final al frontend
    await this.broadcastState(depth, newOrder.token);
  }

  // ============================================================
  //               PASO 2: CANCELACIÓN DE ORDEN
  // ============================================================
  async handleCanceledOrder(order: any) {
    const targetList = order.side === 'BUY' ? this.buyOrders : this.sellOrders;
    const index = targetList.findIndex((o) => o.id === order.orderId);

    if (index === -1) {
      console.log('⚠️ Orden a cancelar no encontrada:', order);
      return;
    }

    const [removed] = targetList.splice(index, 1);
    console.log('🗑️  Orden cancelada y eliminada:', removed);

    this.cleanupStreamsIfNoOrders(order.symbol);

    const depth = await this.fetchDepth(order.symbol);
    await this.broadcastState(depth, order.symbol);
  }

  // ============================================================
  //               PASO 3: TRADE DE MI ORDEN
  // ============================================================
  async handleTradeOrder(order: any) {
    const symbol = order.symbol ?? order.s;
    const price = Number(order.price ?? order.p);
    const quantity = Number(order.qty ?? order.q);
    const makerIndicator = order.makerIndicator ?? order.m;

    const targetList = makerIndicator ? this.buyOrders : this.sellOrders;

    console.log('TRADE recibido:', { s: symbol, p: price, q: quantity, m: makerIndicator });
    console.log('Lista seleccionada:', targetList);

    let foundMatch = false;

    for (const record of targetList) {
      if (record.token === symbol && record.price === price) {
        console.log('Registro encontrado:', record);
        console.log('min_delante antes:', record.min_delante);
        console.log('Cantidad a restar:', quantity);
        record.min_delante -= quantity;
        console.log('min_delante después:', record.min_delante);
        foundMatch = true;
      }
    }

    if (!foundMatch) {
      console.log('NO se encontró ninguna orden con ese token y precio.');
    }

    const depth = await this.fetchDepth(symbol);

    const marketAmount = this.extractMarketAmount(depth, price);

    if (marketAmount !== null) {
      this.updateDepthLevel(depth, price, marketAmount);
    }

    await this.broadcastState(depth, symbol);
  }

  // ============================================================
  //           PASO 5 Y 6: DEPTH + ACTUALIZACIÓN DE ORDEN
  // ============================================================
  private async processDepthForOrder(order: any, depth: any) {
    try {
      const levels = order.side === 'BUY' ? depth.bids : depth.asks;
      const level = levels.find((l: any) => Number(l[0]) === order.price);

      if (!level) {
        console.log('⚠️ No se encontró el nivel de precio en el depth.');
        return;
      }

      const profundidad = Number(level[1]);

      // CORRECCIÓN: Restar la cantidad de tu orden
      const delanteReal = Math.max(profundidad - order.amount, 0);

      order.min_delante = delanteReal;
      order.max_delante = delanteReal;

      // position = index dentro de su lista
      if (order.side === 'BUY') {
        order.position = this.buyOrders.length;
      } else {
        order.position = this.sellOrders.length;
      }

      console.log('📘 Orden actualizada con depth:', order);

    } catch (err) {
      console.log('❌ Error procesando depth:', err);
    }
  }

  // ============================================================
  //               BROADCAST AL FRONTEND
  // ============================================================
  private async broadcastState(primaryDepth: any, primaryToken: string) {
    try {
      const depthMap = await this.buildDepthMap(primaryToken, primaryDepth);
      const state = await this.stateBuilder.buildState(
        this.buyOrders,
        this.sellOrders,
        depthMap,
      );

      this.gateway.broadcast(state);
      console.log('📡 Estado enviado al frontend');
    } catch (e) {
      console.log('❌ Error generando estado final:', e);
    }
  }

  async getFormattedState() {
    const tokens = this.collectTokens();
    const depthMap = await this.fetchDepths(tokens);

    return this.stateBuilder.buildState(
      this.buyOrders,
      this.sellOrders,
      depthMap,
    );
  }

  // ============================================================
  //               DEPTH HELPERS
  // ============================================================
  private collectTokens() {
    const set = new Set<string>();
    for (const o of this.buyOrders) if (o?.token) set.add(o.token);
    for (const o of this.sellOrders) if (o?.token) set.add(o.token);
    return Array.from(set);
  }

  private async fetchDepth(token: string) {
    const url = `https://api.binance.com/api/v3/depth?symbol=${token}&limit=20`;

    const response = await fetch(url);
    const depth = await response.json();

    this.depthByToken.set(token, depth);
    return depth;
  }

  private async buildDepthMap(primaryToken: string, primaryDepth: any) {
    const tokens = this.collectTokens();
    if (primaryToken && !tokens.includes(primaryToken)) {
      tokens.push(primaryToken);
    }

    return this.fetchDepths(tokens, primaryToken, primaryDepth);
  }

  private async fetchDepths(
    tokens: string[],
    primaryToken?: string,
    primaryDepth?: any,
  ) {
    const depthMap = new Map<string, any>();

    for (const token of tokens) {
      if (primaryToken && primaryDepth && token === primaryToken) {
        depthMap.set(token, primaryDepth);
        this.depthByToken.set(token, primaryDepth);
        continue;
      }

      const depth = await this.fetchDepth(token);
      depthMap.set(token, depth);
    }

    return depthMap;
  }

  // ============================================================
  //               STREAM MANAGEMENT
  // ============================================================
  private ensureStreamsForSymbol(symbol: string) {
    if (this.activeTokens.has(symbol)) return;

    this.activeTokens.add(symbol);
    this.openDepthStream(symbol);
    this.openTradeStream(symbol);
  }

  private cleanupStreamsIfNoOrders(symbol: string) {
    const hasActiveOrders =
      this.buyOrders.some((o) => o.token === symbol) ||
      this.sellOrders.some((o) => o.token === symbol);

    if (hasActiveOrders) return;

    this.closeDepthStream(symbol);
    this.closeTradeStream(symbol);
    this.activeTokens.delete(symbol);
  }

  private openDepthStream(symbol: string) {
    const url = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@depth`;
    const ws = new WebSocket(url);

    ws.on('message', async (message: WebSocket.Data) => {
      try {
        const parsed = JSON.parse(message.toString());
        const payload = parsed?.data ?? parsed;
        const bids = payload?.bids ?? payload?.b ?? [];
        const asks = payload?.asks ?? payload?.a ?? [];
        const targetSymbol = payload?.s ?? symbol;

        this.handleDepthDelta(targetSymbol, bids, asks);
      } catch (err) {
        console.log('Error procesando mensaje de depth:', err);
      }
    });

    this.depthStreams.set(symbol, ws);
  }

  private openTradeStream(symbol: string) {
    const url = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`;
    const ws = new WebSocket(url);

    ws.on('message', async (message: WebSocket.Data) => {
      try {
        const parsed = JSON.parse(message.toString());
        const payload = parsed?.data ?? parsed;

        const tradeEvent = {
          eventType: 'TRADE',
          s: payload?.s,
          p: payload?.p,
          q: payload?.q,
          m: payload?.m,
        };

        await this.handleTradeOrder(tradeEvent);
      } catch (err) {
        console.log('Error procesando mensaje de trade:', err);
      }
    });

    this.tradeStreams.set(symbol, ws);
  }

  private closeDepthStream(symbol: string) {
    const ws = this.depthStreams.get(symbol);
    if (ws) {
      ws.close();
      this.depthStreams.delete(symbol);
    }
  }

  private closeTradeStream(symbol: string) {
    const ws = this.tradeStreams.get(symbol);
    if (ws) {
      ws.close();
      this.tradeStreams.delete(symbol);
    }
  }

  getStreamsStatus() {
    const streams: Record<string, { depth: boolean; trades: boolean }> = {};

    for (const symbol of this.activeTokens) {
      streams[symbol] = {
        depth: this.depthStreams.has(symbol),
        trades: this.tradeStreams.has(symbol),
      };
    }

    return {
      activeTokens: Array.from(this.activeTokens),
      streams,
    };
  }

  // ============================================================
  //               TRADE HELPERS
  // ============================================================
  private extractMarketAmount(depth: any, price: number) {
    const level = [
      ...(depth?.bids ?? []),
      ...(depth?.asks ?? []),
    ].find((l: any) => Number(l?.[0]) === price);

    return level ? Number(level[1]) : null;
  }

  private updateDepthLevel(depth: any, price: number, marketAmount: number) {
    const updateLevel = (levels: any[]) => {
      const level = levels.find((l: any) => Number(l?.[0]) === price);
      if (level) {
        level[1] = marketAmount.toString();
      }
    };

    updateLevel(depth.bids ?? []);
    updateLevel(depth.asks ?? []);
  }

  // ============================================================
  //               DEPTH STREAM HANDLING
  // ============================================================
  private ensureOrderBook(symbol: string) {
    if (!this.orderBooks[symbol]) {
      this.orderBooks[symbol] = { bids: new Map(), asks: new Map() };
    }
    return this.orderBooks[symbol];
  }

  private handleDepthDelta(
    symbol: string,
    bidsDelta: [string, string][],
    asksDelta: [string, string][],
  ) {
    const orderBook = this.ensureOrderBook(symbol);

    for (const [priceStr, amountStr] of bidsDelta) {
      const price = Number(priceStr);
      const amount = Number(amountStr);

      if (amount === 0) {
        orderBook.bids.delete(price);
      } else {
        orderBook.bids.set(price, amount);
      }
    }

    for (const [priceStr, amountStr] of asksDelta) {
      const price = Number(priceStr);
      const amount = Number(amountStr);

      if (amount === 0) {
        orderBook.asks.delete(price);
      } else {
        orderBook.asks.set(price, amount);
      }
    }

    const sortedBids = Array.from(orderBook.bids.entries()).sort(
      (a, b) => b[0] - a[0],
    );
    const sortedAsks = Array.from(orderBook.asks.entries()).sort(
      (a, b) => a[0] - b[0],
    );

    const depthSnapshot = {
      bids: sortedBids.map(([price, amount]) => [price, amount]),
      asks: sortedAsks.map(([price, amount]) => [price, amount]),
    };

    this.depthByToken.set(symbol, depthSnapshot);

    const levels = this.buildDepthLevels(symbol, sortedBids, sortedAsks);
    const probabilityRow = this.buildProbabilityRow(sortedBids, sortedAsks);

    const payload = {
      [symbol]: {
        levels,
        probabilityRow,
      },
    };

    this.gateway.broadcast(payload);
  }

  private buildDepthLevels(
    symbol: string,
    sortedBids: [number, number][],
    sortedAsks: [number, number][],
  ): DepthLevel[] {
    const bidLevels: DepthLevel[] = sortedBids
      .slice(0, 3)
      .map(([price, amount]): DepthLevel => ({
        price,
        side: 'BUY',
        marketAmount: amount,
        userOrders: [],
      }));

    const askLevels: DepthLevel[] = sortedAsks
      .slice(0, 3)
      .map(([price, amount]): DepthLevel => ({
        price,
        side: 'SELL',
        marketAmount: amount,
        userOrders: [],
      }));

    const levels: DepthLevel[] = [...bidLevels, ...askLevels];

    for (const order of [...this.buyOrders, ...this.sellOrders]) {
      if (order.token !== symbol) continue;

      const targetLevel = levels.find(
        (level) => level.side === order.side && level.price === order.price,
      );

      if (!targetLevel) continue;

      const depthAmount = targetLevel.marketAmount;

      if (order.max_delante === null || depthAmount < order.max_delante) {
        order.max_delante = depthAmount;
      }

      targetLevel.userOrders.push({
        id: order.id,
        amount: order.amount,
        position: order.position,
        min_delante: order.min_delante,
        max_delante: order.max_delante,
      });
    }

    return levels;
  }

  private buildProbabilityRow(
    sortedBids: [number, number][],
    sortedAsks: [number, number][],
  ) {
    if (!sortedBids.length || !sortedAsks.length) return [];

    const [bid0, bid1] = sortedBids;
    const [ask0, ask1] = sortedAsks;

    const highestBidPrice = bid0?.[0];
    const highestBidAmount = bid0?.[1];

    const lowestAskPrice = ask0?.[0];
    const lowestAskAmount = ask0?.[1];

    const totalVol = highestBidAmount + lowestAskAmount;
    if (!totalVol) return [];

    const probAsk = highestBidAmount / totalVol;
    const probBid = lowestAskAmount / totalVol;

    return [
      {
        price: bid1 ? bid1[0] : null,
        side: 'BUY',
        prob: probBid,
      },
      {
        price: lowestAskPrice,
        side: 'BUY',
        prob: probAsk,
      },
      {
        price: highestBidPrice,
        side: 'SELL',
        prob: probBid,
      },
      {
        price: ask1 ? ask1[0] : null,
        side: 'SELL',
        prob: probAsk,
      },
    ];
  }

}
