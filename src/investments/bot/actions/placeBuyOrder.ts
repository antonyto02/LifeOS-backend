import calculateOrderBudget from './buy/calculateOrderBudget';
import determineBuyPrice from './buy/determineBuyPrice';
import ensureBNB from './buy/ensureBNB';
import getPendingTokens from './buy/getPendingTokens';
import placeBuyLimit from './buy/placeBuyLimit';
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));


export const placeBuyOrder = async (symbol?: string): Promise<void> => {
  console.log('[placeBuyOrder] Función desactivada temporalmente.');
  return;
};

export default placeBuyOrder;
