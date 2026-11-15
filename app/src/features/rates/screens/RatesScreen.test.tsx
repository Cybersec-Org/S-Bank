import { fireEvent, screen } from '@testing-library/react-native';

import { ApiProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import { RatesScreen } from './RatesScreen';

const NBSP = ' ';

describe('RatesScreen', () => {
  it('is usable without signing in and lists the NBP table A rates', async () => {
    await renderWithProviders(<RatesScreen />);

    expect(await screen.findByText(pl.rates.publicEndpoint)).toBeOnTheScreen();
    expect(
      screen.getByText(pl.rates.subtitle('196/A/NBP/2026', '8 października 2026')),
    ).toBeOnTheScreen();
    expect(screen.getByText(`4,3789 zł`)).toBeOnTheScreen();
    expect(screen.getByText(`0,1794 zł`)).toBeOnTheScreen();
    ['EUR', 'USD', 'CHF', 'GBP', 'CZK'].forEach((code) => {
      expect(screen.getByLabelText(new RegExp(`^${code},`))).toBeOnTheScreen();
    });
  });

  it('mentions the public API endpoint', async () => {
    await renderWithProviders(<RatesScreen />);

    expect(await screen.findByText(pl.rates.publicEndpoint)).toBeOnTheScreen();
  });

  it('starts the converter empty for a guest', async () => {
    await renderWithProviders(<RatesScreen />);
    await screen.findByText(pl.rates.publicEndpoint);

    expect(screen.getByLabelText(pl.rates.amountLabel)).toHaveDisplayValue('');
    expect(screen.queryByLabelText(/^To około/)).not.toBeOnTheScreen();
  });

  it('starts the converter with the balance of the signed-in customer', async () => {
    await renderWithProviders(<RatesScreen defaultAmountGrosze={428_015} />, {
      signedInAs: 'customer',
    });
    await screen.findByText(pl.rates.publicEndpoint);

    expect(screen.getByLabelText(pl.rates.amountLabel)).toHaveDisplayValue('4280,15');
    expect(screen.getByLabelText(pl.rates.resultAccessible(`977,45${NBSP}EUR`))).toBeOnTheScreen();
  });

  it('converts an amount in zloty at the mid rate of the chosen currency', async () => {
    await renderWithProviders(<RatesScreen />);
    await screen.findByText(pl.rates.publicEndpoint);

    await fireEvent.changeText(screen.getByLabelText(pl.rates.amountLabel), '1000');

    expect(screen.getByLabelText(pl.rates.resultAccessible(`228,37${NBSP}EUR`))).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: `${pl.rates.currencyLabel}: EUR` }));
    await fireEvent.press(
      screen.getByRole('radio', { name: pl.rates.currencyOption('USD', 'dolar amerykański') }),
    );

    expect(screen.getByLabelText(pl.rates.resultAccessible(`255,55${NBSP}USD`))).toBeOnTheScreen();
  });

  it('explains an invalid amount and shows no result', async () => {
    await renderWithProviders(<RatesScreen />);
    await screen.findByText(pl.rates.publicEndpoint);

    await fireEvent.changeText(screen.getByLabelText(pl.rates.amountLabel), 'dużo');

    expect(
      screen.getByText(`${pl.common.fieldError}: ${pl.rates.amountInvalid}`),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^To około/)).not.toBeOnTheScreen();
  });

  it('offers a way back to the login screen for guests only', async () => {
    const onBack = jest.fn();
    await renderWithProviders(<RatesScreen onBack={onBack} />);
    await screen.findByText(pl.rates.publicEndpoint);

    await fireEvent.press(screen.getByRole('button', { name: pl.rates.backToLogin }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when the table has no rates', async () => {
    await renderWithProviders(<RatesScreen />, { mockOptions: { empty: true } });

    expect(await screen.findByText(pl.rates.emptyTitle)).toBeOnTheScreen();
  });

  it('shows a Polish error when the rates cannot be loaded', async () => {
    await renderWithProviders(<RatesScreen />, {
      mockOptions: { failWith: new ApiProblem({ status: 502 }) },
    });

    expect(await screen.findByText(pl.errors.server)).toBeOnTheScreen();
  });

  it('shows a loading state first', async () => {
    let finish: () => void = () => undefined;
    const pending = new Promise<never>((_resolve, reject) => {
      finish = () => reject(new ApiProblem({ status: 500 }));
    });
    await renderWithProviders(<RatesScreen />, {
      repositories: (base) => ({ ...base, rates: { getRatesTable: () => pending } }),
    });

    expect(screen.getByLabelText(pl.common.loading)).toBeOnTheScreen();

    finish();

    expect(await screen.findByText(pl.errors.server)).toBeOnTheScreen();
  });
});
