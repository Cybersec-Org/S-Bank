import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { AccountsService } from './accounts.service.js';
import { MockAuthGuard } from '../auth/mock-auth.guard.js';
import { PoliciesGuard, CheckAbilities } from '../auth/policies.guard.js';
import { Action } from '../auth/casl-ability.factory.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { UpdateLimitDto } from './dto/update-limit.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { CreateRecipientDto, UpdateSystemConfigDto } from './dto/extra.dto.js';
import { UserAuthGuard } from '../auth/user-auth.guard.js';

@ApiTags('Banking API')
@ApiHeader({ name: 'x-user-id', description: 'User ID (e.g. client-1, emp-1, admin-1)', required: false })
@ApiHeader({ name: 'x-user-role', description: 'User role (CLIENT, EMPLOYEE, ADMIN)', required: false })
@UseGuards(UserAuthGuard, PoliciesGuard)
@Controller()
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('accounts')
  @CheckAbilities({ action: Action.Read, subject: 'Account' })
  @ApiOperation({ summary: 'Get list of accounts (includes dailyUsed and auto-provisions OIDC demo account)' })
  async findAll(@Req() req: any) {
    return this.accountsService.findAllForUser(req.user);
  }

  @Get('accounts/audit-logs')
  @CheckAbilities({ action: Action.Read, subject: 'AuditLog' })
  @ApiOperation({ summary: 'Get security audit logs (Admin only)' })
  async getAuditLogs(@Req() req: any) {
    return this.accountsService.getAuditLogs(req.user);
  }

  @Get('admin/config')
  @CheckAbilities({ action: Action.Manage, subject: 'SystemConfig' })
  @ApiOperation({ summary: 'Get global security parameters (Admin only)' })
  async getSystemConfig() {
    return this.accountsService.getSystemConfig();
  }

  @Patch('admin/config')
  @CheckAbilities({ action: Action.Manage, subject: 'SystemConfig' })
  @ApiOperation({ summary: 'Update global step-up threshold and daily limit range (Admin only)' })
  async updateSystemConfig(@Body() dto: UpdateSystemConfigDto, @Req() req: any) {
    return this.accountsService.updateSystemConfig(dto, req.user);
  }

  @Get('accounts/:id')
  @CheckAbilities({ action: Action.Read, subject: 'Account' })
  @ApiOperation({ summary: 'Get account details with BOLA protection' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.findOneAuthorized(id, req.user);
  }

  @Get('accounts/:id/transactions')
  @CheckAbilities({ action: Action.Read, subject: 'Account' })
  @ApiOperation({ summary: 'Get account transaction history' })
  async getTransactions(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.getTransactionsAuthorized(id, req.user);
  }

  @Patch('accounts/:id/limit')
  @CheckAbilities({ action: Action.Update, subject: 'Account' })
  @ApiOperation({ summary: 'Update account daily limit (Employee or Admin only)' })
  async updateLimit(@Param('id') id: string, @Body() dto: UpdateLimitDto, @Req() req: any) {
    return this.accountsService.updateLimitAuthorized(id, dto, req.user);
  }

  @Patch('accounts/:id/status')
  @CheckAbilities({ action: Action.Freeze, subject: 'Account' })
  @ApiOperation({ summary: 'Freeze or unfreeze account (Employee/Admin only)' })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto, @Req() req: any) {
    return this.accountsService.updateStatusAuthorized(id, dto, req.user);
  }

  @Post('transfers')
  @CheckAbilities({ action: Action.Transfer, subject: 'Account' })
  @ApiOperation({ summary: 'Step 1: Create transfer draft and return summary' })
  async createTransferDraft(@Body() dto: CreateTransactionDto, @Req() req: any) {
    return this.accountsService.createTransferDraft(dto, req.user);
  }

  @Post('transfers/:id/confirm')
  @HttpCode(200)
  @CheckAbilities({ action: Action.Transfer, subject: 'Account' })
  @ApiOperation({ summary: 'Step 2: Confirm, execute and sign transfer' })
  async confirmTransfer(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.confirmTransfer(id, req.user);
  }

  @Post('transfers/:id/cancel')
  @HttpCode(200)
  @CheckAbilities({ action: Action.Transfer, subject: 'Account' })
  @ApiOperation({ summary: 'Step 2 (Alternative): Cancel transfer draft' })
  async cancelTransfer(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.cancelTransfer(id, req.user);
  }

  @Get('recipients')
  @CheckAbilities({ action: Action.Read, subject: 'Recipient' })
  @ApiOperation({ summary: 'Get logged-in client saved recipients' })
  async getRecipients(@Req() req: any) {
    return this.accountsService.getRecipients(req.user);
  }

  @Post('recipients')
  @CheckAbilities({ action: Action.Create, subject: 'Recipient' })
  @ApiOperation({ summary: 'Add a new saved recipient' })
  async createRecipient(@Body() dto: CreateRecipientDto, @Req() req: any) {
    return this.accountsService.createRecipient(dto, req.user);
  }

  @Delete('recipients/:id')
  @CheckAbilities({ action: Action.Delete, subject: 'Recipient' })
  @ApiOperation({ summary: 'Delete saved recipient (BOLA 404 protected)' })
  async deleteRecipient(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.deleteRecipient(id, req.user);
  }

  @Get('payment-requests/:id')
  @CheckAbilities({ action: Action.Read, subject: 'PaymentRequest' })
  @ApiOperation({ summary: 'Get payment request details for QR code or deep link sbank://pay/{id}' })
  async getPaymentRequest(@Param('id') id: string) {
    return this.accountsService.getPaymentRequestForClient(id);
  }

  @Post('payment-requests/:id/pay')
  @HttpCode(200)
  @CheckAbilities({ action: Action.Transfer, subject: 'Account' })
  @ApiOperation({ summary: 'Confirm and pay a QR / deep link payment request' })
  async payPaymentRequest(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.payPaymentRequest(id, req.user);
  }

  @Get('customers/me')
  @CheckAbilities({ action: Action.Read, subject: 'Customer' })
  @ApiOperation({ summary: 'Get logged-in customer profile (for client dashboard)' })
  async getMyProfile(@Req() req: any) {
    return this.accountsService.getCustomerDetails(req.user.id, req.user);
  }

  @Get('customers')
  @CheckAbilities({ action: Action.Read, subject: 'Customer' })
  @ApiOperation({ summary: 'Search customers for employees (GET /customers?query=)' })
  @ApiQuery({ name: 'query', required: false, description: 'Search by first name, last name, email or customer number' })
  async searchCustomers(@Query('query') query: string, @Req() req: any) {
    return this.accountsService.searchCustomers(query, req.user);
  }

  @Get('customers/:id')
  @CheckAbilities({ action: Action.Read, subject: 'Customer' })
  @ApiOperation({ summary: 'Get customer details along with accounts and history' })
  async getCustomer(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.getCustomerDetails(id, req.user);
  }
}
