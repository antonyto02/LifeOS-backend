import { generalNotification } from './generalNotification';

export async function alertNotification(symbol: string, title: string, body: string): Promise<void> {
  console.log(`[notifications] Sending ALERT notification for ${symbol}`);

  try {
    await generalNotification({
      symbol,
      action: 'ALERT',
      title,
      body,
      sound: 'default',
    });
  } catch (error) {
    console.error(
      `[notifications] Error enviando Push, pero el bot sigue vivo. Action: ALERT, Symbol: ${symbol}`,
      error,
    );
  }
}
