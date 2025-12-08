import { Body, Controller, Get, Post } from '@nestjs/common';
import { DeviceTokenState } from '../state/device-token.state';

@Controller('device-token')
export class DeviceTokenController {
  @Post()
  setDeviceToken(@Body('deviceToken') deviceToken: string) {
    DeviceTokenState.getInstance().setDeviceToken(deviceToken);
    return { ok: true, saved: deviceToken };
  }

  @Get()
  getDeviceToken() {
    return { deviceToken: DeviceTokenState.getInstance().getDeviceToken() };
  }
}
