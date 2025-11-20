import { Module, forwardRef } from '@nestjs/common';
import { UserEventsLogic } from './user-events.logic';
import { StateUpdaterLogic } from './state-updater.logic';
import { StateModule } from '../state/state.module';
import { StreamModule } from '../stream/stream.module';
import { SnapshotBuilder } from '../snapshot/snapshot.builder';
import { SnapshotGateway } from '../snapshot/snapshot.gateway';
import { DepthEventsLogic } from './depth-events.logic';

@Module({
  imports: [
    StateModule,
    forwardRef(() => StreamModule),
  ],
  providers: [
    UserEventsLogic,
    StateUpdaterLogic,
    DepthEventsLogic,
    SnapshotBuilder,
    SnapshotGateway,
  ],
  exports: [
    UserEventsLogic,
    StateUpdaterLogic,
    DepthEventsLogic,
    SnapshotBuilder,
    SnapshotGateway,
  ],
})
export class LogicModule {}
