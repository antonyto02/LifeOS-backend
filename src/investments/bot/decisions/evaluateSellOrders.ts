import { ActiveOrdersState } from '../../state/active-orders.state';
import { CollisionSnapshot } from './computeCollisionPoint';
import executeInstantSell from '../actions/executeInstantSell';
import cancelSellOrder from '../actions/cancelSellOrder';
import placeSellOrder from '../actions/placeSellOrder';

export async function evaluateSellOrder(
  symbol: string,
  snapshot: CollisionSnapshot,
) {
  const activeOrdersState = ActiveOrdersState.getInstance();

  if (!activeOrdersState) {
    console.log('[evaluateSellOrder] ActiveOrdersState no inicializado');
    return;
  }

  const sellOrders = activeOrdersState.getAll()[symbol]?.SELL ?? {};
  const { askPrice, topAsk } = snapshot;

  const ordersList = Object.values(sellOrders).flat();

  for (const order of ordersList) {
    const { price, id } = order;

    if (price === askPrice) {
      if (topAsk >= 0.90) {
        console.log('vendiendo automaticamente porque el precio va a caer');
        await cancelSellOrder(id, symbol);
        await executeInstantSell(symbol);
      }

      continue;
    }

    if (price > askPrice) {
      console.log('Cancelando porque el precio ya cayó');
      await cancelSellOrder(id, symbol);
      await placeSellOrder(symbol);
      continue;
    }

    if (price < askPrice) {
      console.log('Manteniendo orden porque el precio de venta subió');
      continue;
    }
  }
}

export default evaluateSellOrder;
