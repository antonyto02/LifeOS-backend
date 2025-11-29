import axios from 'axios';
import crypto from 'crypto';

export const placeBuyLimit = async (
  token: string,
  price: number,
  quantity: number,
): Promise<void> => {
  const secret = process.env.BINANCE_API_SECRET;
  const apiKey = process.env.BINANCE_API_KEY;

  if (!secret || !apiKey) {
    console.log(
      '[placeBuyLimit] Error creando orden BUY: faltan credenciales de Binance.',
    );
    return;
  }

  const timestamp = Date.now();

  const params = new URLSearchParams({
    symbol: token,
    side: 'BUY',
    type: 'LIMIT',
    timeInForce: 'GTC',
    price: String(price),
    quantity: String(quantity),
    timestamp: String(timestamp),
  });

  const signature = crypto
    .createHmac('sha256', secret)
    .update(params.toString())
    .digest('hex');

  console.log('[placeBuyLimit] Enviando orden BUY…');

  try {
    await axios.post(
      `https://api.binance.com/api/v3/order?${params.toString()}&signature=${signature}`,
      undefined,
      {
        headers: {
          'X-MBX-APIKEY': apiKey,
        },
      },
    );

    console.log('[placeBuyLimit] Orden creada exitosamente');
  } catch (error) {
    console.log(
      '[placeBuyLimit] Error creando orden BUY:',
      (error as any).response?.data || (error as Error).message,
    );
    throw error;
  }
};

export default placeBuyLimit;
