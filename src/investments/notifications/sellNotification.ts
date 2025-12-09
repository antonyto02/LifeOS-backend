import { generalNotification } from './generalNotification';

export async function sellNotification(symbol: string): Promise<void> {
  console.log(`[notifications] Sending SELL notification for ${symbol}`);

  await generalNotification({
    symbol,
    action: 'SELL',
    title: `Orden de venta para ${symbol} completada`,
    sound: 'default',
  });
}
