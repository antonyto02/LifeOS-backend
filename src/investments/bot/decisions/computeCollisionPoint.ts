import { DepthState } from '../../state/depth.state';

export type CollisionSnapshot = {
  bidPrice: number;
  secondBidPrice?: number;
  askPrice: number;
  topBid: number;
  topAsk: number;
};

export function computeCollision(symbol: string): CollisionSnapshot | undefined {
  const depthState = DepthState.getInstance();

  if (!depthState) {
    console.log('[computeCollision] DepthState no inicializado');
    return;
  }

  const depthLevels = depthState.getAll()[symbol];

  if (!depthLevels) {
    console.log(`[computeCollision] No depth data available for ${symbol}`);
    return;
  }

  const buyEntries = Object.entries(depthLevels.BUY);
  const sellEntries = Object.entries(depthLevels.SELL);

  if (buyEntries.length === 0 || sellEntries.length === 0) {
    console.log(`[computeCollision] Missing BUY/SELL levels for ${symbol}`);
    return;
  }

  const sortedBuyEntries = buyEntries
    .map(([price, depth]) => [parseFloat(price), depth] as [number, number])
    .sort((a, b) => b[0] - a[0]);

  const topBidEntry = sortedBuyEntries[0];
  const secondBidEntry = sortedBuyEntries[1];

  if (!topBidEntry) {
    console.log(`[computeCollision] Missing BUY levels for ${symbol}`);
    return;
  }

  const [bidPrice, bidDepth] = topBidEntry;
  const secondBidPrice = secondBidEntry ? secondBidEntry[0] : undefined;

  const [askPrice, askDepth] = sellEntries.reduce((min, current) => {
    const currentPrice = parseFloat(current[0]);
    const minPrice = parseFloat(min[0]);

    return currentPrice < minPrice ? current : min;
  });

  const depthSum = bidDepth + askDepth;

  if (depthSum === 0) {
    console.log(`[computeCollision] Combined depth is zero for ${symbol}`);
    return;
  }

  const topBid = bidDepth / depthSum;
  const topAsk = askDepth / depthSum;

  return {
    bidPrice,
    secondBidPrice,
    askPrice: parseFloat(askPrice),
    topBid,
    topAsk,
  };
}
