import axios from 'axios';

export const determineBuyPrice = async (
  usdAmount: number,
  pendingTokens: string[],
): Promise<{
  token: string;
  price: number;
  quantity: number;
}> => {
  const sortedTokens = [...pendingTokens].sort();
  const selectedToken = sortedTokens[0];

  console.log('[determineBuyPrice] Selected token:', selectedToken);

  const response = await axios.get(
    `https://api.binance.com/api/v3/depth?symbol=${selectedToken}&limit=5`,
  );

  const { bids, asks } = response.data;

  const bestBidPrice = Number(bids[0][0]);
  const bestBidQty = Number(bids[0][1]);
  const bestAskPrice = Number(asks[0][0]);
  const bestAskQty = Number(asks[0][1]);

  console.log(
    '[determineBuyPrice] BestBid / BestAsk:',
    { price: bestBidPrice, qty: bestBidQty },
    { price: bestAskPrice, qty: bestAskQty },
  );

  const secondBidPrice = Number(bids[1][0]);
  const chosenPrice = bestBidQty >= 70_000 ? bestBidPrice : secondBidPrice;

  console.log('[determineBuyPrice] Best bid qty:', bestBidQty);

  console.log('[determineBuyPrice] Price chosen:', chosenPrice);

  const quantity = usdAmount / chosenPrice;
  const finalQuantity = Math.floor(quantity);

  console.log('[determineBuyPrice] Quantity:', finalQuantity);

  return {
    token: selectedToken,
    price: chosenPrice,
    quantity: finalQuantity,
  };
};

export default determineBuyPrice;
