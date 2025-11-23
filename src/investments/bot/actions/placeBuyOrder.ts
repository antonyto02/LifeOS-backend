import calculateOrderBudget from './buy/calculateOrderBudget';
import determineBuyPrice from './buy/determineBuyPrice';
import ensureBNB from './buy/ensureBNB';
import getPendingTokens from './buy/getPendingTokens';
import placeBuyLimit from './buy/placeBuyLimit';

export const placeBuyOrder = async (): Promise<void> => {
  const { pendingTokens } = getPendingTokens();

  if (pendingTokens.length === 0) {
    console.log('[placeBuyOrder] No hay tokens pendientes. Finalizando ejecución.');
    return;
  }

  const balancePerToken = await calculateOrderBudget(pendingTokens);
  console.log('[placeBuyOrder] Balance por token:', balancePerToken);

  const adjustedBudget = await ensureBNB(balancePerToken);
  console.log('[placeBuyOrder] Presupuesto ajustado:', adjustedBudget);

  const { token, price, quantity } = await determineBuyPrice(
    adjustedBudget,
    pendingTokens,
  );

  console.log('[placeBuyOrder] Tokens pendientes por activar:', pendingTokens);
  console.log('Colocando orden de compra...');
  console.log('[placeBuyOrder] Orden:', { token, price, quantity });

  await placeBuyLimit(token, price, quantity);

  const { pendingTokens: remainingTokens } = getPendingTokens();

  if (remainingTokens.length === 0) {
    return;
  }

  await placeBuyOrder();
};

export default placeBuyOrder;
