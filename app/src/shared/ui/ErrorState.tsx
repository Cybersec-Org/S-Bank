import { pl } from '@/shared/i18n/pl';

import { Box } from './Box';
import { Button } from './Button';
import { Text } from './Text';

interface ErrorStateProps {
  readonly message: string;
  readonly title?: string;
  readonly onRetry?: () => void;
}

export function ErrorState({ message, title = pl.common.errorTitle, onRetry }: ErrorStateProps) {
  return (
    <Box align="center" gap="sm" padding="xl" accessibilityRole="alert">
      <Text variant="heading" align="center">
        {title}
      </Text>
      <Text tone="danger" align="center">
        {message}
      </Text>
      {onRetry === undefined ? null : (
        <Button label={pl.common.retry} onPress={onRetry} variant="secondary" />
      )}
    </Box>
  );
}
