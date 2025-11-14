import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  private readonly pruebaData = {
    ACAUSDT: {
      levels: [
        {
          price: 0.0169,
          side: 'BUY',
          marketAmount: 250000,
          userOrders: [
            {
              id: 'A1B2',
              amount: 5000,
              position: 1,
              min_delante: 30000,
              max_delante: 80000,
            },
          ],
        },
        {
          price: 0.0170,
          side: 'BUY',
          marketAmount: 600000,
          userOrders: [],
        },
        {
          price: 0.0171,
          side: 'SELL',
          marketAmount: 450000,
          userOrders: [
            {
              id: 'B2C3',
              amount: 5200,
              position: 1,
              min_delante: 50000,
              max_delante: 70000,
            },
            {
              id: 'K8H2',
              amount: 3800,
              position: 2,
              min_delante: 120000,
              max_delante: 120000,
            },
          ],
        },
      ],
      probabilityRow: [
        { price: 0.0169, side: 'BUY', prob: 0.9 },
        { price: 0.0171, side: 'BUY', prob: 0.1 },

        { price: 0.0170, side: 'SELL', prob: 0.9 },
        { price: 0.0172, side: 'SELL', prob: 0.1 },
      ],
    },
  };

  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('prueba')
  getPrueba() {
    return this.pruebaData;
  }
}
