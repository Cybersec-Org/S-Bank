import { useTheme } from './ThemeProvider';

/** Header and tab styling from tokens, so navigators follow the placeholder theme (and its replacement). */
export function useNavigationStyle() {
  const theme = useTheme();
  return {
    screenOptions: {
      headerStyle: { backgroundColor: theme.colors.surface },
      headerTintColor: theme.colors.text,
      headerTitleStyle: { ...theme.typography.heading },
      contentStyle: { backgroundColor: theme.colors.background },
    },
    tabOptions: {
      tabBarActiveTintColor: theme.colors.accent,
      tabBarInactiveTintColor: theme.colors.textMuted,
      tabBarStyle: {
        backgroundColor: theme.colors.surface,
        borderTopColor: theme.colors.border,
      },
      tabBarLabelStyle: { ...theme.typography.label },
      tabBarIcon: () => null,
      tabBarIconStyle: { display: 'none' as const },
    },
  };
}
