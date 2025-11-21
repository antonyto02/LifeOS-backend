import { computeCollision } from './computeCollisionPoint';

export function handleMarketEvent(symbol: string) {
  const collisionSnapshot = computeCollision(symbol);

  return collisionSnapshot;
}
