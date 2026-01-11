import { generalNotification } from './generalNotification';
import { ExpoPushMessage } from 'expo-server-sdk';

export async function alertNotification(
  symbol: string,
  title: string,
  body: string,
  sound: ExpoPushMessage['sound'] = 'alert.wav',
): Promise<void> {
  try {
    await generalNotification({
      symbol,
      action: 'ALERT',
      title,
      body,
      sound,
    });
  } catch (error) {
    console.error(error);
  }
}
