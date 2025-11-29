import { Injectable } from '@nestjs/common';

export interface ActiveOrder {
  id: number;
  pending_amount: number;
  queue_position: number;
  filled_amount: number;
  token: string;
  side: 'BUY' | 'SELL';
  price: number;
}

@Injectable()
export class ActiveOrdersState {

  private static instance: ActiveOrdersState | null = null;

  private activeOrders: Record<
    string,
    {
      BUY: Record<string, ActiveOrder[]>;
      SELL: Record<string, ActiveOrder[]>;
    }
  > = {};

  constructor() {
    ActiveOrdersState.instance = this;
  }

  static getInstance(): ActiveOrdersState | null {
    return ActiveOrdersState.instance;
  }

  getAll() {
    return this.activeOrders;
  }

  private ensureToken(token: string) {
    if (!this.activeOrders[token]) {
      this.activeOrders[token] = {
        BUY: {},
        SELL: {},
      };
    }
  }

  setOrder(
    token: string,
    side: 'BUY' | 'SELL',
    price: string,
    order: ActiveOrder,
  ): void {
    this.ensureToken(token);
    const sideOrders = this.activeOrders[token][side];
    const ordersAtPrice = sideOrders[price] ?? [];

    const existingIdx = ordersAtPrice.findIndex((o) => o.id === order.id);

    if (existingIdx >= 0) {
      ordersAtPrice[existingIdx] = order;
    } else {
      ordersAtPrice.push(order);
    }

    sideOrders[price] = ordersAtPrice;
  }

  getOrder(token: string, side: 'BUY' | 'SELL', price: string) {
    return this.activeOrders[token]?.[side]?.[price] || [];
  }

  deleteOrder(
    token: string,
    side: 'BUY' | 'SELL',
    price: string,
    orderId?: number,
  ): void {
    const sideOrders = this.activeOrders[token]?.[side];

    if (!sideOrders || !sideOrders[price]) return;

    if (orderId === undefined) {
      delete sideOrders[price];
      return;
    }

    sideOrders[price] = sideOrders[price].filter((order) => order.id !== orderId);

    if (sideOrders[price].length === 0) {
      delete sideOrders[price];
    }
  }

  clearToken(token: string): void {
    if (this.activeOrders[token]) {
      delete this.activeOrders[token];
    }
  }


  clearAll(): void {
    this.activeOrders = {};
  }
}
