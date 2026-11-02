import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAllByOwner(ownerId: string) {
    this.logger.log(`Fetching accounts for ownerId: ${ownerId}`);

    const accounts = await this.prisma.account.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'asc' },
    });

    return accounts.map((acc) => ({
      ...acc,
      balance: Number(acc.balance),
      dailyLimit: Number(acc.dailyLimit),
    }));
  }

  async findOne(id: string) {
    this.logger.log(`Fetching details for accountId: ${id}`);

    const account = await this.prisma.account.findUnique({
      where: { id },
    });

    if (!account) {
      this.logger.warn(`Account not found: ${id}`);
      throw new NotFoundException(`Account with ID ${id} was not found`);
    }

    return {
      ...account,
      balance: Number(account.balance),
      dailyLimit: Number(account.dailyLimit),
    };
  }

  async getAccountTransactions(accountId: string) {
    await this.findOne(accountId);
    this.logger.log(`Fetching transaction history for accountId: ${accountId}`);

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
}