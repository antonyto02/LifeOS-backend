import { generalNotification } from './generalNotification';

export async function sellNotification(symbol: string): Promise<void> {
  console.log(`[notifications] Sending SELL notification for ${symbol}`);

  try {
    await generalNotification({
      symbol,
      action: 'SELL',
      title: `[${symbol}] Sell Order`,
      body: 'Sell order filled',
      sound: 'default',
    });
  } catch (error) {
    console.error(
      `[notifications] Error enviando Push, pero el bot sigue vivo. Action: SELL, Symbol: ${symbol}`,
      error,
    );
  }
}
