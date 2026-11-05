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

const PAY_LABEL = pl.payment.pay(`249,00${NBSP}zł`);

describe('PaymentRequestScreen', () => {
  it('fetches the request by id and shows partner, amount, title and account', async () => {
    openRequest(MOCK_PENDING_PAYMENT_REQUEST_ID);
    await renderWithProviders(<PaymentRequestScreen />, { signedInAs: 'customer' });

    expect(await screen.findByText('Sklep Rowerowy Szprycha')).toBeOnTheScreen();
    expect(screen.getByText(pl.payment.partnerBadge)).toBeOnTheScreen();
    expect(screen.getAllByText(`249,00${NBSP}zł`)).not.toHaveLength(0);
    expect(screen.getByText('Zamówienie nr 1042')).toBeOnTheScreen();
    expect(
      await screen.findByText(pl.transferConfirm.fromValue('Osobisty', '•••• 4821')),
    ).toBeOnTheScreen();
    expect(screen.getByText(pl.payment.notice)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: pl.payment.backLabel })).toBeOnTheScreen();
  });

  it('shows how it was opened and a live expiry counter', async () => {
    openRequest(MOCK_PENDING_PAYMENT_REQUEST_ID);
    jest.mocked(useLocalSearchParams).mockReturnValue({
      requestId: MOCK_PENDING_PAYMENT_REQUEST_ID,
      source: 'qr',
    });
    await renderWithProviders(<PaymentRequestScreen />, { signedInAs: 'customer' });

    expect(await screen.findByLabelText(pl.payment.openedFromQr)).toBeOnTheScreen();
    expect(screen.getByLabelText(pl.payment.expiresIn(14))).toBeOnTheScreen();
  });

  it('says "z linku" when no source is given', async () => {
    openRequest(MOCK_PENDING_PAYMENT_REQUEST_ID);
    await renderWithProviders(<PaymentRequestScreen />, { signedInAs: 'customer' });

    expect(await screen.findByLabelText(pl.payment.openedFromLink)).toBeOnTheScreen();
  });

  it('ignores an amount or recipient smuggled into the link', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({
      requestId: MOCK_PENDING_PAYMENT_REQUEST_ID,
      amount: '1',
      to: 'PL00',
    });
    await renderWithProviders(<PaymentRequestScreen />, { signedInAs: 'customer' });

    expect(await screen.findByText('Sklep Rowerowy Szprycha')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: PAY_LABEL })).toBeOnTheScreen();
  });

  it('approves the payment explicitly and shows the result', async () => {
    openRequest(MOCK_PENDING_PAYMENT_REQUEST_ID);
    const { repositories } = await renderWithProviders(<PaymentRequestScreen />, {
      signedInAs: 'customer',
    });

    await fireEvent.press(await screen.findByRole('button', { name: PAY_LABEL }));

    expect(await screen.findByText(pl.payment.approvedTitle)).toBeOnTheScreen();
    const [account] = await repositories.accounts.listAccounts();
    expect(account?.balanceGrosze).toBe(428_015 - 24_900);
  });

  it('does not pay anything until the customer approves', async () => {
    openRequest(MOCK_PENDING_PAYMENT_REQUEST_ID);
    const { repositories } = await renderWithProviders(<PaymentRequestScreen />, {
      signedInAs: 'customer',
    });

    await screen.findByText('Sklep Rowerowy Szprycha');

    const [account] = await repositories.accounts.listAccounts();
    expect(account?.balanceGrosze).toBe(428_015);
  });

  it('sends a payment from 1 000 zł through the passkey step-up, like a transfer', async () => {
    openRequest(MOCK_PENDING_PAYMENT_REQUEST_ID);
    const { store } = await renderWithProviders(<PaymentRequestScreen />, {
      signedInAs: 'customer',
      repositories: (base) => ({
        ...base,
        payments: {
          ...base.payments,
          getPaymentRequest: async (requestId) => ({
            ...(await base.payments.getPaymentRequest(requestId)),
            amountGrosze: 150_000,
          }),
        },
      }),
    });

    expect(await screen.findByText(pl.payment.stepUpHeading)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: pl.payment.payWithPasskey }));

    expect(await screen.findByText(pl.payment.approvedTitle)).toBeOnTheScreen();
    const state = store.getState();
    expect(state.status === 'signedIn' && state.principal.acr).toBe('2');
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
    expect(screen.queryByRole('button', { name: PAY_LABEL })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Zapłać/ })).not.toBeOnTheScreen();
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

    await fireEvent.press(await screen.findByRole('button', { name: PAY_LABEL }));

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
