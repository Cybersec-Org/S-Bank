import { fireEvent, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { FAKE_IBANS } from '@/shared/api/mock/mock-data';
import { ApiProblem } from '@/shared/api/problem';
import { formatIban } from '@/shared/lib/iban';
import { pl } from '@/shared/i18n/pl';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import { TransferFormScreen } from './TransferFormScreen';

const NBSP = '\u00A0';
const SOURCE_SUMMARY = pl.transfer.sourceSummary('Osobisty', '•••• 4821');

async function fillValidForm(amount = '150,00'): Promise<void> {
  await fireEvent.changeText(
    screen.getByLabelText(pl.transfer.recipientNameLabel),
    'Jan Przykładowy',
  );
  await fireEvent.changeText(screen.getByLabelText(pl.transfer.ibanLabel), FAKE_IBANS.recipientJan);
  await fireEvent.changeText(screen.getByLabelText(pl.transfer.amountLabel), amount);
  await fireEvent.changeText(screen.getByLabelText(pl.transfer.titleLabel), 'Zwrot za bilety');
}

describe('TransferFormScreen', () => {
  it('shows the back arrow, the source account card and its available balance', async () => {
    await renderWithProviders(<TransferFormScreen />, { signedInAs: 'customer' });

    expect(await screen.findByText(SOURCE_SUMMARY)).toBeOnTheScreen();
    expect(
      screen.getByText(pl.transfer.availableBalance(`4${NBSP}280,15${NBSP}zł`)),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: pl.transfer.backLabel })).toBeOnTheScreen();
  });

  it('goes back to the dashboard with the arrow', async () => {
    await renderWithProviders(<TransferFormScreen />, { signedInAs: 'customer' });

    await fireEvent.press(screen.getByRole('button', { name: pl.transfer.backLabel }));

    expect(useRouter().back).toHaveBeenCalled();
  });

  it('shows inline errors for an empty form only after the first submit attempt', async () => {
    await renderWithProviders(<TransferFormScreen />, { signedInAs: 'customer' });
    await screen.findByText(SOURCE_SUMMARY);
    expect(
      screen.queryByText(`${pl.common.fieldError}: ${pl.transfer.errorIbanInvalid}`),
    ).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: pl.transfer.submit }));

    expect(
      screen.getByText(`${pl.common.fieldError}: ${pl.transfer.errorIbanInvalid}`),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(`${pl.common.fieldError}: ${pl.transfer.errorAmountInvalid}`),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(`${pl.common.fieldError}: ${pl.transfer.errorRecipientRequired}`),
    ).toBeOnTheScreen();
    expect(useRouter().push).not.toHaveBeenCalled();
  });

  it('rejects an IBAN with a wrong checksum', async () => {
    await renderWithProviders(<TransferFormScreen />, { signedInAs: 'customer' });
    await screen.findByText(SOURCE_SUMMARY);
    await fillValidForm();
    await fireEvent.changeText(
      screen.getByLabelText(pl.transfer.ibanLabel),
      'PL00123456780000000000000003',
    );

    await fireEvent.press(screen.getByRole('button', { name: pl.transfer.submit }));

    expect(
      screen.getByText(`${pl.common.fieldError}: ${pl.transfer.errorIbanInvalid}`),
    ).toBeOnTheScreen();
  });

  it('warns when the amount is above the available balance', async () => {
    await renderWithProviders(<TransferFormScreen />, { signedInAs: 'customer' });
    await screen.findByText(SOURCE_SUMMARY);
    await fillValidForm('4 500,00');

    await fireEvent.press(screen.getByRole('button', { name: pl.transfer.submit }));

    expect(
      screen.getByText(`${pl.common.fieldError}: ${pl.transfer.errorAmountExceedsBalance}`),
    ).toBeOnTheScreen();
  });

  it('announces the step-up requirement from 1 000 zł while typing', async () => {
    await renderWithProviders(<TransferFormScreen />, { signedInAs: 'customer' });
    await screen.findByText(SOURCE_SUMMARY);

    await fireEvent.changeText(screen.getByLabelText(pl.transfer.amountLabel), '999,99');
    expect(screen.queryByText(pl.transfer.stepUpNoticeTitle)).not.toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText(pl.transfer.amountLabel), '1000');
    expect(screen.getByText(pl.transfer.stepUpNoticeTitle)).toBeOnTheScreen();
    expect(screen.getByText(pl.transfer.stepUpNoticeBody)).toBeOnTheScreen();
  });

  it('updates the daily limit bar live with the typed amount', async () => {
    await renderWithProviders(<TransferFormScreen />, { signedInAs: 'customer' });
    await screen.findByText(SOURCE_SUMMARY);
    expect(
      screen.getByText(pl.transfer.limitAfterValue(`0${NBSP}zł`, `5${NBSP}000${NBSP}zł`)),
    ).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText(pl.transfer.amountLabel), '1250,00');

    expect(
      screen.getByText(pl.transfer.limitAfterValue(`1${NBSP}250${NBSP}zł`, `5${NBSP}000${NBSP}zł`)),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('progressbar', { name: pl.transfer.limitBarLabel(25) }),
    ).toBeOnTheScreen();
  });

  it('groups the account number in blocks of four and adds PL to digits typed on a numeric keypad', async () => {
    await renderWithProviders(<TransferFormScreen />, { signedInAs: 'customer' });
    await screen.findByText(SOURCE_SUMMARY);

    await fireEvent.changeText(
      screen.getByLabelText(pl.transfer.ibanLabel),
      '61109010140000071219812874',
    );

    expect(screen.getByLabelText(pl.transfer.ibanLabel)).toHaveDisplayValue(
      'PL61 1090 1014 0000 0712 1981 2874',
    );
  });

  it('turns a typed dot into the decimal comma in the amount', async () => {
    await renderWithProviders(<TransferFormScreen />, { signedInAs: 'customer' });
    await screen.findByText(SOURCE_SUMMARY);

    await fireEvent.changeText(screen.getByLabelText(pl.transfer.amountLabel), '12.50');

    expect(screen.getByLabelText(pl.transfer.amountLabel)).toHaveDisplayValue('12,50');
  });

  it('fills the recipient fields from a saved recipient', async () => {
    await renderWithProviders(<TransferFormScreen />, { signedInAs: 'customer' });
    await screen.findByText(SOURCE_SUMMARY);

    await fireEvent.press(await screen.findByRole('radio', { name: 'Maria Demonstracyjna' }));

    expect(screen.getByLabelText(pl.transfer.recipientNameLabel)).toHaveDisplayValue(
      'Maria Demonstracyjna',
    );
    expect(screen.getByLabelText(pl.transfer.ibanLabel)).toHaveDisplayValue(
      formatIban(FAKE_IBANS.recipientMaria),
    );
  });

  it('saves a draft on the server and continues with the draft id only', async () => {
    await renderWithProviders(<TransferFormScreen />, { signedInAs: 'customer' });
    await screen.findByText(SOURCE_SUMMARY);
    await fillValidForm();

    await fireEvent.press(screen.getByRole('button', { name: pl.transfer.submit }));

    await screen.findByRole('button', { name: pl.transfer.submit });
    expect(useRouter().push).toHaveBeenCalledTimes(1);
    expect(useRouter().push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/transfer/[draftId]' }),
    );
  });

  it('shows the server problem in Polish and stays on the form', async () => {
    await renderWithProviders(<TransferFormScreen />, {
      signedInAs: 'customer',
      repositories: (base) => ({
        ...base,
        transfers: {
          ...base.transfers,
          createDraft: () => Promise.reject(new ApiProblem({ status: 422, code: 'invalid_iban' })),
        },
      }),
    });
    await screen.findByText(SOURCE_SUMMARY);
    await fillValidForm();

    await fireEvent.press(screen.getByRole('button', { name: pl.transfer.submit }));

    expect(await screen.findByText(pl.errors.invalidIban)).toBeOnTheScreen();
    expect(useRouter().push).not.toHaveBeenCalled();
  });

  it('shows the empty state when there is no account to send from', async () => {
    await renderWithProviders(<TransferFormScreen />, {
      signedInAs: 'customer',
      mockOptions: { empty: true },
    });

    expect(await screen.findByText(pl.transfer.noAccountsTitle)).toBeOnTheScreen();
  });

  it('shows an error state when accounts cannot be loaded', async () => {
    await renderWithProviders(<TransferFormScreen />, {
      signedInAs: 'customer',
      mockOptions: { failWith: new ApiProblem({ status: 500 }) },
    });

    expect(await screen.findByText(pl.errors.server)).toBeOnTheScreen();
  });
});
