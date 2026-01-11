import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
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
  private readonly klineIntervalMs = 60 * 1000;
  private readonly klineLimit = 361;
  private readonly klineUrl = 'https://api.binance.com/api/v3/klines';

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
      const alertTitle = `🚨 BTC DOWN ${formattedDelta} IN ${elapsed}`;
      let alertBody = '';

      try {
        alertBody = await this.buildTemporalAlertBody();
      } catch (error) {
        const formattedReference = this.formatCurrency(this.referencePrice);
        const formattedCurrent = this.formatCurrency(currentPrice);
        alertBody = `Max: ${formattedReference} | Current: ${formattedCurrent}`;
        console.log('[BTC-PRICE] No se pudo calcular contexto temporal', error);
      }

      try {
        const alertSound = delta >= 200 ? 'btc.wav' : null;
        await alertNotification('BTCUSDT', alertTitle, alertBody, alertSound);
      } catch (error) {
        console.log('[BTC-PRICE] No se pudo enviar alerta de caída', error);
      }

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
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      style: 'currency',
      currency: 'USD',
    });
  }

  private formatSignedCurrency(amount: number): string {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      style: 'currency',
      currency: 'USD',
      signDisplay: 'always',
    });
  }

  private formatDeltaWithEmoji(delta: number): string {
    const emoji = delta < 0 ? '🔴' : '🟢';
    return `${emoji} ${this.formatSignedCurrency(delta)}`;
  }

  private async buildTemporalAlertBody(): Promise<string> {
    const klines = await this.fetchRecentKlines();
    const lastClosedIndex = this.getLastClosedIndex(klines);
    const currentClose = klines[lastClosedIndex].close;

    const delta1 = this.formatDeltaWithEmoji(currentClose - this.getCloseAtOffsetMinutes(klines, lastClosedIndex, 1));
    const delta5 = this.formatDeltaWithEmoji(currentClose - this.getCloseAtOffsetMinutes(klines, lastClosedIndex, 5));
    const delta10 = this.formatDeltaWithEmoji(currentClose - this.getCloseAtOffsetMinutes(klines, lastClosedIndex, 10));
    const delta15 = this.formatDeltaWithEmoji(currentClose - this.getCloseAtOffsetMinutes(klines, lastClosedIndex, 15));
    const delta30 = this.formatDeltaWithEmoji(currentClose - this.getCloseAtOffsetMinutes(klines, lastClosedIndex, 30));
    const delta60 = this.formatDeltaWithEmoji(currentClose - this.getCloseAtOffsetMinutes(klines, lastClosedIndex, 60));
    const delta120 = this.formatDeltaWithEmoji(currentClose - this.getCloseAtOffsetMinutes(klines, lastClosedIndex, 120));
    const delta180 = this.formatDeltaWithEmoji(currentClose - this.getCloseAtOffsetMinutes(klines, lastClosedIndex, 180));
    const delta360 = this.formatDeltaWithEmoji(currentClose - this.getCloseAtOffsetMinutes(klines, lastClosedIndex, 360));

    const row1 = `1m: ${delta1} | 5m: ${delta5} | 10m: ${delta10}`;
    const row2 = `15m: ${delta15} | 30m: ${delta30} | 1h: ${delta60}`;
    const row3 = `2h: ${delta120} | 3h: ${delta180} | 6h: ${delta360}`;

    return `${row1}\n${row2}\n${row3}`;
  }

  private async fetchRecentKlines(): Promise<Array<{ openTime: number; close: number }>> {
    const response = await axios.get(this.klineUrl, {
      params: {
        symbol: 'BTCUSDT',
        interval: '1m',
        limit: this.klineLimit,
      },
    });

    return (response.data as Array<[number, string, string, string, string]>).map((kline) => ({
      openTime: kline[0],
      close: Number(kline[4]),
    }));
  }

  private getLastClosedIndex(klines: Array<{ openTime: number }>): number {
    const lastIndex = klines.length - 1;
    const lastOpenTime = klines[lastIndex].openTime;
    const now = Date.now();

    if (now < lastOpenTime + this.klineIntervalMs) {
      return Math.max(0, lastIndex - 1);
    }

    return lastIndex;
  }

  private getCloseAtOffsetMinutes(
    klines: Array<{ close: number }>,
    lastClosedIndex: number,
    offsetMinutes: number,
  ): number {
    const index = lastClosedIndex - offsetMinutes;
    if (index < 0) {
      return klines[0].close;
    }
    return klines[index].close;
  }
}
