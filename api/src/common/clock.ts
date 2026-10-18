/** Injection token for the time source, so expiry-sensitive rules can be tested with a fixed clock. */
export const CLOCK = Symbol('CLOCK');

export interface Clock {
  /** Current time as whole seconds since the Unix epoch (the unit of JWT `auth_time`). */
  nowSeconds(): number;
}

export class SystemClock implements Clock {
  nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
  }
}
