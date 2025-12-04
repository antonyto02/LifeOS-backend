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

  const ordersList = Object.values(buyOrders).flat();

  for (const order of ordersList) {
    const { price, id, queue_position } = order;

    if (price === bidPrice) {
      if (depthBid < 130_000) {
        console.log('Cancelando porque el precio va a caer');
        await cancelBuyOrder(id, symbol);
        await placeBuyOrder(symbol);
      }
      continue;
    }





  }
}
