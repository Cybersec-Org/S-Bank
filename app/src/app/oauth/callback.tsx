import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';

import { LoadingState, Screen } from '@/shared/ui';

export default function OAuthCallbackScreen() {
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  return (
    <Screen title="S-Bank">
      <LoadingState />
    </Screen>
  );
}
