import { generalNotification } from './generalNotification';

export async function buyNotification(symbol: string): Promise<void> {
  try {
    await generalNotification({
      symbol,
      action: 'BUY',
      title: `[${symbol}] Buy Order`,
      body: 'Buy order filled',
      sound: 'buy.wav',
    });
  } catch (error) {
    console.error(error);
  }
}
