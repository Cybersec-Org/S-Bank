import { fireEvent, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { FAKE_IBANS } from '@/shared/api/mock/mock-data';
import { ApiProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import { TransferFormScreen } from './TransferFormScreen';

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
  it('shows the source account and its available balance', async () => {
    await renderWithProviders(<TransferFormScreen />, { signedInAs: 'customer' });

    expect(await screen.findByRole('radio', { name: 'Konto osobiste' })).toBeSelected();
    expect(screen.getByText(/Dostępne środki: 12.543,20/)).toBeOnTheScreen();
  });

  it('shows inline errors for an empty form only after the first submit attempt', async () => {
    await renderWithProviders(<TransferFormScreen />, { signedInAs: 'customer' });
    await screen.findByRole('radio', { name: 'Konto osobiste' });
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
    await screen.findByRole('radio', { name: 'Konto osobiste' });
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

  it('warns when the amount is above the remaining daily limit', async () => {
    await renderWithProviders(<TransferFormScreen />, { signedInAs: 'customer' });
    await screen.findByRole('radio', { name: 'Konto osobiste' });
    await fillValidForm('4 000,00');

    await fireEvent.press(screen.getByRole('button', { name: pl.transfer.submit }));

    expect(
      screen.getByText(`${pl.common.fieldError}: ${pl.transfer.errorAmountExceedsLimit}`),
    ).toBeOnTheScreen();
  });

  it('announces the step-up requirement from 1 000 zł while typing', async () => {
    await renderWithProviders(<TransferFormScreen />, { signedInAs: 'customer' });
    await screen.findByRole('radio', { name: 'Konto osobiste' });

    await fireEvent.changeText(screen.getByLabelText(pl.transfer.amountLabel), '999,99');
    expect(screen.queryByText(pl.transfer.stepUpNotice)).not.toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText(pl.transfer.amountLabel), '1000');
    expect(screen.getByText(pl.transfer.stepUpNotice)).toBeOnTheScreen();
  });

  it('fills the recipient fields from a saved recipient', async () => {
    await renderWithProviders(<TransferFormScreen />, { signedInAs: 'customer' });
    await screen.findByRole('radio', { name: 'Konto osobiste' });

    await fireEvent.press(await screen.findByRole('radio', { name: 'Maria Demonstracyjna' }));

    expect(screen.getByLabelText(pl.transfer.recipientNameLabel)).toHaveDisplayValue(
      'Maria Demonstracyjna',
    );
    expect(screen.getByLabelText(pl.transfer.ibanLabel)).toHaveDisplayValue(
      FAKE_IBANS.recipientMaria,
    );
  });

  it('saves a draft on the server and continues with the draft id only', async () => {
    await renderWithProviders(<TransferFormScreen />, { signedInAs: 'customer' });
    await screen.findByRole('radio', { name: 'Konto osobiste' });
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
    await screen.findByRole('radio', { name: 'Konto osobiste' });
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
