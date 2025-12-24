import { CollisionSnapshot } from './computeCollisionPoint';

// Puedes borrar los otros imports (ActiveOrdersState, actions, etc.) 
// si ya no los usas para que no te marque warnings el linter.

export async function evaluateSellOrder(
  symbol: string,
  snapshot: CollisionSnapshot,
) {
  // Simplemente retornamos. 
  // Al ser async, esto equivale a return Promise.resolve();
  // El bot entrará aquí, no hará nada y saldrá inmediatamente.
  return;
}

export default evaluateSellOrder;