import { Injectable, Inject, forwardRef } from '@nestjs/common';
import WebSocket from 'ws';
import { TradingService } from './trading.service';

@Injectable()
export class BinanceClient {
  private listenKey: string;

  constructor(
    @Inject(forwardRef(() => TradingService))
    private readonly tradingService: TradingService,
  ) {}

  async init() {
    await this.createListenKey();
    this.connectUserDataStream();
  }

  private async createListenKey() {
    const url = 'https://api.binance.com/api/v3/userDataStream';

    const res = await fetch(url, {
      method: 'POST',
      headers: new Headers({
        'X-MBX-APIKEY': process.env.BINANCE_API_KEY!,
      }),
    });

    const data = await res.json();
    this.listenKey = data.listenKey;

    console.log('🔑 ListenKey:', this.listenKey);
  }

  private connectUserDataStream() {
    const wsUrl = `wss://stream.binance.com:9443/ws/${this.listenKey}`;
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      console.log('🔥 Conectado al USER DATA STREAM');
    });

    ws.on('message', (raw) => {
      const data = JSON.parse(raw.toString());
      if (data.e !== 'executionReport') return;

      const order = {
        eventType: data.x,
        orderId: data.i,
        symbol: data.s,
        side: data.S,
        price: data.p,
        qty: data.q,
        orderType: data.o,
      };

      // allowed tokens filter
      if (!this.tradingService.isAllowedToken(order.symbol)) return;

      // LIMIT only
      if (order.orderType !== 'LIMIT') return;

      // Only NEW orders
      if (order.eventType === 'NEW') {
        this.tradingService.handleNewOrder(order);
      }
    });
  }
}
