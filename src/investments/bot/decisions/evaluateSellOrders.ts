import { ActiveOrdersState } from '../../state/active-orders.state';
import { CollisionSnapshot } from './computeCollisionPoint';
import executeInstantSell from '../actions/executeInstantSell';
import cancelSellOrder from '../actions/cancelSellOrder';
import placeSellOrder from '../actions/placeSellOrder';

export function evaluateSellOrder(symbol: string, snapshot: CollisionSnapshot) {
  const activeOrdersState = ActiveOrdersState.getInstance();

  if (!activeOrdersState) {
    console.log('[evaluateSellOrder] ActiveOrdersState no inicializado');
    return;
  }

  const sellOrders = activeOrdersState.getAll()[symbol]?.SELL ?? {};
  const { askPrice, topAsk } = snapshot;

  for (const order of Object.values(sellOrders)) {
    const { price, id } = order;

    if (price === askPrice) {
      if (topAsk >= 0.75) {
        console.log('vendiendo automaticamente porque el precio va a caer');
        executeInstantSell();
      }

      continue;
    }

    console.log('Cancelando porque el precio ya cayó');
    cancelSellOrder(id, symbol).finally(() => {
      placeSellOrder(symbol);
    });
  }
}

export default evaluateSellOrder;
