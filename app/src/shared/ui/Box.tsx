import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { useTheme } from './ThemeProvider';
import type { SpacingKey } from './theme';

interface BoxProps extends Omit<ViewProps, 'style'> {
  readonly children?: ReactNode;
  readonly direction?: 'row' | 'column';
  readonly gap?: SpacingKey;
  readonly padding?: SpacingKey;
  readonly align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  readonly justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between';
  readonly wrap?: boolean;
  /** Lets the box take the remaining space of its parent. */
  readonly fill?: boolean;
}

/** Layout primitive: spacing comes from tokens only. */
export function Box({
  children,
  direction = 'column',
  gap = 'none',
  padding = 'none',
  align,
  justify,
  wrap = false,
  fill = false,
  ...rest
}: BoxProps) {
  const theme = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          flexDirection: direction,
          gap: theme.spacing[gap],
          padding: theme.spacing[padding],
          flexWrap: wrap ? 'wrap' : 'nowrap',
        },
        align === undefined ? null : { alignItems: align },
        justify === undefined ? null : { justifyContent: justify },
        fill ? { flex: 1, minWidth: 0 } : null,
      ]}
    >
      {children}
    </View>
  );
}
