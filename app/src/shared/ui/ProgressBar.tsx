import { View } from 'react-native';

import { useTheme } from './ThemeProvider';

const PERCENT_MAX = 100;

interface ProgressBarProps {
  /** Whole percent, clamped to 0-100. */
  readonly percent: number;
  readonly label: string;
}

/** The value must also appear as text next to the bar; the bar alone is not enough. */
export function ProgressBar({ percent, label }: ProgressBarProps) {
  const theme = useTheme();
  const clamped = Math.min(PERCENT_MAX, Math.max(0, Math.round(percent)));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: PERCENT_MAX, now: clamped }}
      style={{
        height: theme.layout.progressBarHeight,
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: theme.radii.pill,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${clamped}%`,
          height: '100%',
          backgroundColor: theme.colors.accent,
        }}
      />
    </View>
  );
}
