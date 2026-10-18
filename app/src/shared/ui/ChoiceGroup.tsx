import { Pressable, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';

export interface ChoiceOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
}

interface ChoiceGroupProps<Value extends string> {
  readonly label: string;
  readonly options: readonly ChoiceOption<Value>[];
  readonly value: Value;
  readonly onChange: (value: Value) => void;
}

const SELECTED_MARK = '✓ ';

/** Single choice from a few options; the selected one is marked with a check, not only a colour. */
export function ChoiceGroup<Value extends string>({
  label,
  options,
  value,
  onChange,
}: ChoiceGroupProps<Value>) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ gap: theme.spacing.xs }}
    >
      <Text variant="label">{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected, checked: selected }}
              style={{
                minHeight: theme.minTouchTarget,
                minWidth: theme.minTouchTarget,
                paddingHorizontal: theme.spacing.lg,
                justifyContent: 'center',
                borderRadius: theme.radii.pill,
                borderWidth: selected ? theme.layout.focusRingWidth : theme.layout.borderWidth,
                borderColor: selected ? theme.colors.accent : theme.colors.border,
                backgroundColor: selected ? theme.colors.surfaceMuted : theme.colors.surface,
              }}
            >
              <Text variant="label" tone={selected ? 'accent' : 'default'} align="center">
                {`${selected ? SELECTED_MARK : ''}${option.label}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
