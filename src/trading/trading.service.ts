import { Injectable, OnModuleInit } from '@nestjs/common';
import { BinanceClient } from './binance.client';
import { TradingGateway } from './trading.gateway';
import { StateBuilder } from './state.builder';

@Injectable()
export class TradingService implements OnModuleInit {

  private allowedTokens = new Set<string>([
    'ACAUSDT',
    'NKNUSDT',
    'BTCUSDT',
    'VANRYUSDT',
  ]);

  public buyOrders: any[] = [];
  public sellOrders: any[] = [];

  private stateBuilder: StateBuilder;

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
  //               PASO 1: NUEVA ORDEN
  // ============================================================
  async handleNewOrder(order: any) {
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

    // calcular depth, min/max, position
    await this.processDepthForOrder(newOrder);

    // enviar estado final al frontend
    await this.broadcastState();
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

    await this.broadcastState();
  }

  // ============================================================
  //           PASO 5 Y 6: DEPTH + ACTUALIZACIÓN DE ORDEN
  // ============================================================
  private async processDepthForOrder(order: any) {
    try {
      const url = `https://api.binance.com/api/v3/depth?symbol=${order.token}&limit=20`;

      const response = await fetch(url);
      const depth = await response.json();

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
  private async broadcastState() {
    try {
      const state = await this.stateBuilder.buildState(
        this.buyOrders,
        this.sellOrders,
      );

      this.gateway.broadcast(state);
      console.log('📡 Estado enviado al frontend');
    } catch (e) {
      console.log('❌ Error generando estado final:', e);
    }
  }

  async getFormattedState() {
  return this.stateBuilder.buildState(this.buyOrders, this.sellOrders);
}

}
