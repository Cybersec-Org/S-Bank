import { createTheme, darkColors, lightColors, MIN_TOUCH_TARGET, type ColorTokens } from './theme';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [red = 0, green = 0, blue = 0] = channels;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

describe('design tokens', () => {
  it('uses the colours of the design in the light theme', () => {
    expect(lightColors).toMatchObject({
      bg: '#F3F6F4',
      surface: '#FFFFFF',
      text: '#10201C',
      textMuted: '#4A5A55',
      textDisabled: '#5B6A65',
      primary: '#0E5A47',
      primaryPressed: '#0A4335',
      primarySoft: '#E1EEE9',
      onPrimarySoft: '#173B31',
      onPrimaryMuted: '#D6EBE4',
      warningBg: '#FFF1DC',
      warningText: '#6B3A00',
      danger: '#8A2A1B',
      border: '#D5DEDA',
      borderStrong: '#B9C7C1',
      divider: '#E6ECE9',
      neutralChip: '#E9EFEC',
    });
  });

  it('keeps every touch target at least 44 px', () => {
    expect(MIN_TOUCH_TARGET).toBeGreaterThanOrEqual(44);
    expect(createTheme('light').minTouchTarget).toBe(MIN_TOUCH_TARGET);
  });

  it('uses Figtree weights 400 to 800 and no hard-coded weights', () => {
    const { typography } = createTheme('light');
    Object.values(typography).forEach((style) => {
      expect(style.fontFamily).toMatch(
        /^Figtree_(400Regular|500Medium|600SemiBold|700Bold|800ExtraBold)$/,
      );
      expect(style).not.toHaveProperty('fontWeight');
    });
    expect(typography.balance).toMatchObject({ fontSize: 38 });
    expect(typography.amountPay).toMatchObject({ fontSize: 40 });
    expect(typography.amountConfirm).toMatchObject({ fontSize: 36 });
    expect(typography.amountInput).toMatchObject({ fontSize: 28 });
    expect(typography.listTitle).toMatchObject({ fontSize: 15 });
  });

  describe.each([
    ['light', lightColors],
    ['dark', darkColors],
  ] as const)('%s palette contrast (WCAG AA, 4.5:1)', (_scheme, colors: ColorTokens) => {
    it.each([
      ['text', 'bg'],
      ['text', 'surface'],
      ['textMuted', 'bg'],
      ['textMuted', 'surface'],
      ['textDisabled', 'bg'],
      ['onPrimary', 'primary'],
      ['onPrimaryMuted', 'primary'],
      ['onPrimarySoft', 'primarySoft'],
      ['warningText', 'warningBg'],
      ['danger', 'surface'],
      ['danger', 'dangerBg'],
      ['primary', 'surface'],
      ['text', 'neutralChip'],
    ] as const)('%s on %s', (foreground, background) => {
      expect(contrast(colors[foreground], colors[background])).toBeGreaterThanOrEqual(4.5);
    });
  });
});
