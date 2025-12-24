import { Module } from '@nestjs/common';
import { StateModule } from '../state/state.module';
import { DeviceTokenController } from './device-token.controller';

@Module({
  imports: [StateModule],
  controllers: [DeviceTokenController],
})
export class DeviceTokenModule {}
