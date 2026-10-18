import { fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ApiProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import {
  MOCK_EXPIRED_PAYMENT_REQUEST_ID,
  MOCK_PENDING_PAYMENT_REQUEST_ID,
} from '../api/payments.mock';
import { PaymentRequestScreen } from './PaymentRequestScreen';

const NBSP = ' ';

function openRequest(requestId: string): void {
  jest.mocked(useLocalSearchParams).mockReturnValue({ requestId });
}

describe('PaymentRequestScreen', () => {
  it('fetches the request by id and shows partner, amount, title and expiry', async () => {
    openRequest(MOCK_PENDING_PAYMENT_REQUEST_ID);
    await renderWithProviders(<PaymentRequestScreen />, { signedInAs: 'customer' });

    expect(await screen.findByText('Sklep Demonstracyjny')).toBeOnTheScreen();
    expect(screen.getByText(`89,90${NBSP}zł`)).toBeOnTheScreen();
    expect(screen.getByText('Zamówienie nr 2026/10/0042')).toBeOnTheScreen();
    expect(screen.getByText(/15\.10\.2026/)).toBeOnTheScreen();
    expect(screen.getByText(pl.payment.notice)).toBeOnTheScreen();
  });

  it('approves the payment explicitly and shows the result', async () => {
    openRequest(MOCK_PENDING_PAYMENT_REQUEST_ID);
    const { repositories } = await renderWithProviders(<PaymentRequestScreen />, {
      signedInAs: 'customer',
    });

    await fireEvent.press(await screen.findByRole('button', { name: pl.payment.approve }));

    expect(await screen.findByText(pl.payment.approvedTitle)).toBeOnTheScreen();
    const [account] = await repositories.accounts.listAccounts();
    expect(account?.balanceGrosze).toBe(1_254_320 - 8_990);
  });

  it('does not pay anything until the customer approves', async () => {
    openRequest(MOCK_PENDING_PAYMENT_REQUEST_ID);
    const { repositories } = await renderWithProviders(<PaymentRequestScreen />, {
      signedInAs: 'customer',
    });

    await screen.findByText('Sklep Demonstracyjny');

    const [account] = await repositories.accounts.listAccounts();
    expect(account?.balanceGrosze).toBe(1_254_320);
  });

  it('rejects the request', async () => {
    openRequest(MOCK_PENDING_PAYMENT_REQUEST_ID);
    await renderWithProviders(<PaymentRequestScreen />, { signedInAs: 'customer' });

    await fireEvent.press(await screen.findByRole('button', { name: pl.payment.reject }));

    expect(await screen.findByText(pl.payment.rejectedTitle)).toBeOnTheScreen();
  });

  it('shows an expired request without approve or reject buttons', async () => {
    openRequest(MOCK_EXPIRED_PAYMENT_REQUEST_ID);
    await renderWithProviders(<PaymentRequestScreen />, { signedInAs: 'customer' });

    expect(await screen.findByText(pl.payment.statusExpired)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: pl.payment.approve })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: pl.payment.reject })).not.toBeOnTheScreen();
  });

  it('shows not found for an unknown id, the same as for someone else’s request', async () => {
    openRequest('00000000-0000-4000-8000-000000009999');
    await renderWithProviders(<PaymentRequestScreen />, { signedInAs: 'customer' });

    expect(await screen.findByText(pl.payment.notFoundTitle)).toBeOnTheScreen();
  });

  it('rejects a link whose id is not a UUID without calling the API', async () => {
    openRequest('12.50;amount=999999');
    const getPaymentRequest = jest.fn();
    await renderWithProviders(<PaymentRequestScreen />, {
      signedInAs: 'customer',
      repositories: (base) => ({ ...base, payments: { ...base.payments, getPaymentRequest } }),
    });

    expect(screen.getByText(pl.payment.invalidLink)).toBeOnTheScreen();
    expect(getPaymentRequest).not.toHaveBeenCalled();
  });

  it('shows a Polish error and a retry when the request cannot be loaded', async () => {
    openRequest(MOCK_PENDING_PAYMENT_REQUEST_ID);
    await renderWithProviders(<PaymentRequestScreen />, {
      signedInAs: 'customer',
      mockOptions: { failWith: new ApiProblem({ status: 503 }) },
    });

    expect(await screen.findByText(pl.errors.server)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: pl.common.retry })).toBeOnTheScreen();
  });

  it('explains a refused approval, for example insufficient funds', async () => {
    openRequest(MOCK_PENDING_PAYMENT_REQUEST_ID);
    await renderWithProviders(<PaymentRequestScreen />, {
      signedInAs: 'customer',
      repositories: (base) => ({
        ...base,
        payments: {
          ...base.payments,
          approvePaymentRequest: () =>
            Promise.reject(new ApiProblem({ status: 422, code: 'insufficient_funds' })),
        },
      }),
    });

    await fireEvent.press(await screen.findByRole('button', { name: pl.payment.approve }));

    expect(await screen.findByText(pl.errors.insufficientFunds)).toBeOnTheScreen();
  });

  it('returns to the dashboard after the result', async () => {
    openRequest(MOCK_PENDING_PAYMENT_REQUEST_ID);
    await renderWithProviders(<PaymentRequestScreen />, { signedInAs: 'customer' });
    await fireEvent.press(await screen.findByRole('button', { name: pl.payment.reject }));

    await fireEvent.press(await screen.findByRole('button', { name: pl.payment.done }));

    expect(useRouter().replace).toHaveBeenCalledWith('/dashboard');
  });
});
