import { Controller, Get } from '@nestjs/common';
import { TradingService } from './trading.service';

@Controller('investments')
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  @Get('orders')
  getFormattedOrders() {
    return this.tradingService.getFormattedState();
  }
}
