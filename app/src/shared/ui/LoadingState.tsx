import { ActivityIndicator } from 'react-native';

import { pl } from '@/shared/i18n/pl';

import { Box } from './Box';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

interface LoadingStateProps {
  readonly message?: string;
}

export function LoadingState({ message = pl.common.loading }: LoadingStateProps) {
  const theme = useTheme();
  return (
    <Box
      align="center"
      gap="md"
      padding="xl"
      accessible
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
    >
      <ActivityIndicator color={theme.colors.accent} size="large" />
      <Text tone="muted" align="center">
        {message}
      </Text>
    </Box>
  );
}
