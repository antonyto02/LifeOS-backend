import axios from 'axios';
import crypto from 'crypto';
import { DepthState } from '../../state/depth.state';

export const placeSellOrder = async (symbol: string): Promise<void> => {
  const depthState = DepthState.getInstance();

  if (!depthState) {
    console.log('Colocando orden de venta...');
    console.log('No se pudo obtener el estado de profundidad.');
    return;
  }

  const sellLevels = depthState.getAll()[symbol]?.SELL;
  const sellPrices = sellLevels ? Object.keys(sellLevels) : [];

  if (sellPrices.length === 0) {
    console.log('Colocando orden de venta...');
    console.log(`No hay niveles de venta para ${symbol}.`);
    return;
  }

  const bestAskPrice = sellPrices
    .map((price) => Number(price))
    .reduce((lowest, price) => (price < lowest ? price : lowest), Infinity);

  console.log('Colocando orden de venta...');
  console.log(`El precio mas bajo de venta de ${symbol} es ${bestAskPrice}`);

  const secret = process.env.BINANCE_API_SECRET;
  const apiKey = process.env.BINANCE_API_KEY;

  if (!secret || !apiKey) {
    console.log('[placeSellOrder] Faltan credenciales de Binance.');
    return;
  }

  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  const signature = crypto.createHmac('sha256', secret).update(queryString).digest('hex');

  try {
    const response = await axios.get(
      `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': apiKey,
        },
      },
    );

    const asset = symbol.replace(/USDT$/, '');
    const balances = response.data?.balances ?? [];
    const tokenBalance = balances.find((balance: any) => balance.asset === asset);

    if (!tokenBalance) {
      console.log(`[placeSellOrder] No se encontró saldo para ${asset}.`);
      return;
    }

    const free = Number(tokenBalance.free ?? 0);
    const locked = Number(tokenBalance.locked ?? 0);
    const totalBalance = free + locked;

    console.log(`Saldo disponible de ${asset}: ${totalBalance}`);
  } catch (error) {
    console.log('[placeSellOrder] No se pudo obtener el saldo.');
    console.log((error as any).response?.data || (error as Error).message);
  }
};

export default placeSellOrder;
