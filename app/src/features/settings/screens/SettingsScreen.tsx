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

/** FR-14: biometrics toggle, passkey registration via Keycloak (live) or demo list (mock), and sign-out. */
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

  function handleSignOut(): void {
    session.signOut();
    router.replace('/');
  }

  async function handleRegisterLivePasskey(): Promise<void> {
    setLivePasskeyNotice(null);
    setRegisteringLive(true);
    try {
      await session.registerPasskey();
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

      <Box gap="sm">
        <Text variant="heading">{pl.settings.passkeysHeading}</Text>
        <Text tone="muted">{pl.settings.passkeysIntro}</Text>
        {isMock ? (
          <>
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
            <Button
              label={pl.settings.passkeyAdd}
              variant="secondary"
              loading={addPasskey.isPending}
              onPress={() => addPasskey.mutate()}
            />
          </>
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
