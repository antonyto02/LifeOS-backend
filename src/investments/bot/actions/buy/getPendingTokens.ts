import { AllowedTokensState } from '../../../state/allowed-tokens.state';
import { ActiveTokensState } from '../../../state/active-tokens.state';

export const getPendingTokens = (): { pendingTokens: string[] } => {
  const allowedTokensState = AllowedTokensState.getInstance();
  const activeTokensState = ActiveTokensState.getInstance();

  if (!allowedTokensState || !activeTokensState) {
    console.log('[getPendingTokens] Estados no inicializados.');
    return { pendingTokens: [] };
  }

  const allowedTokens = allowedTokensState.getAll();
  const activeTokens = new Set(activeTokensState.getAll());

  const pendingTokens = allowedTokens.filter(
    (token) => !activeTokens.has(token),
  );

  return { pendingTokens };
};

export default getPendingTokens;
