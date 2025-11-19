import { Injectable, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import WebSocket from 'ws';

@Injectable()
export class BinanceUserStreamService implements OnModuleInit {
  private ws: WebSocket;

  async onModuleInit() {
    const listenKey = await this.createListenKey();
    this.connect(listenKey);
  }

  private async createListenKey(): Promise<string> {
    const response = await axios.post(
      'https://api.binance.com/api/v3/userDataStream',
      null,
      {
        headers: {
          'X-MBX-APIKEY': process.env.BINANCE_API_KEY,
        },
      },
    );

    return response.data.listenKey;
  }

  private connect(listenKey: string) {
    const url = `wss://stream.binance.com:9443/ws/${listenKey}`;
    this.ws = new WebSocket(url);

    this.ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());

      if (msg.e === 'executionReport') {
        // Aquí luego enviaremos el evento a logic/orderbook/bot.
        // De momento, dejamos vacío.
      }
    });

    this.ws.on('close', () => {
      this.connect(listenKey); // reconexión silenciosa
    });

    this.ws.on('error', () => {
      // error silencioso para no ensuciar la consola
    });
  }
}
