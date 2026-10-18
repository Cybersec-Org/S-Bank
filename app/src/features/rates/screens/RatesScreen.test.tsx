import { fireEvent, screen } from '@testing-library/react-native';

import { ApiProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import { RatesScreen } from './RatesScreen';

const NBSP = ' ';

describe('RatesScreen', () => {
  it('is usable without signing in and lists the NBP table A rates', async () => {
    await renderWithProviders(<RatesScreen />);

    expect(await screen.findByText(pl.rates.source)).toBeOnTheScreen();
    expect(screen.getByText('4,2315')).toBeOnTheScreen();
    ['EUR', 'USD', 'CHF', 'GBP', 'CZK'].forEach((code) => {
      expect(screen.getByLabelText(new RegExp(`^${code},`))).toBeOnTheScreen();
    });
    expect(screen.getByText(pl.rates.effectiveDate('15.10.2026'))).toBeOnTheScreen();
  });

  it('converts an amount in zloty at the mid rate of the chosen currency', async () => {
    await renderWithProviders(<RatesScreen />);
    await screen.findByText(pl.rates.source);

    await fireEvent.changeText(screen.getByLabelText(pl.rates.amountLabel), '1000');

    expect(screen.getByText(pl.rates.result(`236,32${NBSP}EUR`))).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'USD' }));

    expect(screen.getByText(pl.rates.result(`255,62${NBSP}USD`))).toBeOnTheScreen();
  });

  it('explains an invalid amount and shows no result', async () => {
    await renderWithProviders(<RatesScreen />);
    await screen.findByText(pl.rates.source);

    await fireEvent.changeText(screen.getByLabelText(pl.rates.amountLabel), 'dużo');

    expect(
      screen.getByText(`${pl.common.fieldError}: ${pl.rates.amountInvalid}`),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/otrzymasz około/)).not.toBeOnTheScreen();
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
