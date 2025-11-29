import { ActiveOrdersState } from '../../state/active-orders.state';
import { CollisionSnapshot } from './computeCollisionPoint';
import cancelBuyOrder from '../actions/cancelBuyOrder';
import placeBuyOrder from '../actions/placeBuyOrder';

export async function evaluateBuyOrders(
  symbol: string,
  snapshot: CollisionSnapshot,
) {
  const activeOrdersState = ActiveOrdersState.getInstance();

  if (!activeOrdersState) {
    console.log('[evaluateBuyOrders] ActiveOrdersState no inicializado');
    return;
  }

  const buyOrders = activeOrdersState.getAll()[symbol]?.BUY ?? {};

  const { bidPrice, secondBidPrice, depthBid } = snapshot;

  for (const order of Object.values(buyOrders)) {
    const { price, id, queue_position } = order;

    if (price === bidPrice) {
      if (depthBid < 50_000) {
        console.log('Cancelando porque el precio va a caer');
        await cancelBuyOrder(id, symbol);
        await placeBuyOrder();
      }
      continue;
    }

    if (secondBidPrice !== undefined && price === secondBidPrice) {
      if (queue_position > 50_000 && depthBid > 50_000) {
        console.log('Cancelando porque el precio va a subir');
        await cancelBuyOrder(id, symbol);
        await placeBuyOrder();
      }
      continue;
    }

    console.log('Cancelando por precio fuera de rango');
    await cancelBuyOrder(id, symbol);
    await placeBuyOrder();
  }
}
