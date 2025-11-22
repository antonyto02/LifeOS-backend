import { DepthState } from '../../state/depth.state';

export const placeSellOrder = (symbol: string): void => {
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
};

export default placeSellOrder;
