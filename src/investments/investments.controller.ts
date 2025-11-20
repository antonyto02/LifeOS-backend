import { Controller, Get } from '@nestjs/common';
import { AllowedTokensState } from './state/allowed-tokens.state';
import { ActiveTokensState } from './state/active-tokens.state';
import { BinanceDepthStreamService } from './stream/binance-depth-stream.service';
import { BinanceAggTradeStreamService } from './stream/binance-aggtrade-stream.service';
import { DepthState } from './state/depth.state';
import { CentralState } from './state/central-state.state';import { ActiveOrdersState } from './state/active-orders.state';




@Controller('investments')
export class InvestmentsController {
  constructor(
    private readonly allowedTokens: AllowedTokensState,
    private readonly activeTokens: ActiveTokensState,
    private readonly depthStream: BinanceDepthStreamService,
    private readonly aggTradeStream: BinanceAggTradeStreamService,
    private readonly depthState: DepthState,
    private readonly centralState: CentralState,
    private readonly activeOrders: ActiveOrdersState

  ) {}

  @Get('allowedtokens')
  getAllowedTokens() {
    return this.allowedTokens.getAll();
  }

  @Get('activetokens')
  getActiveTokens() {
    return this.activeTokens.getAll();
  }

  @Get('connections')
  getConnections() {
    return {
      depth: this.depthStream.getOpenConnections(),
      aggtrade: this.aggTradeStream.getOpenConnections(),
    };
  }
  @Get('depth')
  getDepth() {
    return this.depthState.getAll();
  }

  @Get('central')
  getCentral() {
    return this.centralState.getAll();
  }

  @Get('orders')
  getOrders() {
    return this.activeOrders.getAll();
}

}
