import { Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AccountsService } from './accounts.service.js';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  /** Lists managed accounts; currently codex_oauth is the supported provider. */
  @Get()
  list(@Query('provider') provider?: string) {
    if (provider && provider !== 'codex_oauth') return [];
    return this.accounts.list();
  }

  /** Starts ChatGPT device-code login. */
  @Post('codex-oauth/device')
  startDeviceLogin() {
    return this.accounts.startDeviceLogin();
  }

  /** Polls one device-code login attempt. */
  @Post('codex-oauth/device/:id/poll')
  poll(@Param('id') id: string) {
    return this.accounts.pollDeviceLogin(id);
  }

  /** Starts reauthentication for an existing stable local account id. */
  @Post(':id/reauth')
  reauth(@Param('id') id: string) {
    return this.accounts.reauth(id);
  }

  /** Makes one account the default managed account. */
  @Patch(':id/default')
  setDefault(@Param('id') id: string) {
    return this.accounts.setDefault(id);
  }

  /** Removes an unbound managed account and its stored OAuth credential. */
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.accounts.delete(id);
  }
}
