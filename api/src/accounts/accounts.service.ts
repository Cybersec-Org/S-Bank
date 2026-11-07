import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Action, CaslAbilityFactory } from '../auth/casl-ability.factory.js';
import { type AuthenticatedUser, Role } from '../auth/interfaces/authenticated-user.interface.js';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async findAllForUser(user: AuthenticatedUser) {
    if (user.role === Role.EMPLOYEE || user.role === Role.ADMIN) {
      this.logger.log(`User ${user.id} (${user.role}) fetching all bank accounts`);
      const allAccounts = await this.prisma.account.findMany({
        orderBy: { createdAt: 'asc' },
      });
      return allAccounts.map((acc) => this.serializeAccount(acc));
    }

    this.logger.log(`Client ${user.id} fetching own bank accounts`);
    const ownAccounts = await this.prisma.account.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    return ownAccounts.map((acc) => this.serializeAccount(acc));
  }

  async findOneAuthorized(accountId: string, user: AuthenticatedUser) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      this.logger.warn(`Account not found: ${accountId}`);
      throw new NotFoundException(`Bank account with ID ${accountId} was not found`);
    }

    const ability = this.caslAbilityFactory.createForUser(user);
    const subject = CaslAbilityFactory.toAccountSubject(account);

    if (!ability.can(Action.Read, subject)) {
      await this.recordSecurityIncident(user, 'BOLA_ACCOUNT_READ_BLOCKED', account.id, {
        attemptedOwnerId: account.ownerId,
      });

      throw new ForbiddenException(
        'Access denied: You do not have permission to view this bank account',
      );
    }

    return this.serializeAccount(account);
  }

  async getAccountTransactionsAuthorized(accountId: string, user: AuthenticatedUser) {
    await this.findOneAuthorized(accountId, user);

    this.logger.log(
      `User ${user.id} (${user.role}) fetching transactions for account ${accountId}`,
    );

    const transactions = await this.prisma.transaction.findMany({
      where: {
        OR: [
          { senderAccountId: accountId },
          { receiverAccountId: accountId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return transactions.map((tx) => ({
      ...tx,
      amount: Number(tx.amount),
      direction: tx.senderAccountId === accountId ? 'OUTGOING' : 'INCOMING',
    }));
  }

  async getAuditLogs() {
    this.logger.log('Fetching security audit logs (Admin access)');
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createTransactionAuthorized(
    senderAccountId: string,
    dto: { receiverIban: string; receiverName: string; amount: number; title: string },
    user: AuthenticatedUser,
  ) {
    const senderAccount = await this.findOneAuthorized(senderAccountId, user);
    const ability = this.caslAbilityFactory.createForUser(user);
    const subject = CaslAbilityFactory.toAccountSubject(senderAccount as any);

    if (!ability.can(Action.Transfer, subject)) {
      await this.recordSecurityIncident(user, 'UNAUTHORIZED_TRANSFER_ATTEMPT', senderAccountId, dto);
      throw new ForbiddenException('You cannot initiate a transfer from this account (Not owner or account frozen).');
    }

    if (Number(senderAccount.balance) < dto.amount) {
      throw new ForbiddenException('Insufficient funds.');
    }
    if (Number(senderAccount.dailyLimit) < dto.amount) {
      throw new ForbiddenException('Transaction exceeds daily limit.');
    }

    const receiverAccount = await this.prisma.account.findUnique({
      where: { iban: dto.receiverIban },
    });

    if (!receiverAccount) {
      throw new NotFoundException('Receiver account IBAN not found in this bank.');
    }

    this.logger.log(`Processing transfer of ${dto.amount} from ${senderAccountId} to ${receiverAccount.id}`);
    
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: senderAccountId },
        data: { balance: { decrement: dto.amount } },
      });

      await tx.account.update({
        where: { id: receiverAccount.id },
        data: { balance: { increment: dto.amount } },
      });

      return tx.transaction.create({
        data: {
          senderAccountId,
          receiverAccountId: receiverAccount.id,
          senderIban: senderAccount.iban,
          receiverIban: dto.receiverIban,
          receiverName: dto.receiverName,
          amount: dto.amount,
          currency: senderAccount.currency,
          title: dto.title,
          type: 'INTERNAL_TRANSFER',
          status: 'COMPLETED',
        },
      });
    });

    await this.recordSecurityIncident(user, 'TRANSFER_COMPLETED', senderAccountId, { amount: dto.amount, receiverIban: dto.receiverIban });
    return result;
  }

  async updateDailyLimitAuthorized(accountId: string, newLimit: number, user: AuthenticatedUser) {
    const account = await this.findOneAuthorized(accountId, user);
    const ability = this.caslAbilityFactory.createForUser(user);
    const subject = CaslAbilityFactory.toAccountSubject(account as any);

    if (!ability.can(Action.Update, subject)) {
      await this.recordSecurityIncident(user, 'UNAUTHORIZED_LIMIT_UPDATE', accountId, { newLimit });
      throw new ForbiddenException('You are not allowed to update the limit for this account.');
    }

    this.logger.log(`User ${user.id} updating limit for ${accountId} to ${newLimit}`);
    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: { dailyLimit: newLimit },
    });

    await this.recordSecurityIncident(user, 'LIMIT_UPDATED', accountId, { newLimit });
    return this.serializeAccount(updated);
  }

  async updateStatusAuthorized(accountId: string, newStatus: string, user: AuthenticatedUser) {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Account not found');

    const ability = this.caslAbilityFactory.createForUser(user);
    const subject = CaslAbilityFactory.toAccountSubject(account as any);

    if (!ability.can(Action.Freeze, subject)) {
      await this.recordSecurityIncident(user, 'UNAUTHORIZED_STATUS_UPDATE', accountId, { newStatus });
      throw new ForbiddenException('You do not have permission to freeze/unfreeze accounts.');
    }

    this.logger.log(`Employee/Admin ${user.id} changing status for ${accountId} to ${newStatus}`);
    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: { status: newStatus as any },
    });

    await this.recordSecurityIncident(user, 'ACCOUNT_STATUS_CHANGED', accountId, { newStatus });
    return this.serializeAccount(updated);
  }

  private async recordSecurityIncident(
    user: AuthenticatedUser,
    action: string,
    resourceId: string,
    details: Record<string, unknown>,
  ) {
    this.logger.warn(
      `SECURITY INCIDENT [${action}]: User ${user.id} (${user.role}) on resource ${resourceId}`,
    );

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorRole: user.role,
        action,
        resourceId,
        details: JSON.stringify(details),
        ipAddress: user.ipAddress,
      },
    });
  }

  private serializeAccount(account: {
    id: string;
    iban: string;
    ownerId: string;
    name: string;
    currency: string;
    balance: unknown;
    dailyLimit: unknown;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...account,
      balance: Number(account.balance),
      dailyLimit: Number(account.dailyLimit),
    };
  }
}