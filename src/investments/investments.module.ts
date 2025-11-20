import { Module } from '@nestjs/common';
import { StreamModule } from './stream/stream.module';
import { StateModule } from './state/state.module';
import { LogicModule } from './logic/logic.module';
import { InvestmentsController } from './investments.controller';
import { SnapshotBuilder } from './snapshot/snapshot.builder';
import { SnapshotGateway } from './snapshot/snapshot.gateway';



@Module({
  imports: [
    StreamModule,
    LogicModule,
    StateModule,
  ],
  controllers: [InvestmentsController],
  providers: [
    SnapshotBuilder,
    SnapshotGateway
  ],
  exports: [
    SnapshotBuilder,
    SnapshotGateway
  ],
})
export class InvestmentsModule {}
