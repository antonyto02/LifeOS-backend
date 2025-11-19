import { Controller, Get } from '@nestjs/common';
import { AllowedTokensState } from './state/allowed-tokens.state';
import { ActiveTokensState } from './state/active-tokens.state';

@Controller('investments')
export class InvestmentsController {
  constructor(
    private readonly allowedTokens: AllowedTokensState,
    private readonly activeTokens: ActiveTokensState,
  ) {}

  @Get('allowedtokens')
  getAllowedTokens() {
    return this.allowedTokens.getAll();
  }

  @Get('activetokens')
  getActiveTokens() {
    return this.activeTokens.getAll();
  }
}
