import { Injectable } from '@nestjs/common';

export interface CentralStateEntry {
  centralBuyPrice: number | null;
  executedSinceBuyPriceChange: number;

  centralSellPrice: number | null;
  executedSinceSellPriceChange: number;

  buyCurrentLevel: number | null;
  sellCurrentLevel: number | null;

  centralBuyDepth: number | null;
  centralSellDepth: number | null;
}

@Injectable()
export class CentralState {
  private centralState: Record<string, CentralStateEntry> = {};

  private ensureToken(token: string): void {
    if (!this.centralState[token]) {
      this.centralState[token] = {
        centralBuyPrice: null,
        executedSinceBuyPriceChange: 0,

        centralSellPrice: null,
        executedSinceSellPriceChange: 0,

        buyCurrentLevel: null,
        sellCurrentLevel: null,

        centralBuyDepth: null,
        centralSellDepth: null,
      };
    }
  }

  getAll() {
    return this.centralState;
  }

  get(token: string): CentralStateEntry {
    this.ensureToken(token);
    return this.centralState[token];
  }

  updateCentralBuyPrice(token: string, newPrice: number): void {
    this.ensureToken(token);

    const entry = this.centralState[token];

    if (entry.centralBuyPrice !== newPrice) {
      entry.centralBuyPrice = newPrice;
      entry.executedSinceBuyPriceChange = 0;
    }
  }

  updateCentralSellPrice(token: string, newPrice: number): void {
    this.ensureToken(token);

    const entry = this.centralState[token];

    if (entry.centralSellPrice !== newPrice) {
      entry.centralSellPrice = newPrice;
      entry.executedSinceSellPriceChange = 0;
    }
  }

  addExecutedBuy(token: string, executed: number): void {
    this.ensureToken(token);
    this.centralState[token].executedSinceBuyPriceChange += executed;
  }

  addExecutedSell(token: string, executed: number): void {
    this.ensureToken(token);
    this.centralState[token].executedSinceSellPriceChange += executed;
  }

  updateCurrentLevels(
    token: string,
    buyLevel: number | null,
    sellLevel: number | null,
  ): void {
    this.ensureToken(token);
    const entry = this.centralState[token];

    entry.buyCurrentLevel = buyLevel;
    entry.sellCurrentLevel = sellLevel;
  }

  updateCentralDepths(token: string, buyDepth: number | null, sellDepth: number | null): void {
    this.ensureToken(token);
    const entry = this.centralState[token];

    entry.centralBuyDepth = buyDepth;
    entry.centralSellDepth = sellDepth;
  }

  clearToken(token: string): void {
    if (this.centralState[token]) {
      delete this.centralState[token];
    }
  }


  clearAll(): void {
    this.centralState = {};
  }
}
