/** Fixed "now" of the demo so mock dates, expiries and tests never depend on the real clock. */
export const MOCK_NOW_ISO = '2026-10-15T09:00:00.000Z';

/** Valid (mod-97) but obviously fake Polish IBANs in a made-up bank range 1234 5678. */
export const FAKE_IBANS = {
  customerMain: 'PL96123456780000000000000001',
  customerSavings: 'PL69123456780000000000000002',
  recipientJan: 'PL42123456780000000000000003',
  recipientOffice: 'PL15123456780000000000000004',
  recipientMaria: 'PL85123456780000000000000005',
  customerPiotr: 'PL58123456780000000000000006',
  customerZofia: 'PL31123456780000000000000007',
  partnerShop: 'PL04123456780000000000000008',
} as const;

/** Builds a v4-shaped UUID from a number, giving deterministic ids for mock records. */
export function mockUuid(sequence: number): string {
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
}

export const MOCK_MAIN_ACCOUNT_ID = mockUuid(101);
