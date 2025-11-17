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
    const targetList = order.side === 'BUY' ? this.buyOrders : this.sellOrders;
    const targetOrder = targetList.find((o) => o.id === order.orderId);

    const depth = await this.fetchDepth(order.symbol);

    if (targetOrder) {
      const executedQty = Number(order.cumulativeFilledQty ?? 0);
      const remaining = Math.max(targetOrder.amount - executedQty, 0);

      if (remaining === 0) {
        const idx = targetList.indexOf(targetOrder);
        targetList.splice(idx, 1);
        console.log('✅ Orden llenada y removida:', targetOrder);
      } else {
        targetOrder.amount = remaining;
        await this.processDepthForOrder(targetOrder, depth);
        console.log('✳️ Orden parcialmente llenada:', targetOrder);
      }
    } else {
      console.log('ℹ️ TRADE recibido para orden no encontrada, refrescando depth.');
    }

    await this.broadcastState(depth, order.symbol);
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

    this.depthStreams.set(symbol, ws);
  }

  private openTradeStream(symbol: string) {
    const url = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`;
    const ws = new WebSocket(url);

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

}
