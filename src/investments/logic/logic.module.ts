import { Module, forwardRef } from '@nestjs/common';
import { UserEventsLogic } from './user-events.logic';
import { StateModule } from '../state/state.module';
import { StreamModule } from '../stream/stream.module';

@Module({
  imports: [
    StateModule,
    forwardRef(() => StreamModule),
  ],
  providers: [
    UserEventsLogic,
  ],
  exports: [
    UserEventsLogic,
  ],
})
export class LogicModule {}
