import { View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';

interface PlaceholderBlockProps {
  readonly label: string;
}

/** Labelled grey box for areas whose design or implementation comes later. */
export function PlaceholderBlock({ label }: PlaceholderBlockProps) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        minHeight: theme.minTouchTarget * 3,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.lg,
        backgroundColor: theme.colors.surfaceMuted,
        borderColor: theme.colors.border,
        borderStyle: 'dashed',
        borderWidth: theme.layout.borderWidth,
        borderRadius: theme.radii.md,
      }}
    >
      <Text tone="muted" align="center">
        {label}
      </Text>
    </View>
  );
}
