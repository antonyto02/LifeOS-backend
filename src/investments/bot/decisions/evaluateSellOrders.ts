import { CollisionSnapshot } from './computeCollisionPoint';
import { ActiveOrdersState } from '../../state/active-orders.state';
import cancelSellOrder from '../actions/cancelSellOrder';
import executeInstantSell from '../actions/executeInstantSell';
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
  const ordersList = Object.values(sellOrders).flat();

  if (ordersList.length === 0) {
    return;
  }

  const { askPrice } = snapshot;

  for (const order of ordersList) {
    const { id, price, entryPrice } = order;

    if (entryPrice == null) {
      console.log(`[evaluateSellOrder] Orden SELL ${id} sin entryPrice.`);
      continue;
    }

    const maxPrice = entryPrice + 1;
    const minPrice = entryPrice - 2;

    if (askPrice <= minPrice) {
      console.log(
        `[evaluateSellOrder] Precio ${askPrice} cayó más de 1 nivel bajo entry ${entryPrice} (>= 2 niveles). Venta inmediata.`,
      );
      await cancelSellOrder(id, symbol);
      await executeInstantSell(symbol);
      continue;
    }

    const targetPrice = askPrice > maxPrice ? maxPrice : askPrice;

    if (price === targetPrice) {
      continue;
    }

    console.log(
      `[evaluateSellOrder] Reposicionando SELL ${id} de ${price} a ${targetPrice}.`,
    );
    activeOrdersState.setPendingSellEntryPrice(symbol, entryPrice);
    await cancelSellOrder(id, symbol);
    await placeSellOrder(symbol, targetPrice);
  }
}

export default evaluateSellOrder;
