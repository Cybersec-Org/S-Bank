import { Pressable } from 'react-native';

import { Icon, Text, useTheme, type IconName } from '@/shared/ui';

interface ShortcutTileProps {
  readonly label: string;
  readonly icon: IconName;
  readonly onPress: () => void;
}

/** White tile with a brand-coloured icon; four of them form the shortcut grid of the dashboard. */
export function ShortcutTile({ label, icon, onPress }: ShortcutTileProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: theme.minTouchTarget * 2,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.md,
        borderRadius: theme.radii.lg,
        borderWidth: theme.layout.borderWidth,
        borderColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.primarySoft : theme.colors.surface,
      })}
    >
      <Icon name={icon} color={theme.colors.primary} size={26} />
      <Text variant="label" align="center">
        {label}
      </Text>
    </Pressable>
  );
}
