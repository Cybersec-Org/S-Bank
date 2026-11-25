import { z } from 'zod';

import type { DevApiTransport } from '@/shared/api/dev-api-transport';
import { scaleRate } from '@/shared/lib/money';

import type { Rate } from '../model/rate';
import type { RatesRepository } from './rates.repository';

/** Currencies the rates screen and the converter show, in display order, with their Polish names. */
const DISPLAYED_CURRENCIES: readonly { readonly code: string; readonly name: string }[] = [
  { code: 'EUR', name: 'euro' },
  { code: 'USD', name: 'dolar amerykański' },
  { code: 'CHF', name: 'frank szwajcarski' },
  { code: 'GBP', name: 'funt szterling' },
  { code: 'CZK', name: 'korona czeska' },
];

const ratesResponseSchema = z.object({
  effectiveDate: z.string().min(1),
  rates: z.array(z.object({ code: z.string().min(1), mid: z.number().positive() })),
});

/** `GET /public/rates` (NBP table A, no sign-in). The API reports no table number. */
export function createDevHttpRatesRepository(transport: DevApiTransport): RatesRepository {
  return {
    getRatesTable: async () => {
      const table = await transport.request({
        method: 'GET',
        path: '/public/rates',
        schema: ratesResponseSchema,
      });
      const rates = DISPLAYED_CURRENCIES.flatMap(({ code, name }): Rate[] => {
        const source = table.rates.find((rate) => rate.code === code);
        return source === undefined ? [] : [{ code, name, midRateScaled: scaleRate(source.mid) }];
      });
      return { tableNumber: null, effectiveDate: table.effectiveDate, rates };
    },
  };
}
