import { FAKE_IBANS } from '@/shared/api/mock/mock-data';

import { toNormalizedRecipientInput, validateRecipientInput } from './recipient';

describe('validateRecipientInput', () => {
  it('accepts a name and a valid IBAN', () => {
    expect(validateRecipientInput({ name: 'Jan', iban: FAKE_IBANS.recipientJan })).toEqual([]);
  });

  it('reports every problem at once', () => {
    expect(validateRecipientInput({ name: '  ', iban: 'PL00' })).toEqual([
      'nameRequired',
      'ibanInvalid',
    ]);
  });
});

describe('toNormalizedRecipientInput', () => {
  it('trims the name and normalizes the IBAN', () => {
    expect(
      toNormalizedRecipientInput({ name: ' Jan ', iban: 'pl42 1234 5678 0000 0000 0000 0003' }),
    ).toEqual({ name: 'Jan', iban: FAKE_IBANS.recipientJan });
  });
});
