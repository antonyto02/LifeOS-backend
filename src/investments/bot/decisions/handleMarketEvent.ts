import { computeCollision } from './computeCollisionPoint';

export function handleMarketEvent(symbol: string): void {
  computeCollision(symbol);
}
