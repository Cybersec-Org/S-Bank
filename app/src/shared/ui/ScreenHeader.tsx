import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

interface ScreenHeaderProps {
  readonly title: string;
  /** Accessible name of the arrow, for example "Wróć do pulpitu". */
  readonly backLabel: string;
  readonly onBack: () => void;
  readonly trailing?: ReactNode;
}

/** Back arrow (44 x 44) and the screen title, as on the transfer, confirmation and payment screens. */
export function ScreenHeader({ title, backLabel, onBack, trailing }: ScreenHeaderProps) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        hitSlop={theme.spacing.xs}
        style={({ pressed }) => ({
          width: theme.minTouchTarget,
          height: theme.minTouchTarget,
          marginLeft: -theme.spacing.sm,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radii.pill,
          backgroundColor: pressed ? theme.colors.neutralChip : 'transparent',
        })}
      >
        <Icon name="arrowLeft" color={theme.colors.text} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="screenTitle">{title}</Text>
      </View>
      {trailing}
    </View>
  );
}
