import { useRouter, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useSession } from '@/shared/auth/SessionProvider';
import { LoadingState, Screen } from '@/shared/ui';

/**
 * Return point of the Keycloak sign-in (`…/oauth/callback`). Web (P-17): the tab comes back here with `code` and
 * `state`; the sign-in is finished in memory and the user moves on. Native: the system browser hands the result to
 * the waiting `promptAsync`, but the router also opens this screen for the same `sbank://oauth/callback` link –
 * it leaves right away, back to the screen that started the sign-in (start, transfer step-up), which then moves on.
 */
export default function OAuthCallbackScreen() {
  const session = useSession();
  const router = useRouter();
  const { completeRedirectSignIn } = session;

  useEffect(() => {
    if (Platform.OS !== 'web') {
      WebBrowser.maybeCompleteAuthSession();
      if (router.canGoBack()) {
        router.back();
      } else {
        // The link started the app (cold start): there is no screen to go back to.
        router.replace('/');
      }
      return;
    }
    let active = true;
    void completeRedirectSignIn().then((next) => {
      if (active) {
        router.replace(next as Href);
      }
    });
    return () => {
      active = false;
    };
  }, [completeRedirectSignIn, router]);

  return (
    <Screen title="S-Bank">
      <LoadingState />
    </Screen>
  );
}
