import { fireEvent, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { pl } from '@/shared/i18n/pl';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import { NotFoundScreen } from './NotFoundScreen';
import { TermsScreen } from './TermsScreen';

describe('TermsScreen', () => {
  it('shows the placeholder for the locked-down WebView (B-30)', async () => {
    await renderWithProviders(<TermsScreen />);

    expect(screen.getByLabelText(pl.terms.placeholder)).toBeOnTheScreen();
  });
});

describe('NotFoundScreen', () => {
  it('explains the problem and links back to the start page', async () => {
    await renderWithProviders(<NotFoundScreen />);

    expect(screen.getByText(pl.common.notFoundTitle)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: pl.common.notFoundBack }));

    expect(useRouter().replace).toHaveBeenCalledWith('/');
  });
});
