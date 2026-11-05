import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { homeRouteFor } from '@/shared/auth/roles';
import { useSession } from '@/shared/auth/SessionProvider';
import { useIsMockMode } from '@/shared/config/ApiModeProvider';
import { pl } from '@/shared/i18n/pl';
import { Banner, Box, Button, Logo, Screen, Text, useTheme } from '@/shared/ui';

import { MockRoleSwitcher } from '../components/MockRoleSwitcher';

/**
 * FR-02: entry point. Live mode will sign in through the system browser (OIDC + PKCE, B-10); until then
 * both sign-in buttons start the demo customer session in mock mode.
 */
export function StartScreen() {
  const router = useRouter();
  const theme = useTheme();
  const session = useSession();
  const isMock = useIsMockMode();
  const [loginNoticeVisible, setLoginNoticeVisible] = useState(false);
  const [devVisible, setDevVisible] = useState(false);

  if (session.principal !== null) {
    return <Redirect href={homeRouteFor(session.principal)} />;
  }

  function handleLogin(): void {
    if (isMock) {
      session.signInAsMock('customer');
    } else {
      setLoginNoticeVisible(true);
    }
  }

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
          onPress={handleLogin}
          fullWidth
        />
        <Button
          label={pl.start.loginPassword}
          variant="secondary"
          size="large"
          onPress={handleLogin}
          fullWidth
        />
        <Banner tone="info" icon="shield">
          {pl.start.loginInfo}
        </Banner>
        {loginNoticeVisible ? (
          <Banner tone="warning">{pl.start.loginLiveUnavailable}</Banner>
        ) : null}

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
        <Button
          label={pl.start.unlockBiometrics}
          variant="outline"
          size="medium"
          disabled
          accessibilityHint={pl.start.unlockBiometricsSoon}
          onPress={() => undefined}
          fullWidth
        />

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
