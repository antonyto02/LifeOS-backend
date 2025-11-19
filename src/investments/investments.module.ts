import { Module } from '@nestjs/common';
import { StreamModule } from './stream/stream.module';
import { StateModule } from './state/state.module';
import { LogicModule } from './logic/logic.module';
import { InvestmentsController } from './investments.controller';

@Module({
  imports: [
    StreamModule,
    LogicModule,
    StateModule,
  ],
  controllers: [InvestmentsController],
})
export class InvestmentsModule {}
