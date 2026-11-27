import { useRouter } from 'expo-router';
import { useState } from 'react';

import { describeProblem } from '@/shared/api/problem';
import { useSession } from '@/shared/auth/SessionProvider';
import { useIsMockMode } from '@/shared/config/ApiModeProvider';
import { pl } from '@/shared/i18n/pl';
import { formatDate } from '@/shared/lib/dates';
import { AsyncBoundary, Banner, Box, Button, ListItem, Screen, Text, Toggle } from '@/shared/ui';

import {
  useAddPasskeyMutation,
  usePasskeysQuery,
  useRemovePasskeyMutation,
  useSecuritySettingsQuery,
  useSetBiometricsMutation,
} from '../hooks/useSettings';

/** FR-14 / SR-03: biometrics toggle, passkey list with add/remove via Keycloak & API (live) or mock. */
export function SettingsScreen() {
  const router = useRouter();
  const session = useSession();
  const isMock = useIsMockMode();
  const securityQuery = useSecuritySettingsQuery();
  const biometrics = useSetBiometricsMutation();
  const passkeysQuery = usePasskeysQuery();
  const addPasskey = useAddPasskeyMutation();
  const removePasskey = useRemovePasskeyMutation();
  const passkeys = passkeysQuery.data ?? [];
  const [livePasskeyNotice, setLivePasskeyNotice] = useState<string | null>(null);
  const [registeringLive, setRegisteringLive] = useState(false);
  const [biometricsLivePending, setBiometricsLivePending] = useState(false);
  const [biometricsLiveError, setBiometricsLiveError] = useState<string | null>(null);

  /** Live (P-18): turning it on creates the biometric key (Android: system prompt); off removes the stored session. */
  async function handleLiveBiometrics(enabled: boolean): Promise<void> {
    setBiometricsLiveError(null);
    setBiometricsLivePending(true);
    try {
      const now = await session.setBiometricsEnabled(enabled);
      if (enabled && !now) {
        setBiometricsLiveError(pl.settings.biometricsEnableFailed);
      }
    } finally {
      setBiometricsLivePending(false);
    }
  }

  function handleSignOut(): void {
    session.signOut();
    router.replace('/');
  }

  async function handleRegisterLivePasskey(): Promise<void> {
    setLivePasskeyNotice(null);
    setRegisteringLive(true);
    try {
      await session.registerPasskey();
      await passkeysQuery.refetch();
      setLivePasskeyNotice(pl.settings.passkeyAddedNotice);
    } catch {
      setLivePasskeyNotice(pl.start.loginCancelled);
    } finally {
      setRegisteringLive(false);
    }
  }

  const mutationError = biometrics.error ?? addPasskey.error ?? removePasskey.error;

  return (
    <Screen title={pl.settings.title}>
      {session.principal === null ? null : (
        <Text tone="muted">{pl.settings.signedInAs(session.principal.displayName)}</Text>
      )}
      {mutationError === null ? null : (
        <Banner tone="danger">{describeProblem(mutationError)}</Banner>
      )}
      {livePasskeyNotice === null ? null : <Banner tone="info">{livePasskeyNotice}</Banner>}

      {isMock ? (
        <Box gap="sm">
          <Text variant="heading">{pl.settings.securityHeading}</Text>
          <AsyncBoundary
            isLoading={securityQuery.isPending}
            error={securityQuery.error}
            isEmpty={false}
            onRetry={() => void securityQuery.refetch()}
          >
            <Toggle
              label={pl.settings.biometrics}
              hint={pl.settings.biometricsHint}
              value={securityQuery.data?.biometricsEnabled ?? false}
              disabled={biometrics.isPending}
              onValueChange={(enabled) => biometrics.mutate(enabled)}
            />
          </AsyncBoundary>
        </Box>
      ) : session.biometrics.available ? (
        <Box gap="sm">
          <Text variant="heading">{pl.settings.securityHeading}</Text>
          <Toggle
            label={pl.settings.biometrics}
            hint={pl.settings.biometricsHintLive}
            value={session.biometrics.enabled}
            disabled={biometricsLivePending}
            onValueChange={(enabled) => void handleLiveBiometrics(enabled)}
          />
          {biometricsLiveError === null ? null : (
            <Banner tone="warning">{biometricsLiveError}</Banner>
          )}
        </Box>
      ) : null}

      <Box gap="sm">
        <Text variant="heading">{pl.settings.passkeysHeading}</Text>
        <Text tone="muted">{pl.settings.passkeysIntro}</Text>
        <AsyncBoundary
          isLoading={passkeysQuery.isPending}
          error={passkeysQuery.error}
          isEmpty={passkeys.length === 0}
          onRetry={() => void passkeysQuery.refetch()}
          emptyTitle={pl.settings.passkeysEmptyTitle}
          emptyMessage={pl.settings.passkeysEmptyMessage}
        >
          <Box>
            {passkeys.map((passkey) => (
              <ListItem
                key={passkey.id}
                title={passkey.label}
                subtitle={pl.settings.passkeyAddedOn(formatDate(passkey.createdAt))}
                trailing={
                  <Button
                    label={pl.settings.passkeyRemove}
                    variant="destructive"
                    accessibilityLabel={pl.settings.passkeyRemoveLabel(passkey.label)}
                    loading={removePasskey.isPending && removePasskey.variables === passkey.id}
                    onPress={() => removePasskey.mutate(passkey.id)}
                  />
                }
              />
            ))}
          </Box>
        </AsyncBoundary>
        {isMock ? (
          <Button
            label={pl.settings.passkeyAdd}
            variant="secondary"
            loading={addPasskey.isPending}
            onPress={() => addPasskey.mutate()}
          />
        ) : (
          <Button
            label={pl.settings.passkeyAddLive}
            variant="secondary"
            loading={registeringLive}
            onPress={() => void handleRegisterLivePasskey()}
          />
        )}
      </Box>

      <Box gap="sm">
        <Text variant="heading">{pl.settings.accountHeading}</Text>
        <Button
          label={pl.settings.recipientsLink}
          variant="secondary"
          accessibilityRole="link"
          onPress={() => router.push('/recipients')}
        />
        <Button
          label={pl.settings.signOut}
          variant="destructive"
          accessibilityLabel={pl.nav.signOutLabel}
          onPress={handleSignOut}
        />
      </Box>
    </Screen>
  );
}
