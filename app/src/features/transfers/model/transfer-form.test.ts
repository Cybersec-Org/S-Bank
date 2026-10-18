import { FAKE_IBANS } from '@/shared/api/mock/mock-data';

import {
  validateTransferForm,
  type SourceAccountContext,
  type TransferFormInput,
} from './transfer-form';

const ACCOUNT: SourceAccountContext = {
  balanceGrosze: 1_000_000,
  remainingDailyLimitGrosze: 380_000,
  blocked: false,
};

function buildInput(overrides: Partial<TransferFormInput> = {}): TransferFormInput {
  return {
    sourceAccountId: 'acc-1',
    recipientName: 'Jan Przykładowy',
    iban: FAKE_IBANS.recipientJan,
    amount: '150,00',
    title: 'Zwrot za bilety',
    ...overrides,
  };
}

describe('validateTransferForm', () => {
  it('accepts a valid form and builds the draft input in grosze with a normalized IBAN', () => {
    const result = validateTransferForm(
      buildInput({ iban: 'pl42 1234 5678 0000 0000 0000 0003', recipientName: '  Jan  ' }),
      ACCOUNT,
    );

    expect(result.errors).toEqual({});
    expect(result.draftInput).toEqual({
      sourceAccountId: 'acc-1',
      recipientName: 'Jan',
      recipientIban: FAKE_IBANS.recipientJan,
      title: 'Zwrot za bilety',
      amountGrosze: 15_000,
    });
  });

  it('requires a recipient name and a title', () => {
    const result = validateTransferForm(buildInput({ recipientName: ' ', title: '' }), ACCOUNT);

    expect(result.errors).toMatchObject({
      recipientName: 'recipientRequired',
      title: 'titleRequired',
    });
    expect(result.draftInput).toBeNull();
  });

  it('rejects an IBAN with a wrong checksum', () => {
    const result = validateTransferForm(
      buildInput({ iban: 'PL00123456780000000000000003' }),
      ACCOUNT,
    );

    expect(result.errors.iban).toBe('ibanInvalid');
  });

  it.each(['', '0', '0,00', 'abc', '-5', '10,999'])('rejects the amount "%s"', (amount) => {
    const result = validateTransferForm(buildInput({ amount }), ACCOUNT);

    expect(result.errors.amount).toBe('amountInvalid');
    expect(result.amountGrosze).toBeNull();
  });

  it('warns when the amount exceeds the balance', () => {
    const result = validateTransferForm(buildInput({ amount: '10 000,01' }), ACCOUNT);

    expect(result.errors.amount).toBe('amountExceedsBalance');
  });

  it('warns when the amount exceeds the remaining daily limit', () => {
    const result = validateTransferForm(buildInput({ amount: '3 800,01' }), ACCOUNT);

    expect(result.errors.amount).toBe('amountExceedsLimit');
  });

  it('accepts exactly the remaining limit', () => {
    const result = validateTransferForm(buildInput({ amount: '3 800,00' }), ACCOUNT);

    expect(result.errors.amount).toBeUndefined();
  });

  it('flags a blocked source account', () => {
    const result = validateTransferForm(buildInput(), { ...ACCOUNT, blocked: true });

    expect(result.errors.account).toBe('accountBlocked');
    expect(result.draftInput).toBeNull();
  });

  it('still validates the rest of the form when the account is not known yet', () => {
    const result = validateTransferForm(buildInput(), null);

    expect(result.errors).toEqual({});
  });
});
