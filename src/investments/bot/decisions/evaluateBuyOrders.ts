import { ActiveOrdersState } from '../../state/active-orders.state';
import { CollisionSnapshot } from './computeCollisionPoint';

export function evaluateBuyOrders(symbol: string, _snapshot: CollisionSnapshot) {
  const activeOrdersState = ActiveOrdersState.getInstance();

  if (!activeOrdersState) {
    console.log('[evaluateBuyOrders] ActiveOrdersState no inicializado');
    return;
  }

  const buyOrders = activeOrdersState.getAll()[symbol]?.BUY ?? {};

  console.log('Órdenes de compra activas:', buyOrders);
}
