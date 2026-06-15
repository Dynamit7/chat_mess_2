/**
 * Rossi Messenger — a premium, minimalist design system in the spirit of iOS 17/18.
 *
 * The canvas is deep midnight purple; containers and cards step up in violet-tinted
 * graphite. A single vivid violet accent (`#7C4DFF`) drives all active states,
 * CTAs and outgoing bubbles. Everything else stays quiet so the accent always reads.
 *
 * Light/dark are designed as a pair. `colors` is the active (dark) palette so the
 * existing screens keep working unchanged; `palettes.light` / `palettes.dark`
 * hold both worlds for the upcoming runtime theme switch.
 */
import { Platform } from 'react-native';

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
}

/** The dark world — pure black canvas, graphite surfaces, maroon accent. */
const dark: Palette = {
  // Base canvas — deep midnight purple. Surfaces step up in violet-tinted graphite.
  bg: '#0F0A1E',
  bg2: '#17122E', // violet graphite — cards, chat containers, inputs
  bg3: '#221A40', // elevated — sheets, pressed cells

  // Solid surfaces (iOS grouped-list feel).
  surface: '#17122E',
  surface2: '#221A40',
  input: '#17122E',

  // Translucent overlays — violet-tinted glass.
  glass: 'rgba(124,77,255,0.08)',
  glass2: 'rgba(124,77,255,0.13)',
  glassStrong: 'rgba(255,255,255,0.14)',
  stroke: 'rgba(255,255,255,0.07)',
  stroke2: 'rgba(255,255,255,0.13)',

  // Text — four-level hierarchy, slightly violet-tinted.
  text: '#FFFFFF',
  textDim: '#C4BAEE',
  textFaint: '#8B82B5',

  // Brand — vivid violet. The only saturated colour in the system.
  brand1: '#9A5FFF',
  brand2: '#7C4DFF',
  brand3: '#5C30E0',
  accent: '#7C4DFF',
  accentSoft: 'rgba(124,77,255,0.18)',
  ink: '#FFFFFF', // text/icon colour to sit on violet

  // Semantic / iOS system colours (swipe actions, status).
  success: '#34C759',
  danger: '#FF3B30',
  online: '#34C759',
  warning: '#FFD60A',
  pin: '#38BDF8',
  mute: '#34C759',

  // Bubble fills
  bubbleOut: '#7C4DFF',
  bubbleIn: '#17122E',

  white: '#ffffff',
  black: '#000000',
} as const;

/** The light world — paper white canvas, soft-grey surfaces, same maroon accent. */
const light: Palette = {
  bg: '#FFFFFF',
  bg2: '#F2F2F7',
  bg3: '#E5E5EA',

  surface: '#F2F2F7',
  surface2: '#FFFFFF',
  input: '#F2F2F7',

  glass: 'rgba(0,0,0,0.04)',
  glass2: 'rgba(0,0,0,0.06)',
  glassStrong: 'rgba(0,0,0,0.10)',
  stroke: 'rgba(0,0,0,0.08)',
  stroke2: 'rgba(0,0,0,0.14)',

  text: '#000000',
  textDim: '#3C3C43',
  textFaint: '#8E8E93',

  brand1: '#9A5FFF',
  brand2: '#7C4DFF',
  brand3: '#5C30E0',
  accent: '#7C4DFF',
  accentSoft: 'rgba(124,77,255,0.12)',
  ink: '#FFFFFF',

  success: '#34C759',
  danger: '#FF3B30',
  online: '#34C759',
  warning: '#FFCC00',
  pin: '#007AFF',
  mute: '#34C759',

  bubbleOut: '#7C4DFF',
  bubbleIn: '#F2F2F7',

  white: '#ffffff',
  black: '#000000',
} as const;

export const palettes = { dark, light } as const;

/**
 * Active palette. Dark is the default per the Rossi spec; switching this to
 * `light` (or wiring a provider) flips the whole app once screens read from a
 * hook. Kept as `colors` so every existing import keeps working.
 */
export const colors = dark;

/**
 * Gradient stops. The violet brand carries CTAs, outgoing bubbles and the active
 * tab; blooms are barely-there violet light on midnight; avatars stay colourful but
 * harmonised for the contact list.
 */
export const gradients = {
  brand: ['#9A5FFF', '#5C30E0'] as const,
  brandSoft: ['rgba(154,95,255,0.95)', 'rgba(92,48,224,0.95)'] as const,
  bubble: ['#8A50F0', '#5C30E0'] as const,
  aurora1: ['rgba(124,77,255,0.22)', 'rgba(124,77,255,0)'] as const,
  aurora2: ['rgba(124,77,255,0.10)', 'rgba(124,77,255,0)'] as const,
  aurora3: ['rgba(92,48,224,0.12)', 'rgba(92,48,224,0)'] as const,
  // Curated per-avatar duotones — colourful but muted, never competing with violet.
  avatars: [
    ['#7C4DFF', '#9A6FFF'],
    ['#3b5bdb', '#5b8def'],
    ['#2bb3a3', '#36d3c0'],
    ['#e0568b', '#f58bb0'],
    ['#f5a623', '#f7c66b'],
    ['#6d45f5', '#9b6bff'],
    ['#4453c9', '#6e7bff'],
    ['#c2569e', '#e08bcf'],
  ] as const,
} as const;

/** iOS-soft corner scale: inputs/buttons small, cards 16–20, modals 24. */
export const radius = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
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

// Platform-aware shadows. On black they stay near-invisible; the system leans on
// surface lightness and hairlines for separation, with one soft maroon glow.
const mkShadow = (color: string, x: number, y: number, blur: number, opacity: number, elevation: number) =>
  Platform.OS === 'web'
    ? { boxShadow: `${x}px ${y}px ${blur}px ${color}` }
    : { shadowColor: color, shadowOpacity: opacity, shadowRadius: blur / 2, shadowOffset: { width: x, height: y }, elevation };

export const shadow = {
  card: mkShadow('rgba(0,0,0,0.6)', 0, 12, 32, 0.45, 8),
  glow: mkShadow('rgba(124,77,255,0.5)', 0, 8, 24, 0.5, 8),
  soft: mkShadow('rgba(0,0,0,0.45)', 0, 6, 16, 0.4, 5),
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
