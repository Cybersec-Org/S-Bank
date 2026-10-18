import { useIsMockMode } from '@/shared/config/ApiModeProvider';
import { useSession } from '@/shared/auth/SessionProvider';
import { pl } from '@/shared/i18n/pl';
import { Box, Button, Card, Text } from '@/shared/ui';

/**
 * Demo sign-in as one of three roles. It renders only when `EXPO_PUBLIC_API_MODE` is `mock`, so a live
 * build can never offer it; the session store also refuses mock sign-in outside mock mode.
 */
export function MockRoleSwitcher() {
  const isMock = useIsMockMode();
  const session = useSession();
  if (!isMock) {
    return null;
  }
  return (
    <Card gap="md">
      <Text variant="heading">{pl.start.mockHeading}</Text>
      <Text tone="muted">{pl.start.mockHint}</Text>
      <Box gap="sm">
        <Button
          label={pl.start.mockCustomer}
          onPress={() => session.signInAsMock('customer')}
          fullWidth
        />
        <Button
          label={pl.start.mockEmployee}
          variant="secondary"
          onPress={() => session.signInAsMock('employee')}
          fullWidth
        />
        <Button
          label={pl.start.mockAdmin}
          variant="secondary"
          onPress={() => session.signInAsMock('admin')}
          fullWidth
        />
      </Box>
    </Card>
  );
}
