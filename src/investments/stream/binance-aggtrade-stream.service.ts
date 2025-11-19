import { Injectable } from '@nestjs/common';
import WebSocket from 'ws';

@Injectable()
export class BinanceAggTradeStreamService {
  private aggTradeConnections: Record<string, WebSocket> = {};

  openAggTradeStream(symbol: string) {
    const lower = symbol.toLowerCase();

    if (this.aggTradeConnections[lower]) {
      console.log(`[AGGTRADE] Ya existe conexión activa para ${symbol}`);
      return;
    }

    const url = `wss://stream.binance.com:9443/ws/${lower}@aggTrade`;

    console.log(`[AGGTRADE] Abriendo conexión WS para ${symbol} → ${url}`);

    const ws = new WebSocket(url);
    this.aggTradeConnections[lower] = ws;

    ws.on('open', () => {
      console.log(`[AGGTRADE] Conexión abierta para ${symbol}`);
    });

    ws.on('message', (msg: any) => {
      console.log(`\n🟢 [AGGTRADE MESSAGE - ${symbol}]`);
      console.log(msg.toString());
    });

    ws.on('close', () => {
      console.log(`[AGGTRADE] Conexión cerrada para ${symbol}`);
      delete this.aggTradeConnections[lower];
    });

    ws.on('error', (err) => {
      console.log(`[AGGTRADE] ERROR en ${symbol}:`, err);
    });
  }

  closeAggTradeStream(symbol: string) {
    const lower = symbol.toLowerCase();

    if (this.aggTradeConnections[lower]) {
      console.log(`[AGGTRADE] Cerrando conexión WS para ${symbol}`);
      this.aggTradeConnections[lower].close();
    }
  }
}
