import { Injectable } from '@nestjs/common';

@Injectable()
export class DepthState {
  // Estructura base:
  // {
  //   "ACAUSDT": {
  //     BUY: { "0.0162": 444866.15, ... },
  //     SELL: { "0.0165": 280000.1, ... }
  //   }
  // }
  private depthLevels: Record<
    string,
    {
      BUY: Record<string, number>;
      SELL: Record<string, number>;
    }
  > = {};

  // Retorna todo el estado
  getAll() {
    return this.depthLevels;
  }

  // Asegura que el token exista en la estructura
  private ensureToken(token: string): void {
    if (!this.depthLevels[token]) {
      this.depthLevels[token] = {
        BUY: {},
        SELL: {},
      };
    }
  }

  // Establece un solo nivel
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

  // Obtiene un nivel individual
  getLevel(token: string, side: 'BUY' | 'SELL', price: string): number | null {
    return this.depthLevels[token]?.[side]?.[price] ?? null;
  }

  // Elimina un nivel individual
  deleteLevel(token: string, side: 'BUY' | 'SELL', price: string): void {
    if (this.depthLevels[token]?.[side]?.[price]) {
      delete this.depthLevels[token][side][price];
    }
  }

  // Limpia únicamente ese token (BUY y SELL quedan vacíos)
  clearToken(token: string): void {
    if (this.depthLevels[token]) {
      delete this.depthLevels[token];
    }
  }


  // Limpia toda la BD de depths
  clearAll(): void {
    this.depthLevels = {};
  }

  // NUEVO: reinicia el token (BUY y SELL vacíos)
  resetToken(token: string): void {
    this.depthLevels[token] = {
      BUY: {},
      SELL: {},
    };
  }

  // NUEVO: establecer el snapshot completo de BUY y SELL
  setSnapshot(
    token: string,
    buy: Record<string, number>,
    sell: Record<string, number>,
  ): void {
    this.depthLevels[token] = {
      BUY: buy,
      SELL: sell,
    };
  }
}
