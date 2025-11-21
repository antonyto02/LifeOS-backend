import { CollisionSnapshot, computeCollision } from './computeCollisionPoint';
import { evaluateBuyOrders } from './evaluateBuyOrders';

export function handleMarketEvent(symbol: string) {
  const collisionSnapshot: CollisionSnapshot | undefined = computeCollision(symbol);

  if (!collisionSnapshot) {
    return;
  }

  evaluateBuyOrders(collisionSnapshot);

  return collisionSnapshot;
}
