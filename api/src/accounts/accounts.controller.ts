import { Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { AccountsService } from './accounts.service.js';
import { MockAuthGuard } from '../auth/mock-auth.guard.js';
import { PoliciesGuard } from '../auth/policies.guard.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { UpdateLimitDto } from './dto/update-limit.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';

@ApiTags('Banking API')
@ApiHeader({ name: 'x-user-id', description: 'User ID (e.g. client-1, emp-1, admin-1)', required: false })
@ApiHeader({ name: 'x-user-role', description: 'User role (CLIENT, EMPLOYEE, ADMIN)', required: false })
@UseGuards(MockAuthGuard, PoliciesGuard)
@Controller()
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('accounts')
  @ApiOperation({ summary: 'Get list of accounts (includes dailyUsed and owner details)' })
  async findAll(@Req() req: any) {
    return this.accountsService.findAllForUser(req.user);
  }

  @Get('accounts/audit-logs')
  @ApiOperation({ summary: 'Get security audit logs (Admin only)' })
  async getAuditLogs(@Req() req: any) {
    return this.accountsService.getAuditLogs(req.user);
  }

  @Get('accounts/:id')
  @ApiOperation({ summary: 'Get account details with BOLA protection' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.findOneAuthorized(id, req.user);
  }

  @Get('accounts/:id/transactions')
  @ApiOperation({ summary: 'Get account transaction history' })
  async getTransactions(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.getTransactionsAuthorized(id, req.user);
  }

  @Patch('accounts/:id/limit')
  @ApiOperation({ summary: 'Update account daily limit (Client or Employee)' })
  async updateLimit(@Param('id') id: string, @Body() dto: UpdateLimitDto, @Req() req: any) {
    return this.accountsService.updateLimitAuthorized(id, dto, req.user);
  }

  @Patch('accounts/:id/status')
  @ApiOperation({ summary: 'Freeze or unfreeze account (Employee/Admin only)' })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto, @Req() req: any) {
    return this.accountsService.updateStatusAuthorized(id, dto, req.user);
  }

  @Post('transfers')
  @ApiOperation({ summary: 'Step 1: Create transfer draft and return summary' })
  async createTransferDraft(@Body() dto: CreateTransactionDto, @Req() req: any) {
    return this.accountsService.createTransferDraft(dto, req.user);
  }

  @Post('transfers/:id/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Step 2: Confirm and execute transfer' })
  async confirmTransfer(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.confirmTransfer(id, req.user);
  }

  @Post('transfers/:id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Step 2 (Alternative): Cancel transfer draft' })
  async cancelTransfer(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.cancelTransfer(id, req.user);
  }

  @Get('customers/me')
  @ApiOperation({ summary: 'Get logged-in customer profile (for client dashboard)' })
  async getMyProfile(@Req() req: any) {
    return this.accountsService.getCustomerDetails(req.user.id, req.user);
  }

  @Get('customers')
  @ApiOperation({ summary: 'Search customers for employees (GET /customers?query=)' })
  @ApiQuery({ name: 'query', required: false, description: 'Search by first name, last name, email or customer number' })
  async searchCustomers(@Query('query') query: string, @Req() req: any) {
    return this.accountsService.searchCustomers(query, req.user);
  }

  @Get('customers/:id')
  @ApiOperation({ summary: 'Get customer details along with accounts and history' })
  async getCustomer(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.getCustomerDetails(id, req.user);
  }
}