import getPendingTokens from './buy/getPendingTokens';

export const placeBuyOrder = (): void => {
  const pendingTokens = getPendingTokens();

  console.log('[placeBuyOrder] Tokens pendientes por activar:', pendingTokens);
  console.log('Colocando orden de compra...');
};

export default placeBuyOrder;
