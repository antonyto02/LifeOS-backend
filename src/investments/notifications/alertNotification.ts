import { generalNotification } from './generalNotification';

export async function alertNotification(symbol: string, body: string): Promise<void> {
  console.log(`[notifications] Sending ALERT notification for ${symbol}`);

  await generalNotification({
    symbol,
    action: 'ALERT',
    title: `Alerta para ${symbol}`,
    body,
  });
}
