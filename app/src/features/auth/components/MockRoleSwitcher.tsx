import { useIsMockMode } from '@/shared/config/ApiModeProvider';
import { useSession } from '@/shared/auth/SessionProvider';
import { pl } from '@/shared/i18n/pl';
import { Box, Button, Card, Text } from '@/shared/ui';

/**
 * Demo sign-in as a staff role. It renders only when `EXPO_PUBLIC_API_MODE` is `mock`, so a live build
 * can never offer it; the session store also refuses mock sign-in outside mock mode.
 */
export function MockRoleSwitcher() {
  const isMock = useIsMockMode();
  const session = useSession();
  if (!isMock) {
    return null;
  }
  return (
    <Card gap="md">
      <Text variant="heading">{pl.start.devHeading}</Text>
      <Box gap="sm">
        <Button
          label={pl.start.devEmployee}
          variant="secondary"
          onPress={() => session.signInAsMock('employee')}
          fullWidth
        />
        <Button
          label={pl.start.devAdmin}
          variant="secondary"
          onPress={() => session.signInAsMock('admin')}
          fullWidth
        />
      </Box>
    </Card>
  );
}
