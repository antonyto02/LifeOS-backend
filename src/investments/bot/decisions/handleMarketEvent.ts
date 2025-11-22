import { CollisionSnapshot, computeCollision } from './computeCollisionPoint';
import { evaluateBuyOrders } from './evaluateBuyOrders';
import { evaluateSellOrder } from './evaluateSellOrders';

export function handleMarketEvent(symbol: string) {
  const collisionSnapshot: CollisionSnapshot | undefined = computeCollision(symbol);

  if (!collisionSnapshot) {
    return;
  }

  evaluateBuyOrders(symbol, collisionSnapshot);
  evaluateSellOrder(symbol, collisionSnapshot);

  return collisionSnapshot;
}
