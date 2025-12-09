import { generalNotification } from './generalNotification';

export async function buyNotification(symbol: string): Promise<void> {
  console.log(`[notifications] Sending BUY notification for ${symbol}`);

  await generalNotification({
    symbol,
    action: 'BUY',
    title: `Orden de compra para ${symbol} completada`,
    sound: null,
  });
}
