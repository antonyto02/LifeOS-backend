import { ActiveOrdersState } from '../../state/active-orders.state';
import { evaluateSellOrder } from './evaluateSellOrders';
import cancelSellOrder from '../actions/cancelSellOrder';
import executeInstantSell from '../actions/executeInstantSell';
import placeSellOrder from '../actions/placeSellOrder';

jest.mock('../actions/cancelSellOrder', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../actions/executeInstantSell', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../actions/placeSellOrder', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('evaluateSellOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const activeOrdersState = new ActiveOrdersState();
    activeOrdersState.clearAll();
  });

  afterEach(() => {
    (console.log as jest.Mock).mockRestore();
  });

  it('cancels and executes instant sell when ask price drops two or more levels below entry', async () => {
    const symbol = 'BTCUSDT';
    const activeOrdersState = ActiveOrdersState.getInstance();

    if (!activeOrdersState) {
      throw new Error('ActiveOrdersState not initialized');
    }

    activeOrdersState.setOrder(symbol, 'SELL', '100', {
      id: 123,
      pending_amount: 1,
      queue_position: 0,
      filled_amount: 0,
      token: symbol,
      side: 'SELL',
      price: 100,
      entryPrice: 100,
    });

    await evaluateSellOrder(symbol, {
      bidPrice: 97,
      depthBid: 1,
      askPrice: 98,
      topBid: 0.6,
      topAsk: 0.4,
    });

    expect(cancelSellOrder).toHaveBeenCalledWith(123, symbol);
    expect(executeInstantSell).toHaveBeenCalledWith(symbol);
    expect(placeSellOrder).not.toHaveBeenCalled();
  });

  it('repositions entryPrice 99 orders and triggers instant sell for entryPrice 100 when the book drops to 97-98', async () => {
    const symbol = 'BTCUSDT';
    const activeOrdersState = ActiveOrdersState.getInstance();
    const nextId = { value: 1000 };

    if (!activeOrdersState) {
      throw new Error('ActiveOrdersState not initialized');
    }

    (cancelSellOrder as jest.Mock).mockImplementation(async (orderId: number) => {
      const allOrders = activeOrdersState.getAll()[symbol]?.SELL ?? {};

      for (const [priceKey, orders] of Object.entries(allOrders)) {
        if (orders.some((order) => order.id === orderId)) {
          activeOrdersState.deleteOrder(symbol, 'SELL', priceKey, orderId);
          break;
        }
      }
    });

    (placeSellOrder as jest.Mock).mockImplementation(async (token: string, price?: number) => {
      const resolvedPrice = price ?? 0;
      const entryPrice = activeOrdersState.consumePendingSellEntryPrice(token);
      const orderId = nextId.value++;

      activeOrdersState.setOrder(token, 'SELL', resolvedPrice.toString(), {
        id: orderId,
        pending_amount: 1,
        queue_position: 0,
        filled_amount: 0,
        token,
        side: 'SELL',
        price: resolvedPrice,
        entryPrice: entryPrice ?? undefined,
      });
    });

    activeOrdersState.setOrder(symbol, 'SELL', '100', {
      id: 201,
      pending_amount: 1,
      queue_position: 0,
      filled_amount: 0,
      token: symbol,
      side: 'SELL',
      price: 100,
      entryPrice: 99,
    });

    activeOrdersState.setOrder(symbol, 'SELL', '100', {
      id: 202,
      pending_amount: 1,
      queue_position: 0,
      filled_amount: 0,
      token: symbol,
      side: 'SELL',
      price: 100,
      entryPrice: 99,
    });

    activeOrdersState.setOrder(symbol, 'SELL', '100', {
      id: 203,
      pending_amount: 1,
      queue_position: 0,
      filled_amount: 0,
      token: symbol,
      side: 'SELL',
      price: 100,
      entryPrice: 100,
    });

    activeOrdersState.setOrder(symbol, 'SELL', '100', {
      id: 204,
      pending_amount: 1,
      queue_position: 0,
      filled_amount: 0,
      token: symbol,
      side: 'SELL',
      price: 100,
      entryPrice: 100,
    });

    await evaluateSellOrder(symbol, {
      bidPrice: 97,
      depthBid: 1,
      askPrice: 98,
      topBid: 0.6,
      topAsk: 0.4,
    });

    const ordersAfter = Object.values(
      activeOrdersState.getAll()[symbol]?.SELL ?? {},
    ).flat();
    console.info(
      '[test] Órdenes SELL después de caer a 97-98:',
      JSON.stringify(ordersAfter, null, 2),
    );

    expect(cancelSellOrder).toHaveBeenCalledTimes(4);
    expect(placeSellOrder).toHaveBeenCalledTimes(2);
    expect(placeSellOrder).toHaveBeenCalledWith(symbol, 98);
    expect(executeInstantSell).toHaveBeenCalledTimes(2);
  });
});
