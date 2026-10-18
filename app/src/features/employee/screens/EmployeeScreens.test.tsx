import { fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ApiProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import { MOCK_CUSTOMER_ANNA_ID } from '../api/employee.mock';
import { CustomerDetailsScreen } from './CustomerDetailsScreen';
import { CustomerSearchScreen } from './CustomerSearchScreen';

describe('CustomerSearchScreen', () => {
  it('finds customers by name and opens one by id', async () => {
    await renderWithProviders(<CustomerSearchScreen />, { signedInAs: 'employee' });

    await fireEvent.changeText(screen.getByLabelText(pl.employee.searchLabel), 'anna');
    await fireEvent.press(screen.getByRole('button', { name: pl.employee.searchSubmit }));
    await fireEvent.press(
      await screen.findByRole('button', { name: pl.employee.openCustomer('Anna Testowa') }),
    );

    expect(useRouter().push).toHaveBeenCalledWith({
      pathname: '/customers/[customerId]',
      params: { customerId: MOCK_CUSTOMER_ANNA_ID },
    });
  });

  it('asks for at least two characters', async () => {
    await renderWithProviders(<CustomerSearchScreen />, { signedInAs: 'employee' });

    await fireEvent.changeText(screen.getByLabelText(pl.employee.searchLabel), 'a');
    await fireEvent.press(screen.getByRole('button', { name: pl.employee.searchSubmit }));

    expect(screen.getByText(pl.employee.searchTooShort)).toBeOnTheScreen();
  });

  it('shows the empty state when nobody matches', async () => {
    await renderWithProviders(<CustomerSearchScreen />, { signedInAs: 'employee' });

    await fireEvent.changeText(screen.getByLabelText(pl.employee.searchLabel), 'nikt');
    await fireEvent.press(screen.getByRole('button', { name: pl.employee.searchSubmit }));

    expect(await screen.findByText(pl.employee.resultsEmptyTitle)).toBeOnTheScreen();
  });

  it('shows a Polish error when the search fails', async () => {
    await renderWithProviders(<CustomerSearchScreen />, {
      signedInAs: 'employee',
      mockOptions: { failWith: new ApiProblem({ status: 500 }) },
    });

    await fireEvent.changeText(screen.getByLabelText(pl.employee.searchLabel), 'anna');
    await fireEvent.press(screen.getByRole('button', { name: pl.employee.searchSubmit }));

    expect(await screen.findByText(pl.errors.server)).toBeOnTheScreen();
  });
});

describe('CustomerDetailsScreen', () => {
  beforeEach(() => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ customerId: MOCK_CUSTOMER_ANNA_ID });
  });

  it('is read-only: shows the banner, the account and no transfer action', async () => {
    await renderWithProviders(<CustomerDetailsScreen />, { signedInAs: 'employee' });

    expect(await screen.findByText('Anna Testowa')).toBeOnTheScreen();
    expect(screen.getByText(pl.employee.readOnlyBannerTitle)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: pl.employee.block })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /przelew/i })).not.toBeOnTheScreen();
  });

  it('blocks and unblocks the account', async () => {
    await renderWithProviders(<CustomerDetailsScreen />, { signedInAs: 'employee' });

    await fireEvent.press(await screen.findByRole('button', { name: pl.employee.block }));
    expect(await screen.findByRole('button', { name: pl.employee.unblock })).toBeOnTheScreen();
  });

  it('rejects a limit outside the allowed range and accepts one inside it', async () => {
    await renderWithProviders(<CustomerDetailsScreen />, { signedInAs: 'employee' });
    await screen.findByText('Anna Testowa');

    await fireEvent.changeText(screen.getByLabelText(pl.employee.limitInputLabel), '50');
    await fireEvent.press(screen.getByRole('button', { name: pl.employee.limitChange }));
    expect(
      screen.getByText(`${pl.common.fieldError}: ${pl.employee.limitInvalid}`),
    ).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText(pl.employee.limitInputLabel), '3000');
    await fireEvent.press(screen.getByRole('button', { name: pl.employee.limitChange }));
    expect(await screen.findByText(pl.employee.limitSaved)).toBeOnTheScreen();
  });

  it('shows not found for an unknown customer id', async () => {
    jest
      .mocked(useLocalSearchParams)
      .mockReturnValue({ customerId: '00000000-0000-4000-8000-000000009999' });
    await renderWithProviders(<CustomerDetailsScreen />, { signedInAs: 'employee' });

    expect(await screen.findByText(pl.employee.notFoundTitle)).toBeOnTheScreen();
  });

  it('rejects a malformed customer id without calling the API', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ customerId: '1 OR 1=1' });
    const getCustomerDetails = jest.fn();
    await renderWithProviders(<CustomerDetailsScreen />, {
      signedInAs: 'employee',
      repositories: (base) => ({ ...base, employee: { ...base.employee, getCustomerDetails } }),
    });

    expect(screen.getByText(pl.employee.invalidLink)).toBeOnTheScreen();
    expect(getCustomerDetails).not.toHaveBeenCalled();
  });
});
