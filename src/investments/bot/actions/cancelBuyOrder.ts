import axios from 'axios';

export const cancelBuyOrder = async (
  orderId?: number | string,
  symbol?: string,
): Promise<void> => {
  if (!orderId || !symbol) {
    console.log('[cancelBuyOrder] Falta orderId o symbol para cancelar.');
    return;
  }

  try {
    await axios.delete('https://api.binance.com/api/v3/order', {
      params: { orderId, symbol },
      headers: {
        'X-MBX-APIKEY': process.env.BINANCE_API_KEY,
      },
    });

    console.log(`Cancelación de orden de compra ${orderId} para ${symbol} ejecutada.`);
  } catch (error) {
    console.log(
      `[cancelBuyOrder] No se pudo cancelar la orden de compra ${orderId} para ${symbol}.`,
    );
  }
};

export default cancelBuyOrder;
