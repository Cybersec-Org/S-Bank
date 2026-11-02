import { Controller, Get, Headers, Param } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountsService } from './accounts.service.js';

@ApiTags('Accounts')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all bank accounts for the authenticated user' })
  @ApiHeader({
    name: 'x-user-id',
    description: 'Temporary mock user ID (default: client-1)',
    required: false,
  })
  async getMyAccounts(@Headers('x-user-id') userId?: string) {
    const activeUserId = userId || 'client-1';
    return this.accountsService.findAllByOwner(activeUserId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get specific bank account details by ID' })
  async getAccountById(@Param('id') id: string) {
    return this.accountsService.findOne(id);
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'Get transaction history for a specific bank account' })
  async getAccountTransactions(@Param('id') id: string) {
    return this.accountsService.getAccountTransactions(id);
  }
}