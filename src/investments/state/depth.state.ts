import { Injectable } from '@nestjs/common';

@Injectable()
export class DepthState {
  private depthLevels: Record<
    string,
    {
      BUY: Record<string, number>;
      SELL: Record<string, number>;
    }
  > = {};

  getAll() {
    return this.depthLevels;
  }

  private ensureToken(token: string): void {
    if (!this.depthLevels[token]) {
      this.depthLevels[token] = {
        BUY: {},
        SELL: {},
      };
    }
  }

  setLevel(
    token: string,
    side: 'BUY' | 'SELL',
    price: string,
    amount: number,
  ): void {
    this.ensureToken(token);

    if (amount === 0) {
      delete this.depthLevels[token][side][price];
      return;
    }

    this.depthLevels[token][side][price] = amount;
  }

  getLevel(token: string, side: 'BUY' | 'SELL', price: string): number | null {
    return this.depthLevels[token]?.[side]?.[price] ?? null;
  }

  deleteLevel(token: string, side: 'BUY' | 'SELL', price: string): void {
    if (this.depthLevels[token]?.[side]?.[price]) {
      delete this.depthLevels[token][side][price];
    }
  }

  clearToken(token: string): void {
    if (this.depthLevels[token]) {
      this.depthLevels[token] = {
        BUY: {},
        SELL: {},
      };
    }
  }

  clearAll(): void {
    this.depthLevels = {};
  }
}
