import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import WebSocket, { RawData } from 'ws';

@Injectable()
export class BinanceBtcPriceStreamService
  implements OnModuleInit, OnModuleDestroy
{
  private ws?: WebSocket;
  private reconnectTimeout?: NodeJS.Timeout;
  private readonly streamUrl = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
  private referencePrice = 0;
  private lastNotifiedFloor = 0;
  private lowestPriceSinceReference = 0;

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
            this.handlePrice(numericPrice);
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

  private handlePrice(currentPrice: number) {
    if (this.referencePrice === 0) {
      this.referencePrice = currentPrice;
      this.lowestPriceSinceReference = currentPrice;
      return;
    }

    // Seguimiento de nuevo máximo
    if (currentPrice > this.referencePrice) {
      this.referencePrice = currentPrice;
      this.lastNotifiedFloor = 0;
      this.lowestPriceSinceReference = currentPrice;
      return;
    }

    // Actualizar mínimo observado para cálculo de rebote
    if (currentPrice < this.lowestPriceSinceReference) {
      this.lowestPriceSinceReference = currentPrice;
    }

    // Cálculo de caída
    const delta = this.referencePrice - currentPrice;
    const currentFloor = Math.floor(delta / 100) * 100;

    // Condición de alerta
    if (currentFloor > this.lastNotifiedFloor) {
      this.lastNotifiedFloor = currentFloor;
      console.log(
        `🚨 [ALERTA] BTC bajó: ${delta.toFixed(2)} USD (Máx: ${this.referencePrice.toFixed(2)} | Actual: ${currentPrice.toFixed(2)})`,
      );
    }

    // Reset al recuperar 300 USD desde el mínimo de la caída
    const rebound = currentPrice - this.lowestPriceSinceReference;
    if (rebound >= 300) {
      this.referencePrice = currentPrice;
      this.lastNotifiedFloor = 0;
      this.lowestPriceSinceReference = currentPrice;
      console.log(
        `🔄 [RESET] BTC recuperó ${rebound.toFixed(2)} USD desde el mínimo. Nuevo referencia: ${this.referencePrice.toFixed(2)}`,
      );
    }
  }
}
