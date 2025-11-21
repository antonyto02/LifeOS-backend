import { DepthState } from '../../state/depth.state';

export function computeCollision(symbol: string): void {
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

  const [bidPrice, bidDepth] = buyEntries.reduce((max, current) => {
    const currentPrice = parseFloat(current[0]);
    const maxPrice = parseFloat(max[0]);

    return currentPrice > maxPrice ? current : max;
  });

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

  console.log(`El precio de compra mas alto es ${bidPrice}`);
  console.log(`El precio de venta mas bajo es ${askPrice}`);
  console.log(`El porcentaje de compradores es ${topBid}`);
  console.log(`El porcentaje de vendedores es ${topAsk}`);
}
