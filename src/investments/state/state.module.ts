import { Module } from '@nestjs/common';
import { AllowedTokensState } from './allowed-tokens.state';
import { ActiveTokensState } from './active-tokens.state';  // ← NUEVO

@Module({
  providers: [
    AllowedTokensState,
    ActiveTokensState,
  ],
  exports: [
    AllowedTokensState,
    ActiveTokensState,
  ],
})
export class StateModule {}
