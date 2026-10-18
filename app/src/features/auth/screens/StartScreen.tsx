import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';

import { homeRouteFor } from '@/shared/auth/roles';
import { useSession } from '@/shared/auth/SessionProvider';
import { useIsMockMode } from '@/shared/config/ApiModeProvider';
import { pl } from '@/shared/i18n/pl';
import { Banner, Box, Button, Card, Screen, Text } from '@/shared/ui';

import { MockRoleSwitcher } from '../components/MockRoleSwitcher';

/** FR-02: entry point. Live mode will sign in through the system browser (OIDC + PKCE, B-10). */
export function StartScreen() {
  const router = useRouter();
  const session = useSession();
  const isMock = useIsMockMode();
  const [loginNoticeVisible, setLoginNoticeVisible] = useState(false);

  if (session.principal !== null) {
    return <Redirect href={homeRouteFor(session.principal)} />;
  }

  return (
    <Screen>
      <Box gap="xs">
        <Text variant="title">{pl.common.appName}</Text>
        <Text tone="muted">{pl.start.tagline}</Text>
      </Box>

      {isMock ? (
        <MockRoleSwitcher />
      ) : (
        <Card gap="md">
          <Text variant="heading">{pl.start.loginHeading}</Text>
          <Text tone="muted">{pl.start.loginLiveHint}</Text>
          <Button
            label={pl.start.loginLive}
            onPress={() => setLoginNoticeVisible(true)}
            fullWidth
          />
          {loginNoticeVisible ? (
            <Banner tone="warning">{pl.start.loginLiveUnavailable}</Banner>
          ) : null}
        </Card>
      )}

      <Box gap="sm">
        <Text variant="heading">{pl.start.publicHeading}</Text>
        <Box direction="row" wrap gap="sm">
          <Button
            label={pl.start.linkRates}
            variant="secondary"
            accessibilityRole="link"
            onPress={() => router.push('/rates')}
          />
          <Button
            label={pl.start.linkAtms}
            variant="secondary"
            accessibilityRole="link"
            onPress={() => router.push('/atms')}
          />
          <Button
            label={pl.start.linkTerms}
            variant="secondary"
            accessibilityRole="link"
            onPress={() => router.push('/terms')}
          />
        </Box>
      </Box>
    </Screen>
  );
}
