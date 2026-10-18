import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { useTheme } from './ThemeProvider';
import type { SpacingKey } from './theme';

interface CardProps extends Omit<ViewProps, 'style'> {
  readonly children: ReactNode;
  readonly gap?: SpacingKey;
}

export function Card({ children, gap = 'sm', ...rest }: CardProps) {
  const theme = useTheme();
  return (
    <View
      {...rest}
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderWidth: theme.layout.borderWidth,
        borderRadius: theme.radii.lg,
        padding: theme.spacing.lg,
        gap: theme.spacing[gap],
      }}
    >
      {children}
    </View>
  );
}
