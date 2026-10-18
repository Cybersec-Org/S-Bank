import { Switch, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';

interface ToggleProps {
  readonly label: string;
  readonly hint?: string;
  readonly value: boolean;
  readonly onValueChange: (value: boolean) => void;
  readonly disabled?: boolean;
}

export function Toggle({ label, hint, value, onValueChange, disabled = false }: ToggleProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        minHeight: theme.minTouchTarget,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
      }}
    >
      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        <Text variant="body">{label}</Text>
        {hint === undefined ? null : (
          <Text variant="caption" tone="muted">
            {hint}
          </Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value, disabled }}
        trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
      />
    </View>
  );
}
