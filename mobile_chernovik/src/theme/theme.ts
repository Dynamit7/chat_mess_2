/**
 * Talkify — premium wellness-app aesthetic (glassmorphism + neon accents).
 *
 * Dark: midnight canvas with neon-lime CTAs, outgoing bubbles and glows — the
 * Bahabr / fitness-app look. Light: airy pastel canvas with lavender accents and
 * soft card shadows — the MindTrack / meditation-app look. Large radii, generous
 * spacing and frosted surfaces everywhere; separation via depth + blur, not lines.
 *
 * Light/dark share the exact same `Palette` keys so flipping `scheme` reskins all screens.
 */
import { Platform, Easing } from 'react-native';

/** Shape shared by both light and dark worlds — every screen reads these tokens. */
export interface Palette {
  bg: string; bg2: string; bg3: string;
  surface: string; surface2: string; input: string;
  glass: string; glass2: string; glassStrong: string; stroke: string; stroke2: string;
  text: string; textDim: string; textFaint: string;
  brand1: string; brand2: string; brand3: string; accent: string; accentSoft: string; ink: string;
  success: string; danger: string; online: string; warning: string; pin: string; mute: string;
  bubbleOut: string; bubbleIn: string;
  white: string; black: string;
  // Theme-specific art: outgoing-bubble gradient + the three background blooms
  // the AuroraBackground paints. Each theme repaints these for a distinct canvas.
  gBubble: readonly [string, string];
  bloom1: readonly [string, string]; // strongest light source, top-left
  bloom2: readonly [string, string]; // counter-light, lower-right
  bloom3: readonly [string, string]; // faint wash, centre-right
}

/**
 * Dark — midnight canvas, neon-lime accent, frosted glass surfaces.
 */
const dark: Palette = {
  bg: '#0A0C12',
  bg2: '#111520',
  bg3: '#181C28',

  surface: 'rgba(255,255,255,0.05)',
  surface2: 'rgba(255,255,255,0.08)',
  input: 'rgba(255,255,255,0.06)',

  glass: 'rgba(255,255,255,0.05)',
  glass2: 'rgba(255,255,255,0.09)',
  glassStrong: 'rgba(255,255,255,0.14)',
  stroke: 'rgba(255,255,255,0.08)',
  stroke2: 'rgba(255,255,255,0.14)',

  text: '#F4F5F8',
  textDim: '#A8AEB8',
  textFaint: '#6E7580',

  brand1: '#EFFF42',
  brand2: '#D4FF5E',
  brand3: '#B8E035',
  accent: '#D4FF5E',
  accentSoft: 'rgba(212,255,94,0.16)',
  ink: '#0A0C10',

  success: '#4ADE80',
  danger: '#FF6B6B',
  online: '#D4FF5E',
  warning: '#FBBF24',
  pin: '#60A5FA',
  mute: '#4ADE80',

  bubbleOut: '#C5F038',
  bubbleIn: 'rgba(255,255,255,0.07)',

  white: '#ffffff',
  black: '#000000',

  gBubble: ['#EFFF42', '#A8D830'],
  bloom1: ['rgba(212,255,94,0.20)', 'rgba(212,255,94,0)'],
  bloom2: ['rgba(148,152,241,0.12)', 'rgba(148,152,241,0)'],
  bloom3: ['rgba(239,255,66,0.06)', 'rgba(239,255,66,0)'],
} as const;

/** Light — airy pastel canvas, lavender accent, white floating cards. */
const light: Palette = {
  bg: '#F0F1F8',
  bg2: '#E8EAF3',
  bg3: '#DFE2EE',

  surface: '#FFFFFF',
  surface2: '#F8F9FC',
  input: '#FFFFFF',

  glass: 'rgba(255,255,255,0.72)',
  glass2: 'rgba(255,255,255,0.88)',
  glassStrong: 'rgba(255,255,255,0.95)',
  stroke: 'rgba(20,24,40,0.06)',
  stroke2: 'rgba(20,24,40,0.10)',

  text: '#141828',
  textDim: '#5A6070',
  textFaint: '#949AA8',

  brand1: '#A8ACFF',
  brand2: '#9498F1',
  brand3: '#7B80E0',
  accent: '#9498F1',
  accentSoft: 'rgba(148,152,241,0.14)',
  ink: '#FFFFFF',

  success: '#22C55E',
  danger: '#EF4444',
  online: '#D4FF5E',
  warning: '#F59E0B',
  pin: '#3B82F6',
  mute: '#22C55E',

  bubbleOut: '#9498F1',
  bubbleIn: '#FFFFFF',

  white: '#ffffff',
  black: '#000000',

  gBubble: ['#A8ACFF', '#7B80E0'],
  bloom1: ['rgba(148,152,241,0.18)', 'rgba(148,152,241,0)'],
  bloom2: ['rgba(212,255,94,0.10)', 'rgba(212,255,94,0)'],
  bloom3: ['rgba(168,172,255,0.08)', 'rgba(168,172,255,0)'],
} as const;

// ── Theme variants ──────────────────────────────────────────────────────────
// Every theme keeps the same neutral canvas + the exact Palette key shape, and
// only repaints the accent family, the outgoing bubble and the three background
// blooms — so switching theme reskins the whole app (accent + canvas) at once.

type AccentOverride = Pick<Palette,
  'brand1' | 'brand2' | 'brand3' | 'accent' | 'accentSoft' | 'ink' |
  'bubbleOut' | 'gBubble' | 'bloom1' | 'bloom2' | 'bloom3'>;

/** Build the three aurora blooms from base "r,g,b" strings. `scale` dims them for light mode. */
const blooms = (
  strong: string, deep: string, bright: string, scale = 1,
): Pick<Palette, 'bloom1' | 'bloom2' | 'bloom3'> => ({
  bloom1: [`rgba(${strong},${0.22 * scale})`, `rgba(${strong},0)`],
  bloom2: [`rgba(${deep},${0.14 * scale})`, `rgba(${deep},0)`],
  bloom3: [`rgba(${bright},${0.07 * scale})`, `rgba(${bright},0)`],
});

const mkVariant = (d: AccentOverride, l: AccentOverride) => ({
  dark: { ...dark, ...d },
  light: { ...light, ...l },
});

export type ThemeId = 'aurora' | 'neon' | 'mind' | 'indigo' | 'sunset' | 'ocean' | 'orchid';

export const THEME_META: { id: ThemeId; name: string; swatch: readonly [string, string] }[] = [
  { id: 'aurora', name: 'Aurora', swatch: ['#EFFF42', '#9498F1'] },
  { id: 'neon', name: 'Neon', swatch: ['#EFFF42', '#B8E035'] },
  { id: 'mind', name: 'Mind', swatch: ['#9498F1', '#D4FF5E'] },
  { id: 'indigo', name: 'Indigo', swatch: ['#9AA2F7', '#4F46E5'] },
  { id: 'sunset', name: 'Sunset', swatch: ['#FDA4AF', '#E11D48'] },
  { id: 'ocean', name: 'Ocean', swatch: ['#7CC0FF', '#1E5FD8'] },
  { id: 'orchid', name: 'Orchid', swatch: ['#C99BFB', '#8B2FE0'] },
];

export const themes: Record<ThemeId, { dark: Palette; light: Palette }> = {
  aurora: { dark, light },
  neon: mkVariant(
    { brand1: '#EFFF42', brand2: '#D4FF5E', brand3: '#A8D830', accent: '#D4FF5E', accentSoft: 'rgba(212,255,94,0.18)', ink: '#0A0C10', bubbleOut: '#C5F038', gBubble: ['#EFFF42', '#A8D830'], ...blooms('212,255,94', '168,216,48', '239,255,66') },
    { brand1: '#EFFF42', brand2: '#D4FF5E', brand3: '#B8E035', accent: '#D4FF5E', accentSoft: 'rgba(212,255,94,0.14)', ink: '#0A0C10', bubbleOut: '#D4FF5E', gBubble: ['#EFFF42', '#B8E035'], ...blooms('212,255,94', '184,224,53', '239,255,66', 0.7) },
  ),
  mind: mkVariant(
    { brand1: '#A8ACFF', brand2: '#9498F1', brand3: '#7B80E0', accent: '#9498F1', accentSoft: 'rgba(148,152,241,0.18)', ink: '#FFFFFF', bubbleOut: '#868BF0', gBubble: ['#A8ACFF', '#7B80E0'], ...blooms('148,152,241', '123,128,224', '212,255,94') },
    { brand1: '#A8ACFF', brand2: '#9498F1', brand3: '#7B80E0', accent: '#9498F1', accentSoft: 'rgba(148,152,241,0.14)', ink: '#FFFFFF', bubbleOut: '#9498F1', gBubble: ['#A8ACFF', '#7B80E0'], ...blooms('148,152,241', '123,128,224', '212,255,94', 0.7) },
  ),
  indigo: mkVariant(
    { brand1: '#9AA2F7', brand2: '#6366F1', brand3: '#4F46E5', accent: '#6366F1', accentSoft: 'rgba(99,102,241,0.18)', ink: '#FFFFFF', bubbleOut: '#5B62E8', gBubble: ['#7077EE', '#4F46E5'], ...blooms('99,102,241', '79,70,229', '154,162,247') },
    { brand1: '#818CF8', brand2: '#5457E0', brand3: '#4338CA', accent: '#5457E0', accentSoft: 'rgba(84,87,224,0.12)', ink: '#FFFFFF', bubbleOut: '#5457E0', gBubble: ['#6D74EE', '#4F46E5'], ...blooms('99,102,241', '79,70,229', '129,140,248', 0.7) },
  ),
  sunset: mkVariant(
    { brand1: '#FDA4AF', brand2: '#F4506A', brand3: '#E11D48', accent: '#F4506A', accentSoft: 'rgba(244,80,106,0.18)', ink: '#FFFFFF', bubbleOut: '#F25571', gBubble: ['#FB7185', '#E11D48'], ...blooms('251,113,133', '244,63,94', '253,186,116') },
    { brand1: '#FB7185', brand2: '#E11D48', brand3: '#BE123C', accent: '#E11D48', accentSoft: 'rgba(225,29,72,0.12)', ink: '#FFFFFF', bubbleOut: '#E11D48', gBubble: ['#FB7185', '#E11D48'], ...blooms('251,113,133', '244,63,94', '253,186,116', 0.7) },
  ),
  ocean: mkVariant(
    { brand1: '#7CC0FF', brand2: '#2D7DF6', brand3: '#1E5FD8', accent: '#2D7DF6', accentSoft: 'rgba(45,125,246,0.18)', ink: '#FFFFFF', bubbleOut: '#2A78F0', gBubble: ['#46A0FF', '#1E5FD8'], ...blooms('45,125,246', '30,95,216', '34,211,238') },
    { brand1: '#3B82F6', brand2: '#2563EB', brand3: '#1D4ED8', accent: '#2563EB', accentSoft: 'rgba(37,99,235,0.12)', ink: '#FFFFFF', bubbleOut: '#2563EB', gBubble: ['#3B82F6', '#1D4ED8'], ...blooms('45,125,246', '30,95,216', '96,165,250', 0.7) },
  ),
  orchid: mkVariant(
    { brand1: '#C99BFB', brand2: '#A855F7', brand3: '#8B2FE0', accent: '#A855F7', accentSoft: 'rgba(168,85,247,0.18)', ink: '#FFFFFF', bubbleOut: '#9D4EEC', gBubble: ['#B36BF9', '#8B2FE0'], ...blooms('168,85,247', '124,58,206', '236,72,153') },
    { brand1: '#A855F7', brand2: '#9333EA', brand3: '#7E22CE', accent: '#9333EA', accentSoft: 'rgba(147,51,234,0.12)', ink: '#FFFFFF', bubbleOut: '#9333EA', gBubble: ['#A855F7', '#7E22CE'], ...blooms('168,85,247', '124,58,206', '192,132,252', 0.7) },
  ),
};

export const palettes = { dark, light } as const;

/**
 * Active palette. Dark is the default per the Talkify spec; switching this to
 * `light` (or wiring a provider) flips the whole app once screens read from a
 * hook. Kept as `colors` so every existing import keeps working.
 */
export const colors = dark;

/**
 * Gradient stops. The indigo brand carries CTAs, outgoing bubbles and the active
 * tab; blooms are barely-there indigo light on near-black; avatars stay colourful
 * but harmonised so they never compete with the accent.
 */
export const gradients = {
  brand: ['#EFFF42', '#A8D830'] as [string, string],
  brandSoft: ['#EFFF42', '#B8E035'] as [string, string],
  bubble: ['#EFFF42', '#A8D830'] as [string, string],
  aurora1: ['rgba(212,255,94,0.18)', 'rgba(212,255,94,0)'] as const,
  aurora2: ['rgba(148,152,241,0.10)', 'rgba(148,152,241,0)'] as const,
  aurora3: ['rgba(239,255,66,0.08)', 'rgba(239,255,66,0)'] as const,
  avatars: [
    ['#D4FF5E', '#EFFF42'],
    ['#9498F1', '#A8ACFF'],
    ['#3b5bdb', '#5b8def'],
    ['#6d45f5', '#9b6bff'],
    ['#e0568b', '#f58bb0'],
    ['#f5a623', '#f7c66b'],
    ['#0ea5e9', '#38bdf8'],
    ['#c2569e', '#e08bcf'],
  ] as const,
};

/**
 * Repaint the theme-driven gradient stops so static `gradients.*` consumers
 * (FAB, composer send, story rings, unread badges, outgoing bubble) follow the
 * active theme. ThemeProvider calls this whenever the resolved palette changes.
 */
export function applyThemeGradients(p: Palette) {
  gradients.brand = [p.brand1, p.brand3];
  gradients.brandSoft = [p.brand1, p.brand3];
  gradients.bubble = [p.gBubble[0], p.gBubble[1]];
}

/** Soft corner scale — premium wellness apps use 24–32px radii on cards and bubbles. */
export const radius = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 32,
  full: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const font = {
  display: 'SpaceGrotesk_700Bold',
  displayMed: 'SpaceGrotesk_500Medium',
  body: 'Inter_400Regular',
  bodyMed: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  // Monospace for timestamps / metadata — platform system mono, tabular by nature.
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string,
} as const;

/**
 * Motion tokens — one rhythm across the whole app. The signature curve is the
 * Linear/iOS "soft landing" bezier(0.16, 1, 0.3, 1): fast out, gentle settle.
 * Exits run shorter than enters so the UI feels responsive.
 */
export const motion = {
  // For Animated.timing easing curves.
  easeOut: Easing.bezier(0.16, 1, 0.3, 1),
  easeIn: Easing.bezier(0.4, 0, 1, 1),
  standard: Easing.bezier(0.2, 0, 0, 1),
  // Durations (ms).
  fast: 140,
  base: 220,
  slow: 320,
  // For react-native-reanimated withSpring — natural, slightly springy.
  spring: { damping: 20, stiffness: 220, mass: 0.9 },
  // CSS string for web/style usage.
  bezier: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

// Platform-aware shadows. On near-black they stay subtle; the system leans on
// surface lightness and hairlines for separation, with one soft indigo glow.
const mkShadow = (color: string, x: number, y: number, blur: number, opacity: number, elevation: number) =>
  Platform.OS === 'web'
    ? { boxShadow: `${x}px ${y}px ${blur}px ${color}` }
    : { shadowColor: color, shadowOpacity: opacity, shadowRadius: blur / 2, shadowOffset: { width: x, height: y }, elevation };

export const shadow = {
  card: mkShadow('rgba(0,0,0,0.35)', 0, 12, 32, 0.28, 8),
  cardLight: mkShadow('rgba(20,24,40,0.08)', 0, 8, 24, 0.12, 4),
  glow: mkShadow('rgba(212,255,94,0.50)', 0, 6, 20, 0.55, 6),
  soft: mkShadow('rgba(0,0,0,0.30)', 0, 4, 16, 0.25, 3),
} as const;

/** Pick a stable duotone for a name/id so avatars stay consistent across sessions. */
export function avatarGradient(seed: string | number): readonly [string, string] {
  const s = String(seed ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return gradients.avatars[h % gradients.avatars.length] as readonly [string, string];
}

export function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
