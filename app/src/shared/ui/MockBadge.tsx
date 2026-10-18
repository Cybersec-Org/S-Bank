import { View } from 'react-native';

import { useIsMockMode } from '@/shared/config/ApiModeProvider';
import { pl } from '@/shared/i18n/pl';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';

/** Rendered only in mock mode, so a live build never shows or implies demonstration data. */
export function MockBadge() {
  const theme = useTheme();
  const isMock = useIsMockMode();
  if (!isMock) {
    return null;
  }
  return (
    <View
      accessible
      accessibilityLabel={pl.common.mockBadge}
      accessibilityHint={pl.common.mockBadgeHint}
      style={{
        alignSelf: 'flex-start',
        backgroundColor: theme.colors.warningSurface,
        borderColor: theme.colors.warning,
        borderWidth: theme.layout.borderWidth,
        borderRadius: theme.radii.pill,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
      }}
    >
      <Text variant="caption">{pl.common.mockBadge}</Text>
    </View>
  );
}
