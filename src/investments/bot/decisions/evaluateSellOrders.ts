import { ActiveOrdersState } from '../../state/active-orders.state';
import { CollisionSnapshot } from './computeCollisionPoint';

export function evaluateSellOrder(symbol: string, _snapshot: CollisionSnapshot) {
  const activeOrdersState = ActiveOrdersState.getInstance();

  if (!activeOrdersState) {
    console.log('[evaluateSellOrder] ActiveOrdersState no inicializado');
    return;
  }

  const sellOrders = activeOrdersState.getAll()[symbol]?.SELL ?? {};

  console.log(sellOrders);
}

export default evaluateSellOrder;
