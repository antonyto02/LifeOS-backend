import { Injectable } from '@nestjs/common';

@Injectable()
export class ActiveTokensState {
  private active: Set<string> = new Set();

  add(token: string) {
    this.active.add(token);
  }

  remove(token: string) {
    this.active.delete(token);
  }

  has(token: string): boolean {
    return this.active.has(token);
  }

  getAll(): string[] {
    return Array.from(this.active);
  }

  clear() {
    this.active.clear();
  }
}
