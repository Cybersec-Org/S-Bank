import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { useTheme } from './ThemeProvider';
import type { SpacingKey } from './theme';

interface CardProps extends Omit<ViewProps, 'style'> {
  readonly children: ReactNode;
  readonly gap?: SpacingKey;
  /** `primary` is the filled balance card. */
  readonly tone?: 'default' | 'primary';
  /** `large` (22 px) is for the balance and summary cards, `default` is 16 px. */
  readonly radius?: 'default' | 'large';
  /** Lists put their rows straight against the card edge. */
  readonly padding?: SpacingKey;
}

export function Card({
  children,
  gap = 'sm',
  tone = 'default',
  radius = 'default',
  padding = 'lg',
  ...rest
}: CardProps) {
  const theme = useTheme();
  const filled = tone === 'primary';
  return (
    <View
      {...rest}
      style={{
        backgroundColor: filled ? theme.colors.primary : theme.colors.surface,
        borderColor: filled ? theme.colors.primary : theme.colors.border,
        borderWidth: theme.layout.borderWidth,
        borderRadius: radius === 'large' ? theme.radii.xl : theme.radii.lg,
        padding: theme.spacing[padding],
        gap: theme.spacing[gap],
      }}
    >
      {children}
    </View>
  );
}
