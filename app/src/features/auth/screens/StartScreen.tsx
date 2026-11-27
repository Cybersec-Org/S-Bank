import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { OidcAuthError, type OidcErrorCode } from '@/shared/auth/oidc';
import type { SignOutReason } from '@/shared/auth/session-store';
import { homeRouteFor } from '@/shared/auth/roles';
import { useSession } from '@/shared/auth/SessionProvider';
import { useIsMockMode } from '@/shared/config/ApiModeProvider';
import { pl } from '@/shared/i18n/pl';
import { Banner, Box, Button, Logo, Screen, Text, useTheme } from '@/shared/ui';

import { MockRoleSwitcher } from '../components/MockRoleSwitcher';

type LoginMethod = 'passkey' | 'password' | 'registerPasskey' | 'unlock';

const ERROR_MESSAGES: Readonly<Record<OidcErrorCode, string>> = {
  cancelled: pl.start.loginCancelled,
  access_denied: pl.start.loginAccessDenied,
  passkey_required: pl.start.loginPasskeyRequired,
  session_expired: pl.start.sessionExpired,
  failed: pl.start.loginFailed,
};

const SIGN_OUT_MESSAGES: Readonly<Record<SignOutReason, string>> = {
  session_expired: pl.start.sessionExpired,
  access_rejected: pl.start.accessRejected,
};

/** Web (P-17): a sign-in that came back with an error lands here as `/?authError=<code>`. */
function messageForCode(code: string | string[] | undefined): string | null {
  const value = Array.isArray(code) ? code[0] : code;
  if (value === undefined) {
    return null;
  }
  return value in ERROR_MESSAGES ? ERROR_MESSAGES[value as OidcErrorCode] : pl.start.loginFailed;
}

/**
 * FR-02 / SR-01 / SR-03: entry point. Signs in through Keycloak (OIDC + PKCE + Passkeys) in live
 * mode, or starts the demo customer session in mock mode.
 */
export function StartScreen() {
  const router = useRouter();
  const theme = useTheme();
  const session = useSession();
  const isMock = useIsMockMode();
  const { authError: authErrorParam } = useLocalSearchParams<{ authError?: string }>();
  const [authError, setAuthError] = useState<string | null>(
    () =>
      messageForCode(authErrorParam) ??
      (session.signedOutReason === null ? null : SIGN_OUT_MESSAGES[session.signedOutReason]),
  );
  const [activeMethod, setActiveMethod] = useState<LoginMethod | null>(null);
  const [devVisible, setDevVisible] = useState(false);

  if (session.principal !== null) {
    return <Redirect href={homeRouteFor(session.principal)} />;
  }

  async function runOidc(method: LoginMethod): Promise<void> {
    setAuthError(null);
    setActiveMethod(method);
    try {
      if (method === 'passkey') {
        await session.signInWithPasskey();
      } else if (method === 'password') {
        await session.signInWithPassword();
      } else {
        await session.registerPasskey();
      }
    } catch (error) {
      setAuthError(
        error instanceof OidcAuthError ? ERROR_MESSAGES[error.code] : pl.start.loginFailed,
      );
    } finally {
      setActiveMethod(null);
    }
  }

  async function unlock(): Promise<void> {
    setAuthError(null);
    setActiveMethod('unlock');
    try {
      const result = await session.unlockWithBiometrics();
      if (result === 'cancelled') {
        setAuthError(pl.start.unlockCancelled);
      } else if (result === 'unavailable') {
        setAuthError(pl.start.unlockUnavailable);
      } else if (result === 'session_expired') {
        setAuthError(pl.start.sessionExpired);
      } else if (result === 'failed') {
        setAuthError(pl.start.unlockFailed);
      }
    } finally {
      setActiveMethod(null);
    }
  }

  function handleLogin(method: LoginMethod): void {
    if (isMock) {
      session.signInAsMock('customer');
      return;
    }
    void runOidc(method);
  }

  const busy = activeMethod !== null;

  return (
    <Screen gutter="xl" fill>
      <View
        style={{
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingTop: theme.layout.loginTopSpace,
        }}
      >
        <Logo size={theme.layout.logoSize} />
        <Text variant="brand" accessibilityRole="header">
          {pl.common.appName}
        </Text>
        <Text tone="muted" align="center" accessibilityLabel={pl.start.taglineLabel}>
          {pl.start.tagline}
        </Text>
      </View>

      <View style={{ flexGrow: 1 }} />

      <Box gap="md">
        <Button
          label={pl.start.loginPasskey}
          icon="key"
          size="large"
          loading={activeMethod === 'passkey'}
          disabled={busy}
          onPress={() => handleLogin('passkey')}
          fullWidth
        />
        <Button
          label={pl.start.loginPassword}
          variant="secondary"
          size="large"
          loading={activeMethod === 'password'}
          disabled={busy}
          onPress={() => handleLogin('password')}
          fullWidth
        />
        {!isMock ? (
          <Button
            label={pl.start.registerPasskey}
            variant="outline"
            size="medium"
            loading={activeMethod === 'registerPasskey'}
            disabled={busy}
            onPress={() => handleLogin('registerPasskey')}
            fullWidth
          />
        ) : null}
        <Banner tone="info" icon="shield">
          {pl.start.loginInfo}
        </Banner>
        {authError === null ? null : <Banner tone="warning">{authError}</Banner>}

        {/* Phone, live: a session stored behind biometrics (P-18) – "Unlock with biometrics" is active. The demo
            keeps the disabled placeholder; the web never shows it. */}
        {isMock || session.status === 'locked' ? (
          <>
            <Box direction="row" align="center" gap="md">
              <View
                style={{
                  flex: 1,
                  height: theme.layout.borderWidth,
                  backgroundColor: theme.colors.border,
                }}
              />
              <Text variant="caption" tone="muted">
                {pl.start.sessionDivider}
              </Text>
              <View
                style={{
                  flex: 1,
                  height: theme.layout.borderWidth,
                  backgroundColor: theme.colors.border,
                }}
              />
            </Box>
            {session.status === 'locked' ? (
              <>
                <Button
                  label={pl.start.unlockBiometrics}
                  icon="lock"
                  size="large"
                  loading={activeMethod === 'unlock'}
                  disabled={busy}
                  onPress={() => void unlock()}
                  fullWidth
                />
                <Text variant="caption" tone="muted" align="center">
                  {pl.start.unlockOtherwiseHint}
                </Text>
              </>
            ) : (
              <Button
                label={pl.start.unlockBiometrics}
                variant="outline"
                size="medium"
                disabled
                accessibilityHint={pl.start.unlockBiometricsSoon}
                onPress={() => undefined}
                fullWidth
              />
            )}
          </>
        ) : null}

        <Box direction="row" justify="center" gap="xl" wrap>
          <Button
            label={pl.start.linkTerms}
            variant="link"
            size="small"
            accessibilityRole="link"
            onPress={() => router.push('/terms')}
          />
          <Button
            label={pl.start.linkRates}
            variant="link"
            size="small"
            accessibilityRole="link"
            onPress={() => router.push('/rates')}
          />
        </Box>

        {isMock ? (
          <Box gap="sm">
            <Box direction="row" justify="center">
              <Button
                label={pl.start.devToggle}
                variant="ghost"
                size="small"
                onPress={() => setDevVisible((visible) => !visible)}
              />
            </Box>
            {devVisible ? <MockRoleSwitcher /> : null}
          </Box>
        ) : null}
      </Box>
    </Screen>
  );
}
