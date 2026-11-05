/**
 * Design tokens of the S-Bank mock-ups (390 x 844). Features never use raw colours, sizes or spacing
 * values: they read them from the theme. The light palette is copied from the design; the dark palette
 * is derived from it (the mock-ups have no dark variant) and keeps the same contrast roles.
 */

export interface ColorTokens {
  /** Screen background. */
  readonly bg: string;
  /** Cards, fields and the bottom navigation. */
  readonly surface: string;
  readonly text: string;
  /** Labels, descriptions, inactive tabs. */
  readonly textMuted: string;
  readonly textDisabled: string;
  /** Main buttons, balance card, incoming amounts, active tab. */
  readonly primary: string;
  readonly primaryPressed: string;
  /** Information panels and chips. */
  readonly primarySoft: string;
  /** Text and icons on `primary`. */
  readonly onPrimary: string;
  readonly onPrimarySoft: string;
  /** Secondary text on the balance card. */
  readonly onPrimaryMuted: string;
  /** Step-up panel and the read-only banner. */
  readonly warningBg: string;
  readonly warningText: string;
  readonly danger: string;
  readonly dangerBg: string;
  /** Card borders. */
  readonly border: string;
  /** Borders of fields and secondary buttons. */
  readonly borderStrong: string;
  readonly divider: string;
  readonly neutralChip: string;
  readonly focusRing: string;
  /** Dimmed backdrop behind dialogs and sheets. */
  readonly scrim: string;
}

export const lightColors: ColorTokens = {
  bg: '#F3F6F4',
  surface: '#FFFFFF',
  text: '#10201C',
  textMuted: '#4A5A55',
  textDisabled: '#5B6A65',
  primary: '#0E5A47',
  primaryPressed: '#0A4335',
  primarySoft: '#E1EEE9',
  onPrimary: '#FFFFFF',
  onPrimarySoft: '#173B31',
  onPrimaryMuted: '#D6EBE4',
  warningBg: '#FFF1DC',
  warningText: '#6B3A00',
  danger: '#8A2A1B',
  dangerBg: '#FBE9E5',
  border: '#D5DEDA',
  borderStrong: '#B9C7C1',
  divider: '#E6ECE9',
  neutralChip: '#E9EFEC',
  focusRing: '#0E5A47',
  scrim: 'rgba(16, 32, 28, 0.5)',
};

export const darkColors: ColorTokens = {
  bg: '#0E1512',
  surface: '#17211D',
  text: '#E8F0EC',
  textMuted: '#A9B9B3',
  textDisabled: '#8A9A94',
  primary: '#5CC2A2',
  primaryPressed: '#7AD3B7',
  primarySoft: '#1B3A31',
  onPrimary: '#06251C',
  onPrimarySoft: '#D6EBE4',
  onPrimaryMuted: '#12392D',
  warningBg: '#3A2B0A',
  warningText: '#F5C46B',
  danger: '#FF9C8A',
  dangerBg: '#3B1714',
  border: '#2B3A35',
  borderStrong: '#5B6F68',
  divider: '#22302B',
  neutralChip: '#22302B',
  focusRing: '#5CC2A2',
  scrim: 'rgba(0, 0, 0, 0.6)',
};

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  /** Side margin of every screen in the design. */
  gutter: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 6,
  /** Buttons and banners. */
  md: 12,
  /** Text fields. */
  field: 14,
  /** Cards. */
  lg: 16,
  /** Balance card and summary card. */
  xl: 22,
  /** The logo tile. */
  logo: 24,
  pill: 999,
} as const;

/** Figtree weights as loaded by `useFonts` (React Native needs one family name per weight). */
export const fonts = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  extrabold: 'Figtree_800ExtraBold',
} as const;

export const typography = {
  /** The S-Bank wordmark on the login screen. */
  brand: { fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 40 },
  /** Page title of the employee panel. */
  pageTitle: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34 },
  /** Page title on rates. */
  title: { fontFamily: fonts.extrabold, fontSize: 24, lineHeight: 30 },
  /** Screen title next to the back arrow. */
  screenTitle: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
  /** Section heading. */
  heading: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 23 },
  /** Customer name on the dashboard. */
  userName: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },
  greeting: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
  /** Text of list rows. */
  listTitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  button: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22 },
  buttonSmall: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 },
  tab: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
  tabActive: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16 },
  /** Balance on the dashboard card. */
  balance: { fontFamily: fonts.extrabold, fontSize: 38, lineHeight: 44 },
  /** Amount typed into the transfer form. */
  amountInput: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34 },
  /** Amount on the transfer confirmation. */
  amountConfirm: { fontFamily: fonts.extrabold, fontSize: 36, lineHeight: 42 },
  /** Amount on the payment request. */
  amountPay: { fontFamily: fonts.extrabold, fontSize: 40, lineHeight: 46 },
} as const;

/** Minimum touch target in density-independent pixels (WCAG 2.5.5, Material, HIG). */
export const MIN_TOUCH_TARGET = 44;

export const layout = {
  contentMaxWidthNarrow: 560,
  contentMaxWidthWide: 1280,
  /** Space above the logo on the login screen. */
  loginTopSpace: 96,
  /** Employee form fields and search never grow past this width. */
  searchMaxWidth: 420,
  /** Below this width the employee panel stacks menu and content. */
  employeeStackBreakpoint: 900,
  progressBarHeight: 8,
  borderWidth: 1,
  amountBorderWidth: 2,
  focusRingWidth: 2,
  buttonHeightLarge: 56,
  buttonHeightMedium: 52,
  buttonHeightSmall: 48,
  fieldHeight: 50,
  amountFieldHeight: 64,
  logoSize: 84,
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
