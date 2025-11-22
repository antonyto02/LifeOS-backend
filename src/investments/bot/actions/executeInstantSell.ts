import axios from 'axios';
import crypto from 'crypto';

export const executeInstantSell = async (symbol: string): Promise<void> => {
  let bestBidPrice: number | undefined;

  try {
    const depthResponse = await axios.get('https://api.binance.com/api/v3/depth', {
      params: {
        symbol,
        limit: 5,
      },
    });

    const bids = depthResponse.data?.bids ?? [];

    if (!bids.length) {
      console.log('Vendiendo inmediatamente...');
      console.log(`No hay niveles de compra para ${symbol}.`);
      return;
    }

    bestBidPrice = Number(bids[0][0]);
  } catch (error) {
    console.log('Vendiendo inmediatamente...');
    console.log('[executeInstantSell] No se pudo obtener la profundidad de mercado.');
    console.log((error as any).response?.data || (error as Error).message);
    return;
  }

  console.log('Vendiendo inmediatamente...');
  console.log(`El precio mas alto de compra de ${symbol} es ${bestBidPrice}`);

  const secret = process.env.BINANCE_API_SECRET;
  const apiKey = process.env.BINANCE_API_KEY;

  if (!secret || !apiKey) {
    console.log('[executeInstantSell] Faltan credenciales de Binance.');
    return;
  }

  const timestamp = Date.now();
  const balanceQuery = `timestamp=${timestamp}`;
  const balanceSignature = crypto.createHmac('sha256', secret).update(balanceQuery).digest('hex');

  let truncatedBalance = 0;

  try {
    const response = await axios.get(
      `https://api.binance.com/api/v3/account?${balanceQuery}&signature=${balanceSignature}`,
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
      console.log(`[executeInstantSell] No se encontró saldo para ${asset}.`);
      return;
    }

    const free = Number(tokenBalance.free ?? 0);
    const locked = Number(tokenBalance.locked ?? 0);
    const totalBalance = free + locked;
    truncatedBalance = Math.floor(totalBalance);

    console.log(`Saldo disponible de ${asset}: ${truncatedBalance}`);
  } catch (error) {
    console.log('[executeInstantSell] No se pudo obtener el saldo.');
    console.log((error as any).response?.data || (error as Error).message);
    return;
  }

  if (!truncatedBalance) {
    return;
  }

  const orderTimestamp = Date.now();
  const orderParams = new URLSearchParams({
    symbol,
    side: 'SELL',
    type: 'LIMIT',
    timeInForce: 'GTC',
    price: String(bestBidPrice),
    quantity: String(truncatedBalance),
    timestamp: String(orderTimestamp),
  });

  const orderSignature = crypto
    .createHmac('sha256', secret)
    .update(orderParams.toString())
    .digest('hex');

  try {
    console.log('Orden SELL enviada');
    const orderResponse = await axios.post(
      `https://api.binance.com/api/v3/order?${orderParams.toString()}&signature=${orderSignature}`,
      undefined,
      {
        headers: {
          'X-MBX-APIKEY': apiKey,
        },
      },
    );

    console.log('Binance respondió:', orderResponse.data);
  } catch (error) {
    console.log('[executeInstantSell] No se pudo colocar la orden SELL.');
    console.log((error as any).response?.data || (error as Error).message);
  }
};

export default executeInstantSell;
