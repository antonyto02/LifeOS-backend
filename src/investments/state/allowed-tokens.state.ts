import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class AllowedTokensState implements OnModuleInit {
  private static instance: AllowedTokensState | null = null;
  private allowed: Set<string> = new Set();

  constructor() {
    AllowedTokensState.instance = this;
  }

  onModuleInit() {
    this.allowed.add("ACAUSDT");
    this.allowed.add("NKNUSDT");
    this.allowed.add("VANRYUSDT");
  }

  static getInstance(): AllowedTokensState | null {
    return AllowedTokensState.instance;
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
