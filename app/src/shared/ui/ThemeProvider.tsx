import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { createTheme, type ColorScheme, type Theme } from './theme';

const ThemeContext = createContext<Theme>(createTheme('light'));

interface ThemeProviderProps {
  readonly children: ReactNode;
  /** Forces a scheme (tests); otherwise the system setting is followed. */
  readonly scheme?: ColorScheme;
}

export function ThemeProvider({ children, scheme }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const resolved: ColorScheme = scheme ?? (systemScheme === 'dark' ? 'dark' : 'light');
  const theme = useMemo(() => createTheme(resolved), [resolved]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
