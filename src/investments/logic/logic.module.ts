import { Module, forwardRef } from '@nestjs/common';
import { UserEventsLogic } from './user-events.logic';
import { StateUpdaterLogic } from './state-updater.logic';
import { StateModule } from '../state/state.module';
import { StreamModule } from '../stream/stream.module';
import { SnapshotBuilder } from '../snapshot/snapshot.builder';
import { SnapshotGateway } from '../snapshot/snapshot.gateway';

@Module({
  imports: [
    StateModule,
    forwardRef(() => StreamModule),
  ],
  providers: [
    UserEventsLogic,
    StateUpdaterLogic,
    SnapshotBuilder,
    SnapshotGateway,
  ],
  exports: [
    UserEventsLogic,
    StateUpdaterLogic,
    SnapshotBuilder,
    SnapshotGateway,
  ],
})
export class LogicModule {}
