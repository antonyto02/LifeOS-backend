import { generalNotification } from './generalNotification';
import { ExpoPushMessage } from 'expo-server-sdk';

export async function alertNotification(
  symbol: string,
  title: string,
  body: string,
  sound: ExpoPushMessage['sound'] = 'alert.wav',
): Promise<void> {
  console.log(`[notifications] Sending ALERT notification for ${symbol}`);

  try {
    await generalNotification({
      symbol,
      action: 'ALERT',
      title,
      body,
      sound,
    });
  } catch (error) {
    console.error(
      `[notifications] Error enviando Push, pero el bot sigue vivo. Action: ALERT, Symbol: ${symbol}`,
      error,
    );
  }
}
