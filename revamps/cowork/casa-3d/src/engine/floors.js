// Interior floor finishes: option lists (es/en names) and how a room's finish
// resolves from its overrides + the whole-house defaults. Pure data, no three.js,
// so state.js, the material factory and the swatch helper all agree.

// kind: 'tile' (grid / diagonal / offset, sized tiles), 'wood' (planks, straight
// or herringbone) or 'stone' (one continuous slab, no layout options).
// tile: the finish's natural tile size id (used while no tileSize is picked).
export const FLOORS = [
  { id: 'porcelanato', es: 'Porcelanato', en: 'Porcelain tile', kind: 'tile', tile: '60' },
  { id: 'ceramica', es: 'Cerámica', en: 'Ceramic tile', kind: 'tile', tile: '30' },
  { id: 'madera', es: 'Madera', en: 'Wood', kind: 'wood' },
  { id: 'marmol', es: 'Mármol', en: 'Marble', kind: 'tile', tile: '80' },
  { id: 'cemento', es: 'Cemento pulido', en: 'Polished concrete', kind: 'stone' },
  { id: 'terracota', es: 'Barro (terracota)', en: 'Terracotta', kind: 'tile', tile: '30' },
  { id: 'granito', es: 'Granito pulido', en: 'Polished granite (terrazzo)', kind: 'stone' },
  { id: 'porcelanato-madera', es: 'Porcelanato símil madera', en: 'Wood-look porcelain', kind: 'wood' },
  { id: 'vinil', es: 'Vinil (listones)', en: 'Vinyl planks', kind: 'wood' },
];

export const FLOOR_TONES = [
  { id: 'claro', es: 'Claro', en: 'Light' },
  { id: 'medio', es: 'Medio', en: 'Medium' },
  { id: 'oscuro', es: 'Oscuro', en: 'Dark' },
];

// kinds: the finish kinds the layout applies to ('recto' works on everything).
export const FLOOR_PATTERNS = [
  { id: 'recto', es: 'Recto', en: 'Straight', kinds: ['tile', 'wood', 'stone'] },
  { id: 'diagonal', es: 'Diagonal', en: 'Diagonal', kinds: ['tile'] },
  { id: 'escalonado', es: 'Escalonado', en: 'Offset (brick)', kinds: ['tile'] },
  { id: 'espiga', es: 'Espiga', en: 'Herringbone', kinds: ['wood'] },
];

// w x h in meters; tiles only.
export const TILE_SIZES = [
  { id: '30', w: 0.3, h: 0.3, es: '30 × 30 cm', en: '30 × 30 cm' },
  { id: '60', w: 0.6, h: 0.6, es: '60 × 60 cm', en: '60 × 60 cm' },
  { id: '80', w: 0.8, h: 0.8, es: '80 × 80 cm', en: '80 × 80 cm' },
  { id: '120x60', w: 1.2, h: 0.6, es: '120 × 60 cm', en: '120 × 60 cm' },
];

export const floorIds = FLOORS.map((f) => f.id);
export const toneIds = FLOOR_TONES.map((t) => t.id);
export const patternIds = FLOOR_PATTERNS.map((p) => p.id);
export const tileSizeIds = TILE_SIZES.map((t) => t.id);
const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

// Linear-space color multipliers that shift a finish's texture colour.
// 'medio' leaves the texture as drawn.
const TINT = {
  tile: { claro: [1.08, 1.08, 1.07], medio: [1, 1, 1], oscuro: [0.2, 0.2, 0.21] },
  wood: { claro: [1.3, 1.36, 1.48], medio: [1, 1, 1], oscuro: [0.2, 0.15, 0.13] },
  stone: { claro: [1.1, 1.1, 1.1], medio: [1, 1, 1], oscuro: [0.36, 0.36, 0.37] },
};
export const toneTint = (kind, tone) => (TINT[kind] ?? TINT.tile)[tone] ?? [1, 1, 1];

// A finish id + optional layout fields -> a fully valid spec. Invalid pattern /
// size combos fall back (recto, natural tile size).
export function normalizeFloor({ floor, floorTone, floorPattern, tileSize, baseboard } = {}) {
  const def = FLOORS.find((f) => f.id === floor) ?? FLOORS[0];
  const tone = toneIds.includes(floorTone) ? floorTone : 'medio';
  const p = FLOOR_PATTERNS.find((x) => x.id === floorPattern);
  const pattern = p && p.kinds.includes(def.kind) ? p.id : 'recto';
  const size = def.kind === 'tile' ? (tileSizeIds.includes(tileSize) ? tileSize : def.tile) : null;
  return { id: def.id, kind: def.kind, tone, pattern, size, baseboard: isHex(baseboard) ? baseboard : null };
}

// The finish a room shows: its own override per field, else the house default.
export function floorSpec(interior, roomKey) {
  const I = interior ?? {};
  const o = (roomKey && I.rooms && typeof I.rooms === 'object' && I.rooms[roomKey]) || {};
  const pick = (k) => o[k] ?? I[k];
  return normalizeFloor({ floor: pick('floor'), floorTone: pick('floorTone'), floorPattern: pick('floorPattern'), tileSize: pick('tileSize'), baseboard: pick('baseboard') });
}

export const tileDims = (sizeId) => TILE_SIZES.find((t) => t.id === sizeId) ?? TILE_SIZES[1];
