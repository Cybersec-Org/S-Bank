import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountsService } from './accounts.service.js';
import { MockAuthGuard } from '../auth/mock-auth.guard.js';
import { type AuthenticatedUser, Role } from '../auth/interfaces/authenticated-user.interface.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CheckAbilities, PoliciesGuard } from '../auth/policies.guard.js';
import { Action } from '../auth/casl-ability.factory.js';

@ApiTags('Accounts')
@ApiHeader({
  name: 'x-user-id',
  description: 'Authenticated User ID (default: client-1, e.g. client-2, emp-1, admin-1)',
  required: false,
})
@ApiHeader({
  name: 'x-user-role',
  description: 'Authenticated User Role (CLIENT, EMPLOYEE, ADMIN)',
  enum: Role,
  required: false,
})
@UseGuards(MockAuthGuard, PoliciesGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({
    summary: 'List bank accounts (CLIENT: own accounts only, EMPLOYEE/ADMIN: all accounts)',
  })
  async getAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.accountsService.findAllForUser(user);
  }

  @Get('admin/audit-logs')
  @CheckAbilities({ action: Action.Read, subject: 'AuditLog' })
  @ApiOperation({
    summary: 'Get security & banking audit logs (Restricted to ADMIN role)',
  })
  async getAuditLogs() {
    return this.accountsService.getAuditLogs();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get specific bank account details (Protected against BOLA/IDOR via CASL)',
  })
  async getAccountById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountsService.findOneAuthorized(id, user);
  }

  @Get(':id/transactions')
  @ApiOperation({
    summary: 'Get transaction history for an account (Protected against BOLA/IDOR via CASL)',
  })
  async getAccountTransactions(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountsService.getAccountTransactionsAuthorized(id, user);
  }
}