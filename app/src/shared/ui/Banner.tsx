import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Icon, type IconName } from './Icon';
import { Text, type TextTone } from './Text';
import { useTheme } from './ThemeProvider';

export type BannerTone = 'info' | 'warning' | 'danger' | 'success';

interface BannerProps {
  readonly tone?: BannerTone;
  readonly title?: string;
  /** Overrides the icon that belongs to the tone. */
  readonly icon?: IconName;
  readonly children: ReactNode;
}

const DEFAULT_ICON: Readonly<Record<BannerTone, IconName>> = {
  info: 'info',
  warning: 'alert',
  danger: 'alert',
  success: 'check',
};

const TEXT_TONE: Readonly<Record<BannerTone, TextTone>> = {
  info: 'onSoft',
  warning: 'warning',
  danger: 'danger',
  success: 'onSoft',
};

/** Inline notice. The title and the icon (not the colour alone) carry the meaning. */
export function Banner({ tone = 'info', title, icon, children }: BannerProps) {
  const theme = useTheme();
  const palette = {
    info: { surface: theme.colors.primarySoft, content: theme.colors.onPrimarySoft },
    warning: { surface: theme.colors.warningBg, content: theme.colors.warningText },
    danger: { surface: theme.colors.dangerBg, content: theme.colors.danger },
    success: { surface: theme.colors.primarySoft, content: theme.colors.onPrimarySoft },
  }[tone];
  const textTone = TEXT_TONE[tone];
  return (
    <View
      accessible={tone === 'danger'}
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      accessibilityLiveRegion={tone === 'danger' ? 'assertive' : 'polite'}
      style={{
        backgroundColor: palette.surface,
        borderRadius: theme.radii.md,
        padding: theme.spacing.md,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.md,
      }}
    >
      <Icon name={icon ?? DEFAULT_ICON[tone]} color={palette.content} size={22} />
      <View style={{ flex: 1, minWidth: 0, gap: theme.spacing.xs }}>
        {title === undefined ? null : (
          <Text variant="label" tone={textTone}>
            {title}
          </Text>
        )}
        {typeof children === 'string' ? (
          <Text variant="body" tone={textTone}>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}
