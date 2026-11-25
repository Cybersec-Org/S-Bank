import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { AccountsService } from './accounts.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { CaslAbilityFactory } from '../auth/casl-ability.factory.js';
import type { SignatureService } from '../auth/signature.service.js';
import { PartnerId } from '../auth/interfaces/authenticated-partner.interface.js';
import type { CreatePaymentRequestDto } from './dto/extra.dto.js';

describe('AccountsService - partner payment requests', () => {
  let service: AccountsService;

  let prisma: {
    account: {
      findFirst: jest.Mock<(...args: any[]) => Promise<any>>;
    };
    paymentRequest: {
      create: jest.Mock<(...args: any[]) => Promise<any>>;
      findUnique: jest.Mock<(...args: any[]) => Promise<any>>;
    };
  };

  beforeEach(() => {
    prisma = {
      account: {
        findFirst: jest.fn<(...args: any[]) => Promise<any>>(),
      },
      paymentRequest: {
        create: jest.fn<(...args: any[]) => Promise<any>>(),
        findUnique: jest.fn<(...args: any[]) => Promise<any>>(),
      },
    };

    service = new AccountsService(
      prisma as unknown as PrismaService,
      {} as CaslAbilityFactory,
      {} as SignatureService,
    );
  });

  describe('createPartnerPaymentRequest', () => {
    const dto: CreatePaymentRequestDto = {
      amount: 149.99,
      title: 'Order #1024',
      receiverIban: 'PL99102010260000140202736451',
      receiverName: 'Test Shop',
    };

    it('creates a payment request associated with the authenticated partner', async () => {
      const created = {
        id: 'request-1',
        partnerId: PartnerId.PARTNER1,
        amount: 149.99,
        currency: 'PLN',
        status: 'PENDING',
      };

      prisma.paymentRequest.create.mockResolvedValue(created);

      const result = await service.createPartnerPaymentRequest(
        PartnerId.PARTNER1,
        dto,
      );

      expect(prisma.paymentRequest.create).toHaveBeenCalledWith({
        data: {
          partnerId: PartnerId.PARTNER1,
          receiverIban: dto.receiverIban,
          receiverName: dto.receiverName,
          amount: dto.amount,
          currency: 'PLN',
          title: dto.title,
          status: 'PENDING',
        },
      });

      expect(result).toMatchObject({
        id: 'request-1',
        partnerId: PartnerId.PARTNER1,
        amount: 149.99,
        deepLink: 'sbank://pay/request-1',
      });
    });

    it('uses the default receiver when receiver details are omitted', async () => {
      prisma.account.findFirst.mockResolvedValue({
        iban: 'PL11111111111111111111111111',
      });

      prisma.paymentRequest.create.mockResolvedValue({
        id: 'request-2',
        amount: 50,
      });

      await service.createPartnerPaymentRequest(
        PartnerId.PARTNER2,
        {
          amount: 50,
          title: 'Test order',
        },
      );

      expect(prisma.account.findFirst).toHaveBeenCalledWith({
        where: {
          ownerId: 'client-2',
          currency: 'PLN',
        },
      });

      expect(prisma.paymentRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          partnerId: PartnerId.PARTNER2,
          receiverIban: 'PL11111111111111111111111111',
          receiverName: `Sklep Partner (${PartnerId.PARTNER2})`,
        }),
      });
    });

    it('does not use a partner identity supplied through extra DTO properties', async () => {
      const manipulatedDto = {
        ...dto,
        partnerId: PartnerId.PARTNER2,
      } as CreatePaymentRequestDto;

      prisma.paymentRequest.create.mockResolvedValue({
        id: 'request-3',
        amount: dto.amount,
      });

      await service.createPartnerPaymentRequest(
        PartnerId.PARTNER1,
        manipulatedDto,
      );

      const createCall = prisma.paymentRequest.create.mock.calls[0][0];

      expect(createCall.data.partnerId).toBe(PartnerId.PARTNER1);
      expect(createCall.data).not.toHaveProperty('partnerId', PartnerId.PARTNER2);
    });
  });

  describe('getPartnerPaymentRequest', () => {
    const paymentRequest = {
      id: 'request-1',
      partnerId: PartnerId.PARTNER1,
      amount: 149.99,
      currency: 'PLN',
      status: 'PENDING',
    };

    it('returns a payment request belonging to the requesting partner', async () => {
      prisma.paymentRequest.findUnique.mockResolvedValue(paymentRequest);

      const result = await service.getPartnerPaymentRequest(
        PartnerId.PARTNER1,
        'request-1',
      );

      expect(prisma.paymentRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'request-1' },
      });

      expect(result).toMatchObject({
        id: 'request-1',
        partnerId: PartnerId.PARTNER1,
        amount: 149.99,
      });
    });

    it('rejects access when another partner owns the payment request', async () => {
      prisma.paymentRequest.findUnique.mockResolvedValue(paymentRequest);

      await expect(
        service.getPartnerPaymentRequest(
          PartnerId.PARTNER2,
          'request-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns 404 when the payment request does not exist', async () => {
      prisma.paymentRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.getPartnerPaymentRequest(
          PartnerId.PARTNER1,
          'unknown-request',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
