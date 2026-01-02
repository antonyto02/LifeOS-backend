import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import WebSocket, { RawData } from 'ws';
import { alertNotification } from '../notifications/alertNotification';

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
  private maxPriceTimestamp = 0;

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
            void this.handlePrice(numericPrice);
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

  private async handlePrice(currentPrice: number) {
    if (this.referencePrice === 0) {
      this.referencePrice = currentPrice;
      this.lowestPriceSinceReference = currentPrice;
      this.maxPriceTimestamp = Date.now();
      return;
    }

    // Seguimiento de nuevo máximo
    if (currentPrice > this.referencePrice) {
      this.referencePrice = currentPrice;
      this.lastNotifiedFloor = 0;
      this.lowestPriceSinceReference = currentPrice;
      this.maxPriceTimestamp = Date.now();
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
      const elapsed = this.formatElapsed(Date.now() - this.maxPriceTimestamp);
      const formattedDelta = this.formatCurrency(delta);
      const formattedReference = this.formatCurrency(this.referencePrice);
      const formattedCurrent = this.formatCurrency(currentPrice);
      const alertTitle = `🚨 BTC DOWN ${formattedDelta} IN ${elapsed}`;
      const alertBody = `Max: ${formattedReference} | Current: ${formattedCurrent}`;

      try {
        const alertSound = delta >= 200 ? 'btc.wav' : null;
        await alertNotification('BTCUSDT', alertTitle, alertBody, alertSound);
      } catch (error) {
        console.log('[BTC-PRICE] No se pudo enviar alerta de caída', error);
      }

      console.log(
        `${alertTitle} (${alertBody})`,
      );
    }

    // Reset al recuperar 200 USD desde el mínimo de la caída
    const rebound = currentPrice - this.lowestPriceSinceReference;
    if (rebound >= 200) {
      this.referencePrice = currentPrice;
      this.lastNotifiedFloor = 0;
      this.lowestPriceSinceReference = currentPrice;
      this.maxPriceTimestamp = Date.now();
      const formattedCurrent = this.formatCurrency(currentPrice);
      const resetTitle = '✅ BTC RECOVERY: +$200';
      const resetBody = `New reference point: ${formattedCurrent}`;

      try {
        await alertNotification('BTCUSDT', resetTitle, resetBody, null);
      } catch (error) {
        console.log('[BTC-PRICE] No se pudo enviar alerta de reset', error);
      }

      console.log(
        `🔄 [RESET] BTC recuperó ${rebound.toFixed(2)} USD desde el mínimo. Nuevo referencia: ${formattedCurrent}`,
      );
    }
  }

  private formatElapsed(elapsedMs: number): string {
    const totalSeconds = Math.floor(elapsedMs / 1000);

    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  }

  private formatCurrency(amount: number): string {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2, style: 'currency', currency: 'USD' });
  }
}
