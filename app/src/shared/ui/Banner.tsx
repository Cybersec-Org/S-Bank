import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';

export type BannerTone = 'info' | 'warning' | 'danger' | 'success';

interface BannerProps {
  readonly tone?: BannerTone;
  readonly title?: string;
  readonly children: ReactNode;
}

/** Inline notice. The title (not the colour) carries the meaning, so it works without colour vision. */
export function Banner({ tone = 'info', title, children }: BannerProps) {
  const theme = useTheme();
  const palette = {
    info: { surface: theme.colors.surfaceMuted, edge: theme.colors.accent },
    warning: { surface: theme.colors.warningSurface, edge: theme.colors.warning },
    danger: { surface: theme.colors.dangerSurface, edge: theme.colors.danger },
    success: { surface: theme.colors.successSurface, edge: theme.colors.success },
  }[tone];
  return (
    <View
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      accessibilityLiveRegion={tone === 'danger' ? 'assertive' : 'polite'}
      style={{
        backgroundColor: palette.surface,
        borderLeftColor: palette.edge,
        borderLeftWidth: theme.spacing.xs,
        borderRadius: theme.radii.md,
        padding: theme.spacing.md,
        gap: theme.spacing.xs,
      }}
    >
      {title === undefined ? null : <Text variant="label">{title}</Text>}
      {typeof children === 'string' ? <Text variant="body">{children}</Text> : children}
    </View>
  );
}
