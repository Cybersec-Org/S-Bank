import { useRouter } from 'expo-router';

import { describeProblem } from '@/shared/api/problem';
import { useSession } from '@/shared/auth/SessionProvider';
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

/** FR-14: biometrics toggle, passkey list (both mocked until B-20 / B-21) and sign-out. */
export function SettingsScreen() {
  const router = useRouter();
  const session = useSession();
  const securityQuery = useSecuritySettingsQuery();
  const biometrics = useSetBiometricsMutation();
  const passkeysQuery = usePasskeysQuery();
  const addPasskey = useAddPasskeyMutation();
  const removePasskey = useRemovePasskeyMutation();
  const passkeys = passkeysQuery.data ?? [];

  function handleSignOut(): void {
    session.signOut();
    router.replace('/');
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
