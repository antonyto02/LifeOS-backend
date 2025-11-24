import axios from 'axios';
import crypto from 'crypto';

const BINANCE_API_URL = 'https://api.binance.com/api/v3';

export const ensureBNB = async (usdAmount: number): Promise<number> => {
  const secret = process.env.BINANCE_API_SECRET;
  const apiKey = process.env.BINANCE_API_KEY;

  if (!secret || !apiKey) {
    console.log('[ensureBNB] Faltan credenciales de Binance.');
    return usdAmount;
  }

  console.log('[ensureBNB] Checking BNB balance…');

  const timestamp = Date.now();
  const accountQuery = `timestamp=${timestamp}`;
  const accountSignature = crypto
    .createHmac('sha256', secret)
    .update(accountQuery)
    .digest('hex');

  let currentBNBInUsd = 0;

  try {
    const accountResponse = await axios.get(
      `${BINANCE_API_URL}/account?${accountQuery}&signature=${accountSignature}`,
      {
        headers: {
          'X-MBX-APIKEY': apiKey,
        },
      },
    );

    const balances = accountResponse.data?.balances ?? [];
    const bnbEntry = balances.find((balance: any) => balance.asset === 'BNB');

    const freeBNB = Number(bnbEntry?.free ?? 0);
    const lockedBNB = Number(bnbEntry?.locked ?? 0);
    const totalBNB = freeBNB + lockedBNB;

    const priceResponse = await axios.get(`${BINANCE_API_URL}/ticker/price`, {
      params: {
        symbol: 'BNBUSDT',
      },
    });

    const bnbPrice = Number(priceResponse.data?.price ?? 0);
    currentBNBInUsd = totalBNB * bnbPrice;
  } catch (error) {
    console.log('[ensureBNB] No se pudo obtener el balance de BNB.');
    console.log((error as any).response?.data || (error as Error).message);
    return usdAmount;
  }

  console.log(`[ensureBNB] Current BNB in USD: ${currentBNBInUsd}`);

  const requiredBNB = usdAmount * 0.002;
  console.log(`[ensureBNB] Required BNB in USD: ${requiredBNB}`);

  if (currentBNBInUsd >= requiredBNB) {
    return usdAmount;
  }

  const missingUsd = requiredBNB - currentBNBInUsd;
  const amountToSpendInUsd = missingUsd <= 5 ? 5 : missingUsd;

  console.log(`[ensureBNB] Missing: ${missingUsd} – buying BNB…`);

  const orderTimestamp = Date.now();
  const orderParams = new URLSearchParams({
    side: 'BUY',
    symbol: 'BNBUSDT',
    type: 'MARKET',
    quoteOrderQty: String(amountToSpendInUsd),
    timestamp: String(orderTimestamp),
  });

  const orderSignature = crypto
    .createHmac('sha256', secret)
    .update(orderParams.toString())
    .digest('hex');

  let amountSpentOnBNB = amountToSpendInUsd;

  try {
    const orderResponse = await axios.post(
      `${BINANCE_API_URL}/order?${orderParams.toString()}&signature=${orderSignature}`,
      undefined,
      {
        headers: {
          'X-MBX-APIKEY': apiKey,
        },
      },
    );

    amountSpentOnBNB = Number(orderResponse.data?.cummulativeQuoteQty ?? amountToSpendInUsd);
  } catch (error) {
    console.log('[ensureBNB] No se pudo comprar BNB.');
    console.log((error as any).response?.data || (error as Error).message);
    return usdAmount;
  }

  console.log(`[ensureBNB] Bought BNB using ${amountSpentOnBNB} USDT`);

  const adjustedUsdAmount = usdAmount - amountSpentOnBNB;
  console.log(`[ensureBNB] Adjusted order budget: ${adjustedUsdAmount} USDT`);

  return adjustedUsdAmount;
};

export default ensureBNB;
