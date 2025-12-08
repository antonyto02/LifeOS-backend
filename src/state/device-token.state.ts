import { Injectable } from '@nestjs/common';

@Injectable()
export class DeviceTokenState {
  private static instance: DeviceTokenState | null = null;
  private deviceToken: string | null = null;

  constructor() {
    DeviceTokenState.instance = this;
  }

  static getInstance(): DeviceTokenState {
    if (!DeviceTokenState.instance) {
      throw new Error('DeviceTokenState has not been initialized');
    }
    return DeviceTokenState.instance;
  }

  setDeviceToken(token: string): void {
    this.deviceToken = token;
  }

  getDeviceToken(): string | null {
    return this.deviceToken;
  }

  clear(): void {
    this.deviceToken = null;
  }
}
