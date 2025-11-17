import { Injectable, OnModuleInit } from '@nestjs/common';
import WebSocket from 'ws';
import { BinanceClient } from './binance.client';
import { TradingGateway } from './trading.gateway';
import { StateBuilder } from './state.builder';

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

        const token = (payload?.s ?? symbol).toUpperCase();
        const bids = payload?.b ?? payload?.bids ?? [];
        const asks = payload?.a ?? payload?.asks ?? [];

        if (!this.isAllowedToken(token)) return;

        await this.handleDepthStreamEvent(token, { bids, asks });
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
  //               DEPTH STREAM HANDLER
  // ============================================================
  private async handleDepthStreamEvent(
    token: string,
    depth: { bids: any[]; asks: any[] },
  ) {
    const levels = [
      ...depth.bids.slice(0, 3).map(([price, amount]) => ({
        price: Number(price),
        side: 'BUY',
        marketAmount: Number(amount),
        userOrders: [],
      })),
      ...depth.asks.slice(0, 3).map(([price, amount]) => ({
        price: Number(price),
        side: 'SELL',
        marketAmount: Number(amount),
        userOrders: [],
      })),
    ];

    const userOrders = [...this.buyOrders, ...this.sellOrders];

    for (const order of userOrders) {
      if (order.token !== token) continue;

      const level = levels.find((l) => Number(l.price) === Number(order.price));
      if (!level) continue;

      if (
        order.max_delante === null ||
        order.max_delante === undefined ||
        level.marketAmount < order.max_delante
      ) {
        order.max_delante = level.marketAmount;
      }

      level.userOrders.push({
        id: order.id,
        amount: order.amount,
        position: order.position,
        min_delante: order.min_delante,
        max_delante: order.max_delante,
      });
    }

    const normalizedDepth = {
      bids: depth.bids,
      asks: depth.asks,
    };

    this.depthByToken.set(token, normalizedDepth);

    const payload = {
      [token]: {
        levels,
        probabilityRow: this.buildProbabilityRowFromDepth(normalizedDepth),
      },
    };

    this.gateway.broadcast(payload);
    console.log('📡 Depth stream actualizado y enviado al frontend');
  }

  private buildProbabilityRowFromDepth(depth: any) {
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
        side: 'BUY',
        prob: probBid,
      },
      {
        price: Number(Number(ask0[0]).toFixed(5)),
        side: 'BUY',
        prob: probAsk,
      },
      {
        price: Number(Number(bid0[0]).toFixed(5)),
        side: 'SELL',
        prob: probBid,
      },
      {
        price: ask1 ? Number(Number(ask1[0]).toFixed(5)) : null,
        side: 'SELL',
        prob: probAsk,
      },
    ];
  }

}
