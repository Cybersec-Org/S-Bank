import { View } from 'react-native';

import { pl } from '@/shared/i18n/pl';
import { Icon } from './Icon';
import { useTheme } from './ThemeProvider';

interface LogoProps {
  /** Side of the square tile: 84 on the login screen, 40 in the employee top bar. */
  readonly size: number;
}

const ICON_SHARE = 0.52;
const RADIUS_SHARE = 24 / 84;

/** The S-Bank tile: a shield on the brand colour. */
export function Logo({ size }: LogoProps) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={pl.start.logoLabel}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * RADIUS_SHARE),
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="shield" color={theme.colors.onPrimary} size={Math.round(size * ICON_SHARE)} />
    </View>
  );
}
