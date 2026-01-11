import { generalNotification } from './generalNotification';

export async function sellNotification(symbol: string): Promise<void> {
  try {
    await generalNotification({
      symbol,
      action: 'SELL',
      title: `[${symbol}] Sell Order`,
      body: 'Sell order filled',
      sound: 'sellNotification.wav',
    });
  } catch (error) {
    console.error(error);
  }
}
