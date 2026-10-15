import type { TextStyle, ViewStyle } from 'react-native';

/**
 * RunLoop design system — locked 2026-07-21 interview.
 * Two user-selectable modes (Phase 5.5): dark = "Night", light = "Day". Dark is the
 * originating design; light is the same system re-grounded for a light context.
 * Signature violet #5E2BE0 (fills) + #9D6BFF (glow/route/active) on violet-biased
 * near-black. "Sport" numerals = Barlow Condensed Black Italic. "Mixed" surfaces =
 * rounded cards with hairline rules. See RUNLOOP_V3_PLAN.md Task 3.1.
 */

// ---- Bundled font family names (must match the keys passed to useFonts) ----
export const fonts = {
  black: 'BarlowCondensed-Black',
  blackItalic: 'BarlowCondensed-BlackItalic',
  semibold: 'BarlowCondensed-SemiBold',
  medium: 'BarlowCondensed-Medium',
} as const;

/** Pass to useFonts() in App.tsx. */
export const fontAssets = {
  [fonts.black]: require('../../assets/fonts/BarlowCondensed-Black.ttf'),
  [fonts.blackItalic]: require('../../assets/fonts/BarlowCondensed-BlackItalic.ttf'),
  [fonts.semibold]: require('../../assets/fonts/BarlowCondensed-SemiBold.ttf'),
  [fonts.medium]: require('../../assets/fonts/BarlowCondensed-Medium.ttf'),
};

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  textMuted: string;
  textDim: string;
  accent: string;        // #5E2BE0 — fills, buttons, wordmark, split bars
  accentBright: string;  // #9D6BFF — route trace, glow, active states, small accent text
  accentOn: string;      // text/icon colour on an accent fill
  line: string;          // hairline rules, card borders
  lineBright: string;    // tick-marks, emphasised rules
  danger: string;
  success: string;
  mapRoute: string;      // active / covered route stroke
  mapRouteMuted: string; // remaining / uncovered route
  mapCandidate: string;  // non-selected candidate loops
  mapTrace: string;      // recorded GPS trace during a run
}

type TypeRole =
  | 'hero'      // giant single hero stat (active-run distance)
  | 'statLg'    // large stat numerals (summary grid)
  | 'statMd'    // inline cell numerals (pace/time)
  | 'h1'        // screen titles
  | 'h2'        // section / card headings
  | 'body'      // running text, controls
  | 'bodyStrong'
  | 'label'     // uppercase micro-labels
  | 'button';

export interface Theme {
  dark: boolean;
  colors: ThemeColors;
  space: (n: number) => number;                 // 4px base scale
  radius: { sm: number; md: number; lg: number; pill: number };
  type: Record<TypeRole, TextStyle>;
  shadow: { card: ViewStyle; glow: ViewStyle };
}

const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;
const space = (n: number) => n * 4;

// Sport numerals: explicit italic family (custom fonts don't reliably synthesise
// italic on Android), tabular figures so columns line up.
const sportBase: TextStyle = {
  fontFamily: fonts.blackItalic,
  fontVariant: ['tabular-nums'],
  letterSpacing: 0.3,
};

const type: Record<TypeRole, TextStyle> = {
  hero: { ...sportBase, fontSize: 60, lineHeight: 58 },
  statLg: { ...sportBase, fontSize: 30, lineHeight: 32 },
  statMd: { ...sportBase, fontSize: 24, lineHeight: 26 },
  h1: { fontFamily: fonts.black, fontSize: 26, lineHeight: 28, letterSpacing: 0.2 },
  h2: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, letterSpacing: 0.3 },
  body: { fontSize: 15, lineHeight: 21 },        // system font (SF Pro) — no fontFamily
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  label: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  button: { fontFamily: fonts.black, fontSize: 16, letterSpacing: 0.6 },
};

const darkColors: ThemeColors = {
  bg: '#08080C',
  surface: '#15131F',
  surfaceRaised: '#1B1828',
  text: '#EFECF6',
  textMuted: '#8B84A0',
  textDim: '#5F596F',
  accent: '#5E2BE0',
  accentBright: '#9D6BFF',
  accentOn: '#FFFFFF',
  line: '#272235',
  lineBright: '#3A3350',
  danger: '#FF6A7D',
  success: '#3ED598',
  mapRoute: '#9D6BFF',
  mapRouteMuted: '#3A3350',
  // #5E2BE0 measures only 2.45 on the dark-v11 land fill — too dim for unselected
  // loops to be findable. This lighter violet is what RouteMap used to hardcode.
  mapCandidate: '#7A67C0',
  mapTrace: '#9D6BFF',
};

// Light theme = "Day mode" (Phase 5.5). Same accent, type and shape language as
// dark; only the neutrals and the semantic/map colours differ. Every value below
// is contrast-checked in contrast.test.ts — don't hand-tweak without rerunning it.
const lightColors: ThemeColors = {
  bg: '#F4F4F8',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  text: '#14121C',
  textMuted: '#5F5A70',
  textDim: '#6F6982',
  accent: '#5E2BE0',
  accentBright: '#7A46F0',
  accentOn: '#FFFFFF',
  line: '#E5E3ED',
  lineBright: '#CFCADA',
  danger: '#C42A40',
  success: '#0E7A55',
  mapRoute: '#5E2BE0',
  mapRouteMuted: '#857F99',
  mapCandidate: '#7A6BB0',
  mapTrace: '#5E2BE0',
};

export const darkTheme: Theme = {
  dark: true,
  colors: darkColors,
  space,
  radius,
  type,
  shadow: {
    card: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 6,
    },
    glow: {
      shadowColor: '#9D6BFF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.55,
      shadowRadius: 14,
      elevation: 8,
    },
  },
};

export const lightTheme: Theme = {
  dark: false,
  colors: lightColors,
  space,
  radius,
  type,
  shadow: {
    card: {
      shadowColor: '#2A2440',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
      elevation: 3,
    },
    glow: {
      shadowColor: '#5E2BE0',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 4,
    },
  },
};
