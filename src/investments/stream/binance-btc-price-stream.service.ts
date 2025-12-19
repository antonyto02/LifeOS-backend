import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import WebSocket, { RawData } from 'ws';

@Injectable()
export class BinanceBtcPriceStreamService
  implements OnModuleInit, OnModuleDestroy
{
  private ws?: WebSocket;
  private reconnectTimeout?: NodeJS.Timeout;
  private readonly streamUrl = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
  private lastPrintedPrice?: string;

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

    this.ws.on('message', (raw: RawData) => {
      try {
        const payload = JSON.parse(raw.toString()) as { p?: string; c?: string };
        const price = payload?.p ?? payload?.c;

        if (price) {
          const numericPrice = Number(price);

          if (Number.isFinite(numericPrice)) {
            const roundedPrice = numericPrice.toFixed(2);

            if (roundedPrice !== this.lastPrintedPrice) {
              this.lastPrintedPrice = roundedPrice;
              console.log(`[BTC-PRICE] Precio BTCUSDT: ${roundedPrice}`);
            }
          }
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
