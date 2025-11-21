import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import axios from 'axios';
import WebSocket from 'ws';
import { UserEventsLogic } from '../logic/user-events.logic';

@Injectable()
export class BinanceUserStreamService implements OnModuleInit, OnModuleDestroy {
  private ws: WebSocket;
  private keepAliveInterval?: NodeJS.Timeout;

  constructor(
    private readonly logicService: UserEventsLogic,
  ) {}

  async onModuleInit() {
    const listenKey = await this.createListenKey();
    this.startKeepAlive(listenKey);
    this.connect(listenKey);
  }

  onModuleDestroy() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }
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

  private startKeepAlive(listenKey: string) {
    const renew = async () => {
      try {
        await axios.put(
          'https://api.binance.com/api/v3/userDataStream',
          null,
          {
            params: { listenKey },
            headers: {
              'X-MBX-APIKEY': process.env.BINANCE_API_KEY,
            },
          },
        );
      } catch (error) {
        // Ignore errors to avoid disrupting the stream; next interval will retry
      }
    };

    this.keepAliveInterval = setInterval(renew, 30 * 60 * 1000);
  }

  private connect(listenKey: string) {
    const url = `wss://stream.binance.com:9443/ws/${listenKey}`;
    this.ws = new WebSocket(url);

    this.ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());

      if (msg.e === 'executionReport') {
        this.logicService.handleUserExecutionReport(msg);
      }
    });

    this.ws.on('close', () => {
      this.connect(listenKey);
    });

    this.ws.on('error', () => {});
  }
}
