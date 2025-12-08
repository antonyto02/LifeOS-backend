import { Module } from '@nestjs/common';
import { DeviceTokenState } from './device-token.state';

@Module({
  providers: [DeviceTokenState],
  exports: [DeviceTokenState],
})
export class StateModule {}
