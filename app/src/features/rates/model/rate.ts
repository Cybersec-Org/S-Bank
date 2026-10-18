import { convertGroszeToForeignMinorUnits } from '@/shared/lib/money';

// B-15: switch to the generated schema type once GET /public/rates exists.
export interface Rate {
  readonly code: string;
  readonly name: string;
  /** NBP mid rate in PLN scaled by 10 000 (4.2315 is 42315), so no floating point is involved. */
  readonly midRateScaled: number;
}

export interface RatesTable {
  readonly tableNumber: string;
  readonly effectiveDate: string;
  readonly rates: readonly Rate[];
}

/** Foreign minor units (cents) received for an amount in grosze at the mid rate. */
export function convertPlnToForeign(grosze: number, rate: Rate): number {
  return convertGroszeToForeignMinorUnits(grosze, rate.midRateScaled);
}
