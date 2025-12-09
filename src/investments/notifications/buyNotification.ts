import { generalNotification } from './generalNotification';

export async function buyNotification(symbol: string): Promise<void> {
  console.log(`[notifications] Sending BUY notification for ${symbol}`);

  await generalNotification({
    symbol,
    action: 'BUY',
    title: `[${symbol}] Buy Order`,
    body: 'Buy order filled',
    sound: null,
  });
}
