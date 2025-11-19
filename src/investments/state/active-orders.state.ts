import { Injectable } from '@nestjs/common';

export interface ActiveOrder {
  id: number;
  pending_amount: number;
  queue_position: number;
  filled_amount: number;
}

@Injectable()
export class ActiveOrdersState {

  private activeOrders: Record<
    string,
    {
      BUY: Record<string, ActiveOrder>;
      SELL: Record<string, ActiveOrder>;
    }
  > = {};

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
    this.activeOrders[token][side][price] = order;
  }

  getOrder(token: string, side: 'BUY' | 'SELL', price: string) {
    return this.activeOrders[token]?.[side]?.[price] || null;
  }

  deleteOrder(token: string, side: 'BUY' | 'SELL', price: string): void {
    if (this.activeOrders[token]?.[side]?.[price]) {
      delete this.activeOrders[token][side][price];
    }
  }

  clearToken(token: string): void {
    if (this.activeOrders[token]) {
      this.activeOrders[token] = {
        BUY: {},
        SELL: {},
      };
    }
  }

  clearAll(): void {
    this.activeOrders = {};
  }
}
