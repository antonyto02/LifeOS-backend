import { Module } from '@nestjs/common';
import { AllowedTokensState } from './allowed-tokens.state';
import { ActiveTokensState } from './active-tokens.state';
import { BotState } from './bot-state.state';
import { ActiveOrdersState } from './active-orders.state';
import { DepthState } from './depth.state';
import { CentralState } from './central-state.state';

@Module({
  providers: [
    AllowedTokensState,
    ActiveTokensState,
    BotState,
    ActiveOrdersState,
    DepthState,
    CentralState,
  ],
  exports: [
    AllowedTokensState,
    ActiveTokensState,
    BotState,
    ActiveOrdersState,
    DepthState,
    CentralState,
  ],
})
export class StateModule {}
