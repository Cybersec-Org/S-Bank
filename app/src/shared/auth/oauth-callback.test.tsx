import { useRouter } from 'expo-router';

import OAuthCallbackScreen from '@/app/oauth/callback';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

/** `sbank://oauth/callback` also opens this route on a phone; it must not stay on top of the signed-in app. */
describe('OAuth callback screen on a phone', () => {
  it('goes back to the screen that started the sign-in, instead of staying on a spinner', async () => {
    const router = useRouter();
    jest.mocked(router.canGoBack).mockReturnValue(true);

    await renderWithProviders(<OAuthCallbackScreen />);

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('opens the start screen when the link started the app', async () => {
    const router = useRouter();
    jest.mocked(router.canGoBack).mockReturnValue(false);

    await renderWithProviders(<OAuthCallbackScreen />);

    expect(router.replace).toHaveBeenCalledWith('/');
    expect(router.back).not.toHaveBeenCalled();
  });
});
