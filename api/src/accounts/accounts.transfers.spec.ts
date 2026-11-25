import { AccountsService } from './accounts.service.js';
import { Role } from '../auth/interfaces/authenticated-user.interface.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { jest } from '@jest/globals';

describe('AccountsService transfers', () => {
  const user: AuthenticatedUser = {
    id: 'customer-1',
    role: Role.CLIENT,
    ipAddress: '127.0.0.1',
    acr: '2',
  };

  const senderAccount = {
    id: 'account-sender',
    ownerId: user.id,
    iban: 'PL00111111111111111111111111',
    status: 'ACTIVE',
    currency: 'PLN',
    balance: 500,
    dailyLimit: 1000,
  };

  const receiverAccount = {
    id: 'account-receiver',
    ownerId: 'customer-2',
    iban: 'PL00222222222222222222222222',
    status: 'ACTIVE',
    currency: 'PLN',
    balance: 200,
    dailyLimit: 1000,
  };

  const draft = {
    id: 'transfer-1',
    senderAccountId: senderAccount.id,
    receiverAccountId: receiverAccount.id,
    senderAccount,
    receiverAccount,
    receiverIban: receiverAccount.iban,
    receiverName: 'Test Receiver',
    amount: 100,
    currency: 'PLN',
    status: 'DRAFT',
    title: 'Test transfer',
  };

  let service: AccountsService;
  let prisma: any;
  let tx: any;
  let signatureService: any;


  beforeEach(() => {
    const completedTransfer = {
      ...draft,
      status: 'COMPLETED',
      operationNumber: 'OP-TEST-1',
      executedAt: new Date('2026-11-24T10:00:00.000Z'),
      signature: 'test-signature',
    };

    tx = {
      $queryRaw: jest.fn<(...args: any[]) => any>().mockResolvedValue([]),

      transaction: {
        findUnique: jest.fn<(...args: any[]) => any>().mockResolvedValue(draft),
        aggregate: jest.fn<(...args: any[]) => any>().mockResolvedValue({
          _sum: { amount: 0 },
        }),
        updateMany: jest.fn<(...args: any[]) => any>().mockResolvedValue({ count: 1 }),
        update: jest.fn<(...args: any[]) => any>().mockResolvedValue(completedTransfer),
	findUniqueOrThrow: jest.fn<(...args: any[]) => any>().mockResolvedValue({
	  ...draft,
	  status: 'CANCELLED',
	}),
      },

      systemConfig: {
        upsert: jest.fn<(...args: any[]) => any>().mockResolvedValue({
          id: 'global',
          stepUpThreshold: 1000,
          minDailyLimit: 100,
	  maxDailyLimit: 50000,
          updatedAt: new Date(),
        }),
      },

      account: {
        findUnique: jest.fn(({ where }: any) => {
          if (where.id === senderAccount.id) {
            return Promise.resolve(senderAccount);
          }

          if (where.id === receiverAccount.id) {
            return Promise.resolve(receiverAccount);
          }

          return Promise.resolve(null);
        }),
        update: jest.fn<(...args: any[]) => any>().mockResolvedValue({}),
      },
    };

    prisma = {
      transaction: {
        findUnique: jest.fn<(...args: any[]) => any>().mockResolvedValue(draft),
      },

      systemConfig: {
        upsert: jest.fn<(...args: any[]) => any>().mockResolvedValue({
          id: 'global',
          stepUpThreshold: 1000,
          minDailyLimit: 100,
          maxDailyLimit: 50000,
          updatedAt: new Date(),
        }),
      },

      $transaction: jest.fn(async (callback: any) => callback(tx)),
      auditLog: {
        create: jest.fn<(...args: any[]) => any>().mockResolvedValue({}),
      },
    };

    signatureService = {
      signTransferConfirmation: jest.fn<(...args: any[]) => any>().mockReturnValue('test-signature'),
    };

    service = new AccountsService(
      prisma,
      {} as any,
      signatureService,
    );
  });

  describe('confirmTransfer', () => {
    it('should confirm a valid transfer and update both account balances', async () => {
      const result = await service.confirmTransfer('transfer-1', user);

      expect(result).toMatchObject({
        id: 'transfer-1',
        status: 'COMPLETED',
        amount: 100,
        currency: 'PLN',
        signature: 'test-signature',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      // Lock transfer row and both account rows.
      expect(tx.$queryRaw).toHaveBeenCalledTimes(3);

      expect(tx.transaction.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'transfer-1',
          status: 'DRAFT',
        },
        data: {
          status: 'PROCESSING',
        },
      });

      expect(tx.account.update).toHaveBeenNthCalledWith(1, {
        where: { id: senderAccount.id },
        data: { balance: { decrement: 100 } },
      });

      expect(tx.account.update).toHaveBeenNthCalledWith(2, {
        where: { id: receiverAccount.id },
        data: { balance: { increment: 100 } },
      });

      expect(tx.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'transfer-1' },
          data: expect.objectContaining({
            status: 'COMPLETED',
            signature: 'test-signature',
          }),
        }),
      );
    });
    it('should reject a transfer that does not exist', async () => {
      tx.transaction.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmTransfer('missing-transfer', user),
      ).rejects.toThrow();

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should reject a transfer that is no longer a draft', async () => {
      tx.transaction.findUnique.mockResolvedValue({
        ...draft,
        status: 'COMPLETED',
      });

    await expect(
      service.confirmTransfer('transfer-1', user),
    ).rejects.toThrow();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should reject an attempt to confirm another customer transfer', async () => {
      tx.transaction.findUnique.mockResolvedValue({
        ...draft,
        senderAccount: {
        ...senderAccount,
        ownerId: 'another-customer',
        },
      });

      await expect(
        service.confirmTransfer('transfer-1', user),
      ).rejects.toThrow();

      expect(prisma.auditLog.create).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should require step-up authentication for transfers at or above the threshold', async () => {
      tx.transaction.findUnique.mockResolvedValue({
        ...draft,
        amount: 1500,
      });

      const userWithoutStepUp: AuthenticatedUser = {
        ...user,
        acr: '1',
      };

      await expect(
        service.confirmTransfer('transfer-1', userWithoutStepUp),
        ).rejects.toThrow();

      expect(prisma.auditLog.create).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    describe('step-up freshness (A2)', () => {
      const nowSeconds = () => Math.floor(Date.now() / 1000);

      beforeEach(() => {
        tx.transaction.findUnique.mockResolvedValue({ ...draft, amount: 1500 });
        tx.account.findUnique.mockImplementation(({ where }: any) =>
          Promise.resolve(
            where.id === senderAccount.id
              ? { ...senderAccount, balance: 5000, dailyLimit: 10000 }
              : receiverAccount,
          ),
        );
      });

      it('rejects acr=2 without auth_time (cannot prove a recent Passkey)', async () => {
        await expect(
          service.confirmTransfer('transfer-1', { ...user, acr: '2' }),
        ).rejects.toMatchObject({ response: { code: 'STEP_UP_REQUIRED' } });

        expect(tx.account.update).not.toHaveBeenCalled();
      });

      it('rejects acr=2 with auth_time older than 5 minutes', async () => {
        await expect(
          service.confirmTransfer('transfer-1', { ...user, acr: '2', authTime: nowSeconds() - 301 }),
        ).rejects.toMatchObject({ response: { code: 'STEP_UP_REQUIRED' } });
      });

      it('accepts acr=2 with a fresh auth_time', async () => {
        await expect(
          service.confirmTransfer('transfer-1', { ...user, acr: '2', authTime: nowSeconds() - 60 }),
        ).resolves.toMatchObject({ status: 'COMPLETED' });
      });
    });

    it('should reject a transfer when the sender has insufficient funds', async () => {
      tx.account.findUnique.mockImplementation(({ where }: any) => {
        if (where.id === senderAccount.id) {
          return Promise.resolve({
            ...senderAccount,
            balance: 50,
          });
        }

        return Promise.resolve(receiverAccount);
      });

    await expect(
      service.confirmTransfer('transfer-1', user),
    ).rejects.toThrow();

    expect(tx.account.update).not.toHaveBeenCalled();
    expect(tx.transaction.update).not.toHaveBeenCalled();
  });

    it('should reject a transfer that exceeds the daily limit', async () => {
      tx.transaction.aggregate.mockResolvedValue({
        _sum: { amount: 950 },
      });

      await expect(
        service.confirmTransfer('transfer-1', user),
      ).rejects.toThrow();

      expect(tx.account.update).not.toHaveBeenCalled();
      expect(tx.transaction.update).not.toHaveBeenCalled();
    });

    it('should reject a transfer if the conditional draft claim fails', async () => {
      tx.transaction.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.confirmTransfer('transfer-1', user),
      ).rejects.toThrow();

      expect(tx.account.update).not.toHaveBeenCalled();
      expect(tx.transaction.update).not.toHaveBeenCalled();
    });
  });

  describe('cancelTransfer', () => {
    it('should cancel a valid draft', async () => {
      const result = await service.cancelTransfer('transfer-1', user);

      expect(result).toEqual({
        id: 'transfer-1',
        status: 'CANCELLED',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);

      expect(tx.transaction.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'transfer-1',
          status: 'DRAFT',
        },
        data: {
          status: 'CANCELLED',
        },
      });
    });

    it('should reject cancellation of a nonexistent transfer', async () => {
      prisma.transaction.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelTransfer('missing-transfer', user),
      ).rejects.toThrow();

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should reject cancellation of a transfer that is no longer a draft', async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        ...draft,
        status: 'COMPLETED',
      });

      await expect(
        service.cancelTransfer('transfer-1', user),
      ).rejects.toThrow();

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should reject cancellation of another customer transfer', async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        ...draft,
        senderAccount: {
          ...senderAccount,
          ownerId: 'another-customer',
        },
      });

      await expect(
        service.cancelTransfer('transfer-1', user),
      ).rejects.toThrow();

      expect(prisma.auditLog.create).toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should reject cancellation if the draft status changes after acquiring the lock', async () => {
      tx.transaction.findUnique.mockResolvedValue({
        ...draft,
        status: 'COMPLETED',
      });

      await expect(
        service.cancelTransfer('transfer-1', user),
      ).rejects.toThrow();

      expect(tx.transaction.updateMany).not.toHaveBeenCalled();
    });

    it('should reject cancellation if the conditional update fails', async () => {
      tx.transaction.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.cancelTransfer('transfer-1', user),
      ).rejects.toThrow();

      expect(tx.transaction.findUniqueOrThrow).not.toHaveBeenCalled();
    });
  });
});
