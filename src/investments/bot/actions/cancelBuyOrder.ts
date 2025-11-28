import axios from 'axios';
import crypto from 'crypto';

export const cancelBuyOrder = async (
  orderId?: number | string,
  symbol?: string,
): Promise<void> => {
  if (!orderId || !symbol) {
    console.log('[cancelBuyOrder] Falta orderId o symbol para cancelar.');
    return;
  }

  const secret = process.env.BINANCE_API_SECRET;
  const apiKey = process.env.BINANCE_API_KEY;

  if (!secret || !apiKey) {
    console.log('[cancelBuyOrder] Faltan credenciales de Binance.');
    return;
  }

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const attemptCancellation = async (attempt: number): Promise<void> => {
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

      console.log(`Cancelación de orden de compra ${orderId} para ${symbol} ejecutada.`);
    } catch (error) {
      console.log(
        `[cancelBuyOrder] Intento ${attempt} fallido al cancelar la orden de compra ${orderId} para ${symbol}.`,
      );
      console.log((error as any).response?.data || (error as Error).message);

      if (attempt < 2) {
        console.log('[cancelBuyOrder] Reintentando en 1 segundo…');
        await delay(1000);
        await attemptCancellation(attempt + 1);
        return;
      }

      console.log(
        `[cancelBuyOrder] No se pudo cancelar la orden de compra ${orderId} para ${symbol} tras reintento.`,
      );
    }
  };

  await attemptCancellation(1);
};

export default cancelBuyOrder;
