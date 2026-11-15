import { fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ApiProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import { MOCK_CUSTOMER_ANNA_ID } from '../api/employee.mock';
import { EmployeeShell } from '../components/EmployeeShell';
import { CustomerDetailsScreen } from './CustomerDetailsScreen';
import { CustomerSearchScreen } from './CustomerSearchScreen';

const NBSP = '\u00A0';

describe('CustomerSearchScreen', () => {
  it('finds customers by name and opens one by id', async () => {
    await renderWithProviders(<CustomerSearchScreen />, { signedInAs: 'employee' });

    await fireEvent.changeText(screen.getByLabelText(pl.employee.searchLabel), 'anna');
    await fireEvent.press(screen.getByRole('button', { name: pl.employee.searchSubmit }));
    await fireEvent.press(
      await screen.findByRole('button', { name: pl.employee.openCustomer('Anna Nowak') }),
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

  it('is read-only: shows the banner, the customer card, the account and no transfer action', async () => {
    await renderWithProviders(<CustomerDetailsScreen />, { signedInAs: 'employee' });

    expect(await screen.findByText('Anna Nowak')).toBeOnTheScreen();
    expect(screen.getByText(pl.employee.readOnlyBannerTitle)).toBeOnTheScreen();
    expect(
      screen.getByText(pl.employee.customerMeta('anna.nowak@example.com', 1007)),
    ).toBeOnTheScreen();
    expect(screen.getByText(pl.employee.statusActive)).toBeOnTheScreen();
    expect(screen.getByText(pl.employee.accountRow('Osobisty', '•••• 4821'))).toBeOnTheScreen();
    expect(screen.getByText(`4${NBSP}280,15${NBSP}zł`)).toBeOnTheScreen();
    expect(screen.getByText(`5${NBSP}000${NBSP}zł`)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /przelew/i })).not.toBeOnTheScreen();
  });

  it('shows the same four operations as the dashboard, with table dates', async () => {
    await renderWithProviders(<CustomerDetailsScreen />, { signedInAs: 'employee' });

    expect(await screen.findByText('Wynagrodzenie')).toBeOnTheScreen();
    expect(screen.getByText('8.10.2026')).toBeOnTheScreen();
    expect(screen.getByText('2.10.2026')).toBeOnTheScreen();
    expect(screen.getByText('Płatność z linku')).toBeOnTheScreen();
    expect(screen.getByText(`\u2212249,00${NBSP}zł`)).toBeOnTheScreen();
    expect(screen.getByText(`+5${NBSP}400,00${NBSP}zł`)).toBeOnTheScreen();
  });

  it('asks for confirmation before blocking, and unblocks afterwards', async () => {
    const { repositories } = await renderWithProviders(<CustomerDetailsScreen />, {
      signedInAs: 'employee',
    });

    await fireEvent.press(await screen.findByRole('button', { name: /^Zablokuj rachunek/ }));
    expect(screen.getByText(pl.employee.blockDialogTitle)).toBeOnTheScreen();
    const before = await repositories.employee.getCustomerDetails(MOCK_CUSTOMER_ANNA_ID);
    expect(before.accounts[0]?.status).toBe('active');

    await fireEvent.press(screen.getAllByRole('button', { name: pl.employee.block })[0] as never);
    expect(await screen.findByText(pl.employee.statusBlocked)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /^Odblokuj rachunek/ }));
    expect(screen.getByText(pl.employee.unblockDialogTitle)).toBeOnTheScreen();
  });

  it('does not block when the dialog is cancelled', async () => {
    await renderWithProviders(<CustomerDetailsScreen />, { signedInAs: 'employee' });

    await fireEvent.press(await screen.findByRole('button', { name: /^Zablokuj rachunek/ }));
    await fireEvent.press(screen.getByRole('button', { name: pl.common.cancel }));

    expect(screen.getByText(pl.employee.statusActive)).toBeOnTheScreen();
  });

  it('rejects a limit outside the allowed range and accepts one inside it', async () => {
    await renderWithProviders(<CustomerDetailsScreen />, { signedInAs: 'employee' });

    await fireEvent.press(await screen.findByRole('button', { name: /^Zmień limit/ }));
    await fireEvent.changeText(screen.getByLabelText(pl.employee.limitInputLabel), '50');
    await fireEvent.press(screen.getByRole('button', { name: pl.employee.limitSave }));
    expect(
      screen.getByText(`${pl.common.fieldError}: ${pl.employee.limitInvalid}`),
    ).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText(pl.employee.limitInputLabel), '3000');
    await fireEvent.press(screen.getByRole('button', { name: pl.employee.limitSave }));
    expect(await screen.findByText(pl.employee.limitSaved)).toBeOnTheScreen();
    expect(await screen.findByText(`3${NBSP}000${NBSP}zł`)).toBeOnTheScreen();
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

describe('EmployeeShell', () => {
  it('shows the top bar, the passkey chip, the employee name and the menu with locked items', async () => {
    await renderWithProviders(
      <EmployeeShell>
        <></>
      </EmployeeShell>,
      { signedInAs: 'employee' },
    );

    expect(screen.getByText(pl.employee.panelLabel)).toBeOnTheScreen();
    expect(screen.getByText(pl.employee.signedInWithPasskey)).toBeOnTheScreen();
    expect(screen.getByText('Katarzyna Zielińska')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: pl.employee.menuCustomers })).toBeSelected();
    expect(
      screen.getByRole('button', { name: `${pl.employee.menuAudit}, ${pl.employee.adminOnly}` }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: `${pl.employee.menuPartners}, ${pl.employee.adminOnly}` }),
    ).toBeDisabled();
  });

  it('signs out and returns to the login screen', async () => {
    const { store } = await renderWithProviders(
      <EmployeeShell>
        <></>
      </EmployeeShell>,
      { signedInAs: 'employee' },
    );

    await fireEvent.press(screen.getByRole('button', { name: pl.nav.signOutLabel }));

    expect(store.getState().status).toBe('signedOut');
    expect(useRouter().replace).toHaveBeenCalledWith('/');
  });
});
