import {
  calculateLimitUsagePercent,
  calculateRemainingDailyLimit,
  signedAmountGrosze,
  type Account,
  type Transaction,
} from './account';

function buildAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'a',
    name: 'Konto',
    iban: 'PL96123456780000000000000001',
    balanceGrosze: 100_000,
    dailyLimitGrosze: 500_000,
    dailyUsedGrosze: 125_000,
    status: 'active',
    ...overrides,
  };
}

describe('daily limit helpers', () => {
  it('computes the remaining limit', () => {
    expect(calculateRemainingDailyLimit(buildAccount())).toBe(375_000);
  });

  it('never reports a negative remaining limit', () => {
    expect(calculateRemainingDailyLimit(buildAccount({ dailyUsedGrosze: 600_000 }))).toBe(0);
  });

  it('computes whole-percent usage and clamps at 100', () => {
    expect(calculateLimitUsagePercent(buildAccount())).toBe(25);
    expect(calculateLimitUsagePercent(buildAccount({ dailyUsedGrosze: 900_000 }))).toBe(100);
  });

  it('treats a zero limit as fully used', () => {
    expect(calculateLimitUsagePercent(buildAccount({ dailyLimitGrosze: 0 }))).toBe(100);
  });
});

describe('signedAmountGrosze', () => {
  const base: Transaction = {
    id: 't',
    accountId: 'a',
    direction: 'outgoing',
    amountGrosze: 1250,
    title: 'x',
    counterpartyName: 'y',
    bookedAt: '2026-10-15T09:00:00.000Z',
  };

  it('is negative for outgoing and positive for incoming operations', () => {
    expect(signedAmountGrosze(base)).toBe(-1250);
    expect(signedAmountGrosze({ ...base, direction: 'incoming' })).toBe(1250);
  });
});
