import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import WebSocket from 'ws';

@Injectable()
export class BinanceBtcPriceStreamService
  implements OnModuleInit, OnModuleDestroy
{
  private ws?: WebSocket;
  private reconnectTimeout?: NodeJS.Timeout;
  private readonly streamUrl = 'wss://stream.binance.com:9443/ws/btcusdt@trade';

  onModuleInit() {
    this.connect();
  }

  onModuleDestroy() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.ws?.close();
  }

  private connect() {
    console.log(`[BTC-PRICE] Abriendo conexión WS → ${this.streamUrl}`);

    this.ws = new WebSocket(this.streamUrl);

    this.ws.on('open', () => {
      console.log('[BTC-PRICE] Conexión abierta');
    });

    this.ws.on('message', (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        const price = payload?.p ?? payload?.c;

        if (price) {
          console.log(`[BTC-PRICE] Precio BTCUSDT: ${price}`);
        }
      } catch (error) {
        console.log('[BTC-PRICE] No se pudo parsear el mensaje', error);
      }
    });

    this.ws.on('close', () => {
      console.log('[BTC-PRICE] Conexión cerrada, reintentando en 5s');
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.log('[BTC-PRICE] Error en el stream BTC', err);
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
  }
}
