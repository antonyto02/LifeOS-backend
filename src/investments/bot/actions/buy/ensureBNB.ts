import axios from 'axios';
import crypto from 'crypto';

export const ensureBNB = async (tokens: string[]): Promise<number> => {
  const secret = process.env.BINANCE_API_SECRET;
  const apiKey = process.env.BINANCE_API_KEY;

  if (!secret || !apiKey) {
    console.log('[ensureBNB] Faltan credenciales de Binance.');
    return 0;
  }

  const timestamp = Date.now();
  const balanceQuery = `timestamp=${timestamp}`;
  const balanceSignature = crypto
    .createHmac('sha256', secret)
    .update(balanceQuery)
    .digest('hex');

  let usdtBalance = 0;

  try {
    const response = await axios.get(
      `https://api.binance.com/api/v3/account?${balanceQuery}&signature=${balanceSignature}`,
      {
        headers: {
          'X-MBX-APIKEY': apiKey,
        },
      },
    );

    const balances = response.data?.balances ?? [];
    const usdtEntry = balances.find((balance: any) => balance.asset === 'USDT');

    if (!usdtEntry) {
      console.log('[ensureBNB] No se encontró saldo para USDT.');
      return 0;
    }

    const free = Number(usdtEntry.free ?? 0);
    const locked = Number(usdtEntry.locked ?? 0);

    usdtBalance = free + locked;

    console.log(`[ensureBNB] Saldo recibido de USDT: ${usdtBalance}`);
  } catch (error) {
    console.log('[ensureBNB] No se pudo obtener el saldo.');
    console.log((error as any).response?.data || (error as Error).message);
    return 0;
  }

  const items = tokens.length;
  console.log(`[ensureBNB] Elementos en la lista (${items}):`, tokens);

  if (!items) {
    return 0;
  }

  return usdtBalance / items;
};

export default ensureBNB;
