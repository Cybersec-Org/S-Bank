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
  ForbiddenException,
} from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiCreatedResponse, ApiForbiddenResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { AccountsService } from './accounts.service.js';
import { PoliciesGuard, CheckAbilities } from '../auth/policies.guard.js';
import { Action } from '../auth/casl-ability.factory.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { UpdateLimitDto } from './dto/update-limit.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { CreateRecipientDto, UpdateSystemConfigDto } from './dto/extra.dto.js';
import { UserAuthGuard } from '../auth/user-auth.guard.js';
import { Role } from '../auth/interfaces/authenticated-user.interface.js';
import { AccountDto, TransactionDto, TransferDraftDto, TransferConfirmedDto, TransferCancelledDto, RecipientDto, DeletedDto, PaymentRequestDto, CustomerSummaryDto, CustomerDetailsDto, AuditLogDto, SystemConfigDto } from './dto/responses.dto.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';

@ApiTags('Banking API')
@ApiBearerAuth()
@UseGuards(UserAuthGuard, PoliciesGuard)
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Missing, invalid or expired token, or a CLIENT not linked to a customer' })
@ApiForbiddenResponse({ type: ErrorResponseDto, description: 'Role not allowed (FORBIDDEN), staff without Passkey (PASSKEY_REQUIRED) or step-up missing (STEP_UP_REQUIRED)' })
@Controller()
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('accounts')
  @CheckAbilities({ action: Action.Read, subject: 'Account' })
  @ApiOperation({ summary: 'Get list of accounts (includes dailyUsed and auto-provisions OIDC demo account)' })
  @ApiOkResponse({ type: [AccountDto] })
  async findAll(@Req() req: any) {
    return this.accountsService.findAllForUser(req.user);
  }

  @Get('accounts/audit-logs')
  @CheckAbilities({ action: Action.Read, subject: 'AuditLog' })
  @ApiOperation({ summary: 'Get security audit logs (Admin only)' })
  @ApiOkResponse({ type: [AuditLogDto] })
  async getAuditLogs(@Req() req: any) {
    return this.accountsService.getAuditLogs(req.user);
  }

  @Get('admin/config')
  @CheckAbilities({ action: Action.Manage, subject: 'SystemConfig' })
  @ApiOperation({ summary: 'Get global security parameters (Admin only)' })
  @ApiOkResponse({ type: SystemConfigDto })
  async getSystemConfig() {
    return this.accountsService.getSystemConfig();
  }

  @Patch('admin/config')
  @CheckAbilities({ action: Action.Manage, subject: 'SystemConfig' })
  @ApiOperation({ summary: 'Update global step-up threshold and daily limit range (Admin only)' })
  @ApiOkResponse({ type: SystemConfigDto })
  async updateSystemConfig(@Body() dto: UpdateSystemConfigDto, @Req() req: any) {
    return this.accountsService.updateSystemConfig(dto, req.user);
  }

  @Get('accounts/:id')
  @CheckAbilities({ action: Action.Read, subject: 'Account' })
  @ApiOperation({ summary: 'Get account details with BOLA protection' })
  @ApiOkResponse({ type: AccountDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'ACCOUNT_NOT_FOUND (also for accounts of other customers)' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.findOneAuthorized(id, req.user);
  }

  @Get('accounts/:id/transactions')
  @CheckAbilities({ action: Action.Read, subject: 'Account' })
  @ApiOperation({ summary: 'Get account transaction history' })
  @ApiOkResponse({ type: [TransactionDto], description: 'Completed transactions, newest first' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'ACCOUNT_NOT_FOUND' })
  async getTransactions(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.getTransactionsAuthorized(id, req.user);
  }

  @Patch('accounts/:id/limit')
  @CheckAbilities({ action: Action.Update, subject: 'Account' })
  @ApiOperation({ summary: 'Update account daily limit (Employee or Admin only)' })
  @ApiOkResponse({ type: AccountDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'ACCOUNT_NOT_FOUND' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'LIMIT_OUT_OF_RANGE or validation error' })
  async updateLimit(@Param('id') id: string, @Body() dto: UpdateLimitDto, @Req() req: any) {
    return this.accountsService.updateLimitAuthorized(id, dto, req.user);
  }

  @Patch('accounts/:id/status')
  @CheckAbilities({ action: Action.Freeze, subject: 'Account' })
  @ApiOperation({ summary: 'Freeze or unfreeze account (Employee/Admin only)' })
  @ApiOkResponse({ type: AccountDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'ACCOUNT_NOT_FOUND' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Validation error' })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto, @Req() req: any) {
    return this.accountsService.updateStatusAuthorized(id, dto, req.user);
  }

  @Post('transfers')
  @CheckAbilities({ action: Action.Transfer, subject: 'Account' })
  @ApiOperation({ summary: 'Step 1: Create transfer draft and return summary' })
  @ApiCreatedResponse({ type: TransferDraftDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'ACCOUNT_NOT_FOUND or RECIPIENT_NOT_FOUND' })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'SAME_ACCOUNT_TRANSFER, CURRENCY_MISMATCH or validation error' })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto, description: 'INSUFFICIENT_FUNDS or DAILY_LIMIT_EXCEEDED' })
  async createTransferDraft(@Body() dto: CreateTransactionDto, @Req() req: any) {
    return this.accountsService.createTransferDraft(dto, req.user);
  }

  @Get('transfers/:id')
  @CheckAbilities({ action: Action.Read, subject: 'Account' })
  @ApiOperation({ summary: 'Get transfer draft details with BOLA protection' })
  @ApiOkResponse({ type: TransferDraftDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'TRANSFER_NOT_FOUND' })
  async getTransferDraft(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.getTransferDraft(id, req.user);
  }

  @Post('transfers/:id/confirm')
  @HttpCode(200)
  @CheckAbilities({ action: Action.Transfer, subject: 'Account' })
  @ApiOperation({ summary: 'Step 2: Confirm, execute and sign transfer' })
  @ApiOkResponse({ type: TransferConfirmedDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'TRANSFER_NOT_FOUND' })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto, description: 'INSUFFICIENT_FUNDS or DAILY_LIMIT_EXCEEDED' })
  async confirmTransfer(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.confirmTransfer(id, req.user);
  }

  @Post('transfers/:id/cancel')
  @HttpCode(200)
  @CheckAbilities({ action: Action.Transfer, subject: 'Account' })
  @ApiOperation({ summary: 'Step 2 (Alternative): Cancel transfer draft' })
  @ApiOkResponse({ type: TransferCancelledDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'TRANSFER_NOT_FOUND' })
  async cancelTransfer(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.cancelTransfer(id, req.user);
  }

  @Get('recipients')
  @CheckAbilities({ action: Action.Read, subject: 'Recipient' })
  @ApiOperation({ summary: 'Get logged-in client saved recipients' })
  @ApiOkResponse({ type: [RecipientDto] })
  async getRecipients(@Req() req: any) {
    return this.accountsService.getRecipients(req.user);
  }

  @Post('recipients')
  @CheckAbilities({ action: Action.Create, subject: 'Recipient' })
  @ApiOperation({ summary: 'Add a new saved recipient' })
  @ApiCreatedResponse({ type: RecipientDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Validation error' })
  async createRecipient(@Body() dto: CreateRecipientDto, @Req() req: any) {
    return this.accountsService.createRecipient(dto, req.user);
  }

  @Delete('recipients/:id')
  @CheckAbilities({ action: Action.Delete, subject: 'Recipient' })
  @ApiOperation({ summary: 'Delete saved recipient (BOLA 404 protected)' })
  @ApiOkResponse({ type: DeletedDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'RECIPIENT_NOT_FOUND' })
  async deleteRecipient(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.deleteRecipient(id, req.user);
  }

  @Get('payment-requests/:id')
  @CheckAbilities({ action: Action.Read, subject: 'PaymentRequest' })
  @ApiOperation({ summary: 'Get payment request details for QR code or deep link sbank://pay/{id}' })
  @ApiOkResponse({ type: PaymentRequestDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'PAYMENT_REQUEST_NOT_FOUND' })
  async getPaymentRequest(@Param('id') id: string) {
    return this.accountsService.getPaymentRequestForClient(id);
  }

  @Post('payment-requests/:id/pay')
  @HttpCode(200)
  @CheckAbilities({ action: Action.Transfer, subject: 'Account' })
  @ApiOperation({ summary: 'Confirm and pay a QR / deep link payment request' })
  @ApiOkResponse({ type: TransferConfirmedDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'PAYMENT_REQUEST_NOT_FOUND' })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto, description: 'INSUFFICIENT_FUNDS or DAILY_LIMIT_EXCEEDED' })
  async payPaymentRequest(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.payPaymentRequest(id, req.user);
  }

  @Get('customers/me')
  @CheckAbilities({ action: Action.Read, subject: 'Customer' })
  @ApiOperation({ summary: 'Get logged-in customer profile (for client dashboard)' })
  @ApiOkResponse({ type: CustomerDetailsDto })
  async getMyProfile(@Req() req: any) {
    if (req.user.role !== Role.CLIENT) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'This endpoint is available to clients only',
      });
    }
    return this.accountsService.getCustomerDetails(req.user.id, req.user);
  }

  @Get('customers')
  @CheckAbilities({ action: Action.Read, subject: 'Customer' })
  @ApiOperation({ summary: 'Search customers for employees (GET /customers?query=)' })
  @ApiQuery({ name: 'query', required: false, description: 'Search by first name, last name, email or customer number' })
  @ApiOkResponse({ type: [CustomerSummaryDto] })
  async searchCustomers(@Query('query') query: string, @Req() req: any) {
    return this.accountsService.searchCustomers(query, req.user);
  }

  @Get('customers/:id')
  @CheckAbilities({ action: Action.Read, subject: 'Customer' })
  @ApiOperation({ summary: 'Get customer details along with accounts and history' })
  @ApiOkResponse({ type: CustomerDetailsDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'CUSTOMER_NOT_FOUND' })
  async getCustomer(@Param('id') id: string, @Req() req: any) {
    return this.accountsService.getCustomerDetails(id, req.user);
  }
}
