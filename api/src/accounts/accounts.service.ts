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

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  // Helper method to calculate daily spent amount for an account
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
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You do not have permission to view this account' });
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
    let senderAccount = dto.senderAccountId
      ? await this.prisma.account.findUnique({ where: { id: dto.senderAccountId } })
      : await this.prisma.account.findFirst({ where: { ownerId: user.id, currency: 'PLN' } });

    if (!senderAccount) {
      throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Sender account not found' });
    }

    if (user.role === Role.CLIENT && senderAccount.ownerId !== user.id) {
      await this.logSecurityIncident(user, 'UNAUTHORIZED_TRANSFER_ATTEMPT', senderAccount.id, 'Not account owner');
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You are not the owner of this account' });
    }

    if (senderAccount.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: 'ACCOUNT_BLOCKED',
        message: 'Account is frozen or closed. Cannot initiate transfer.',
      });
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

    if (user.role === Role.CLIENT && senderAccount.ownerId !== user.id) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Unauthorized transfer confirmation attempt' });
    }

    if (senderAccount.status !== 'ACTIVE') {
      throw new ForbiddenException({ code: 'ACCOUNT_BLOCKED', message: 'Account is blocked' });
    }

    const amount = Number(draft.amount);

    if (Number(senderAccount.balance) < amount) {
      throw new UnprocessableEntityException({ code: 'INSUFFICIENT_FUNDS', message: 'Insufficient funds' });
    }

    const dailyUsed = await this.calculateDailyUsed(senderAccount.id);
    if (dailyUsed + amount > Number(senderAccount.dailyLimit)) {
      throw new UnprocessableEntityException({ code: 'DAILY_LIMIT_EXCEEDED', message: 'Daily limit exceeded' });
    }

    const operationNumber = `OP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const executedAt = new Date();

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

    if (user.role === Role.CLIENT && draft.senderAccount.ownerId !== user.id) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Unauthorized cancellation attempt' });
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

  // ==================== LIMIT & STATUS MANAGEMENT ====================

  async updateLimitAuthorized(accountId: string, dto: UpdateLimitDto, user: AuthenticatedUser) {
    const account = await this.prisma.account.findUnique({ where: { id: accountId }, include: { owner: true } });
    if (!account) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' });

    const ability = this.caslAbilityFactory.createForUser(user);
    const subject = CaslAbilityFactory.toAccountSubject(account);

    if (!ability.can(Action.Update, subject)) {
      await this.logSecurityIncident(user, 'UNAUTHORIZED_LIMIT_CHANGE', accountId, 'Forbidden limit update attempt');
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Cannot update limit for this account' });
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
    if (user.role === Role.CLIENT && user.id !== customerId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Cannot view other customer profile' });
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { accounts: true },
    });

    if (!customer) {
      throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });
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
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only admins can view audit logs' });
    }
    return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' } });
  }

  private async logSecurityIncident(user: AuthenticatedUser, action: string, resourceId: string, reason: string) {
    this.logger.warn(`SECURITY INCIDENT [${action}]: User ${user.id} (${user.role}) -> Resource ${resourceId}. Reason: ${reason}`);
    await this.prisma.auditLog.create({
      data: { userId: user.id, userRole: user.role, action, resourceId, ipAddress: user.ipAddress, reason },
    });
  }
}