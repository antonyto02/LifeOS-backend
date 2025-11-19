import { Injectable } from '@nestjs/common';
import WebSocket from 'ws';

@Injectable()
export class BinanceDepthStreamService {
  private depthConnections: Record<string, WebSocket> = {};

  openDepthStream(symbol: string) {
    const lower = symbol.toLowerCase();

    if (this.depthConnections[lower]) {
      console.log(`[DEPTH] Ya existe conexión activa para ${symbol}`);
      return;
    }

    const url = `wss://stream.binance.com:9443/ws/${lower}@depth`;

    console.log(`[DEPTH] Abriendo conexión WS para ${symbol} → ${url}`);

    const ws = new WebSocket(url);
    this.depthConnections[lower] = ws;

    ws.on('open', () => {
      console.log(`[DEPTH] Conexión abierta para ${symbol}`);
    });

    ws.on('message', (msg: any) => {
      console.log(`\n🔵 [DEPTH MESSAGE - ${symbol}]`);
      console.log(msg.toString());
    });

    ws.on('close', () => {
      console.log(`[DEPTH] Conexión cerrada para ${symbol}`);
      delete this.depthConnections[lower];
    });

    ws.on('error', (err) => {
      console.log(`[DEPTH] ERROR en ${symbol}:`, err);
    });
  }

  closeDepthStream(symbol: string) {
    const lower = symbol.toLowerCase();

    if (this.depthConnections[lower]) {
      console.log(`[DEPTH] Cerrando conexión WS para ${symbol}`);
      this.depthConnections[lower].close();
    }
  }
}
