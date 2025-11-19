import { Injectable } from '@nestjs/common';
import { AllowedTokensState } from '../state/allowed-tokens.state';
import { ActiveTokensState } from '../state/active-tokens.state';
import { BinanceDepthStreamService } from '../stream/binance-depth-stream.service';
import { BinanceAggTradeStreamService } from '../stream/binance-aggtrade-stream.service';

@Injectable()
export class UserEventsLogic {
  constructor(
    private readonly allowedTokens: AllowedTokensState,
    private readonly activeTokens: ActiveTokensState,
    private readonly depthStream: BinanceDepthStreamService,
    private readonly aggTradeStream: BinanceAggTradeStreamService,
  ) {}

  handleUserExecutionReport(msg: any) {
    const symbol = msg.s;
    const orderType = msg.o;
    const execType = msg.x;
    const orderStatus = msg.X;

    // Solo tokens permitidos
    if (!this.allowedTokens.has(symbol)) return;

    // Solo LIMIT
    if (orderType !== 'LIMIT') return;

    // ───────────────────────────────────────────────
    // 🟢 NEW → activar token + abrir streams
    // ───────────────────────────────────────────────
    if (execType === 'NEW') {
      if (!this.activeTokens.has(symbol)) {
        this.activeTokens.add(symbol);

        // abrir streams
        this.depthStream.openDepthStream(symbol);
        this.aggTradeStream.openAggTradeStream(symbol);
      }
      return;
    }

    // ───────────────────────────────────────────────
    // 🔴 CANCELED → quitar token + cerrar streams
    // ───────────────────────────────────────────────
    if (execType === 'CANCELED') {
      // quitar el token siempre
      this.activeTokens.remove(symbol);

      // cerrar conexiones siempre
      this.depthStream.closeDepthStream(symbol);
      this.aggTradeStream.closeAggTradeStream(symbol);

      return;
    }

    // ───────────────────────────────────────────────
    // 🟡 PARTIAL FILLED (por ahora vacío)
    // ───────────────────────────────────────────────
    if (execType === 'TRADE' && orderStatus === 'PARTIALLY_FILLED') {
      return;
    }

    // ───────────────────────────────────────────────
    // 🔵 FILLED (por ahora vacío)
    // ───────────────────────────────────────────────
    if (execType === 'TRADE' && orderStatus === 'FILLED') {
      return;
    }
  }
}
