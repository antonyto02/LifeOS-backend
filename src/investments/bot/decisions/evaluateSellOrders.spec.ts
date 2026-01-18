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

  it('repositions each sell order and keeps the last pending entryPrice when the book drops to 98-99', async () => {
    const symbol = 'BTCUSDT';
    const activeOrdersState = ActiveOrdersState.getInstance();

    if (!activeOrdersState) {
      throw new Error('ActiveOrdersState not initialized');
    }

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
      bidPrice: 98,
      depthBid: 1,
      askPrice: 99,
      topBid: 0.6,
      topAsk: 0.4,
    });

    const ordersAfter = Object.values(
      activeOrdersState.getAll()[symbol]?.SELL ?? {},
    ).flat();
    console.info(
      '[test] Órdenes SELL después de caer a 98-99:',
      JSON.stringify(ordersAfter, null, 2),
    );

    expect(cancelSellOrder).toHaveBeenCalledTimes(4);
    expect(placeSellOrder).toHaveBeenCalledTimes(4);
    expect(placeSellOrder).toHaveBeenCalledWith(symbol, 99);
    expect(executeInstantSell).not.toHaveBeenCalled();

    const pendingEntry = activeOrdersState.consumePendingSellEntryPrice(symbol);
    expect(pendingEntry).toBe(100);
  });
});
