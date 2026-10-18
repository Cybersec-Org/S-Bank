import { fireEvent, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { pl } from '@/shared/i18n/pl';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import { MOCK_PENDING_PAYMENT_REQUEST_ID } from '../api/payments.mock';
import { ScanScreen } from './ScanScreen';

describe('ScanScreen', () => {
  it('shows the scanner placeholder and the camera rationale', async () => {
    await renderWithProviders(<ScanScreen />, { signedInAs: 'customer' });

    expect(screen.getByLabelText(pl.scan.scannerPlaceholder)).toBeOnTheScreen();
    expect(screen.getByText(pl.scan.cameraRationale)).toBeOnTheScreen();
  });

  it('opens the payment request for a valid id and passes nothing but the id', async () => {
    await renderWithProviders(<ScanScreen />, { signedInAs: 'customer' });

    await fireEvent.changeText(
      screen.getByLabelText(pl.scan.manualLabel),
      MOCK_PENDING_PAYMENT_REQUEST_ID,
    );
    await fireEvent.press(screen.getByRole('button', { name: pl.scan.manualSubmit }));

    expect(useRouter().push).toHaveBeenCalledWith({
      pathname: '/pay/[requestId]',
      params: { requestId: MOCK_PENDING_PAYMENT_REQUEST_ID },
    });
  });

  it('refuses input that is not an id, such as a code carrying an amount', async () => {
    await renderWithProviders(<ScanScreen />, { signedInAs: 'customer' });

    await fireEvent.changeText(
      screen.getByLabelText(pl.scan.manualLabel),
      'pay?amount=100&to=PL42',
    );
    await fireEvent.press(screen.getByRole('button', { name: pl.scan.manualSubmit }));

    expect(screen.getByText(`${pl.common.fieldError}: ${pl.scan.manualInvalid}`)).toBeOnTheScreen();
    expect(useRouter().push).not.toHaveBeenCalled();
  });
});
