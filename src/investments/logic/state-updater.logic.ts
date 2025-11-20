import { Injectable } from '@nestjs/common';
import fetch from 'node-fetch';
import { ActiveTokensState } from '../state/active-tokens.state';
import { BinanceDepthStreamService } from '../stream/binance-depth-stream.service';
import { BinanceAggTradeStreamService } from '../stream/binance-aggtrade-stream.service';
import { DepthState } from '../state/depth.state';
import { CentralState } from '../state/central-state.state';


export interface DepthData {
  bids: Array<[number, number]>;
  asks: Array<[number, number]>;
}

@Injectable()
export class StateUpdaterLogic {
  constructor(
    private readonly activeTokens: ActiveTokensState,
    private readonly depthStream: BinanceDepthStreamService,
    private readonly aggTradeStream: BinanceAggTradeStreamService,
    private readonly depthState: DepthState,
    private readonly centralState: CentralState,
    
    
  ) {}

  maybeActivateToken(symbol: string): void {
    if (!this.activeTokens.has(symbol)) {
      this.activeTokens.add(symbol);

      this.depthStream.openDepthStream(symbol);
      this.aggTradeStream.openAggTradeStream(symbol);
    }
  }


  async fetchDepth(symbol: string): Promise<DepthData> {
    const url = `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=20`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Binance depth request failed: ${response.status}`);
      }

      const json = await response.json() as {
        bids: [string, string][],
        asks: [string, string][],
      };

      const bids: Array<[number, number]> = json.bids.map(
        (b: [string, string]) => [parseFloat(b[0]), parseFloat(b[1])]
      );

      const asks: Array<[number, number]> = json.asks.map(
        (a: [string, string]) => [parseFloat(a[0]), parseFloat(a[1])]
      );

      return {
        bids,
        asks,
      };

    } catch (err) {
      console.error(`[fetchDepth] Error obteniendo profundidad para ${symbol}`, err);

      return {
        bids: [],
        asks: [],
      };
    }
  }
  updateDepthState(symbol: string, depth: DepthData): void {
    const { bids, asks } = depth;

    // 1. Reiniciar la estructura del token (BUY y SELL vacíos)
    this.depthState.resetToken(symbol);

    // 2. Objetos donde guardaremos los mapas finales
    const buyMap: Record<string, number> = {};
    const sellMap: Record<string, number> = {};

    // 3. Ordenar bids de menor → mayor (como tú lo trabajas)
    const sortedBids = [...bids].sort((a, b) => a[0] - b[0]);

    for (const [price, qty] of sortedBids) {
      buyMap[price.toString()] = qty;
    }

    // 4. Ordenar asks de menor → mayor
    const sortedAsks = [...asks].sort((a, b) => a[0] - b[0]);

    for (const [price, qty] of sortedAsks) {
      sellMap[price.toString()] = qty;
    }

    // 5. Guardar snapshot completo
    this.depthState.setSnapshot(symbol, buyMap, sellMap);
  }
updateCentralState(symbol: string): void {
  // Obtener snapshot actual de depth
  const depth = this.depthState.getAll()[symbol];
  if (!depth) return; // si no hay depth, no se hace nada

  const buyLevels = Object.keys(depth.BUY).map(p => parseFloat(p));
  const sellLevels = Object.keys(depth.SELL).map(p => parseFloat(p));

  if (buyLevels.length === 0 || sellLevels.length === 0) {
    // No se puede calcular central prices si falta un lado
    return;
  }

  // BUY → precio más alto
  const centralBuy = Math.max(...buyLevels);

  // SELL → precio más bajo
  const centralSell = Math.min(...sellLevels);

  // Actualizar central state (solo si cambió)
  this.centralState.updateCentralBuyPrice(symbol, centralBuy);
  this.centralState.updateCentralSellPrice(symbol, centralSell);
}


}
