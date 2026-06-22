/**
 * Talkify — a premium design system in the spirit of Linear / Vercel / Raycast.
 *
 * The dark world is the hero: a near-black neutral canvas (never pure #000, which
 * smears on OLED) with surfaces that step up in cool graphite. A single refined
 * indigo accent (`#5E6AD2`) drives every active state, CTA and outgoing bubble —
 * everything else stays quiet so the accent always reads. Separation comes from
 * hairline borders and surface lightness, not heavy shadows; the one coloured
 * light in the room is a soft indigo glow.
 *
 * Light/dark are designed as a pair and share the exact same token keys, so every
 * screen reads the same `Palette` shape and flipping `scheme` reskins the whole app.
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
 * The dark world — "Cinema Mobile". Near-black neutral canvas, cool graphite
 * surfaces, refined indigo accent. No pure black; separation via hairlines + glow.
 */
const dark: Palette = {
  // Base canvas — near-black, faintly cool. Surfaces step up in neutral graphite.
  bg: '#08090B',
  bg2: '#0E1014', // base elevated — chat containers, grouped sections
  bg3: '#16181D', // elevated — sheets, pressed cells, raised cards

  // Solid surfaces (cards, search bars, inputs).
  surface: '#101216',
  surface2: '#181B21',
  input: '#101216',

  // Translucent overlays — neutral white glass (premium, not tinted).
  glass: 'rgba(255,255,255,0.04)',
  glass2: 'rgba(255,255,255,0.07)',
  glassStrong: 'rgba(255,255,255,0.12)',
  stroke: 'rgba(255,255,255,0.08)',
  stroke2: 'rgba(255,255,255,0.14)',

  // Text — three-level neutral hierarchy tuned for the dark canvas.
  text: '#ECEDEF',
  textDim: '#A4A9B2',
  textFaint: '#71767F',

  // Brand — fresh emerald-teal. A bright, premium accent that pops on near-black.
  brand1: '#3FE3CD', // bright highlight — avatar ring top, glow
  brand2: '#16C2A8', // the accent — badges, active tab, ticks, FAB
  brand3: '#0E9A88', // deep stop — gradient bottoms, pressed
  accent: '#16C2A8',
  accentSoft: 'rgba(22,194,168,0.16)',
  ink: '#06231F', // near-black teal — sits on the BRIGHT accent (FAB icon, badge text)

  // Semantic colours — slightly desaturated for a premium, calm read.
  success: '#3FB950',
  danger: '#F2555A',
  online: '#34D399', // emerald presence dot — distinct from the teal accent
  warning: '#E3B341',
  pin: '#38BDF8',
  mute: '#3FB950',

  // Bubble fills — outgoing uses a deeper teal so white text stays readable.
  bubbleOut: '#0FAB95',
  bubbleIn: '#181B21',

  white: '#ffffff',
  black: '#000000',

  gBubble: ['#15BFA5', '#0A8674'],
  bloom1: ['rgba(22,194,168,0.22)', 'rgba(22,194,168,0)'],
  bloom2: ['rgba(14,154,136,0.14)', 'rgba(14,154,136,0)'],
  bloom3: ['rgba(63,227,205,0.07)', 'rgba(63,227,205,0)'],
} as const;

/** The light world — clean paper canvas, soft neutral surfaces, same indigo accent. */
const light: Palette = {
  bg: '#FFFFFF',
  bg2: '#F6F7F9',
  bg3: '#EDEEF2',

  surface: '#F6F7F9',
  surface2: '#FFFFFF',
  input: '#F1F2F5',

  glass: 'rgba(10,12,20,0.035)',
  glass2: 'rgba(10,12,20,0.06)',
  glassStrong: 'rgba(10,12,20,0.10)',
  stroke: 'rgba(10,12,20,0.08)',
  stroke2: 'rgba(10,12,20,0.14)',

  text: '#0B0C0F',
  textDim: '#4A4F58',
  textFaint: '#8A8F98',

  brand1: '#2DD4BF',
  brand2: '#0F9E8A',
  brand3: '#0B7A6B',
  accent: '#0F9E8A',
  accentSoft: 'rgba(15,158,138,0.12)',
  ink: '#FFFFFF',

  success: '#1A7F37',
  danger: '#E5484D',
  online: '#0FA37F',
  warning: '#BF8700',
  pin: '#0969DA',
  mute: '#1A7F37',

  bubbleOut: '#0F9E8A',
  bubbleIn: '#F1F2F5',

  white: '#ffffff',
  black: '#000000',

  gBubble: ['#15BFA5', '#0A8674'],
  bloom1: ['rgba(22,194,168,0.16)', 'rgba(22,194,168,0)'],
  bloom2: ['rgba(14,154,136,0.10)', 'rgba(14,154,136,0)'],
  bloom3: ['rgba(45,212,191,0.08)', 'rgba(45,212,191,0)'],
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

export type ThemeId = 'aurora' | 'indigo' | 'sunset' | 'ocean' | 'orchid';

export const THEME_META: { id: ThemeId; name: string; swatch: readonly [string, string] }[] = [
  { id: 'aurora', name: 'Aurora', swatch: ['#3FE3CD', '#0E9A88'] },
  { id: 'indigo', name: 'Indigo', swatch: ['#9AA2F7', '#4F46E5'] },
  { id: 'sunset', name: 'Sunset', swatch: ['#FDA4AF', '#E11D48'] },
  { id: 'ocean', name: 'Ocean', swatch: ['#7CC0FF', '#1E5FD8'] },
  { id: 'orchid', name: 'Orchid', swatch: ['#C99BFB', '#8B2FE0'] },
];

export const themes: Record<ThemeId, { dark: Palette; light: Palette }> = {
  aurora: { dark, light },
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
  // brand / brandSoft / bubble are repainted per-theme by applyThemeGradients()
  // so static consumers (FAB, send button, story rings, badges) track the theme.
  brand: ['#19C9AE', '#0C8A79'] as [string, string],
  brandSoft: ['#3FE3CD', '#0E9A88'] as [string, string],
  bubble: ['#15BFA5', '#0A8674'] as [string, string],
  aurora1: ['rgba(22,194,168,0.20)', 'rgba(22,194,168,0)'] as const,
  aurora2: ['rgba(63,227,205,0.10)', 'rgba(63,227,205,0)'] as const,
  aurora3: ['rgba(14,154,136,0.12)', 'rgba(14,154,136,0)'] as const,
  // Curated per-avatar duotones — vivid but harmonised, led by the teal family.
  avatars: [
    ['#16C2A8', '#3FE3CD'],
    ['#2bb3a3', '#36d3c0'],
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
  // Repaint the coloured glow so the one light in the room tracks the accent —
  // otherwise FAB / send button / icon orbs keep the old theme's halo.
  shadow.glow = mkShadow(hexToRgba(p.brand2, 0.45), 0, 8, 24, 0.5, 8);
}

/** "#RRGGBB" → "rgba(r,g,b,a)". Falls back to the input for already-rgba/unknown strings. */
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Soft corner scale: inputs/buttons small, cards 16, modals 20–28. */
export const radius = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 28,
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

// `glow` is repainted per-theme by applyThemeGradients(); card/soft stay constant.
export const shadow = {
  card: mkShadow('rgba(0,0,0,0.55)', 0, 14, 36, 0.4, 9),
  glow: mkShadow('rgba(22,194,168,0.45)', 0, 8, 24, 0.5, 8),
  soft: mkShadow('rgba(0,0,0,0.4)', 0, 6, 18, 0.35, 5),
};

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
