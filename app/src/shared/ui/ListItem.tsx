import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';

interface ListItemProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly trailing?: ReactNode;
  readonly onPress?: () => void;
  /**
   * Full spoken description; screen readers read it instead of the separate parts. Leave it out when
   * `trailing` holds its own controls, so those stay reachable.
   */
  readonly accessibilityLabel?: string;
}

export function ListItem({
  title,
  subtitle,
  trailing,
  onPress,
  accessibilityLabel,
}: ListItemProps) {
  const theme = useTheme();
  const content = (
    <>
      <View style={{ flex: 1, minWidth: 0, gap: theme.spacing.xs }}>
        <Text variant="body">{title}</Text>
        {subtitle === undefined ? null : (
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
    </>
  );
  const rowStyle = {
    minHeight: theme.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: theme.layout.borderWidth,
    borderBottomColor: theme.colors.surfaceMuted,
  } as const;

  if (onPress === undefined) {
    return (
      <View
        {...(accessibilityLabel === undefined ? {} : { accessible: true, accessibilityLabel })}
        style={rowStyle}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [rowStyle, { opacity: pressed ? 0.7 : 1 }]}
    >
      {content}
    </Pressable>
  );
}
