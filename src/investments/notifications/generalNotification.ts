import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { DeviceTokenState } from '../../state/device-token.state';

export type NotificationAction = 'BUY' | 'SELL' | 'ALERT' | 'GENERAL' | string;

const expo = new Expo();

type NotificationPayload = {
  symbol: string;
  action: NotificationAction;
  title: string;
  body?: string;
  sound?: ExpoPushMessage['sound'];
  data?: Record<string, unknown>;
};

type CollapsiblePushMessage = ExpoPushMessage & { _collapseId: string; tag: string };

export async function generalNotification({
  symbol,
  action,
  title,
  body,
  sound = null,
  data,
}: NotificationPayload): Promise<void> {
  const deviceToken = DeviceTokenState.getInstance().getDeviceToken();

  if (!deviceToken) {
    return;
  }

  if (!Expo.isExpoPushToken(deviceToken)) {
    return;
  }

  const isMarketStatus = action === 'ALERT' || action === 'GENERAL';
  const collapseId = isMarketStatus ? `${symbol}-MARKET_STATUS` : `${symbol}-${action}`;

  const message: CollapsiblePushMessage = {
    to: deviceToken,
    title,
    body,
    sound,
    data: { symbol, action, ...(data ?? {}) },
    _collapseId: collapseId,
    tag: collapseId,
  };

  try {
    await expo.sendPushNotificationsAsync([message]);
  } catch (error) {
    console.error(error);
  }
}
