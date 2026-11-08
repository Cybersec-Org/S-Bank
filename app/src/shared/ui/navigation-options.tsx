import { Text, type ColorValue } from 'react-native';

import { Icon, type IconName } from './Icon';
import { useTheme } from './ThemeProvider';

/** Header and tab styling from tokens, so navigators follow the design. */
export function useNavigationStyle() {
  const theme = useTheme();
  return {
    screenOptions: {
      headerStyle: { backgroundColor: theme.colors.surface },
      headerTintColor: theme.colors.text,
      headerTitleStyle: { ...theme.typography.screenTitle },
      contentStyle: { backgroundColor: theme.colors.bg },
    },
    tabOptions: {
      tabBarActiveTintColor: theme.colors.primary,
      tabBarInactiveTintColor: theme.colors.textMuted,
      tabBarStyle: {
        backgroundColor: theme.colors.surface,
        borderTopColor: theme.colors.border,
        paddingTop: theme.spacing.xs,
      },
      tabBarLabelStyle: { ...theme.typography.tab },
    },
  };
}

/**
 * Options of one bottom-navigation tab: icon in the tint colour and a label that is bold (700) only
 * while the tab is active. The navigator itself marks the active tab as selected for screen readers.
 */
export function tabScreenOptions(title: string, icon: IconName) {
  function TabBarIcon({ color }: { readonly color: ColorValue }) {
    return <Icon name={icon} color={color} size={24} />;
  }
  function TabBarLabel({
    focused,
    color,
  }: {
    readonly focused: boolean;
    readonly color: ColorValue;
  }) {
    const theme = useTheme();
    return (
      <Text
        style={[
          focused ? theme.typography.tabActive : theme.typography.tab,
          { color, textAlign: 'center' },
        ]}
      >
        {title}
      </Text>
    );
  }
  return { title, tabBarIcon: TabBarIcon, tabBarLabel: TabBarLabel };
}
