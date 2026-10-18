/**
 * PLACEHOLDER TOKENS. The visual design is not decided yet: the final design replaces only this file
 * and the primitives in this folder. Features must never use raw colours, sizes or spacing values.
 */

export interface ColorTokens {
  readonly background: string;
  readonly surface: string;
  readonly surfaceMuted: string;
  readonly border: string;
  readonly text: string;
  readonly textMuted: string;
  readonly textOnAccent: string;
  readonly accent: string;
  readonly danger: string;
  readonly dangerSurface: string;
  readonly success: string;
  readonly successSurface: string;
  readonly warning: string;
  readonly warningSurface: string;
  readonly disabled: string;
  readonly focusRing: string;
}

export const lightColors: ColorTokens = {
  background: '#F4F4F5',
  surface: '#FFFFFF',
  surfaceMuted: '#E8E8EA',
  border: '#8A8A90',
  text: '#18181B',
  textMuted: '#52525B',
  textOnAccent: '#FFFFFF',
  accent: '#1D4ED8',
  danger: '#B42318',
  dangerSurface: '#FDECEA',
  success: '#17653A',
  successSurface: '#E6F4EA',
  warning: '#7A4B00',
  warningSurface: '#FFF4D6',
  disabled: '#71717A',
  focusRing: '#1D4ED8',
};

export const darkColors: ColorTokens = {
  background: '#101012',
  surface: '#1C1C1F',
  surfaceMuted: '#2A2A2E',
  border: '#8E8E96',
  text: '#F4F4F5',
  textMuted: '#B4B4BC',
  textOnAccent: '#0A1B4D',
  accent: '#93B4FF',
  danger: '#FF8A80',
  dangerSurface: '#3B1714',
  success: '#7DD3A0',
  successSurface: '#12301F',
  warning: '#F5C46B',
  warningSurface: '#3A2B0A',
  disabled: '#8E8E96',
  focusRing: '#93B4FF',
};

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  money: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
} as const;

/** Minimum touch target in density-independent pixels (WCAG 2.5.5, Material, HIG). */
export const MIN_TOUCH_TARGET = 44;

export const layout = {
  contentMaxWidthNarrow: 560,
  contentMaxWidthWide: 1040,
  progressBarHeight: 10,
  borderWidth: 1,
  focusRingWidth: 2,
} as const;

export type SpacingKey = keyof typeof spacing;
export type TypographyKey = keyof typeof typography;
export type ColorScheme = 'light' | 'dark';

export interface Theme {
  readonly scheme: ColorScheme;
  readonly colors: ColorTokens;
  readonly spacing: typeof spacing;
  readonly radii: typeof radii;
  readonly typography: typeof typography;
  readonly layout: typeof layout;
  readonly minTouchTarget: number;
}

export function createTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    spacing,
    radii,
    typography,
    layout,
    minTouchTarget: MIN_TOUCH_TARGET,
  };
}
