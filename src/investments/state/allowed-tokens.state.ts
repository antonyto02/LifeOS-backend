import { Injectable } from '@nestjs/common';

@Injectable()
export class AllowedTokensState {
  private allowed: Set<string> = new Set();

  onModuleInit() {
    this.allowed.add("ACAUSDT");
    this.allowed.add("BTCUSDT");
    this.allowed.add("ETHUSDT");
  }  

  getAll(): string[] {
    return Array.from(this.allowed);
  }

  has(token: string): boolean {
    return this.allowed.has(token);
  }

  add(token: string) {
    this.allowed.add(token);
  }

  remove(token: string) {
    this.allowed.delete(token);
  }

  clear() {
    this.allowed.clear();
  }
}
