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