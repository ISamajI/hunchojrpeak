// The art-direction library. Each direction is a complete design system: type pairing,
// graded palette, hero composition, service layout, motion character and photographic
// grade. The director picks three candidates per business and selects the strongest.

export const DIRECTIONS = [
  {
    id: 'noir-atelier', name: 'Noir Atelier', industries: { barber: 3, beauty: 1, tattoo: 2 },
    mood: ['classic', 'luxury', 'precise', 'craft', 'refined', 'gentleman', 'premium', 'sharp'],
    fonts: { display: 'instrument', body: 'intertight' }, displayItalic: true,
    palette: { bg: '#0d0c0b', surface: '#171513', ink: '#f2ede4', muted: '#a49d92', accent: '#c9a45c', onAccent: '#14110c', line: 'rgba(242,237,228,.12)' },
    hero: 'cinematic', services: 'index', shader: { kind: 'silk', a: '#c9a45c', b: '#3b2a14', c: '#0d0c0b', speed: 0.12 },
    grade: 'low-key warm tungsten, deep blacks, brass highlights, subtle film grain', photoLed: true,
  },
  {
    id: 'street-grade', name: 'Street Grade', industries: { barber: 2, tattoo: 3, fitness: 2 },
    mood: ['bold', 'urban', 'fresh', 'energetic', 'modern', 'culture', 'confident', 'clean'],
    fonts: { display: 'bebas', body: 'spacegrotesk' }, displayCase: 'upper',
    palette: { bg: '#0f0f0f', surface: '#191919', ink: '#f4f4ef', muted: '#a3a39b', accent: '#d7ff3f', onAccent: '#121400', line: 'rgba(244,244,239,.12)' },
    hero: 'stacked', services: 'cards', shader: { kind: 'grain', a: '#d7ff3f', b: '#2a2a2a', c: '#0f0f0f', speed: 0.2 },
    grade: 'high-contrast urban night, neon spill, crisp shadows', photoLed: false,
  },
  {
    id: 'soft-salon', name: 'Soft Salon', industries: { beauty: 3, barber: 0, health: 1 },
    mood: ['calm', 'elegant', 'soft', 'self-care', 'relax', 'feminine', 'warm', 'luxury'],
    fonts: { display: 'cormorant', body: 'manrope' }, displayItalic: true, light: true,
    palette: { bg: '#f6efe9', surface: '#efe4dc', ink: '#2a1d22', muted: '#6e5b60', accent: '#a8445f', onAccent: '#ffffff', line: 'rgba(42,29,34,.14)' },
    hero: 'editorial', services: 'accordion', shader: { kind: 'silk', a: '#e9c3c9', b: '#f6efe9', c: '#d9b8a6', speed: 0.06 },
    grade: 'soft window daylight, blush and cream tones, gentle highlights', photoLed: true,
  },
  {
    id: 'ember-trattoria', name: 'Ember', industries: { restaurant: 3, cafe: 1 },
    mood: ['warm', 'hearty', 'family', 'fire', 'authentic', 'cozy', 'flavour', 'local'],
    fonts: { display: 'fraunces', body: 'intertight' }, displayItalic: true,
    palette: { bg: '#170f0a', surface: '#221710', ink: '#f6ead8', muted: '#b9a68d', accent: '#e8643a', onAccent: '#1b0c05', line: 'rgba(246,234,216,.12)' },
    hero: 'cinematic', services: 'menu', shader: { kind: 'ember', a: '#e8643a', b: '#5a2410', c: '#170f0a', speed: 0.18 },
    grade: 'candle-and-hearth warm light, rich ambers, deep shadows, appetizing highlights', photoLed: true,
  },
  {
    id: 'market-fresh', name: 'Market Fresh', industries: { cafe: 2, restaurant: 2 },
    mood: ['fresh', 'bright', 'friendly', 'natural', 'daytime', 'neighbourhood', 'honest', 'light'],
    fonts: { display: 'dmserif', body: 'manrope' }, light: true,
    palette: { bg: '#f3eee3', surface: '#e9e2d3', ink: '#1d2a1f', muted: '#56614f', accent: '#2f6b3a', onAccent: '#ffffff', line: 'rgba(29,42,31,.14)' },
    hero: 'editorial', services: 'menu', shader: { kind: 'silk', a: '#c8d9b2', b: '#f3eee3', c: '#e6c79c', speed: 0.05 },
    grade: 'bright natural morning light, fresh greens, warm wood', photoLed: true,
  },
  {
    id: 'roastery', name: 'Roastery Editorial', industries: { cafe: 3, restaurant: 1 },
    mood: ['crafted', 'slow', 'ritual', 'specialty', 'editorial', 'cozy', 'quality', 'calm'],
    fonts: { display: 'instrument', body: 'intertight' }, displayItalic: true, light: true,
    palette: { bg: '#ebe3d6', surface: '#e1d6c5', ink: '#1b1612', muted: '#5e5246', accent: '#8a4123', onAccent: '#ffffff', line: 'rgba(27,22,18,.14)' },
    hero: 'editorial', services: 'index', shader: { kind: 'silk', a: '#c9a27c', b: '#ebe3d6', c: '#8a4123', speed: 0.05 },
    grade: 'soft side light, coffee browns, paper textures, shallow depth of field', photoLed: true,
  },
  {
    id: 'precision-garage', name: 'Precision Garage', industries: { auto: 3, trades: 2 },
    mood: ['reliable', 'technical', 'honest', 'fast', 'expert', 'strong', 'precise', 'trusted'],
    fonts: { display: 'archivo', body: 'intertight' }, displayCase: 'upper', displayWeight: 800,
    palette: { bg: '#0b0d10', surface: '#13171c', ink: '#eef1f4', muted: '#97a1ad', accent: '#ff5a1f', onAccent: '#140700', line: 'rgba(238,241,244,.12)' },
    hero: 'cinematic', services: 'spec', shader: { kind: 'grid', a: '#ff5a1f', b: '#1d2733', c: '#0b0d10', speed: 0.15 },
    grade: 'cool workshop fluorescents with orange accent light, metallic textures', photoLed: false,
  },
  {
    id: 'trade-trust', name: 'Trade & Trust', industries: { trades: 3, auto: 1, general: 1 },
    mood: ['dependable', 'local', 'straightforward', 'trusted', 'clean', 'professional', 'family', 'honest'],
    fonts: { display: 'bricolage', body: 'intertight' }, light: true, displayWeight: 700,
    palette: { bg: '#f3f4f1', surface: '#e7e9e4', ink: '#14202b', muted: '#4f5b66', accent: '#1f4fd1', onAccent: '#ffffff', line: 'rgba(20,32,43,.14)' },
    hero: 'editorial', services: 'cards', shader: { kind: 'grid', a: '#1f4fd1', b: '#dfe5ee', c: '#f3f4f1', speed: 0.06 },
    grade: 'clear daylight, clean whites, confident blue accents', photoLed: false,
  },
  {
    id: 'clinical-calm', name: 'Clinical Calm', industries: { health: 3, beauty: 1 },
    mood: ['calm', 'gentle', 'trusted', 'modern', 'caring', 'clean', 'reassuring', 'professional'],
    fonts: { display: 'fraunces', body: 'manrope' }, light: true, displayWeight: 400,
    palette: { bg: '#f1f6f5', surface: '#e3eeec', ink: '#0f2f2a', muted: '#4b6863', accent: '#1d7d71', onAccent: '#ffffff', line: 'rgba(15,47,42,.14)' },
    hero: 'editorial', services: 'accordion', shader: { kind: 'silk', a: '#bfe3dc', b: '#f1f6f5', c: '#e7efe0', speed: 0.05 },
    grade: 'soft diffused daylight, airy whites, teal accents', photoLed: true,
  },
  {
    id: 'kinetic', name: 'Kinetic', industries: { fitness: 3, tattoo: 1 },
    mood: ['powerful', 'driven', 'intense', 'community', 'strong', 'energetic', 'results', 'bold'],
    fonts: { display: 'unbounded', body: 'spacegrotesk' }, displayCase: 'upper', displayWeight: 700,
    palette: { bg: '#08090a', surface: '#121416', ink: '#ffffff', muted: '#9aa1a8', accent: '#3dff8f', onAccent: '#02140a', line: 'rgba(255,255,255,.12)' },
    hero: 'stacked', services: 'cards', shader: { kind: 'grid', a: '#3dff8f', b: '#13261c', c: '#08090a', speed: 0.3 },
    grade: 'dramatic rim light, sweat-and-steel textures, high contrast', photoLed: false,
  },
  {
    id: 'gallery-minimal', name: 'Gallery Minimal', industries: { retail: 3, beauty: 1, general: 1 },
    mood: ['curated', 'minimal', 'stylish', 'modern', 'design', 'boutique', 'refined', 'quality'],
    fonts: { display: 'syne', body: 'intertight' }, light: true, displayWeight: 800,
    palette: { bg: '#f6f4f1', surface: '#ebe7e1', ink: '#111111', muted: '#5c5852', accent: '#111111', onAccent: '#f6f4f1', line: 'rgba(17,17,17,.14)' },
    hero: 'editorial', services: 'index', shader: { kind: 'silk', a: '#d9d2c7', b: '#f6f4f1', c: '#b8a27a', speed: 0.04 },
    grade: 'gallery lighting, neutral whites, precise product shadows', photoLed: true,
  },
  {
    id: 'civic-modern', name: 'Civic Modern', industries: { general: 3, trades: 1, health: 1, retail: 1 },
    mood: ['professional', 'trusted', 'established', 'clear', 'modern', 'local', 'confident', 'service'],
    fonts: { display: 'dmserif', body: 'manrope' },
    palette: { bg: '#0f1419', surface: '#171e25', ink: '#eef2f6', muted: '#9aa6b2', accent: '#8fb0ff', onAccent: '#0b1220', line: 'rgba(238,242,246,.12)' },
    hero: 'editorial', services: 'cards', shader: { kind: 'silk', a: '#8fb0ff', b: '#1c2633', c: '#0f1419', speed: 0.08 },
    grade: 'cool evening light, navy and steel tones, clean architecture', photoLed: false,
  },
];

export function getDirection(id) {
  return DIRECTIONS.find((d) => d.id === id);
}
