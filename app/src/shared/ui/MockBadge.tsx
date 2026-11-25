import { View } from 'react-native';

import { useApiMode, useIsMockMode } from '@/shared/config/ApiModeProvider';
import { pl } from '@/shared/i18n/pl';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';

/** Rendered only in mock and hybrid mode, so a live build never shows or implies demonstration data. */
export function MockBadge() {
  const theme = useTheme();
  const isMock = useIsMockMode();
  const hybrid = useApiMode() === 'hybrid';
  if (!isMock) {
    return null;
  }
  const label = hybrid ? pl.common.devApiBadge : pl.common.mockBadge;
  const hint = hybrid ? pl.common.devApiBadgeHint : pl.common.mockBadgeHint;
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={{
        alignSelf: 'flex-start',
        backgroundColor: theme.colors.warningBg,
        borderColor: theme.colors.warningBg,
        borderWidth: theme.layout.borderWidth,
        borderRadius: theme.radii.pill,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
      }}
    >
      <Text variant="caption" tone="warning">
        {label}
      </Text>
    </View>
  );
}
