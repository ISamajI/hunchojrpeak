import { poolRect, carportSpot } from './engine/site.js';
import { layoutHouse, resolvePlan } from './engine/layout.js';
import * as P from './engine/plan.js';
import { floorIds, toneIds, patternIds, tileSizeIds } from './engine/floors.js';
import { ops as BO, lastReason, effectiveState, emptyBuild, sanitizeBuild, buildInfoOf, snapPointOf, buildRooms, GRIDS, OPENING_KINDS, OPENING_STYLES, WALL_FINISHES, FENCE_TYPES, GATE_KINDS, OPEN_DEFAULTS, ROOF_TYPES, ROOF_MATERIALS, BL } from './engine/buildmodel.js';
import { convertAuto, blankBuild } from './engine/buildconvert.js';
import { remodelDiff } from './engine/remodel.js';
import { PIECES, PIECE_CATS, pieceById, fitPiece, applyPiece, groupAt, fitGroup, transformGroup, removeGroupIn, groupBox, refuse } from './engine/pieces.js';

// Pieces (v5): ready-made rooms / walls / openings ... see CONTRACT.md "v5 pieces API".
export { PIECES, PIECE_CATS, pieceById };

// Build mode (v4): data lives in design.build, see .squad/CONTRACT.md "v4 build API".
export { GRIDS as BUILD_GRIDS, OPENING_KINDS, OPENING_STYLES, WALL_FINISHES, FENCE_TYPES, GATE_KINDS, OPEN_DEFAULTS, ROOF_TYPES, ROOF_MATERIALS, BL as BUILD_LIMITS };

// Floor option lists (es/en names, kind, patterns) live in engine/floors.js; the swatch helper in engine/floortex.js.
export { FLOORS, FLOOR_TONES, FLOOR_PATTERNS, TILE_SIZES, floorSpec, normalizeFloor, tileDims } from './engine/floors.js';
export { floorSwatch } from './engine/floortex.js';

// Design store: one plain JSON object, path-based setters, undo/redo,
// and localStorage projects. See .squad/CONTRACT.md for the schema.

export const LIMITS = {
  floors: [1, 3],
  width: [8, 20],
  depth: [7, 18],
  bedrooms: [1, 6],
  bathrooms: [1, 5],
  landWidth: [14, 60],
  landDepth: [18, 80],
  time: [0.25, 0.8125],
  floorHeight: [2.7, 3.6],
  eaves: [0.2, 1.2],
};

// Interior finishes and house details. Each option has Spanish + English names.
// (FLOORS and the other floor lists are re-exported above.)
export const WOODS = [
  { id: 'claro', hex: '#c49a6c', es: 'Claro', en: 'Light' },
  { id: 'medio', hex: '#a47551', es: 'Medio', en: 'Medium' },
  { id: 'oscuro', hex: '#5e3b26', es: 'Oscuro', en: 'Dark' },
];
export const COUNTERS = [
  { id: 'blanco', es: 'Blanco', en: 'White' },
  { id: 'granito', es: 'Granito', en: 'Granite' },
  { id: 'marmol', es: 'Mármol', en: 'Marble' },
];
export const INDOOR_TYPES = [
  { id: 'mecedora', es: 'Mecedora', en: 'Rocking chair' },
  { id: 'butaca', es: 'Butaca', en: 'Armchair' },
  { id: 'planta', es: 'Planta', en: 'Plant' },
  { id: 'tv', es: 'Televisor', en: 'TV' },
  { id: 'lampara', es: 'Lámpara', en: 'Floor lamp' },
  { id: 'estante', es: 'Librero', en: 'Bookshelf' },
  { id: 'mesa', es: 'Mesita', en: 'Side table' },
  { id: 'cama', es: 'Cama extra', en: 'Extra bed' },
];
export const COLUMN_STYLES = [
  { id: 'square', es: 'Cuadradas', en: 'Square' },
  { id: 'round', es: 'Redondas', en: 'Round' },
  { id: 'classic', es: 'Clásicas', en: 'Classic' },
];
export const RAILINGS = [
  { id: 'iron', es: 'Hierro', en: 'Iron' },
  { id: 'balusters', es: 'Balaustres', en: 'Balusters' },
  { id: 'glass', es: 'Vidrio', en: 'Glass' },
  { id: 'concrete', es: 'Concreto', en: 'Concrete' },
];
export const DOOR_STYLES = [
  { id: 'panel', es: 'Sencilla', en: 'Panel' },
  { id: 'double', es: 'Doble', en: 'Double' },
  { id: 'glass', es: 'Con vidrio', en: 'Glass' },
];
export const OUT_FLOORS = [
  { id: 'tile', es: 'Cerámica', en: 'Tile' },
  { id: 'terracotta', es: 'Barro', en: 'Terracotta' },
  { id: 'concrete', es: 'Cemento', en: 'Concrete' },
];
export const CEILINGS = [
  { id: 'liso', es: 'Liso', en: 'Plain' },
  { id: 'vigas', es: 'Con vigas de madera', en: 'Wood beams' },
];
export const LIGHTS = ['auto', 'on', 'off'];

// Where indoor furniture may stand in build mode: the walls' bounding box (house-local), inset a little.
function buildBounds(b) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  const add = (x, z) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); };
  for (const L of b.levels) {
    for (const w of L.walls) { add(w.x0, w.z0); add(w.x1, w.z1); }
    for (const s of L.slabs) { add(s.x0, s.z0); add(s.x1, s.z1); }
  }
  if (!Number.isFinite(x0)) return { x0: -4, x1: 4, z0: -3, z1: 3 };
  return { x0: x0 + 0.3, x1: x1 - 0.3, z0: z0 + 0.3, z1: z1 - 0.3 };
}
export function itemBounds(d) {
  if (d.mode === 'build' && d.build) return buildBounds(d.build);
  const b = indoorBounds(d.house);
  return { x0: -b.x, x1: b.x, z0: -b.z, z1: b.z };
}

// Inner usable rect for indoor furniture: wall thickness + half a footprint.
const INNER = 0.2 + 0.3;
export function indoorBounds(h) {
  return { x: Math.max(0, h.width / 2 - INNER), z: Math.max(0, h.depth / 2 - INNER) };
}

function defaultInterior() {
  return {
    wallColor: '#f5f2ec',
    floor: 'porcelanato',
    floorTone: 'medio',
    floorPattern: 'recto',
    tileSize: null,           // null = the finish's natural tile size
    baseboard: null,          // zócalo color; null = same finish as the floor
    rooms: {},
    sofa: '#b9b1a4',
    wood: 'medio',
    cabinets: '#6f5a48',
    counter: 'granito',
    ceiling: 'liso',
    items: [],
  };
}

export const STYLES = [
  {
    id: 'moderna',
    es: 'Moderna', en: 'Modern',
    swatch: ['#f7f5ef', '#4a4f55', '#c9a27a'],
    house: {
      roof: { type: 'flat', color: '#e9e6df', material: 'concrete' },
      colors: { walls: '#f7f5ef', trim: '#4a4f55', base: '#6f6a64', door: '#8a5a3b', windows: '#2e3a44', accent: '#c9a27a' },
      wallFinish: 'stone-base', windowStyle: 'tall',
      porch: true, balcony: true, carport: true, roofTerrace: true, waterTank: true, solar: true, windowBars: false,
      columnStyle: 'square', railing: 'glass', doorStyle: 'glass', floorFinishOut: 'concrete',
    },
    interior: { ceiling: 'liso', floor: 'porcelanato' },
    yard: { fence: 'wall', fenceColor: '#f7f5ef' },
  },
  {
    id: 'caribena',
    es: 'Caribeña', en: 'Caribbean',
    swatch: ['#f5de8c', '#ffffff', '#5fbfc4'],
    house: {
      roof: { type: 'hip', color: '#a5472f', material: 'tile' },
      colors: { walls: '#f5de8c', trim: '#ffffff', base: '#c9b48c', door: '#5fbfc4', windows: '#ffffff', accent: '#5fbfc4' },
      wallFinish: 'smooth', windowStyle: 'louvered',
      porch: true, balcony: true, carport: true, roofTerrace: false, waterTank: true, solar: false, windowBars: true,
      columnStyle: 'round', railing: 'iron', doorStyle: 'double', floorFinishOut: 'tile',
    },
    interior: { ceiling: 'liso', floor: 'porcelanato' },
    yard: { fence: 'rejas', fenceColor: '#ffffff' },
  },
  {
    id: 'colonial',
    es: 'Victoriana (Puerto Plata)', en: 'Victorian (Puerto Plata)',
    swatch: ['#a9d3e8', '#ffffff', '#efa391'],
    house: {
      roof: { type: 'gable', color: '#8a8f94', material: 'metal' },
      colors: { walls: '#a9d3e8', trim: '#ffffff', base: '#d9c7a4', door: '#7a3e2b', windows: '#ffffff', accent: '#efa391' },
      wallFinish: 'smooth', windowStyle: 'arched',
      porch: true, balcony: true, carport: false, roofTerrace: false, waterTank: false, solar: false, windowBars: false,
      columnStyle: 'classic', railing: 'balusters', doorStyle: 'double', floorFinishOut: 'tile',
    },
    interior: { ceiling: 'vigas', floor: 'porcelanato' },
    yard: { fence: 'rejas', fenceColor: '#ffffff' },
  },
  {
    id: 'campo',
    es: 'De campo', en: 'Countryside',
    swatch: ['#f6c9a0', '#ffffff', '#2f6f5e'],
    house: {
      roof: { type: 'gable', color: '#9aa0a6', material: 'metal' },
      colors: { walls: '#f6c9a0', trim: '#ffffff', base: '#c9694a', door: '#2f6f5e', windows: '#2f6f5e', accent: '#7fbf9e' },
      wallFinish: 'block', windowStyle: 'standard',
      porch: true, balcony: false, carport: false, roofTerrace: false, waterTank: true, solar: false, windowBars: true,
      columnStyle: 'square', railing: 'iron', doorStyle: 'panel', floorFinishOut: 'terracotta',
    },
    interior: { ceiling: 'vigas', floor: 'terracota' },
    yard: { fence: 'none', fenceColor: '#ffffff' },
  },
];

export const LOT_PRESETS = [
  { id: 'small', w: 14, d: 22, es: 'Pequeño', en: 'Small' },
  { id: 'medium', w: 20, d: 30, es: 'Mediano', en: 'Medium' },
  { id: 'large', w: 30, d: 40, es: 'Grande', en: 'Large' },
];

// Named swatches people in DR actually paint with; same list for every part.
export const PALETTES = [
  { hex: '#ffffff', es: 'Blanco', en: 'White' },
  { hex: '#f4f1ea', es: 'Hueso', en: 'Bone' },
  { hex: '#f2d8a7', es: 'Crema', en: 'Cream' },
  { hex: '#e9c46a', es: 'Amarillo mango', en: 'Mango yellow' },
  { hex: '#f4a6a0', es: 'Rosado', en: 'Pink' },
  { hex: '#e8a33d', es: 'Naranja', en: 'Orange' },
  { hex: '#b8573a', es: 'Terracota', en: 'Terracotta' },
  { hex: '#7cc4c0', es: 'Turquesa', en: 'Turquoise' },
  { hex: '#8fbfe0', es: 'Azul cielo', en: 'Sky blue' },
  { hex: '#a7c98b', es: 'Verde menta', en: 'Mint green' },
  { hex: '#2a7d4f', es: 'Verde', en: 'Green' },
  { hex: '#1f4e79', es: 'Azul marino', en: 'Navy' },
  { hex: '#6b3b26', es: 'Caoba', en: 'Mahogany' },
  { hex: '#9aa3a8', es: 'Gris', en: 'Gray' },
  { hex: '#3b3d40', es: 'Gris oscuro', en: 'Charcoal' },
];

export const ITEM_TYPES = [
  { id: 'palm', es: 'Palma', en: 'Palm tree' },
  { id: 'mango', es: 'Árbol de mango', en: 'Mango tree' },
  { id: 'flowers', es: 'Flores', en: 'Flowers' },
  { id: 'car', es: 'Carro', en: 'Car' },
  { id: 'gazebo', es: 'Gazebo', en: 'Gazebo' },
  { id: 'bench', es: 'Banco', en: 'Bench' },
  { id: 'bbq', es: 'Parrilla', en: 'BBQ grill' },
];

const KEY_PROJECTS = 'casa3d.projects';
const KEY_CURRENT = 'casa3d.current';
const keyDesign = (id) => `casa3d.design.${id}`;

const clone = (o) => structuredClone(o);
const uid = () => Math.random().toString(36).slice(2, 9);

export function defaultDesign(styleId = 'caribena') {
  const style = STYLES.find((s) => s.id === styleId) ?? STYLES[1];
  const d = {
    version: 2,
    name: 'Mi Casa',
    mode: 'auto',
    build: null,
    remodel: null, // { base: build } while remodelling an existing house (see engine/remodel.js)
    land: { mode: 'generated', seed: 1234, width: 24, depth: 32, scenery: 'mountains', photo: null, photoMode: 'ground' },
    house: {
      style: style.id,
      floors: 1, width: 12, depth: 10, floorHeight: 3.0, eaves: 0.6,
      offsetX: 0, offsetZ: -1,
      carportSide: 'right',
      bedrooms: 3, bathrooms: 2,
      plan: null,
    },
    yard: {
      pool: false, driveway: true, garden: true,
      items: [
        { id: uid(), type: 'palm', x: -10, z: 12.5, rot: 0.4 },
        { id: uid(), type: 'palm', x: -10.2, z: 3, rot: 2.1 },
        { id: uid(), type: 'mango', x: 7.5, z: -12, rot: 0 },
      ],
    },
    env: { time: 0.6875, lightsOn: 'auto' },
    interior: defaultInterior(),
  };
  applyStyleTo(d, style.id);
  return d;
}

function applyStyleTo(d, styleId) {
  const style = STYLES.find((s) => s.id === styleId);
  if (!style) return;
  const h = clone(style.house);
  Object.assign(d.house, h, { style: styleId });
  Object.assign(d.yard, clone(style.yard));
  if (style.interior && d.interior && typeof d.interior === 'object') Object.assign(d.interior, clone(style.interior));
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
  target[last] = value;
}

const clampNum = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

// Keep numbers in range so a bad value never breaks the geometry.
const pickOne = (v, list) => (list.includes(v) ? v : list[0]);
const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const ids = (list) => list.map((o) => o.id);
const plainObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const ROOM_KEY = /^\d:[a-z]+:\d{1,2}$/;
// Valid values per room override field.
const ROOM_FIELDS = {
  wall: (v) => isHex(v),
  floor: (v) => floorIds.includes(v),
  floorTone: (v) => toneIds.includes(v),
  floorPattern: (v) => patternIds.includes(v),
  tileSize: (v) => tileSizeIds.includes(v),
  baseboard: (v) => isHex(v),
};
const finite = (v, fallback) => (v !== null && v !== '' && Number.isFinite(+v) ? +v : fallback);

// How far the house (with carport, porch and steps) may move before it leaves the lot.
export function offsetLimits(d) {
  const h = d.house, l = d.land;
  const left = h.width / 2 + (h.carport && h.carportSide === 'left' ? 3.6 : 0) + 1;
  const right = h.width / 2 + (h.carport && h.carportSide === 'right' ? 3.6 : 0) + 1;
  const front = h.depth / 2 + (h.porch ? 3.7 : 0.8) + 1.5;
  const back = h.depth / 2 + (h.waterTank && h.roof.type !== 'flat' ? 2.2 : 0) + 1;
  return {
    minX: Math.min(0, -l.width / 2 + left), maxX: Math.max(0, l.width / 2 - right),
    minZ: Math.min(0, -l.depth / 2 + back), maxZ: Math.max(0, l.depth / 2 - front),
  };
}

function sanitize(d) {
  const h = d.house;
  h.style = pickOne(h.style, STYLES.map((s) => s.id));
  h.roof.type = pickOne(h.roof.type, ['flat', 'hip', 'gable', 'shed']);
  h.roof.material = pickOne(h.roof.material, ['concrete', 'tile', 'metal']);
  if (!isHex(h.roof.color)) h.roof.color = '#a5472f';
  for (const k of ['walls', 'trim', 'base', 'door', 'windows', 'accent']) if (!isHex(h.colors[k])) h.colors[k] = '#ffffff';
  h.wallFinish = pickOne(h.wallFinish, ['smooth', 'stone-base', 'block']);
  h.windowStyle = pickOne(h.windowStyle, ['standard', 'tall', 'arched', 'louvered']);
  h.carportSide = pickOne(h.carportSide, ['right', 'left']);
  h.floorHeight = +clampNum(finite(h.floorHeight, 3), LIMITS.floorHeight).toFixed(2);
  h.eaves = +clampNum(finite(h.eaves, 0.6), LIMITS.eaves).toFixed(2);
  h.columnStyle = pickOne(h.columnStyle, ids(COLUMN_STYLES));
  h.railing = pickOne(h.railing, ids(RAILINGS));
  h.doorStyle = pickOne(h.doorStyle, ids(DOOR_STYLES));
  h.floorFinishOut = pickOne(h.floorFinishOut, ids(OUT_FLOORS));
  d.land.mode = pickOne(d.land.mode, ['generated', 'photo']);
  d.land.scenery = pickOne(d.land.scenery, ['mountains', 'sea', 'countryside']);
  d.land.photoMode = pickOne(d.land.photoMode, ['ground', 'backdrop']);
  if (typeof d.land.photo !== 'string' || !d.land.photo.startsWith('data:image/')) d.land.photo = null;
  if (d.land.mode === 'photo' && !d.land.photo) d.land.mode = 'generated';
  d.yard.fence = pickOne(d.yard.fence, ['none', 'wall', 'rejas', 'custom']);
  if (!isHex(d.yard.fenceColor)) d.yard.fenceColor = '#ffffff';
  if (!Array.isArray(d.yard.items)) d.yard.items = [];
  d.yard.items = d.yard.items.filter((it) => it && ITEM_TYPES.some((t) => t.id === it.type) && Number.isFinite(+it.x) && Number.isFinite(+it.z));
  if (typeof d.name !== 'string') d.name = 'Mi Casa';
  h.floors = Math.round(clampNum(+h.floors || 1, LIMITS.floors));
  h.width = clampNum(+h.width || 12, LIMITS.width);
  h.depth = clampNum(+h.depth || 10, LIMITS.depth);
  h.bedrooms = Math.round(clampNum(+h.bedrooms || 1, LIMITS.bedrooms));
  h.bathrooms = Math.round(clampNum(+h.bathrooms || 1, LIMITS.bathrooms));
  // Custom plan: validated against the house size; bedrooms/bathrooms become summaries of it.
  d.mode = pickOne(d.mode, ['auto', 'build']);
  const rp = h.plan && d.mode !== 'build' ? resolvePlan(h) : d.mode === 'build' ? h.plan : null;
  h.plan = rp;
  if (rp && d.mode !== 'build') {
    const all = rp.levels.flatMap((lv) => lv.front.concat(lv.back));
    // Real counts (0 baths or 7+ bedrooms are possible); only the stepper's target is clamped.
    h.bedrooms = all.filter((r) => r.type === 'dormitorio' || r.type === 'principal').length;
    h.bathrooms = all.filter((r) => r.type === 'bano').length;
  }
  d.land.width = clampNum(+d.land.width || 24, LIMITS.landWidth);
  d.land.depth = clampNum(+d.land.depth || 32, LIMITS.landDepth);
  // Lot must hold the house plus a little yard.
  d.land.width = Math.max(d.land.width, h.width + (h.carport ? 3.6 : 0) + 4);
  d.land.depth = Math.max(d.land.depth, h.depth + (h.porch ? 3.7 : 0.8) + 5);
  // Hand-built house: validated against the lot; floors / floor height follow it.
  if (!plainObj(d.interior)) d.interior = defaultInterior();
  d.build = sanitizeBuild(d.build, { house: h, land: d.land, offsetX: +h.offsetX || 0, offsetZ: +h.offsetZ || 0, interiorFloor: d.interior.floor });
  if (!d.build && d.mode === 'build') d.mode = 'auto';
  // Remodel: the frozen "today" copy of the hand-built house. Kept while he works in Diseñar too (dormant there).
  if (plainObj(d.remodel) && d.build) {
    const base = sanitizeBuild(d.remodel.base, { house: h, land: d.land, offsetX: +h.offsetX || 0, offsetZ: +h.offsetZ || 0, interiorFloor: d.interior.floor });
    d.remodel = base ? { base, startedAt: Number.isFinite(+d.remodel.startedAt) ? +d.remodel.startedAt : Date.now() } : null;
  } else d.remodel = null;
  if (d.mode === 'build') {
    h.floors = d.build.levels.length;
    h.floorHeight = d.build.floorHeight;
  }
  if (!plainObj(d.env)) d.env = { time: 0.6875 };
  d.env.time = clampNum(+d.env.time || 0.6, LIMITS.time);
  d.env.lightsOn = pickOne(d.env.lightsOn, LIGHTS);
  sanitizeInterior(d);
  const lim = offsetLimits(d);
  h.offsetX = clampNum(+h.offsetX || 0, [lim.minX, lim.maxX]);
  h.offsetZ = clampNum(+h.offsetZ || 0, [lim.minZ, lim.maxZ]);
  for (const it of d.yard.items) {
    it.x = clampNum(+it.x, [-d.land.width / 2 + 0.6, d.land.width / 2 - 0.6]);
    it.z = clampNum(+it.z, [-d.land.depth / 2 + 0.6, d.land.depth / 2 - 0.6]);
  }
  return d;
}

function sanitizeInterior(d) {
  const h = d.house;
  if (!plainObj(d.interior)) d.interior = defaultInterior();
  const I = d.interior;
  if (!isHex(I.wallColor)) I.wallColor = '#f5f2ec';
  I.floor = pickOne(I.floor, floorIds);
  I.floorTone = toneIds.includes(I.floorTone) ? I.floorTone : 'medio';
  I.floorPattern = pickOne(I.floorPattern, patternIds);
  I.tileSize = tileSizeIds.includes(I.tileSize) ? I.tileSize : null;
  I.baseboard = isHex(I.baseboard) ? I.baseboard : null;
  if (!isHex(I.sofa)) I.sofa = '#b9b1a4';
  if (!ids(WOODS).includes(I.wood)) I.wood = 'medio';
  if (!isHex(I.cabinets)) I.cabinets = '#6f5a48';
  if (!ids(COUNTERS).includes(I.counter)) I.counter = 'granito';
  I.ceiling = pickOne(I.ceiling, ids(CEILINGS));
  // Room overrides: keep only valid values; drop empty rooms.
  const rooms = {};
  // With a plan, overrides of rooms that no longer exist go away (a new room never inherits an old look).
  const alive = d.mode === 'build' && d.build ? new Set(d.build.rooms.map((a) => a.key)) : h.plan ? new Set(h.plan.levels.flatMap((lv, l) => lv.front.concat(lv.back).map((x) => x.id).concat(`${l}:pasillo:0`))) : null;
  if (plainObj(I.rooms)) {
    for (const [key, r] of Object.entries(I.rooms).slice(0, 200)) {
      if (!ROOM_KEY.test(key) || !plainObj(r) || (alive && !alive.has(key))) continue;
      const o = {};
      if (isHex(r.wall)) o.wall = r.wall;
      if (floorIds.includes(r.floor)) o.floor = r.floor;
      if (toneIds.includes(r.floorTone)) o.floorTone = r.floorTone;
      if (patternIds.includes(r.floorPattern)) o.floorPattern = r.floorPattern;
      if (tileSizeIds.includes(r.tileSize)) o.tileSize = r.tileSize;
      if (isHex(r.baseboard)) o.baseboard = r.baseboard;
      if (Object.keys(o).length) rooms[key] = o;
    }
  }
  I.rooms = rooms;
  // Movable furniture: known types, inside the house, on an existing floor.
  const b = itemBounds(d);
  const seen = new Set();
  I.items = (Array.isArray(I.items) ? I.items : [])
    .filter((it) => plainObj(it) && ids(INDOOR_TYPES).includes(it.type) && Number.isFinite(+it.x) && Number.isFinite(+it.z))
    .slice(0, 120);
  for (const it of I.items) {
    if (typeof it.id !== 'string' || !it.id || seen.has(it.id)) it.id = uid();
    seen.add(it.id);
    it.level = Math.round(clampNum(finite(it.level, 0), [0, h.floors - 1]));
    it.x = +clampNum(+it.x, [b.x0, b.x1]).toFixed(2);
    it.z = +clampNum(+it.z, [b.z0, b.z1]).toFixed(2);
    it.rot = +(((finite(it.rot, 0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).toFixed(4);
  }
}

// Room rects for one floor (house-local), from the same layout the engine draws.
function roomsOn(d, level) {
  try {
    if (d.mode === 'build' && d.build) return buildRooms(d.build).filter((r) => r.level === level && r.type !== 'pasillo').map((r) => ({ type: r.type === 'cuarto' ? 'sala' : r.type, key: r.key, x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 }));
    return layoutHouse(d.house)[level]?.rooms ?? [];
  } catch {
    return [];
  }
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function projectList() {
  const l = readJSON(KEY_PROJECTS, []);
  return Array.isArray(l) ? l.filter((p) => p && typeof p.id === 'string') : [];
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function createStore() {
  let currentId = readJSON(KEY_CURRENT, null);
  let state;
  try {
    state = sanitize(migrate((currentId && readJSON(keyDesign(currentId), null)) || defaultDesign()));
  } catch {
    // A broken save must never lock him out: start fresh.
    currentId = null;
    state = sanitize(defaultDesign());
  }
  if (!currentId) currentId = uid();

  const past = [];
  const future = [];
  const subs = new Set();
  let saveTimer = 0;

  function emit(path) {
    for (const fn of subs) fn(state, path);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(autosave, 400);
  }

  function pushUndo() {
    past.push(clone(state));
    if (past.length > 80) past.shift();
    future.length = 0;
  }

  function autosave() {
    writeJSON(keyDesign(currentId), state);
    writeJSON(KEY_CURRENT, currentId);
    const list = projectList();
    const entry = list.find((p) => p.id === currentId);
    if (entry) {
      entry.name = state.name;
      entry.updatedAt = Date.now();
      writeJSON(KEY_PROJECTS, list);
    }
  }

  // Snapshot taken when a slider drag starts, so commit() records the pre-drag state.
  let dragBase = null;
  let remodelMemo = {};
  let lastPatch = null;

  // Steppers and the floors slider keep a custom plan in step (the plan is the source of truth).
  function planEffects(path, value) {
    const h = state.house;
    if (!h.plan) return;
    if (path === 'house.floors') {
      const F = Math.round(clampNum(+value || 1, LIMITS.floors));
      if (F < h.floors) {
        // Dropping floors takes their furniture and room finishes with them.
        state.interior.items = state.interior.items.filter((it) => it.level < F);
        for (const key of Object.keys(state.interior.rooms)) if (+key[0] >= F) delete state.interior.rooms[key];
      }
    } else if (path === 'house.bedrooms' || path === 'house.bathrooms') {
      const kind = path === 'house.bedrooms' ? 'bed' : 'bath';
      const want = Math.round(clampNum(+value || 1, kind === 'bed' ? LIMITS.bedrooms : LIMITS.bathrooms));
      const next = P.adjustCount(h, kind, want);
      if (next) h.plan = next;
    }
  }

  // Apply an edited plan. commit:false is a live drag preview (undo step on the final commit:true call).
  function planApply(next, { commit = true } = {}) {
    if (!next) return false;
    if (commit && !dragBase) pushUndo();
    else if (!dragBase) dragBase = clone(state);
    state.house.plan = next;
    sanitize(state);
    lastPatch = 'house.plan';
    if (commit && dragBase) store.commit();
    else emit('house.plan');
    return true;
  }

  // Build edit: clone the build, run the pure op, commit like planApply (one undo step, or a live drag).
  function bApply(fn, opts, { needBuild = true, custom = false } = {}) {
    if (needBuild && state.mode !== 'build') return false;
    const commit = opts?.commit !== false;
    BO.__reset?.();
    const b = state.build ? clone(state.build) : emptyBuild(state.house);
    let r;
    try { r = fn(b); } catch (e) { console.warn('build action', e); return false; }
    if (r === false || r == null) return false;
    if (commit && !dragBase) pushUndo();
    else if (!dragBase) dragBase = clone(state);
    state.build = b;
    if (custom && state.yard.fence !== 'custom') state.yard.fence = 'custom';
    sanitize(state);
    lastPatch = 'build';
    if (commit && dragBase) store.commit();
    else emit('build');
    return r;
  }

  // Piece edit (v5): like bApply, but may also switch to build mode (blank build) and touch yard items, all in ONE undo step.
  function pApply(fn, { needBuild = true, custom = false, commit = true } = {}) {
    BO.__reset?.();
    const toBuild = needBuild && state.mode !== 'build';
    let b, noFence = false;
    if (toBuild) {
      const has = state.build?.levels.some((L) => L.walls.length || L.slabs.length);
      b = has ? clone(state.build) : blankBuild(state);
      if (!has && state.build?.fences) b.fences = clone(state.build.fences);
      // A blank start has no perimeter fence (unless he drew his own).
      noFence = !has && !b.fences.length && state.yard.fence !== 'custom';
    } else b = state.build ? clone(state.build) : needBuild || custom ? emptyBuild(state.house) : null;
    const items = clone(state.yard.items);
    let r;
    try { r = fn(b, items); } catch (e) { console.warn('piece action', e); return false; }
    if (r === false || r == null) return false;
    if (commit && !dragBase) pushUndo();
    else if (!dragBase) dragBase = clone(state);
    if (toBuild) {
      b.prev = { floors: state.house.floors, floorHeight: state.house.floorHeight };
      state.mode = 'build';
      if (noFence) state.yard.fence = 'none';
    }
    const itemsChanged = JSON.stringify(items) !== JSON.stringify(state.yard.items);
    if (b) state.build = b;
    state.yard.items = items;
    if (custom && state.yard.fence !== 'custom') state.yard.fence = 'custom';
    sanitize(state);
    lastPatch = 'build';
    if (commit && dragBase) store.commit();
    else emit('build');
    if (toBuild) emit('mode');
    if (itemsChanged) emit('yard.items');
    return r;
  }
  const rad = (deg) => (((Math.round((+deg || 0) / 90) % 4) + 4) % 4) * (Math.PI / 2);

  const store = {
    get: () => state,
    set(path, value) {
      if (getPath(state, path) === value) return;
      pushUndo();
      dragBase = null;
      planEffects(path, value);
      setPath(state, path, clone(value));
      sanitize(state);
      emit(path);
    },
    patch(path, value) {
      if (!dragBase) dragBase = clone(state);
      lastPatch = path;
      planEffects(path, value);
      setPath(state, path, clone(value));
      sanitize(state);
      emit(path);
    },
    commit() {
      if (!dragBase) return;
      past.push(dragBase);
      if (past.length > 80) past.shift();
      future.length = 0;
      dragBase = null;
      emit(lastPatch ?? 'commit');
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    undo() {
      dragBase = null;
      if (!past.length) return;
      future.push(clone(state));
      state = past.pop();
      emit('undo');
    },
    redo() {
      dragBase = null;
      if (!future.length) return;
      past.push(clone(state));
      state = future.pop();
      emit('undo');
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    applyStyle(styleId) {
      dragBase = null;
      pushUndo();
      applyStyleTo(state, styleId);
      sanitize(state);
      emit('house');
    },
    newDesign(styleId) {
      // A new house starts a clean history, so undo can't resurrect the old one under the new id.
      dragBase = null;
      past.length = 0;
      future.length = 0;
      currentId = uid();
      state = sanitize(defaultDesign(styleId));
      const taken = new Set(projectList().map((p) => p?.name));
      for (let n = 2; taken.has(state.name); n++) state.name = `Casa ${n}`;
      state.land.seed = Math.floor(Math.random() * 1e6);
      emit('*');
    },
    addItem(type) {
      pushUndo();
      const { width, depth } = state.land;
      const es = effectiveState(state, { lot: true });
      const h = es.house;
      // Try spots around the yard until one is clear of the house and other items.
      let spot = { x: 0, z: depth / 2 - 2 };
      const pool = poolRect(es);
      const car = carportSpot(h);
      const crowdedAt = (x, z, r = 2.5) => state.yard.items.some((it) => Math.hypot(it.x - x, it.z - z) < r);
      if (type === 'car' && car && !crowdedAt(car.x, car.z, 2)) spot = car;
      else for (let i = 0; i < 80; i++) {
        const x = (Math.random() - 0.5) * (width - 3);
        const z = (Math.random() - 0.5) * (depth - 3);
        const inHouse = Math.abs(x - h.offsetX) < h.width / 2 + (h.carport ? 4.5 : 2.5) && Math.abs(z - h.offsetZ) < h.depth / 2 + 3.5;
        const inPool = pool && Math.abs(x - pool.x) < pool.w / 2 + 2.5 && Math.abs(z - pool.z) < pool.d / 2 + 2.5;
        const onPath = Math.abs(x - h.offsetX) < 1.5 && z > h.offsetZ;
        if (!inHouse && !inPool && !onPath && !crowdedAt(x, z)) { spot = { x, z }; break; }
      }
      const rot = type === 'car' && spot === car ? +(Math.PI / 2).toFixed(2) : +(Math.random() * Math.PI * 2).toFixed(2);
      const item = { id: uid(), type, x: +spot.x.toFixed(2), z: +spot.z.toFixed(2), rot };
      state.yard.items.push(item);
      emit('yard.items');
      return item.id;
    },
    removeItem(id) {
      const i = state.yard.items.findIndex((it) => it.id === id);
      if (i < 0) return;
      pushUndo();
      state.yard.items.splice(i, 1);
      emit('yard.items');
    },
    moveItem(id, x, z, { commit = false } = {}) {
      const it = state.yard.items.find((t) => t.id === id);
      if (!it) return;
      if (!dragBase) dragBase = clone(state);
      it.x = +x.toFixed(2);
      it.z = +z.toFixed(2);
      lastPatch = 'yard.items';
      emit('yard.items');
      if (commit) store.commit();
    },
    // ---- floor plan (see .squad/PLANEDIT.md) ----
    // Each action is one undo step and returns true when something changed.
    planCustomize() {
      if (state.house.plan) return true;
      return planApply(P.materialize(state.house));
    },
    setRoomType: (id, type) => planApply(P.setRoomType(state.house, id, type)),
    setRoomWidth: (id, meters) => planApply(P.setRoomWidth(state.house, id, meters)),
    moveWall: (level, band, index, x, opts) => planApply(P.moveWall(state.house, level, band, index, x), opts),
    setFrontDepth: (meters, opts) => planApply(P.setFrontDepth(state.house, meters), opts),
    addRoom: (level, band, type) => planApply(P.addRoom(state.house, level, band, type)),
    removeRoom(id) {
      const ok = planApply(P.removeRoom(state.house, id));
      if (ok && state.interior.rooms[id]) { delete state.interior.rooms[id]; emit('interior.rooms'); }
      return ok;
    },
    moveRoom: (id, dir) => planApply(P.moveRoom(state.house, id, dir)),
    resetPlan() {
      if (!state.house.plan) return false;
      dragBase = null;
      pushUndo();
      state.house.plan = null;
      sanitize(state);
      emit('house.plan');
      return true;
    },
    planInfo: (level = 0) => P.planInfo(state.house, level),
    // Where a wall may go: { x, lo, hi, left0, right1 } (absolute house-local x), or null.
    wallInfo(level, band, index) {
      const w = P.wallInfo(state.house, level, band, index);
      return w && { x: w.x, lo: w.lo, hi: w.hi, left0: w.left0, right1: w.right1 };
    },
    frontRange: () => P.frontRange(state.house),
    // ---- build mode (v4, see CONTRACT.md "v4 build API") ----
    // Every action is one undo step and returns the new id / true, or false. Drag-friendly ones accept
    // { commit: false } for live previews (final call with commit true = ONE undo step), like the plan actions.
    // ---- remodel (Remodelar) ----
    // startRemodel(): freezes the hand-built house as "today" (converts the automatic house first when needed:
    // that is its own undo step). Everything he builds after this is the plan; remodelInfo() compares the two.
    startRemodel() {
      if (state.mode !== 'build' && !store.setMode('build', { from: state.build ? undefined : 'house' })) return false;
      if (!state.build) return false;
      dragBase = null;
      pushUndo();
      const base = clone(state.build);
      delete base.prev;
      state.remodel = { base, startedAt: Date.now() };
      sanitize(state);
      emit('remodel');
      return true;
    },
    // finishRemodel(): the plan becomes the house; the "today" copy is dropped.
    finishRemodel() {
      if (!state.remodel) return false;
      dragBase = null;
      pushUndo();
      state.remodel = null;
      emit('remodel');
      return true;
    },
    // resetRemodel(): throw the changes away, back to the house as it is today (remodel stays on).
    resetRemodel() {
      if (!state.remodel || state.mode !== 'build') return false;
      dragBase = null;
      pushUndo();
      const prev = state.build?.prev;
      state.build = clone(state.remodel.base);
      if (prev) state.build.prev = prev;
      sanitize(state);
      emit('build');
      return true;
    },
    isRemodel: () => !!state.remodel && state.mode === 'build',
    remodelBase: () => state.remodel?.base ?? null,
    // { levels: [{ level, demolish, add, closed, opened, slabNew, slabGone, areaBefore, areaAfter, isNew }], totals }
    remodelInfo() {
      if (!state.remodel || !state.build) return null;
      if (remodelMemo.b === state.build && remodelMemo.r === state.remodel) return remodelMemo.v;
      remodelMemo = { b: state.build, r: state.remodel, v: remodelDiff(state.remodel.base, state.build) };
      return remodelMemo.v;
    },
    setMode(mode, { from } = {}) {
      if (mode !== 'auto' && mode !== 'build') return false;
      if (state.mode === mode && !(mode === 'build' && from)) return false;
      dragBase = null;
      pushUndo();
      const h = state.house;
      if (mode === 'build') {
        const prev = { floors: h.floors, floorHeight: h.floorHeight };
        let nb;
        if (from === 'blank' || from === 'house') state.remodel = null; // starting over ends a remodel
        if (from === 'blank') { nb = blankBuild(state); if (state.yard.fence !== 'custom' || !state.build?.fences?.length) state.yard.fence = 'none'; }
        else if (from === 'house' || !state.build || !state.build.levels.some((L) => L.walls.length || L.slabs.length)) nb = convertAuto(state);
        else nb = clone(state.build);
        if (nb.fences.length && !state.build?.fences?.length && state.yard.fence !== 'custom') state.yard.fence = 'custom';
        if (state.mode === 'auto') nb.prev = prev;
        state.build = nb;
        state.mode = 'build';
      } else {
        const prev = state.build?.prev;
        state.mode = 'auto';
        if (prev) { h.floors = prev.floors; h.floorHeight = prev.floorHeight; }
        if (state.build) delete state.build.prev;
      }
      sanitize(state);
      emit('mode');
      return true;
    },
    buildConvert() {
      if (state.mode === 'build') return false;
      return store.setMode('build', { from: 'house' });
    },
    addWall: (level, x0, z0, x1, z1, opts) => bApply((b) => BO.addWall(b, level, x0, z0, x1, z1, opts), opts),
    moveWallEnd: (id, end, x, z, opts) => bApply((b) => BO.moveWallEnd(b, id, end, x, z), opts),
    moveWallBy: (id, dx, dz, opts) => bApply((b) => BO.moveWallBy(b, id, dx, dz), opts),
    // Wall length: `anchor` 'a' keeps the first end, 'b' the second; connected perpendicular walls slide along.
    setWallLength: (id, len, anchor, opts) => bApply((b) => BO.setWallLength(b, id, len, anchor), opts),
    setWall: (id, patch, opts) => bApply((b) => BO.setWall(b, id, patch), opts),
    removeWall: (id) => bApply((b) => BO.removeWall(b, id)),
    addOpening: (wallId, kind, at, opts) => bApply((b) => BO.addOpening(b, wallId, kind, at, opts)),
    setOpening: (wallId, openingId, patch, opts) => bApply((b) => BO.setOpening(b, wallId, openingId, patch), opts),
    removeOpening: (wallId, openingId) => bApply((b) => BO.removeOpening(b, wallId, openingId)),
    addSlab: (level, rect) => bApply((b) => BO.addSlab(b, level, { ...(rect?.kind === 'carport' ? {} : { finish: state.interior.floor }), ...rect })),
    setSlab: (id, patch, opts) => bApply((b) => BO.setSlab(b, id, patch), opts),
    removeSlab: (id) => bApply((b) => BO.removeSlab(b, id)),
    // { shell: false } = an empty level (Piezas mode); default copies the outer walls + slabs from below (v4).
    addLevel: (opts) => bApply((b) => BO.addLevel(b, opts)),
    removeLevel() {
      const ok = bApply((b) => BO.removeLevel(b));
      if (ok) {
        // Furniture and room finishes of the removed level go with it.
        const F = state.build.levels.length;
        state.interior.items = state.interior.items.filter((it) => it.level < F);
        for (const key of Object.keys(state.interior.rooms)) if (+key[0] >= F) delete state.interior.rooms[key];
        emit('interior.rooms');
      }
      return ok;
    },
    addStairs: (level, x, z, rot, opts) => bApply((b) => BO.addStairs(b, level, x, z, rot, opts)),
    setStairs: (id, patch, opts) => bApply((b) => BO.setStairs(b, id, patch), opts),
    removeStairs: (id) => bApply((b) => BO.removeStairs(b, id)),
    setBuildRoof: (patch) => bApply((b) => BO.setBuildRoof(b, patch)),
    // Roof extras: { roofTerrace, pergola, waterTank, solar, entryPortal } booleans.
    setBuildExtras: (patch) => bApply((b) => BO.setBuildExtras(b, patch)),
    // Fences work in auto mode too (yard.fence becomes 'custom'); coordinates are lot-local.
    addFence: (x0, z0, x1, z1, opts) => bApply((b) => BO.addFence(b, x0, z0, x1, z1, opts), undefined, { needBuild: false, custom: true }),
    setFence: (id, patch, opts) => bApply((b) => BO.setFence(b, id, patch), opts, { needBuild: false }),
    removeFence: (id) => bApply((b) => BO.removeFence(b, id), undefined, { needBuild: false }),
    removeGate: (fenceId, at) => bApply((b) => BO.removeGate(b, fenceId, at), undefined, { needBuild: false }),
    // Why the last build action returned false: 'tooShort' | 'noFit' | 'overlap' | 'limit' | 'badValue' | 'needLevel' | 'levelsMax' | 'notFound' | '' (unknown).
    buildReason: () => lastReason(),
    addGate: (fenceId, at, kind) => bApply((b) => BO.addGate(b, fenceId, at, kind), undefined, { needBuild: false, custom: true }),
    setGrid: (g) => bApply((b) => BO.setGrid(b, g), undefined, { needBuild: false }),
    // Columns (v5): free-standing plastered columns, house-local centre.
    addColumn: (level, x, z, opts) => bApply((b) => BO.addColumn(b, level, x, z, opts)),
    setColumn: (id, patch, opts) => bApply((b) => BO.setColumn(b, id, patch), opts),
    removeColumn: (id) => bApply((b) => BO.removeColumn(b, id)),
    // ---- pieces (v5, see CONTRACT.md "v5 pieces API") ----
    // Pure: where the piece would go (snapped), or why not. Call on every pointer move.
    fitPiece: (pieceId, placement) => fitPiece(state, pieceId, placement ?? {}),
    // Places a piece at a fitPiece result (re-fitted here). One undo step. -> { ok, ids, level, reason? }
    placePiece(pieceId, pl = {}) {
      const pc = pieceById(pieceId);
      if (!pc) return { ok: false, ids: [], level: 0, reason: 'notFound' };
      const f = fitPiece(state, pieceId, { level: pl.level, x: pl.x, z: pl.z, rot: pl.rot, wallId: pl.wallId, fenceId: pl.fenceId });
      if (!f.ok) return { ok: false, ids: [], level: f.level, reason: f.reason };
      if (pc.kind === 'yard') {
        dragBase = null;
        pushUndo();
        const item = { id: uid(), type: pc.item, x: f.x, z: f.z, rot: +rad(f.rot).toFixed(4) };
        state.yard.items.push(item);
        emit('yard.items');
        return { ok: true, ids: [item.id], level: 0 };
      }
      const lot = pc.kind === 'fence' || pc.kind === 'gate' || pc.kind === 'frontFence';
      let out = null;
      const ok = pApply((b) => (out = applyPiece(b, pc, f, { floor: state.interior.floor, s: state })), { needBuild: !lot, custom: lot });
      if (!ok || !out) return { ok: false, ids: [], level: f.level, reason: lastReason() || 'noRoom' };
      return { ok: true, ids: out.ids, level: out.level };
    },
    // The placed piece under a house-local point: { kind, ids, level, label, x, z, w, d } or null.
    groupAt: (level, x, z) => groupAt(state, level, x, z),
    // Pure validated move / rotate of a group: { ok, dx, dz, rot, snaps, reason? }. opts { rot, snap, copy }.
    fitGroup: (ids, dx, dz, opts) => fitGroup(state, Array.isArray(ids) ? ids : [], dx, dz, opts ?? {}),
    // Group edits run the same checks as fitGroup and refuse (false, store.buildReason()) when it says no.
    moveGroup(ids, dx, dz, opts) {
      const mx = +dx || 0, mz = +dz || 0;
      if (!Array.isArray(ids) || !ids.length || (Math.abs(mx) < 1e-6 && Math.abs(mz) < 1e-6)) return false;
      const f = fitGroup(state, ids, mx, mz, { snap: false });
      if (!f.ok) { refuse(f.reason); return false; }
      return !!pApply((b, items) => transformGroup(state, b, items, ids, (x, z) => [x + mx, z + mz], 0), { needBuild: false, commit: opts?.commit !== false });
    },
    rotateGroup(ids, deg = 90) {
      if (!Array.isArray(ids) || !ids.length) return false;
      const g = groupBox(state, ids);
      if (!g.bbox) return false;
      const th = rad(deg);
      if (!th) return false;
      const f = fitGroup(state, ids, 0, 0, { rot: deg, snap: false });
      if (!f.ok) { refuse(f.reason); return false; }
      const cx = (g.bbox.x0 + g.bbox.x1) / 2, cz = (g.bbox.z0 + g.bbox.z1) / 2, c = Math.round(Math.cos(th)), sn = Math.round(Math.sin(th));
      return !!pApply((b, items) => transformGroup(state, b, items, ids, (x, z) => [cx + (x - cx) * c + (z - cz) * sn, cz - (x - cx) * sn + (z - cz) * c], th), { needBuild: false });
    },
    removeGroup(ids) {
      if (!Array.isArray(ids) || !ids.length) return false;
      return !!pApply((b, items) => removeGroupIn(state, b, items, ids), { needBuild: false });
    },
    // Copy of a group in the first free spot beside it (right, left, front, back; flush, sharing the wall line),
    // or at (dx, dz) when given. -> { ok, ids, reason? }
    duplicateGroup(ids, dx = null, dz = null) {
      if (!Array.isArray(ids) || !ids.length) return { ok: false, ids: [], reason: 'notFound' };
      const g = groupBox(state, ids);
      if (!g.bbox) return { ok: false, ids: [], reason: 'notFound' };
      const ws = state.build?.levels[g.level]?.walls.filter((w) => g.walls.includes(w.id)) ?? [];
      const span = (k0, k1) => (ws.length ? Math.max(...ws.flatMap((w) => [w[k0], w[k1]])) - Math.min(...ws.flatMap((w) => [w[k0], w[k1]])) : 0);
      const W = ws.length ? span('x0', 'x1') : g.bbox.x1 - g.bbox.x0, D = ws.length ? span('z0', 'z1') : g.bbox.z1 - g.bbox.z0;
      const tries = dx != null || dz != null ? [[+dx || 0, +dz || 0]] : [[W, 0], [-W, 0], [0, D], [0, -D], [2 * W, 0], [-2 * W, 0], [0, 2 * D], [0, -2 * D]];
      let reason = 'overlap';
      for (const [ox, oz] of tries) {
        const f = fitGroup(state, ids, ox, oz, { snap: false, copy: true });
        if (!f.ok) { reason = f.reason; continue; }
        let out = null;
        const ok = pApply((b, items) => (out = transformGroup(state, b, items, ids, (x, z) => [x + ox, z + oz], 0, { copy: true })), { needBuild: false });
        if (ok && out) return { ok: true, ids: out.ids };
      }
      refuse(reason);
      return { ok: false, ids: [], reason };
    },
    // Helpers for the UI
    buildInfo: (level = 0) => buildInfoOf(state.build ?? emptyBuild(state.house), level),
    snapPoint: (x, z, level = 0, opts) => snapPointOf(state.build ?? emptyBuild(state.house), x, z, level, opts),
    // Rooms inferred from closed wall loops: [{ key, type, level, x, z, area, net, x0, x1, z0, z1, poly }]
    buildRooms: () => (state.build ? buildRooms(state.build).map(({ holes, ...r }) => r) : []),
    itemBounds: () => itemBounds(state),
    // ---- interior ----
    addIndoorItem(type, level = 0) {
      if (!INDOOR_TYPES.some((t) => t.id === type)) return null;
      const h = state.house;
      const lvl = Math.round(clampNum(finite(level, 0), [0, h.floors - 1]));
      const b = itemBounds(state);
      const rooms = roomsOn(state, lvl).filter((r) => r.type !== 'pasillo' && r.type !== 'escalera' && r.type !== 'bano');
      const liked = rooms.filter((r) => r.type === 'sala' || r.type === 'dormitorio' || r.type === 'principal');
      const others = state.interior.items.filter((it) => it.level === lvl);
      const free = (x, z) => others.every((it) => Math.hypot(it.x - x, it.z - z) > 1.1);
      const pad = 0.7;
      let spot = null;
      for (let i = 0; i < 120 && !spot; i++) {
        const pool = i < 80 && liked.length ? liked : rooms;
        const r = pool[Math.floor(Math.random() * pool.length)];
        if (!r) break;
        const w = r.x1 - r.x0 - 2 * pad, d = r.z1 - r.z0 - 2 * pad;
        const x = (r.x0 + r.x1) / 2 + (w > 0 ? (Math.random() - 0.5) * w : 0);
        const z = (r.z0 + r.z1) / 2 + (d > 0 ? (Math.random() - 0.5) * d : 0);
        if (free(x, z)) spot = { x, z };
      }
      if (!spot) {
        const r = liked[0] ?? rooms[0];
        spot = r ? { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 } : { x: 0, z: 0 };
      }
      pushUndo();
      dragBase = null;
      const item = {
        id: uid(), type, level: lvl,
        x: +clampNum(spot.x, [b.x0, b.x1]).toFixed(2),
        z: +clampNum(spot.z, [b.z0, b.z1]).toFixed(2),
        rot: +((Math.floor(Math.random() * 4) * Math.PI) / 2).toFixed(4),
      };
      state.interior.items.push(item);
      emit('interior.items');
      return item.id;
    },
    moveIndoorItem(id, x, z, { commit = false } = {}) {
      const it = state.interior.items.find((t) => t.id === id);
      if (!it || !Number.isFinite(+x) || !Number.isFinite(+z)) return;
      if (!dragBase) dragBase = clone(state);
      const b = itemBounds(state);
      it.x = +clampNum(+x, [b.x0, b.x1]).toFixed(2);
      it.z = +clampNum(+z, [b.z0, b.z1]).toFixed(2);
      lastPatch = 'interior.items';
      emit('interior.items');
      if (commit) store.commit();
    },
    rotateIndoorItem(id) {
      const it = state.interior.items.find((t) => t.id === id);
      if (!it) return;
      pushUndo();
      dragBase = null;
      it.rot = +((((it.rot ?? 0) + Math.PI / 2) % (Math.PI * 2))).toFixed(4);
      emit('interior.items');
    },
    removeIndoorItem(id) {
      const i = state.interior.items.findIndex((it) => it.id === id);
      if (i < 0) return;
      pushUndo();
      dragBase = null;
      state.interior.items.splice(i, 1);
      emit('interior.items');
    },
    // field: wall | floor | floorTone | floorPattern | tileSize | baseboard. null/'' clears that override.
    setRoom(key, field, value) {
      return store.setRoomFields(key, { [field]: value });
    },
    // Several fields of one room as a single undo step.
    setRoomFields(key, fields) {
      if (!ROOM_KEY.test(key) || !plainObj(fields)) return false;
      const next = { ...state.interior.rooms[key] };
      for (const [field, value] of Object.entries(fields)) {
        if (!ROOM_FIELDS[field]) return false;
        if (value === null || value === '') { delete next[field]; continue; }
        if (!ROOM_FIELDS[field](value)) return false;
        next[field] = value;
      }
      if (JSON.stringify(next) === JSON.stringify(state.interior.rooms[key] ?? {})) return false;
      pushUndo();
      dragBase = null;
      if (Object.keys(next).length) state.interior.rooms[key] = next;
      else delete state.interior.rooms[key];
      sanitize(state);
      emit('interior.rooms');
      return true;
    },
    clearRoom(key) {
      if (!state.interior.rooms[key]) return;
      pushUndo();
      dragBase = null;
      delete state.interior.rooms[key];
      emit('interior.rooms');
    },
    projects: {
      list: () => projectList().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
      currentId: () => currentId,
      save(name, thumb) {
        if (name) state.name = name;
        const list = projectList();
        let entry = list.find((p) => p.id === currentId);
        if (!entry) {
          entry = { id: currentId };
          list.push(entry);
        }
        entry.name = state.name;
        entry.updatedAt = Date.now();
        if (thumb) entry.thumb = thumb;
        const ok = writeJSON(keyDesign(currentId), state) && writeJSON(KEY_PROJECTS, list);
        writeJSON(KEY_CURRENT, currentId);
        emit('name');
        return ok ? currentId : null;
      },
      open(id) {
        const d = readJSON(keyDesign(id), null);
        if (!d) return false;
        let next;
        try { next = sanitize(migrate(d)); } catch { return false; }
        dragBase = null;
        currentId = id;
        state = next;
        past.length = 0;
        future.length = 0;
        writeJSON(KEY_CURRENT, id);
        emit('*');
        return true;
      },
      remove(id) {
        writeJSON(KEY_PROJECTS, projectList().filter((p) => p.id !== id));
        try { localStorage.removeItem(keyDesign(id)); } catch { /* storage blocked */ }
        if (id === currentId) store.newDesign();
      },
    },
  };
  return store;
}

// Fill in any field an older saved design is missing; replace wrong-typed ones.
function migrate(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) d = {};
  const base = defaultDesign(d?.house?.style);
  const merge = (a, b) => {
    for (const k of Object.keys(a)) {
      const plainObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
      if (b[k] === undefined || b[k] === null && a[k] !== null || (plainObj(a[k]) && !plainObj(b[k])) || (Array.isArray(a[k]) && !Array.isArray(b[k]))) b[k] = a[k];
      else if (plainObj(a[k])) merge(a[k], b[k]);
    }
    return b;
  };
  const out = merge(base, d ?? {});
  out.version = 2;
  return out;
}
