import { useState } from 'react';

import { useSession } from '@/shared/auth/SessionProvider';
import { pl } from '@/shared/i18n/pl';
import { Banner, ConfirmDialog } from '@/shared/ui';

/**
 * P-18 / B-21: after a customer's sign-in on a phone with strong biometrics, offer once to keep the session behind
 * biometrics. Consent is required – without it the refresh token stays in memory only. On Android enabling shows
 * the system biometric prompt (the key is created in the Keystore).
 */
export function BiometricsOffer() {
  const session = useSession();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!session.biometrics.offerPending) {
    return null;
  }

  return (
    <ConfirmDialog
      visible
      title={pl.biometricsOffer.title}
      message={pl.biometricsOffer.message}
      confirmLabel={pl.biometricsOffer.enable}
      pending={pending}
      onConfirm={() => {
        setPending(true);
        setFailed(false);
        void session
          .setBiometricsEnabled(true)
          .then((enabled) => setFailed(!enabled))
          .finally(() => setPending(false));
      }}
      onCancel={session.dismissBiometricsOffer}
    >
      {failed ? <Banner tone="warning">{pl.settings.biometricsEnableFailed}</Banner> : null}
    </ConfirmDialog>
  );
}
