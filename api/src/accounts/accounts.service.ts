import { randomInt } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CaslAbilityFactory, Action } from '../auth/casl-ability.factory.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { Role } from '../auth/interfaces/authenticated-user.interface.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { UpdateLimitDto } from './dto/update-limit.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import {
  CreateRecipientDto,
  CreatePaymentRequestDto,
  UpdateSystemConfigDto,
} from './dto/extra.dto.js';
import { SignatureService } from '../auth/signature.service.js';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
    private readonly signatureService: SignatureService,
  ) {}

  // Automatyczne zakładanie profilu i rachunku demonstracyjnego po pierwszym logowaniu OIDC
  async ensureCustomerExists(user: AuthenticatedUser) {
    if (user.role !== Role.CLIENT) return;

    const existing = await this.prisma.customer.findUnique({ where: { id: user.id } });
    if (existing) return;

    const randomDigits = `${randomInt(10000000, 99999999)}${randomInt(10000000, 99999999)}${randomInt(10000000, 99999999)}`;
    const demoIban = `PL${randomInt(10, 99)}${randomDigits}`;

    await this.prisma.customer.create({
      data: {
        id: user.id,
        firstName: user.firstName ?? 'Nowy',
        lastName: user.lastName ?? 'Klient',
        email: user.email ?? `${user.id}@sbank.local`,
        customerNumber: `CUST-${randomInt(10000, 99999)}`,
        accounts: {
          create: {
            iban: demoIban,
            currency: 'PLN',
            balance: 1000.0,
            dailyLimit: 5000.0,
            status: 'ACTIVE',
          },
        },
      },
    });
  }

  async getSystemConfig() {
    const cfg = await this.prisma.systemConfig.upsert({
      where: { id: 'global' },
      update: {},
      create: {
        id: 'global',
        stepUpThreshold: 1000.0,
        minDailyLimit: 100.0,
        maxDailyLimit: 50000.0,
      },
    });

    return {
      id: cfg.id,
      stepUpThreshold: Number(cfg.stepUpThreshold),
      minDailyLimit: Number(cfg.minDailyLimit),
      maxDailyLimit: Number(cfg.maxDailyLimit),
      updatedAt: cfg.updatedAt,
    };
  }

  async updateSystemConfig(dto: UpdateSystemConfigDto, user: AuthenticatedUser) {
    if (user.role !== Role.ADMIN) {
      await this.logSecurityIncident(user, 'UNAUTHORIZED_CONFIG_CHANGE', 'SystemConfig', 'Non-admin tried to change global config');
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only admins can update global parameters' });
    }

    const current = await this.getSystemConfig();
    const updated = await this.prisma.systemConfig.update({
      where: { id: 'global' },
      data: {
        stepUpThreshold: dto.stepUpThreshold ?? current.stepUpThreshold,
        minDailyLimit: dto.minDailyLimit ?? current.minDailyLimit,
        maxDailyLimit: dto.maxDailyLimit ?? current.maxDailyLimit,
      },
    });

    await this.logSecurityIncident(
      user,
      'ADMIN_CONFIG_UPDATED',
      'SystemConfig',
      `Updated stepUpThreshold=${Number(updated.stepUpThreshold)}, limits=${Number(updated.minDailyLimit)}-${Number(updated.maxDailyLimit)}`,
    );

    return {
      id: updated.id,
      stepUpThreshold: Number(updated.stepUpThreshold),
      minDailyLimit: Number(updated.minDailyLimit),
      maxDailyLimit: Number(updated.maxDailyLimit),
      updatedAt: updated.updatedAt,
    };
  }

  private async calculateDailyUsed(accountId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const agg = await this.prisma.transaction.aggregate({
      where: {
        senderAccountId: accountId,
        status: 'COMPLETED',
        executedAt: { gte: today },
      },
      _sum: { amount: true },
    });

    return Number(agg._sum.amount ?? 0);
  }

  private async serializeAccount(acc: any) {
    const dailyUsed = await this.calculateDailyUsed(acc.id);
    return {
      ...acc,
      balance: Number(acc.balance),
      dailyLimit: Number(acc.dailyLimit),
      dailyUsed,
      ownerFirstName: acc.owner?.firstName,
      ownerLastName: acc.owner?.lastName,
    };
  }

  async findAllForUser(user: AuthenticatedUser) {
    await this.ensureCustomerExists(user);

    if (user.role === Role.ADMIN || user.role === Role.EMPLOYEE) {
      const allAccounts = await this.prisma.account.findMany({
        include: { owner: true },
      });
      return Promise.all(allAccounts.map((acc) => this.serializeAccount(acc)));
    }

    const ownAccounts = await this.prisma.account.findMany({
      where: { ownerId: user.id },
      include: { owner: true },
    });
    return Promise.all(ownAccounts.map((acc) => this.serializeAccount(acc)));
  }

  async findOneAuthorized(accountId: string, user: AuthenticatedUser) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { owner: true },
    });

    if (!account) {
      throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' });
    }

    const ability = this.caslAbilityFactory.createForUser(user);
    const subject = CaslAbilityFactory.toAccountSubject(account);

    if (!ability.can(Action.Read, subject)) {
      await this.logSecurityIncident(user, 'BOLA_READ_ATTEMPT', accountId, 'Unauthorized attempt to read account');
      throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' });
    }

    if (user.role === Role.EMPLOYEE) {
      await this.logSecurityIncident(user, 'EMPLOYEE_ACCOUNT_VIEW', accountId, 'Employee viewed customer account');
    }

    return this.serializeAccount(account);
  }

  async getTransactionsAuthorized(accountId: string, user: AuthenticatedUser) {
    await this.findOneAuthorized(accountId, user);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        OR: [{ senderAccountId: accountId }, { receiverAccountId: accountId }],
        status: 'COMPLETED',
      },
      orderBy: { executedAt: 'desc' },
    });

    return transactions.map((tx) => ({
      ...tx,
      amount: Number(tx.amount),
    }));
  }

  // ==================== TWO-STEP TRANSFER SYSTEM ====================

  async createTransferDraft(dto: CreateTransactionDto, user: AuthenticatedUser) {
    await this.ensureCustomerExists(user);

    const senderAccount = dto.senderAccountId
      ? await this.prisma.account.findUnique({ where: { id: dto.senderAccountId } })
      : await this.prisma.account.findFirst({ where: { ownerId: user.id, currency: 'PLN' } });

    if (!senderAccount) {
      throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' });
    }

    if (user.role !== Role.CLIENT) {
      await this.logSecurityIncident(user, 'ROLE_TRANSFER_FORBIDDEN', senderAccount.id, 'Non-client tried to initiate transfer');
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only clients can initiate transfers' });
    }

    if (senderAccount.ownerId !== user.id) {
      await this.logSecurityIncident(user, 'BOLA_TRANSFER_ATTEMPT', senderAccount.id, 'Not account owner');
      throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' });
    }

    if (senderAccount.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: 'ACCOUNT_BLOCKED',
        message: 'Account is frozen or closed. Cannot initiate transfer.',
      });
    }

    const config = await this.getSystemConfig();
    if (Number(dto.amount) >= config.stepUpThreshold && user.acr !== '2') {
      await this.logSecurityIncident(
        user,
        'STEP_UP_REQUIRED',
        senderAccount.id,
        `Transfer of ${dto.amount} PLN requires Passkey step-up authentication (acr=2, threshold=${config.stepUpThreshold})`,
      );
      throw new ForbiddenException({
        code: 'STEP_UP_REQUIRED',
        message: `Transfers of ${config.stepUpThreshold} PLN or more require Passkey step-up confirmation (acr=2).`,
      });
    }

    const ability = this.caslAbilityFactory.createForUser(user);
    const subject = CaslAbilityFactory.toAccountSubject(senderAccount);
    if (!ability.can(Action.Transfer, subject)) {
      await this.logSecurityIncident(user, 'UNAUTHORIZED_TRANSFER_ATTEMPT', senderAccount.id, 'CASL transfer check failed');
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Cannot initiate transfer from this account' });
    }

    const receiverAccount = await this.prisma.account.findUnique({
      where: { iban: dto.receiverIban },
    });

    if (!receiverAccount) {
      throw new NotFoundException({
        code: 'RECIPIENT_NOT_FOUND',
        message: 'Receiver account with given IBAN does not exist in this bank.',
      });
    }

    if (senderAccount.id === receiverAccount.id) {
      throw new BadRequestException({
        code: 'SAME_ACCOUNT_TRANSFER',
        message: 'Cannot transfer funds to the same account.',
      });
    }

    if (Number(senderAccount.balance) < dto.amount) {
      throw new UnprocessableEntityException({
        code: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient funds on the account.',
      });
    }

    const dailyUsed = await this.calculateDailyUsed(senderAccount.id);
    if (dailyUsed + dto.amount > Number(senderAccount.dailyLimit)) {
      throw new UnprocessableEntityException({
        code: 'DAILY_LIMIT_EXCEEDED',
        message: `Daily limit exceeded. Used today: ${dailyUsed}, Limit: ${Number(senderAccount.dailyLimit)}`,
      });
    }

    const draft = await this.prisma.transaction.create({
      data: {
        senderAccountId: senderAccount.id,
        receiverAccountId: receiverAccount.id,
        receiverIban: dto.receiverIban,
        receiverName: dto.receiverName,
        amount: dto.amount,
        currency: senderAccount.currency,
        title: dto.title,
        status: 'DRAFT',
      },
    });

    return {
      id: draft.id,
      status: draft.status,
      senderAccountId: draft.senderAccountId,
      senderIban: senderAccount.iban,
      receiverIban: draft.receiverIban,
      receiverName: draft.receiverName,
      amount: Number(draft.amount),
      currency: draft.currency,
      title: draft.title,
      createdAt: draft.createdAt,
    };
  }

  async confirmTransfer(transferId: string, user: AuthenticatedUser) {
    const draft = await this.prisma.transaction.findUnique({
      where: { id: transferId },
      include: { senderAccount: true, receiverAccount: true },
    });

    if (!draft || draft.status !== 'DRAFT') {
      throw new NotFoundException({ code: 'TRANSFER_NOT_FOUND', message: 'Transfer draft not found or already processed' });
    }

    const senderAccount = draft.senderAccount;

    if (user.role !== Role.CLIENT || senderAccount.ownerId !== user.id) {
      await this.logSecurityIncident(user, 'BOLA_CONFIRM_ATTEMPT', transferId, 'Unauthorized transfer confirmation attempt');
      throw new NotFoundException({ code: 'TRANSFER_NOT_FOUND', message: 'Transfer draft not found or already processed' });
    }

    if (senderAccount.status !== 'ACTIVE') {
      throw new ForbiddenException({ code: 'ACCOUNT_BLOCKED', message: 'Account is blocked' });
    }

    const config = await this.getSystemConfig();
    if (Number(draft.amount) >= config.stepUpThreshold && user.acr !== '2') {
      await this.logSecurityIncident(
        user,
        'STEP_UP_REQUIRED',
        senderAccount.id,
        `Transfer of ${draft.amount} PLN requires Passkey step-up authentication (acr=2)`,
      );
      throw new ForbiddenException({
        code: 'STEP_UP_REQUIRED',
        message: `Transfers of ${config.stepUpThreshold} PLN or more require Passkey step-up confirmation (acr=2).`,
      });
    }

    const amount = Number(draft.amount);

    if (Number(senderAccount.balance) < amount) {
      throw new UnprocessableEntityException({ code: 'INSUFFICIENT_FUNDS', message: 'Insufficient funds' });
    }

    const dailyUsed = await this.calculateDailyUsed(senderAccount.id);
    if (dailyUsed + amount > Number(senderAccount.dailyLimit)) {
      throw new UnprocessableEntityException({ code: 'DAILY_LIMIT_EXCEEDED', message: 'Daily limit exceeded' });
    }

    const operationNumber = `OP-${Date.now()}-${randomInt(1000, 10000)}`;
    const executedAt = new Date();

    const confirmationPayload = {
      operationNumber,
      senderIban: senderAccount.iban,
      receiverIban: draft.receiverIban,
      amount,
      currency: draft.currency,
      executedAt: executedAt.toISOString(),
    };

    const signature = this.signatureService.signTransferConfirmation(confirmationPayload);

    const completed = await this.prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: senderAccount.id },
        data: { balance: { decrement: amount } },
      });

      if (draft.receiverAccountId) {
        await tx.account.update({
          where: { id: draft.receiverAccountId },
          data: { balance: { increment: amount } },
        });
      }

      return tx.transaction.update({
        where: { id: draft.id },
        data: {
          status: 'COMPLETED',
          operationNumber,
          executedAt,
          signature,
        },
      });
    });

    return {
      id: completed.id,
      status: completed.status,
      operationNumber: completed.operationNumber,
      executedAt: completed.executedAt,
      amount: Number(completed.amount),
      currency: completed.currency,
      signature: completed.signature ?? signature,
      confirmationPayload,
    };
  }

  async cancelTransfer(transferId: string, user: AuthenticatedUser) {
    const draft = await this.prisma.transaction.findUnique({
      where: { id: transferId },
      include: { senderAccount: true },
    });

    if (!draft || draft.status !== 'DRAFT') {
      throw new NotFoundException({ code: 'TRANSFER_NOT_FOUND', message: 'Transfer draft not found or already processed' });
    }

    if (user.role !== Role.CLIENT || draft.senderAccount.ownerId !== user.id) {
      await this.logSecurityIncident(user, 'BOLA_CANCEL_ATTEMPT', transferId, 'Unauthorized cancellation attempt');
      throw new NotFoundException({ code: 'TRANSFER_NOT_FOUND', message: 'Transfer draft not found or already processed' });
    }

    const cancelled = await this.prisma.transaction.update({
      where: { id: transferId },
      data: { status: 'CANCELLED' },
    });

    return {
      id: cancelled.id,
      status: cancelled.status,
    };
  }

  // ==================== SAVED RECIPIENTS (BOLA 404 PROTECTED) ====================

  async getRecipients(user: AuthenticatedUser) {
    await this.ensureCustomerExists(user);
    return this.prisma.recipient.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRecipient(dto: CreateRecipientDto, user: AuthenticatedUser) {
    await this.ensureCustomerExists(user);
    return this.prisma.recipient.create({
      data: {
        ownerId: user.id,
        name: dto.name,
        iban: dto.iban,
      },
    });
  }

  async deleteRecipient(recipientId: string, user: AuthenticatedUser) {
    const recipient = await this.prisma.recipient.findUnique({ where: { id: recipientId } });
    if (!recipient) {
      throw new NotFoundException({ code: 'RECIPIENT_NOT_FOUND', message: 'Recipient not found' });
    }

    if (recipient.ownerId !== user.id) {
      await this.logSecurityIncident(user, 'BOLA_RECIPIENT_DELETE', recipientId, 'Client tried to delete another user recipient');
      throw new NotFoundException({ code: 'RECIPIENT_NOT_FOUND', message: 'Recipient not found' });
    }

    await this.prisma.recipient.delete({ where: { id: recipientId } });
    return { deleted: true, id: recipientId };
  }

  // ==================== QR & DEEP LINK PAYMENT REQUESTS ====================

  async getPaymentRequestForClient(requestId: string) {
    const req = await this.prisma.paymentRequest.findUnique({ where: { id: requestId } });
    if (!req) {
      throw new NotFoundException({ code: 'PAYMENT_REQUEST_NOT_FOUND', message: 'Payment request not found' });
    }
    return {
      ...req,
      amount: Number(req.amount),
    };
  }

  async payPaymentRequest(requestId: string, user: AuthenticatedUser) {
    const payReq = await this.prisma.paymentRequest.findUnique({ where: { id: requestId } });
    if (!payReq || payReq.status !== 'PENDING') {
      throw new NotFoundException({
        code: 'PAYMENT_REQUEST_NOT_FOUND',
        message: 'Payment request not found or already paid',
      });
    }

    const draft = await this.createTransferDraft(
      {
        receiverIban: payReq.receiverIban,
        receiverName: payReq.receiverName,
        amount: Number(payReq.amount),
        title: payReq.title,
      },
      user,
    );

    const confirmed = await this.confirmTransfer(draft.id, user);

    await this.prisma.paymentRequest.update({
      where: { id: requestId },
      data: {
        status: 'PAID',
        transactionId: confirmed.id,
        paidAt: new Date(),
      },
    });

    return confirmed;
  }

  // ==================== PARTNER API PAYMENT REQUESTS ====================

  async createPartnerPaymentRequest(partnerId: string, dto: CreatePaymentRequestDto) {
    const defaultReceiver = await this.prisma.account.findFirst({
      where: { ownerId: 'client-2', currency: 'PLN' },
    });

    const created = await this.prisma.paymentRequest.create({
      data: {
        partnerId,
        receiverIban: dto.receiverIban ?? defaultReceiver?.iban ?? 'PL99102010260000140202736451',
        receiverName: dto.receiverName ?? `Sklep Partner (${partnerId})`,
        amount: dto.amount,
        currency: 'PLN',
        title: dto.title,
        status: 'PENDING',
      },
    });

    return {
      ...created,
      amount: Number(created.amount),
      deepLink: `sbank://pay/${created.id}`,
    };
  }

  async getPartnerPaymentRequest(partnerId: string, requestId: string) {
    const payReq = await this.prisma.paymentRequest.findUnique({ where: { id: requestId } });
    if (!payReq || payReq.partnerId !== partnerId) {
      throw new NotFoundException({ code: 'PAYMENT_REQUEST_NOT_FOUND', message: 'Payment request not found' });
    }
    return {
      ...payReq,
      amount: Number(payReq.amount),
    };
  }

  // ==================== LIMIT & STATUS MANAGEMENT ====================

  async updateLimitAuthorized(accountId: string, dto: UpdateLimitDto, user: AuthenticatedUser) {
    const account = await this.prisma.account.findUnique({ where: { id: accountId }, include: { owner: true } });
    if (!account) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' });

    if (user.role === Role.CLIENT && account.ownerId !== user.id) {
      await this.logSecurityIncident(user, 'BOLA_LIMIT_CHANGE', accountId, 'Client tried to update another user limit');
      throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' });
    }

    const ability = this.caslAbilityFactory.createForUser(user);
    const subject = CaslAbilityFactory.toAccountSubject(account);

    if (!ability.can(Action.Update, subject)) {
      await this.logSecurityIncident(user, 'UNAUTHORIZED_LIMIT_CHANGE', accountId, 'Forbidden limit update attempt');
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Cannot update limit for this account' });
    }

    const config = await this.getSystemConfig();
    if (dto.newLimit < config.minDailyLimit || dto.newLimit > config.maxDailyLimit) {
      throw new BadRequestException({
        code: 'LIMIT_OUT_OF_RANGE',
        message: `Daily limit must be between ${config.minDailyLimit} and ${config.maxDailyLimit} PLN`,
      });
    }

    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: { dailyLimit: dto.newLimit },
      include: { owner: true },
    });

    return this.serializeAccount(updated);
  }

  async updateStatusAuthorized(accountId: string, dto: UpdateStatusDto, user: AuthenticatedUser) {
    const account = await this.prisma.account.findUnique({ where: { id: accountId }, include: { owner: true } });
    if (!account) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' });

    const ability = this.caslAbilityFactory.createForUser(user);
    const subject = CaslAbilityFactory.toAccountSubject(account);

    if (!ability.can(Action.Freeze, subject)) {
      await this.logSecurityIncident(user, 'UNAUTHORIZED_STATUS_CHANGE', accountId, 'Client tried to change account status');
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only employees can change account status' });
    }

    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: { status: dto.status },
      include: { owner: true },
    });

    return this.serializeAccount(updated);
  }

  // ==================== CUSTOMER SEARCH & DETAILS ====================

  async searchCustomers(query: string = '', user: AuthenticatedUser) {
    if (user.role !== Role.EMPLOYEE && user.role !== Role.ADMIN) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only employees can search customers' });
    }

    const customers = await this.prisma.customer.findMany({
      where: query
        ? {
            OR: [
              { firstName: { contains: query } },
              { lastName: { contains: query } },
              { email: { contains: query } },
              { customerNumber: { contains: query } },
            ],
          }
        : {},
      include: { accounts: true },
    });

    return Promise.all(
      customers.map(async (c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        customerNumber: c.customerNumber,
        accounts: await Promise.all(c.accounts.map((a) => this.serializeAccount(a))),
      })),
    );
  }

  async getCustomerDetails(customerId: string, user: AuthenticatedUser) {
    await this.ensureCustomerExists(user);

    if (user.role === Role.CLIENT && user.id !== customerId) {
      await this.logSecurityIncident(user, 'BOLA_CUSTOMER_READ', customerId, 'Client tried to view another customer profile');
      throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { accounts: true },
    });

    if (!customer) {
      throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });
    }

    if (user.role === Role.EMPLOYEE) {
      await this.logSecurityIncident(user, 'EMPLOYEE_CUSTOMER_VIEW', customerId, 'Employee viewed customer profile');
    }

    const serializedAccounts = await Promise.all(
      customer.accounts.map((acc) => this.serializeAccount(acc)),
    );

    const accountIds = customer.accounts.map((a) => a.id);
    const transactions = await this.prisma.transaction.findMany({
      where: {
        OR: [
          { senderAccountId: { in: accountIds } },
          { receiverAccountId: { in: accountIds } },
        ],
        status: 'COMPLETED',
      },
      orderBy: { executedAt: 'desc' },
    });

    return {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      customerNumber: customer.customerNumber,
      accounts: serializedAccounts,
      transactions: transactions.map((tx) => ({
        ...tx,
        amount: Number(tx.amount),
      })),
    };
  }

  async getAuditLogs(user: AuthenticatedUser) {
    if (user.role !== Role.ADMIN) {
      await this.logSecurityIncident(user, 'UNAUTHORIZED_AUDIT_READ', 'AuditLog', 'Non-admin tried to read audit logs');
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only admins can view audit logs' });
    }
    return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' } });
  }

  private async logSecurityIncident(user: AuthenticatedUser, action: string, resourceId: string, reason: string) {
    this.logger.warn(`SECURITY INCIDENT [${action}]: User ${user.id} (${user.role}) -> Resource ${resourceId}. Reason: ${reason}`);
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        userRole: user.role,
        action,
        resourceId,
        ipAddress: user.ipAddress ?? '127.0.0.1',
        reason,
      },
    });
  }
}