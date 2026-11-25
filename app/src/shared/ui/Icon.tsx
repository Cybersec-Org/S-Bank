import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const VIEW_BOX = '0 0 24 24';
const STROKE_WIDTH = 1.9;
const DEFAULT_SIZE = 24;
const NO_POINTER_EVENTS = { pointerEvents: 'none' } as const;

/** Line icons of the design: 24 px grid, stroke 1.9, round caps and joins. */
const GLYPHS = {
  key: (
    <>
      <Circle cx="7.5" cy="15.5" r="5.5" />
      <Path d="m21 2-9.6 9.6" />
      <Path d="m15.5 7.5 3 3L22 7l-3-3" />
    </>
  ),
  shield: (
    <>
      <Path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <Path d="m9 12 2 2 4-4" />
    </>
  ),
  lock: (
    <>
      <Rect x="3" y="11" width="18" height="11" rx="2" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  arrowLeft: (
    <>
      <Path d="m12 19-7-7 7-7" />
      <Path d="M19 12H5" />
    </>
  ),
  transfer: (
    <>
      <Path d="m16 3 4 4-4 4" />
      <Path d="M20 7H4" />
      <Path d="m8 21-4-4 4-4" />
      <Path d="M4 17h16" />
    </>
  ),
  qr: (
    <>
      <Rect x="3" y="3" width="5" height="5" rx="1" />
      <Rect x="16" y="3" width="5" height="5" rx="1" />
      <Rect x="3" y="16" width="5" height="5" rx="1" />
      <Path d="M21 16h-3a2 2 0 0 0-2 2v3" />
      <Path d="M21 21v.01" />
      <Path d="M12 7v3a2 2 0 0 1-2 2H7" />
      <Path d="M3 12h.01" />
      <Path d="M12 3h.01" />
      <Path d="M12 16v.01" />
      <Path d="M16 12h1" />
      <Path d="M21 12v.01" />
      <Path d="M12 21v-1" />
    </>
  ),
  rates: (
    <>
      <Path d="M16 7h6v6" />
      <Path d="m22 7-8.5 8.5-5-5L2 17" />
    </>
  ),
  atm: (
    <>
      <Path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <Circle cx="12" cy="10" r="3" />
    </>
  ),
  home: (
    <>
      <Path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <Path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  user: (
    <>
      <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </>
  ),
  file: (
    <>
      <Path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <Path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <Path d="M10 9H8" />
      <Path d="M16 13H8" />
      <Path d="M16 17H8" />
    </>
  ),
  store: (
    <>
      <Path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <Path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <Path d="M2 7h20" />
      <Path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />
    </>
  ),
  globe: (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <Path d="M2 12h20" />
    </>
  ),
  eye: (
    <>
      <Path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <Circle cx="12" cy="12" r="3" />
    </>
  ),
  check: <Path d="M20 6 9 17l-5-5" />,
  clock: (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M12 6v6l4 2" />
    </>
  ),
  info: (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M12 16v-4" />
      <Path d="M12 8h.01" />
    </>
  ),
  alert: (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M12 8v4" />
      <Path d="M12 16h.01" />
    </>
  ),
  logout: (
    <>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Path d="m16 17 5-5-5-5" />
      <Path d="M21 12H9" />
    </>
  ),
  chevronDown: <Path d="m6 9 6 6 6-6" />,
  users: (
    <>
      <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  wallet: (
    <>
      <Path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <Path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </>
  ),
} as const;

export type IconName = keyof typeof GLYPHS;

interface IconProps {
  readonly name: IconName;
  readonly color: ColorValue;
  readonly size?: number;
}

/** Decorative by default: the control that contains the icon carries the accessible name. */
export function Icon({ name, color, size = DEFAULT_SIZE }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={VIEW_BOX}
      fill="none"
      stroke={color}
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={NO_POINTER_EVENTS}
    >
      {GLYPHS[name]}
    </Svg>
  );
}
