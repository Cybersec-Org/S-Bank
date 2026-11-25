import { z } from 'zod';

import type { HttpTransport } from '@/shared/api/http';

import type { RatesRepository } from './rates.repository';

const apiRatesSchema = z.object({
  effectiveDate: z.string(),
  rates: z.array(
    z.object({
      code: z.string(),
      currency: z.string(),
      mid: z.number(),
    }),
  ),
});

export function createHttpRatesRepository(transport: HttpTransport): RatesRepository {
  return {
    async getRatesTable() {
      const data = await transport.requestJson('/public/rates', apiRatesSchema);
      return {
        tableNumber: 'A (NBP)',
        effectiveDate: data.effectiveDate,
        rates: data.rates
          .filter((rate) => rate.code !== 'PLN')
          .map((rate) => ({
            code: rate.code,
            name: rate.currency,
            midRateScaled: Math.round(rate.mid * 10_000),
          })),
      };
    },
  };
}
