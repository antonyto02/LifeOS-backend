import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  private readonly pruebaData = {
    VANRYUSDT: {
      levels: [
        {
          price: 0.0169,
          side: 'BUY',
          marketAmount: 270000,
          userOrders: [
            
            
          ],
        },
        {
          price: 0.0170,
          side: 'BUY',
          marketAmount: 600000,
          userOrders: [
            {
              id: 'B2C3',
              amount: 30000,
              position: 1,
              min_delante:40000,
            },
            {
              id: 'B2C4',
              amount: 50000,
              position: 1,
              min_delante:180000,
            },
          ],
        },
        {
          price: 0.0171,
          side: 'SELL',
          marketAmount: 1000000,
          userOrders: [
            
            
            
          ],
        },
        {
          price: 0.0172,
          side: 'SELL',
          marketAmount: 100000,
          userOrders: [],
        },
      ],
      probabilityRow: [
        { price: 0.0169, side: 'BUY', prob: 0.1 },
        { price: 0.0171, side: 'BUY', prob: 0.9 },

        { price: 0.0170, side: 'SELL', prob: 0.1 },
        { price: 0.0172, side: 'SELL', prob: 0.9 },
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
