import calculateOrderBudget from './buy/calculateOrderBudget';
import determineBuyPrice from './buy/determineBuyPrice';
import ensureBNB from './buy/ensureBNB';
import getPendingTokens from './buy/getPendingTokens';
import placeBuyLimit from './buy/placeBuyLimit';
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));


export const placeBuyOrder = async (): Promise<void> => {
  await delay(800);
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

  const attemptPlaceOrder = async (attempt: number): Promise<void> => {
    try {
      await placeBuyLimit(token, price, quantity);
    } catch (error) {
      console.log(
        `[placeBuyOrder] Intento ${attempt} fallido al crear la orden BUY para ${token}.`,
      );
      console.log((error as any).response?.data || (error as Error).message);

      if (attempt < 2) {
        console.log('[placeBuyOrder] Reintentando en 1 segundo…');
        await delay(1000);
        await attemptPlaceOrder(attempt + 1);
        return;
      }

      console.log('[placeBuyOrder] No se pudo crear la orden BUY tras reintento.');
    }
  };

  await attemptPlaceOrder(1);

  const { pendingTokens: remainingTokens } = getPendingTokens();

  if (remainingTokens.length === 0) {
    return;
  }

  await placeBuyOrder();
};

export default placeBuyOrder;
