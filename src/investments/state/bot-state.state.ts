import { Injectable } from '@nestjs/common';

@Injectable()
export class BotState {
  private isActive = false;

  getStatus(): boolean {
    return this.isActive;
  }

  activate(): void {
    this.isActive = true;
  }

  deactivate(): void {
    this.isActive = false;
  }

  toggle(): void {
    this.isActive = !this.isActive;
  }
}
