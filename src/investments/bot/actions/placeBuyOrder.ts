import calculateOrderBudget from './buy/calculateOrderBudget';
import ensureBNB from './buy/ensureBNB';
import getPendingTokens from './buy/getPendingTokens';

export const placeBuyOrder = async (): Promise<void> => {
  const { pendingTokens } = getPendingTokens();

  const balancePerToken = await calculateOrderBudget(pendingTokens);
  console.log('[placeBuyOrder] Balance por token:', balancePerToken);

  const adjustedBudget = await ensureBNB(balancePerToken);
  console.log('[placeBuyOrder] Presupuesto ajustado:', adjustedBudget);

  console.log('[placeBuyOrder] Tokens pendientes por activar:', pendingTokens);
  console.log('Colocando orden de compra...');
};

export default placeBuyOrder;
