import { ActiveOrdersState } from '../../state/active-orders.state';
import { CollisionSnapshot } from './computeCollisionPoint';
import cancelBuyOrder from '../actions/cancelBuyOrder';

export function evaluateBuyOrders(symbol: string, snapshot: CollisionSnapshot) {
  const activeOrdersState = ActiveOrdersState.getInstance();

  if (!activeOrdersState) {
    console.log('[evaluateBuyOrders] ActiveOrdersState no inicializado');
    return;
  }

  const buyOrders = activeOrdersState.getAll()[symbol]?.BUY ?? {};

  const { bidPrice, secondBidPrice, topBid } = snapshot;

  for (const order of Object.values(buyOrders)) {
    const { price } = order;

    if (price === bidPrice) {
      if (topBid <= 0.2) {
        console.log('Cancelando porque el precio va a caer');
        cancelBuyOrder();
      }
      continue;
    }

    if (secondBidPrice !== undefined && price === secondBidPrice) {
      if (topBid >= 0.45) {
        console.log('Cancelando porque el precio va a subir');
        cancelBuyOrder();
      }
      continue;
    }

    console.log('Cancelando por precio fuera de rango');
    cancelBuyOrder();
  }
}
