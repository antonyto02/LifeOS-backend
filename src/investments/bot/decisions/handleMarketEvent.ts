import { CollisionSnapshot, computeCollision } from './computeCollisionPoint';
import { evaluateBuyOrders } from './evaluateBuyOrders';
import { evaluateSellOrder } from './evaluateSellOrders';

export async function handleMarketEvent(symbol: string) {
  const collisionSnapshot: CollisionSnapshot | undefined = computeCollision(symbol);

  if (!collisionSnapshot) {
    return;
  }

  await evaluateBuyOrders(symbol, collisionSnapshot);
  evaluateSellOrder(symbol, collisionSnapshot);

  return collisionSnapshot;
}
