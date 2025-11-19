import { Injectable } from '@nestjs/common';

export interface CentralStateEntry {
  centralBuyPrice: number | null;
  executedSinceBuyPriceChange: number;

  centralSellPrice: number | null;
  executedSinceSellPriceChange: number;
}

@Injectable()
export class CentralState {
  // Estructura:
  // centralState[token] = { ... }
  private centralState: Record<string, CentralStateEntry> = {};

  /** Asegura que el token exista */
  private ensureToken(token: string): void {
    if (!this.centralState[token]) {
      this.centralState[token] = {
        centralBuyPrice: null,
        executedSinceBuyPriceChange: 0,

        centralSellPrice: null,
        executedSinceSellPriceChange: 0,
      };
    }
  }

  /** Obtener todo el estado */
  getAll() {
    return this.centralState;
  }

  /** Obtener estado individual */
  get(token: string): CentralStateEntry {
    this.ensureToken(token);
    return this.centralState[token];
  }

  /** Actualizar precio central de BUY */
  updateCentralBuyPrice(token: string, newPrice: number): void {
    this.ensureToken(token);

    const entry = this.centralState[token];

    if (entry.centralBuyPrice !== newPrice) {
      entry.centralBuyPrice = newPrice;
      entry.executedSinceBuyPriceChange = 0; // reset
    }
  }

  /** Actualizar precio central de SELL */
  updateCentralSellPrice(token: string, newPrice: number): void {
    this.ensureToken(token);

    const entry = this.centralState[token];

    if (entry.centralSellPrice !== newPrice) {
      entry.centralSellPrice = newPrice;
      entry.executedSinceSellPriceChange = 0; // reset
    }
  }

  /** Sumar volumen ejecutado en BUY */
  addExecutedBuy(token: string, executed: number): void {
    this.ensureToken(token);
    this.centralState[token].executedSinceBuyPriceChange += executed;
  }

  /** Sumar volumen ejecutado en SELL */
  addExecutedSell(token: string, executed: number): void {
    this.ensureToken(token);
    this.centralState[token].executedSinceSellPriceChange += executed;
  }

  /** Limpiar un token */
  clearToken(token: string): void {
    this.centralState[token] = {
      centralBuyPrice: null,
      executedSinceBuyPriceChange: 0,

      centralSellPrice: null,
      executedSinceSellPriceChange: 0,
    };
  }

  /** Limpiar todo el estado */
  clearAll(): void {
    this.centralState = {};
  }
}
