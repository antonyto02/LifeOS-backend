import { Controller, Get } from '@nestjs/common';
import { TradingService } from './trading.service';

@Controller('investments')
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  @Get('orders')
  getFormattedOrders() {
    return this.tradingService.getFormattedState();
  }

  @Get('debug/orders')
  getRawOrders() {
    return {
      buyOrders: this.tradingService.buyOrders,
      sellOrders: this.tradingService.sellOrders,
    };
  }
}
