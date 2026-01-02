import { generalNotification } from './generalNotification';

export async function buyNotification(symbol: string): Promise<void> {
  console.log(`[notifications] Sending BUY notification for ${symbol}`);

  try {
    await generalNotification({
      symbol,
      action: 'BUY',
      title: `[${symbol}] Buy Order`,
      body: 'Buy order filled',
      sound: 'buy.wav',
    });
  } catch (error) {
    console.error(
      `[notifications] Error enviando Push, pero el bot sigue vivo. Action: BUY, Symbol: ${symbol}`,
      error,
    );
  }
}
