import axios from 'axios';
import crypto from 'crypto';

export const cancelSellOrder = async (
  orderId?: number | string,
  symbol?: string,
): Promise<void> => {
  if (!orderId || !symbol) {
    console.log('[cancelSellOrder] Falta orderId o symbol para cancelar.');
    return;
  }

  const secret = process.env.BINANCE_SECRET_KEY;
  const apiKey = process.env.BINANCE_API_KEY;

  if (!secret || !apiKey) {
    console.log('[cancelSellOrder] Faltan credenciales de Binance.');
    return;
  }

  const timestamp = Date.now();
  const queryString = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
  const signature = crypto.createHmac('sha256', secret).update(queryString).digest('hex');

  try {
    await axios.delete(
      `https://api.binance.com/api/v3/order?${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': apiKey,
        },
      },
    );

    console.log(`Cancelación de orden de venta ${orderId} para ${symbol} ejecutada.`);
  } catch (error) {
    console.log(
      `[cancelSellOrder] No se pudo cancelar la orden de venta ${orderId} para ${symbol}.`,
    );
  }
};

export default cancelSellOrder;
