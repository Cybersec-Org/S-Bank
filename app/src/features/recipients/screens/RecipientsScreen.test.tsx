import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { FAKE_IBANS } from '@/shared/api/mock/mock-data';
import { ApiProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import { RecipientsScreen } from './RecipientsScreen';

describe('RecipientsScreen', () => {
  it('lists saved recipients with masked IBANs', async () => {
    await renderWithProviders(<RecipientsScreen />, { signedInAs: 'customer' });

    expect(await screen.findByText('Jan Przykładowy')).toBeOnTheScreen();
    expect(screen.getByText('Biuro Testowe Sp. z o.o.')).toBeOnTheScreen();
    expect(screen.getByText('Maria Demonstracyjna')).toBeOnTheScreen();
    expect(screen.queryByText(new RegExp(FAKE_IBANS.recipientJan))).not.toBeOnTheScreen();
    expect(screen.getAllByText(/^PL•• •••• •••• •••• •••• •••• 000\d$/)).toHaveLength(3);
  });

  it('shows the empty state with no recipients', async () => {
    await renderWithProviders(<RecipientsScreen />, {
      signedInAs: 'customer',
      mockOptions: { empty: true },
    });

    expect(await screen.findByText(pl.recipients.emptyTitle)).toBeOnTheScreen();
  });

  it('shows a Polish error when loading fails', async () => {
    await renderWithProviders(<RecipientsScreen />, {
      signedInAs: 'customer',
      mockOptions: { failWith: new ApiProblem({ status: 500 }) },
    });

    expect(await screen.findByText(pl.errors.server)).toBeOnTheScreen();
  });

  it('validates the form inline and does not save an invalid recipient', async () => {
    await renderWithProviders(<RecipientsScreen />, { signedInAs: 'customer' });
    await screen.findByText('Jan Przykładowy');

    await fireEvent.press(screen.getByRole('button', { name: pl.recipients.add }));
    await fireEvent.changeText(
      screen.getByLabelText(pl.recipients.ibanLabel),
      'PL00123456780000000000000003',
    );
    await fireEvent.press(screen.getByRole('button', { name: pl.recipients.add }));

    expect(
      screen.getByText(`${pl.common.fieldError}: ${pl.recipients.errorNameRequired}`),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(`${pl.common.fieldError}: ${pl.recipients.errorIbanInvalid}`),
    ).toBeOnTheScreen();
  });

  it('adds a recipient and shows it in the list', async () => {
    await renderWithProviders(<RecipientsScreen />, { signedInAs: 'customer' });
    await screen.findByText('Jan Przykładowy');

    await fireEvent.press(screen.getByRole('button', { name: pl.recipients.add }));
    await fireEvent.changeText(screen.getByLabelText(pl.recipients.nameLabel), 'Zofia Wzorcowa');
    await fireEvent.changeText(
      screen.getByLabelText(pl.recipients.ibanLabel),
      FAKE_IBANS.customerZofia,
    );
    await fireEvent.press(screen.getByRole('button', { name: pl.recipients.add }));

    expect(await screen.findByText('Zofia Wzorcowa')).toBeOnTheScreen();
    expect(screen.queryByLabelText(pl.recipients.nameLabel)).not.toBeOnTheScreen();
  });

  it('edits a recipient', async () => {
    await renderWithProviders(<RecipientsScreen />, { signedInAs: 'customer' });
    await screen.findByText('Jan Przykładowy');

    await fireEvent.press(
      screen.getByRole('button', { name: pl.recipients.editLabel('Jan Przykładowy') }),
    );
    await fireEvent.changeText(screen.getByLabelText(pl.recipients.nameLabel), 'Jan Zmieniony');
    await fireEvent.press(screen.getByRole('button', { name: pl.recipients.saveChanges }));

    expect(await screen.findByText('Jan Zmieniony')).toBeOnTheScreen();
    expect(screen.queryByText('Jan Przykładowy')).not.toBeOnTheScreen();
  });

  it('deletes a recipient', async () => {
    await renderWithProviders(<RecipientsScreen />, { signedInAs: 'customer' });
    await screen.findByText('Maria Demonstracyjna');

    await fireEvent.press(
      screen.getByRole('button', { name: pl.recipients.deleteLabel('Maria Demonstracyjna') }),
    );

    await waitFor(() => {
      expect(screen.queryByText('Maria Demonstracyjna')).not.toBeOnTheScreen();
    });
    expect(screen.getByText('Jan Przykładowy')).toBeOnTheScreen();
  });

  it('goes back to the dashboard when there is no history', async () => {
    jest.mocked(useRouter().canGoBack).mockReturnValue(false);
    await renderWithProviders(<RecipientsScreen />, { signedInAs: 'customer' });
    await screen.findByText('Jan Przykładowy');

    await fireEvent.press(screen.getByRole('button', { name: pl.common.back }));

    expect(useRouter().replace).toHaveBeenCalledWith('/dashboard');
  });
});
