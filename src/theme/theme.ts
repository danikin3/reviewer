/**
 * Zentrales Design-System. Alle Farben, Abstände, Radien und Schriftgrößen
 * kommen von hier — keine Hardcoded-Werte in Komponenten.
 *
 * Identität: dunkler Kinosaal. Poster sind die Helden, das UI tritt zurück.
 * Akzentfarbe: warmes Projektor-Gold, sparsam eingesetzt (Sterne, aktive Zustände).
 */

export const colors = {
  // Flächen
  background: '#0B0D10',
  surface: '#14171C',
  surfaceElevated: '#1C2129',
  border: '#262C36',

  // Text
  text: '#F2F4F7',
  textSecondary: '#98A2B3',
  textTertiary: '#5C6672',

  // Akzent
  accent: '#F0B429',
  accentMuted: '#8A6A1F',
  onAccent: '#14120A',

  // Semantik
  danger: '#F04438',
  success: '#32D583',

  // Typ-Badges
  badgeMovie: '#3E63DD',
  badgeTv: '#B657D6',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 999,
} as const;

export const fonts = {
  /** UI-Schrift */
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  /** Zahlen & Statistiken */
  numeric: 'SpaceGrotesk_500Medium',
  numericBold: 'SpaceGrotesk_700Bold',
} as const;

export const typography = {
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, letterSpacing: 0.4 },
  stat: { fontFamily: fonts.numericBold, fontSize: 28, lineHeight: 34 },
  statSmall: { fontFamily: fonts.numeric, fontSize: 16, lineHeight: 20 },
} as const;

/** Mindestgröße für Touch-Targets (Barrierefreiheit) */
export const touchTarget = 44;

export const theme = { colors, spacing, radius, fonts, typography, touchTarget } as const;
export type Theme = typeof theme;
