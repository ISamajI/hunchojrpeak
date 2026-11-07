// v5 "Piezas": the catalog of ready-made pieces and the pure logic that fits, places, groups and moves them.
// Every piece becomes ordinary v4 build data (walls / openings / slabs / stairs / fences + columns).
// Spec: .squad/PIECES.md, API: CONTRACT.md "v5 pieces API". No three.js here.
import {
  ops as BO, emptyBuild, emptyLevel, inferRooms, roomContains, wallLen, nodeKey, splitWalls, mergeWalls, mkId, allIds,
  r2, fail, BL, OPEN_DEFAULTS, FENCE_DEFAULT_H, buildEntry, buildPad, bclone as clone,
} from './buildmodel.js';
import { roomName } from './layout.js';

export const PIECE_CATS = ['cuartos', 'paredes', 'aberturas', 'pisos', 'techo', 'exterior'];
export const MAX_YARD_ITEMS = 60;

// ---- catalog ------------------------------------------------------------------------------------
const N = (es, en) => ({ es, en });
const win = (side, w = 1.2, h = 1.2, sill = 1.0, extra = {}) => ({ side, kind: 'window', w, h, sill, ...extra });
const room = (id, es, en, w, d, type, ico, { door = { side: 'front', kind: 'door', w: 0.9 }, windows = [] } = {}) =>
  ({ id, cat: 'cuartos', kind: 'room', name: N(es, en), w, d, ico, room: type, t: 0.15, door, windows });
const wallP = (len, es, en, extra = {}) => ({ id: `pared-${len}`, cat: 'paredes', kind: 'wall', name: N(es, en), w: len, d: 0.15, ico: 'brick-wall', len, h: null, t: 0.15, ...extra });
const opening = (id, es, en, kind, extra = {}) => {
  const open = { kind, ...OPEN_DEFAULTS[kind], ...extra };
  return { id, cat: 'aberturas', kind: 'opening', name: N(es, en), w: open.w, d: open.h, ico: kind === 'window' ? 'app-window' : 'door-open', open };
};
const fence = (id, es, en, type, cat = 'exterior') => ({ id, cat, kind: 'fence', name: N(es, en), w: 3, d: 0.25, ico: 'fence', type, len: 3 });
const yard = (item, es, en, w, d, ico) => ({ id: `yard-${item}`, cat: 'exterior', kind: 'yard', name: N(es, en), w, d, ico, item });

export const PIECES = [
  // cuartos
  room('dormitorio', 'Habitación', 'Bedroom', 3, 3.5, 'dormitorio', 'bed', { windows: [win('back'), win('left', 1.0)] }),
  room('dormitorio-grande', 'Habitación grande', 'Large bedroom', 4, 4, 'principal', 'bed-double', { windows: [win('back', 1.5), win('right', 1.2)] }),
  room('bano', 'Baño', 'Bathroom', 2, 2.5, 'bano', 'bath', { door: { side: 'front', kind: 'door', w: 0.8 }, windows: [win('back', 0.6, 0.5, 1.6, { style: 'louvered' })] }),
  room('cocina', 'Cocina', 'Kitchen', 3, 3.5, 'cocina', 'cooking-pot', { windows: [win('back', 1.2, 1.0, 1.1)] }),
  room('sala', 'Sala', 'Living room', 5, 4, 'sala', 'sofa', { door: { side: 'front', kind: 'door', w: 1.0, pos: 0.28 }, windows: [win('front', 2.0, 1.4, 0.8, { pos: 0.7 }), win('left', 1.5), win('right', 1.5)] }),
  room('comedor', 'Comedor', 'Dining room', 3.5, 3.5, 'comedor', 'utensils', { door: { side: 'front', kind: 'arch', w: 1.2 }, windows: [win('left', 1.5), win('right', 1.5)] }),
  room('estudio', 'Estudio', 'Study', 3, 3, 'estudio', 'book-open', { windows: [win('back')] }),
  room('lavado', 'Lavado', 'Laundry', 2, 2, 'lavado', 'washing-machine', { door: { side: 'front', kind: 'door', w: 0.8 }, windows: [win('back', 0.8, 0.6, 1.4, { style: 'louvered' })] }),
  { id: 'galeria', cat: 'cuartos', kind: 'porch', name: N('Galería', 'Porch'), w: 4, d: 2.5, ico: 'tent', finish: 'ceramica' },
  { id: 'marquesina', cat: 'cuartos', kind: 'carport', name: N('Marquesina', 'Carport'), w: 3, d: 6, ico: 'car' },
  { id: 'balcon', cat: 'cuartos', kind: 'balcony', name: N('Balcón', 'Balcony'), w: 3, d: 1.5, ico: 'fence', finish: 'ceramica' },
  // paredes
  wallP(1, 'Pared 1 m', 'Wall 1 m'), wallP(2, 'Pared 2 m', 'Wall 2 m'), wallP(3, 'Pared 3 m', 'Wall 3 m'), wallP(4, 'Pared 4 m', 'Wall 4 m'),
  { ...wallP(1, 'Media pared', 'Half wall', { h: 1.0 }), id: 'media-pared' },
  { id: 'columna', cat: 'paredes', kind: 'column', name: N('Columna', 'Column'), w: 0.3, d: 0.3, ico: 'columns-3', s: 0.3 },
  fence('muro-bloque', 'Muro de bloque 3 m', 'Block wall 3 m', 'block', 'paredes'),
  // aberturas
  opening('puerta', 'Puerta', 'Door', 'door'),
  opening('puerta-doble', 'Puerta doble', 'Double door', 'door', { w: 1.6, style: 'double' }),
  opening('corrediza', 'Corrediza', 'Sliding door', 'slider'),
  opening('arco', 'Arco', 'Arch', 'arch'),
  opening('garaje', 'Garaje', 'Garage door', 'garage'),
  opening('ventana', 'Ventana', 'Window', 'window'),
  opening('ventana-grande', 'Ventana grande', 'Large window', 'window', { w: 2.0, h: 1.4, sill: 0.8 }),
  opening('ventanal', 'Ventanal', 'Glass wall', 'slider', { w: 2.4, h: 2.5, style: 'glass' }),
  opening('ventana-bano', 'Ventana de baño', 'Bathroom window', 'window', { w: 0.6, h: 0.5, sill: 1.6, style: 'louvered' }),
  // pisos
  { id: 'piso-3', cat: 'pisos', kind: 'slab', name: N('Piso 3 × 3', 'Floor 3 × 3'), w: 3, d: 3, ico: 'square' },
  { id: 'piso-4', cat: 'pisos', kind: 'slab', name: N('Piso 4 × 4', 'Floor 4 × 4'), w: 4, d: 4, ico: 'square' },
  { id: 'terraza', cat: 'pisos', kind: 'slab', name: N('Terraza', 'Terrace'), w: 4, d: 4, ico: 'grid-2x2', finish: 'terracota' },
  { id: 'escalera', cat: 'pisos', kind: 'stairs', name: N('Escalera', 'Stairs'), w: 1.0, d: 4.6, ico: 'stairs', len: 4.6 },
  // techo
  { id: 'techo-plano', cat: 'techo', kind: 'roof', name: N('Techo plano', 'Flat roof'), w: 0, d: 0, ico: 'square', roof: { type: 'flat', material: 'concrete', parapet: true } },
  { id: 'techo-cuatro', cat: 'techo', kind: 'roof', name: N('Cuatro aguas', 'Hip roof'), w: 0, d: 0, ico: 'home', roof: { type: 'hip', material: 'tile' } },
  { id: 'techo-dos', cat: 'techo', kind: 'roof', name: N('Dos aguas', 'Gable roof'), w: 0, d: 0, ico: 'home', roof: { type: 'gable', material: 'tile' } },
  { id: 'techo-una', cat: 'techo', kind: 'roof', name: N('Una agua', 'Shed roof'), w: 0, d: 0, ico: 'triangle-right', roof: { type: 'shed', material: 'metal' } },
  { id: 'pergola', cat: 'techo', kind: 'extra', name: N('Pérgola', 'Pergola'), w: 0, d: 0, ico: 'grid-3x3', extras: { roofTerrace: true, pergola: true }, flat: true },
  { id: 'tinaco', cat: 'techo', kind: 'extra', name: N('Tinaco', 'Water tank'), w: 0, d: 0, ico: 'cylinder', extras: { waterTank: true } },
  { id: 'solar', cat: 'techo', kind: 'extra', name: N('Paneles solares', 'Solar panels'), w: 0, d: 0, ico: 'sun', extras: { solar: true } },
  { id: 'azotea', cat: 'techo', kind: 'extra', name: N('Azotea', 'Roof terrace'), w: 0, d: 0, ico: 'layers', extras: { roofTerrace: true }, flat: true },
  // exterior
  fence('cerca-bloque', 'Cerca de bloque 3 m', 'Block fence 3 m', 'block'),
  fence('cerca-rejas', 'Rejas 3 m', 'Iron fence 3 m', 'rejas'),
  fence('cerca-madera', 'Madera 3 m', 'Wood fence 3 m', 'madera'),
  fence('cerca-malla', 'Malla 3 m', 'Chain-link 3 m', 'malla'),
  fence('cerca-piedra', 'Piedra 3 m', 'Stone fence 3 m', 'piedra'),
  { ...fence('cerca-bloque-6', 'Cerca de bloque 6 m', 'Block fence 6 m', 'block'), w: 6, len: 6 },
  { ...fence('cerca-rejas-6', 'Rejas 6 m', 'Iron fence 6 m', 'rejas'), w: 6, len: 6 },
  { ...fence('cerca-madera-6', 'Madera 6 m', 'Wood fence 6 m', 'madera'), w: 6, len: 6 },
  { ...fence('cerca-malla-6', 'Malla 6 m', 'Chain-link 6 m', 'malla'), w: 6, len: 6 },
  { ...fence('cerca-piedra-6', 'Piedra 6 m', 'Stone fence 6 m', 'piedra'), w: 6, len: 6 },
  // The whole front lot line in one go, with the vehicle and pedestrian gates in front of the carport / entrance.
  { id: 'cercar-frente', cat: 'exterior', kind: 'frontFence', name: N('Cercar el frente', 'Fence the front'), w: 0, d: 0.25, ico: 'fence', type: 'rejas' },
  { id: 'porton-peatonal', cat: 'exterior', kind: 'gate', name: N('Portón peatonal', 'Garden gate'), w: 1.0, d: 0.25, ico: 'door-open', gate: 'peatonal' },
  { id: 'porton-vehicular', cat: 'exterior', kind: 'gate', name: N('Portón vehicular', 'Driveway gate'), w: 3.2, d: 0.25, ico: 'car', gate: 'vehicular' },
  yard('palm', 'Palma', 'Palm tree', 1, 1, 'palmtree'),
  yard('mango', 'Árbol de mango', 'Mango tree', 1.5, 1.5, 'tree-deciduous'),
  yard('flowers', 'Flores', 'Flowers', 1.2, 1.2, 'flower'),
  yard('car', 'Carro', 'Car', 1.9, 4.4, 'car'),
  yard('gazebo', 'Gazebo', 'Gazebo', 3.4, 3.4, 'tent'),
  yard('bench', 'Banco', 'Bench', 1.6, 0.6, 'armchair'),
  yard('bbq', 'Parrilla', 'BBQ grill', 1.2, 0.8, 'flame'),
];
const BY_ID = new Map(PIECES.map((p) => [p.id, p]));
export const pieceById = (id) => BY_ID.get(id) ?? null;

const LOT_KINDS = ['fence', 'gate', 'yard', 'frontFence'];
// Snap radius onto a wall / fence: generous, because on touch the drop point is lifted above the finger.
const OPEN_R = 1.2, GATE_R = 2.0;
const ROOM_FLOOR = { bano: 'ceramica', lavado: 'ceramica' };
export const LOT_PIECE_KINDS = LOT_KINDS;
export const BUILD_KINDS = ['room', 'porch', 'carport', 'balcony', 'wall', 'column', 'opening', 'slab', 'stairs', 'roof', 'extra'];

// ---- small geometry helpers ----------------------------------------------------------------------
const normRot = (deg) => ((((Math.round((+deg || 0) / 90)) % 4) + 4) % 4) * 90;
const rad = (deg) => (deg * Math.PI) / 180;
// Local piece frame -> world (three.js rotation.y = θ).
const rotV = (lx, lz, th) => [lx * Math.cos(th) + lz * Math.sin(th), -lx * Math.sin(th) + lz * Math.cos(th)];
const SIDE_N = { front: [0, 1], back: [0, -1], left: [-1, 0], right: [1, 0] };
function worldSide(side, rot) {
  const [nx, nz] = rotV(...SIDE_N[side] ?? SIDE_N.front, rad(rot));
  if (Math.abs(nx) > Math.abs(nz)) return nx > 0 ? 'right' : 'left';
  return nz > 0 ? 'front' : 'back';
}
const segDist = (px, pz, x0, z0, x1, z1) => {
  const dx = x1 - x0, dz = z1 - z0, l2 = dx * dx + dz * dz;
  const t = l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / l2));
  const cx = x0 + t * dx, cz = z0 + t * dz;
  return { d: Math.hypot(px - cx, pz - cz), t, cx, cz };
};
const isH = (w) => Math.abs(w.z1 - w.z0) < 0.01;
const isV = (w) => Math.abs(w.x1 - w.x0) < 0.01;

// Lot bounds in house-local metres (same margins as sanitizeBuild).
function lotBox(s) {
  const { width, depth } = s.land, { offsetX: ox = 0, offsetZ: oz = 0 } = s.house;
  return { x0: -width / 2 - ox + 0.2, x1: width / 2 - ox - 0.2, z0: -depth / 2 - oz + 0.2, z1: depth / 2 - oz - 0.2, ox, oz, hw: width / 2, hd: depth / 2 };
}

// The build pieces are placed into: the hand-built one, or (auto mode / nothing yet) a blank one.
const blankCache = new WeakMap();
export function targetBuild(s) {
  if (s.mode === 'build' && s.build) return s.build;
  if (s.build && s.build.levels.some((L) => L.walls.length || L.slabs.length)) return s.build;
  let b = blankCache.get(s.house);
  if (!b) { b = emptyBuild(s.house); if (s.build?.fences) b.fences = s.build.fences; blankCache.set(s.house, b); }
  if (s.build?.fences) b.fences = s.build.fences;
  return b;
}

// Per-build cache: inferred rooms per level (builds are immutable snapshots in the store).
const roomCache = new WeakMap();
function roomsOf(b, li) {
  let m = roomCache.get(b);
  if (!m) { m = []; roomCache.set(b, m); }
  if (!b.levels[li]) return [];
  return (m[li] ??= inferRooms(b.levels[li]));
}

// Free spot on a wall / fence for an opening of width ow near `want` (m from its first end), or null.
export function fitOnSeg(len, list, ow, want, { margin = 0.12, gap = 0.08 } = {}) {
  const lo = ow / 2 + margin, hi = len - ow / 2 - margin;
  if (hi < lo - 1e-6) return null;
  const blocked = list.map((p) => [p.at - (p.w + ow) / 2 - gap, p.at + (p.w + ow) / 2 + gap]).sort((a, c) => a[0] - c[0]);
  const free = [];
  let cur = lo;
  for (const [a, c] of blocked) { if (a > cur) free.push([cur, Math.min(a, hi)]); cur = Math.max(cur, c); }
  if (cur <= hi) free.push([cur, hi]);
  let best = null;
  for (const [a0, c0] of free) {
    // Round inward to whole cm (plus 1 mm) so `at` never sits on a neighbour's clearance edge, where float error
    // made addOpening's re-check report 'overlap' after fitPiece said ok.
    const a = Math.ceil((a0 + 1e-3) * 100) / 100, c = Math.floor((c0 - 1e-3) * 100) / 100;
    if (c < a - 1e-6) continue;
    const v = Math.min(c, Math.max(a, want));
    if (best === null || Math.abs(v - want) < Math.abs(best - want)) best = v;
  }
  return best === null ? null : r2(best);
}

// 1-D snap: shift the piece's edges onto the nearest candidate line within R.
function snap1D(edges, cands, R) {
  let best = null;
  for (const e of edges) for (const c of cands) {
    const sh = c.v - e;
    const score = Math.abs(sh) + (c.kind === 'edge' ? 0.12 : 0);
    if (Math.abs(sh) <= R && (!best || score < best.score)) best = { shift: sh, v: c.v, kind: c.kind, score };
  }
  return best;
}

// Candidate lines (x and z) near a rectangle, from walls / slabs of the given levels.
// mode 'center' = rectangle edges are wall centre lines (rooms); 'outer' = rectangle edges are outlines (slabs).
function rectCands(b, levels, rect, mode, t, skip = null) {
  const X = [], Z = [], R = 0.6;
  const nearZ = (a, c) => Math.max(a, c) >= rect.z0 - R && Math.min(a, c) <= rect.z1 + R;
  const nearX = (a, c) => Math.max(a, c) >= rect.x0 - R && Math.min(a, c) <= rect.x1 + R;
  for (const li of levels) {
    const L = b.levels[li];
    if (!L) continue;
    for (const w of L.walls) {
      if (skip?.has(w.id)) continue;
      const off = mode === 'outer' ? [w.t / 2, -w.t / 2] : [0];
      if (isV(w) && nearZ(w.z0, w.z1)) for (const o of off) X.push({ v: w.x0 + o, kind: 'wall' });
      if (isH(w) && nearX(w.x0, w.x1)) for (const o of off) Z.push({ v: w.z0 + o, kind: 'wall' });
      for (const [px, pz] of [[w.x0, w.z0], [w.x1, w.z1]]) {
        if (pz >= rect.z0 - R && pz <= rect.z1 + R) for (const o of off) X.push({ v: px + o, kind: 'end' });
        if (px >= rect.x0 - R && px <= rect.x1 + R) for (const o of off) Z.push({ v: pz + o, kind: 'end' });
      }
    }
    for (const s of L.slabs) {
      if (skip?.has(s.id)) continue;
      // Room centre lines sit half a wall inside a slab outline (low edge +t/2, high edge -t/2).
      const o0 = mode === 'outer' ? 0 : t / 2;
      if (nearZ(s.z0, s.z1)) X.push({ v: s.x0 + o0, kind: 'edge' }, { v: s.x1 - o0, kind: 'edge' });
      if (nearX(s.x0, s.x1)) Z.push({ v: s.z0 + o0, kind: 'edge' }, { v: s.z1 - o0, kind: 'edge' });
    }
  }
  return { X, Z };
}

// Snap a rectangle centred at (x, z) with half sizes (hw, hd). Returns { x, z, snaps }.
function snapRect(b, levels, x, z, hw, hd, mode, t, g, skip) {
  const rect = { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd };
  const { X, Z } = rectCands(b, levels, rect, mode, t, skip);
  const snaps = [];
  const sx = snap1D([rect.x0, rect.x1], X, 0.4), sz = snap1D([rect.z0, rect.z1], Z, 0.4);
  let nx = x, nz = z;
  if (sx) { nx = x + sx.shift; snaps.push({ x: r2(sx.v), z: r2(z), kind: sx.kind }); }
  else nx = Math.round((x - hw) / g) * g + hw;
  if (sz) { nz = z + sz.shift; snaps.push({ x: r2(nx), z: r2(sz.v), kind: sz.kind }); }
  else nz = Math.round((z - hd) / g) * g + hd;
  if (sx) snaps[0].z = r2(nz);
  return { x: r2(nx), z: r2(nz), snaps };
}

const inLot = (lot, r) => r.x0 >= lot.x0 - 0.01 && r.x1 <= lot.x1 + 0.01 && r.z0 >= lot.z0 - 0.01 && r.z1 <= lot.z1 + 0.01;

// Does the rectangle cut into an existing room interior by more than 0.3 m?
function overlapsRoom(b, li, r, ignore = null) {
  for (const rm of roomsOf(b, li)) {
    if (ignore && ignore(rm)) continue;
    const ox = Math.min(r.x1, rm.x1) - Math.max(r.x0, rm.x0), oz = Math.min(r.z1, rm.z1) - Math.max(r.z0, rm.z0);
    if (ox <= 0.3 || oz <= 0.3) continue;
    const cx = (Math.min(r.x1, rm.x1) + Math.max(r.x0, rm.x0)) / 2, cz = (Math.min(r.z1, rm.z1) + Math.max(r.z0, rm.z0)) / 2;
    if (roomContains(rm, cx, cz)) return true;
    // L-shaped rooms: sample a few points of the overlap.
    for (const [fx, fz] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
      const px = Math.max(r.x0, rm.x0) + ox * fx, pz = Math.max(r.z0, rm.z0) + oz * fz;
      if (roomContains(rm, px, pz)) return true;
    }
  }
  return false;
}

const shrink = (r, k) => ({ x0: r.x0 + k, x1: r.x1 - k, z0: r.z0 + k, z1: r.z1 - k });
const rectOverlap = (a, c, min = 0.3) => Math.min(a.x1, c.x1) - Math.max(a.x0, c.x0) > min && Math.min(a.z1, c.z1) - Math.max(a.z0, c.z0) > min;
// Does segment (x0,z0)-(x1,z1) pass through the rectangle? (Liang-Barsky clip)
function segHitsRect(x0, z0, x1, z1, r) {
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dz = z1 - z0;
  for (const [p, q] of [[-dx, x0 - r.x0], [dx, r.x1 - x0], [-dz, z0 - r.z0], [dz, r.z1 - z0]]) {
    if (Math.abs(p) < 1e-12) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return t1 - t0 > 1e-6;
}
// An inferred room with no walls inside it: a "+ Piso" shell or a big empty hall a new room may subdivide.
function isEmptyShell(L, rm) {
  return !L.walls.some((w) => !wallOnPoly(w, rm.poly) && roomContains(rm, (w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2));
}
const rectInRoom = (rm, r) => [[r.x0 + 0.05, r.z0 + 0.05], [r.x1 - 0.05, r.z0 + 0.05], [r.x1 - 0.05, r.z1 - 0.05], [r.x0 + 0.05, r.z1 - 0.05], [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2]].every(([x, z]) => roomContains(rm, x, z));
// The empty shell a room rectangle would subdivide, or null.
function shellFor(b, li, rect) {
  const L = b.levels[li];
  if (!L) return null;
  return roomsOf(b, li).find((rm) => rectInRoom(rm, rect) && isEmptyShell(L, rm)) ?? null;
}
// Room type of an inferred room (its anchor), 'cuarto' when it has none.
function typeOf(b, li, rm) {
  return (b.rooms ?? []).find((a) => +a.key[0] === li && roomContains(rm, a.x, a.z))?.type ?? 'cuarto';
}

// Why a footprint cannot go on level li (or null). kind: room | porch | carport | balcony | slab | stairs.
// ignoreRooms / ignoreIds = the group being moved (its own rooms and elements do not count).
function footprintReason(b, li, rect, kind, { ignoreRooms = [], ignoreIds = null } = {}) {
  const L = b.levels[li];
  if (!L) return null;
  const inner = shrink(rect, 0.05);
  const skip = (id) => ignoreIds?.has(id);
  if (kind === 'room' || kind === 'porch' || kind === 'carport' || kind === 'balcony') {
    const shell = kind === 'room' ? shellFor(b, li, rect) : null;
    if (overlapsRoom(b, li, inner, (rm) => rm === shell || ignoreRooms.includes(rm))) return 'overlap';
  }
  // A room never sits on a porch / carport / balcony; outdoor slabs and floors never stack on another slab.
  for (const q of L.slabs) {
    if (skip(q.id)) continue;
    if (kind === 'room' && q.kind && rectOverlap(inner, q)) return 'overlap';
    if ((kind === 'slab' || kind === 'porch' || kind === 'carport' || kind === 'balcony') && rectOverlap(inner, q)) return 'overlap';
  }
  // Stairs: the run may not pass through a wall.
  if (kind === 'stairs') for (const w of L.walls) if (!skip(w.id) && segHitsRect(w.x0, w.z0, w.x1, w.z1, shrink(rect, 0.02 - w.t / 2))) return 'overlap';
  return null;
}

// Fraction of a rectangle resting on slabs / rooms of level li.
function supportOf(b, li, r) {
  const L = b.levels[li];
  if (!L) return 0;
  const rooms = roomsOf(b, li);
  const n = 8;
  let hit = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const px = r.x0 + ((i + 0.5) / n) * (r.x1 - r.x0), pz = r.z0 + ((j + 0.5) / n) * (r.z1 - r.z0);
    if (L.slabs.some((s) => px >= s.x0 && px <= s.x1 && pz >= s.z0 && pz <= s.z1) || rooms.some((rm) => roomContains(rm, px, pz))) hit++;
  }
  return hit / (n * n);
}

// ---- fitPiece (pure) -----------------------------------------------------------------------------
export function fitPiece(s, pieceId, { level = 0, x = 0, z = 0, rot = 0, wallId = null, fenceId = null } = {}) {
  const pc = pieceById(pieceId);
  const base = { ok: false, pieceId, kind: pc?.kind ?? null, frame: 'house', level: 0, x: r2(+x || 0), z: r2(+z || 0), rot: normRot(rot), w: 0, d: 0, snaps: [] };
  if (!pc) return { ...base, reason: 'notFound' };
  const lot = lotBox(s);
  if (LOT_KINDS.includes(pc.kind)) return fitLot(s, pc, base, lot, fenceId);
  const b = targetBuild(s);
  const NL = b.levels.length, g = b.grid ?? 0.5;
  const th = rad(base.rot), swap = base.rot % 180 !== 0;
  let lv = Math.max(0, Math.floor(+level || 0));
  const r = { ...base };
  const done = (o = {}) => ({ ...r, ...o, ok: !o.reason && !r.reason, ...(o.reason || r.reason ? { reason: o.reason ?? r.reason } : {}) });

  if (pc.kind === 'roof' || pc.kind === 'extra') {
    const has = b.levels.some((L) => L.walls.length || L.slabs.length);
    let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
    for (const L of b.levels) for (const w of L.walls) { bx0 = Math.min(bx0, w.x0, w.x1); bx1 = Math.max(bx1, w.x0, w.x1); bz0 = Math.min(bz0, w.z0, w.z1); bz1 = Math.max(bz1, w.z0, w.z1); }
    r.level = Math.min(lv, NL - 1);   // a roof never moves the active level
    if (Number.isFinite(bx0)) Object.assign(r, { x: r2((bx0 + bx1) / 2), z: r2((bz0 + bz1) / 2), w: r2(bx1 - bx0), d: r2(bz1 - bz0) });
    return done(has ? {} : { reason: 'noHouse' });
  }

  if (pc.kind === 'opening') {
    lv = Math.min(lv, NL - 1);
    r.level = lv;
    const o = pc.open;
    let best = null;
    for (const w of b.levels[lv].walls) {
      const sd = segDist(r.x, r.z, w.x0, w.z0, w.x1, w.z1);
      // A wall hint (placePiece re-fitting a ghost) wins ties at corners, so fit and place always agree.
      const hint = w.id === wallId ? 1e-3 : 0;
      if (sd.d <= OPEN_R && (!best || sd.d - hint < best.sd.d - best.hint)) best = { w, sd, hint };
    }
    r.w = o.w; r.d = 0.2;
    if (!best) return done({ reason: 'noWall' });
    const { w } = best, len = wallLen(w), dx = (w.x1 - w.x0) / len, dz = (w.z1 - w.z0) / len;
    const top = Math.min(b.floorHeight - 0.3, (w.h ?? b.floorHeight) - 0.1);
    let at = top - (o.sill ?? 0) < 0.4 ? null : fitOnSeg(len, w.openings, o.w, best.sd.t * len);
    const ang = Math.atan2(dz, dx);
    if (at === null) {
      at = r2(Math.min(len, Math.max(0, best.sd.t * len)));
      return done({ reason: 'noRoom', wallId: w.id, at, ang, t: w.t, x: r2(w.x0 + dx * at), z: r2(w.z0 + dz * at) });
    }
    return done({ wallId: w.id, at, ang, t: w.t, x: r2(w.x0 + dx * at), z: r2(w.z0 + dz * at), snaps: [{ x: r2(w.x0 + dx * at), z: r2(w.z0 + dz * at), kind: 'wall' }] });
  }

  // Footprint pieces: level checks first.
  if (pc.kind === 'stairs') lv = Math.min(lv, NL - 1);
  if (lv > NL) lv = NL;
  r.level = lv;
  if (lv === NL) { r.newLevel = true; if (NL >= BL.levels) r.reason = 'maxLevels'; }
  if (pc.kind === 'stairs' && lv === NL - 1) { r.newLevel = true; if (NL >= BL.levels) r.reason = 'maxLevels'; }
  const guides = lv > 0 ? [lv, lv - 1] : [lv];

  if (pc.kind === 'wall') {
    const half = pc.len / 2, [ux, uz] = rotV(1, 0, th);
    Object.assign(r, { w: swap ? pc.t : pc.len, d: swap ? pc.len : pc.t });
    let cx = r.x, cz = r.z, snap = null;
    const ends = [[cx - ux * half, cz - uz * half], [cx + ux * half, cz + uz * half]];
    for (const li of guides) for (const w of b.levels[li]?.walls ?? []) for (const [ex, ez] of ends) {
      for (const [px, pz] of [[w.x0, w.z0], [w.x1, w.z1]]) {
        const d = Math.hypot(px - ex, pz - ez);
        if (d <= 0.4 && (!snap || d < snap.d - 1e-9 || (snap.kind !== 'end' && d < snap.d + 0.1))) snap = { d, dx: px - ex, dz: pz - ez, x: px, z: pz, kind: 'end' };
      }
    }
    if (!snap) for (const w of b.levels[lv]?.walls ?? []) for (const [ex, ez] of ends) {
      const sd = segDist(ex, ez, w.x0, w.z0, w.x1, w.z1);
      if (sd.d <= 0.4 && (!snap || sd.d < snap.d)) snap = { d: sd.d, dx: sd.cx - ex, dz: sd.cz - ez, x: sd.cx, z: sd.cz, kind: 'wall' };
    }
    if (snap) { cx += snap.dx; cz += snap.dz; r.snaps = [{ x: r2(snap.x), z: r2(snap.z), kind: snap.kind }]; }
    else { const ax = Math.round(ends[0][0] / g) * g, az = Math.round(ends[0][1] / g) * g; cx = ax + ux * half; cz = az + uz * half; }
    r.x = r2(cx); r.z = r2(cz);
    r.rect = { x0: r2(cx - Math.abs(ux) * half), x1: r2(cx + Math.abs(ux) * half), z0: r2(cz - Math.abs(uz) * half), z1: r2(cz + Math.abs(uz) * half) };
    if (!inLot(lot, r.rect)) return done({ reason: 'outsideLot' });
    if (b.levels[lv] && b.levels[lv].walls.length >= BL.walls) return done({ reason: 'maxItems' });
    return done();
  }

  if (pc.kind === 'column') {
    Object.assign(r, { w: pc.s, d: pc.s });
    let snap = null;
    for (const li of guides) {
      const L = b.levels[li];
      if (!L) continue;
      for (const w of L.walls) for (const [px, pz] of [[w.x0, w.z0], [w.x1, w.z1]]) {
        const d = Math.hypot(px - r.x, pz - r.z);
        if (d <= 0.4 && (!snap || d < snap.d)) snap = { d, x: px, z: pz, kind: 'end' };
      }
      for (const c of L.columns ?? []) {
        const d = Math.hypot(c.x - r.x, c.z - r.z);
        if (li !== lv && d <= 0.4 && (!snap || d < snap.d)) snap = { d, x: c.x, z: c.z, kind: 'end' };
      }
      for (const s2 of L.slabs) for (const [px, pz] of [[s2.x0 + 0.2, s2.z0 + 0.2], [s2.x1 - 0.2, s2.z0 + 0.2], [s2.x0 + 0.2, s2.z1 - 0.2], [s2.x1 - 0.2, s2.z1 - 0.2]]) {
        const d = Math.hypot(px - r.x, pz - r.z);
        if (d <= 0.4 && (!snap || d < snap.d - 0.05)) snap = { d, x: px, z: pz, kind: 'edge' };
      }
    }
    if (snap) { r.x = r2(snap.x); r.z = r2(snap.z); r.snaps = [{ x: r.x, z: r.z, kind: snap.kind }]; }
    else { r.x = r2(Math.round(r.x / g) * g); r.z = r2(Math.round(r.z / g) * g); }
    r.rect = { x0: r.x - pc.s / 2, x1: r.x + pc.s / 2, z0: r.z - pc.s / 2, z1: r.z + pc.s / 2 };
    if (!inLot(lot, r.rect)) return done({ reason: 'outsideLot' });
    const L = b.levels[lv];
    if (L && (L.columns ?? []).length >= BL.columns) return done({ reason: 'maxItems' });
    if (L && (L.columns ?? []).some((c) => Math.hypot(c.x - r.x, c.z - r.z) < 0.3)) return done({ reason: 'overlap' });
    return done();
  }

  // Rectangles: room / porch / carport / balcony / slab / stairs.
  const W0 = pc.kind === 'stairs' ? pc.w : pc.w, D0 = pc.kind === 'stairs' ? pc.len : pc.d;
  const hw = (swap ? D0 : W0) / 2, hd = (swap ? W0 : D0) / 2;
  Object.assign(r, { w: 2 * hw, d: 2 * hd });
  const isRoom = pc.kind === 'room';
  const sn = snapRect(b, guides, r.x, r.z, hw, hd, isRoom ? 'center' : 'outer', pc.t ?? 0.15, g);
  Object.assign(r, { x: sn.x, z: sn.z, snaps: sn.snaps });
  r.rect = { x0: r2(r.x - hw), x1: r2(r.x + hw), z0: r2(r.z - hd), z1: r2(r.z + hd) };
  const outer = isRoom ? { x0: r.rect.x0 - pc.t / 2, x1: r.rect.x1 + pc.t / 2, z0: r.rect.z0 - pc.t / 2, z1: r.rect.z1 + pc.t / 2 } : r.rect;
  if (r.reason) return done();
  if (!inLot(lot, outer)) return done({ reason: 'outsideLot' });
  if (pc.kind === 'balcony' && lv === 0) return done({ reason: 'upperOnly' });
  if (pc.kind === 'carport' && lv > 0) return done({ reason: 'noSupport' });
  if (b.levels[lv]) {
    const L = b.levels[lv];
    if (isRoom && L.walls.length + 4 > BL.walls) return done({ reason: 'maxItems' });
    if (L.slabs.length >= BL.slabs || (pc.kind === 'stairs' && L.stairs.length >= BL.stairs)) return done({ reason: 'maxItems' });
    const why = footprintReason(b, lv, r.rect, pc.kind);
    if (why) return done({ reason: why });
  }
  if (lv > 0 && (isRoom || pc.kind === 'slab' || pc.kind === 'porch') && supportOf(b, lv - 1, outer) < 0.5) return done({ reason: 'noSupport' });
  // Stairs must arrive in (or right beside) a room of the floor above, once that floor has rooms.
  if (pc.kind === 'stairs' && b.levels[lv + 1]) {
    const th = rad(r.rot), [fx, fz] = rotV(0, pc.len / 2, th);
    const st = { x: r.x + fx, z: r.z + fz, rot: th, w: pc.w, len: pc.len };
    if (roomsOf(b, lv + 1).length && !stairTarget(b, lv + 1, st, roomsOf(b, lv + 1))) return done({ reason: 'stairsNowhere' });
  }
  return done();
}

// Fences, gates, yard items: lot-local.
function fitLot(s, pc, base, lot, fenceId = null) {
  const r = { ...base, frame: 'lot', level: 0 };
  const b = s.build ?? { fences: [] };
  const fences = b.fences ?? [];
  const done = (o = {}) => ({ ...r, ...o, ok: !o.reason, ...(o.reason ? { reason: o.reason } : {}) });
  const th = rad(r.rot), swap = r.rot % 180 !== 0;
  if (pc.kind === 'yard') {
    Object.assign(r, { w: swap ? pc.d : pc.w, d: swap ? pc.w : pc.d, x: r2(r.x), z: r2(r.z) });
    if (Math.abs(r.x) > lot.hw - 0.6 || Math.abs(r.z) > lot.hd - 0.6) return done({ reason: 'outsideLot' });
    if ((s.yard?.items?.length ?? 0) >= MAX_YARD_ITEMS) return done({ reason: 'maxItems' });
    return done();
  }
  if (pc.kind === 'gate') {
    let best = null;
    for (const f of fences) {
      const sd = segDist(r.x, r.z, f.x0, f.z0, f.x1, f.z1);
      const hint = f.id === fenceId ? 1e-3 : 0;
      if (sd.d <= GATE_R && (!best || sd.d - hint < best.sd.d - best.hint)) best = { f, sd, hint };
    }
    Object.assign(r, { w: pc.w, d: 0.25 });
    if (!best) return done({ reason: 'noFence' });
    const { f } = best, len = Math.hypot(f.x1 - f.x0, f.z1 - f.z0), dx = (f.x1 - f.x0) / len, dz = (f.z1 - f.z0) / len;
    const at = fitOnSeg(len, f.gates ?? [], pc.w, best.sd.t * len, { margin: 0.1, gap: 0.1 });
    const ang = Math.atan2(dz, dx);
    const a2 = at ?? r2(best.sd.t * len);
    const o = { fenceId: f.id, at: a2, ang, x: r2(f.x0 + dx * a2), z: r2(f.z0 + dz * a2), h: f.h, fenceType: f.type };
    if (at === null) return done({ ...o, reason: 'noRoom' });
    return done({ ...o, snaps: [{ x: o.x, z: o.z, kind: 'wall' }] });
  }
  if (pc.kind === 'frontFence') {
    // The whole front lot line (+z), whatever the finger points at.
    const zf = r2(lot.hd - 0.1), len = 2 * lot.hw;
    Object.assign(r, { x: 0, z: zf, rot: 0, w: r2(len), d: 0.25, rect: { x0: -lot.hw, x1: lot.hw, z0: zf, z1: zf }, gates: frontGates(s, len), type: pc.type });
    r.snaps = [{ x: -lot.hw, z: zf, kind: 'edge' }, { x: r2(lot.hw), z: zf, kind: 'edge' }];
    if (fences.filter((f) => !onFront(f, zf)).length >= BL.fences) return done({ reason: 'maxItems' });
    return done();
  }
  // fence segment
  const half = pc.len / 2, [ux, uz] = rotV(1, 0, th);
  Object.assign(r, { w: swap ? 0.25 : pc.len, d: swap ? pc.len : 0.25 });
  let cx = r.x, cz = r.z, snap = null;
  const ends = [[cx - ux * half, cz - uz * half], [cx + ux * half, cz + uz * half]];
  for (const f of fences) for (const [ex, ez] of ends) for (const [px, pz] of [[f.x0, f.z0], [f.x1, f.z1]]) {
    const d = Math.hypot(px - ex, pz - ez);
    if (d <= 0.4 && (!snap || d < snap.d)) snap = { d, dx: px - ex, dz: pz - ez, x: px, z: pz, kind: 'end' };
  }
  if (snap) { cx += snap.dx; cz += snap.dz; r.snaps = [{ x: r2(snap.x), z: r2(snap.z), kind: 'end' }]; }
  else {
    const g = s.build?.grid ?? 0.5;
    const ax = Math.round(ends[0][0] / g) * g, az = Math.round(ends[0][1] / g) * g;
    cx = ax + ux * half; cz = az + uz * half;
    // Lot edges: a fence near the boundary sits on it.
    const ex = lot.hw - 0.1, ez = lot.hd - 0.1;
    if (Math.abs(uz) < 0.5) { for (const v of [-ez, ez]) if (Math.abs(cz - v) < 0.6) { cz = v; r.snaps = [{ x: r2(cx), z: r2(v), kind: 'edge' }]; } }
    else for (const v of [-ex, ex]) if (Math.abs(cx - v) < 0.6) { cx = v; r.snaps = [{ x: r2(v), z: r2(cz), kind: 'edge' }]; }
  }
  r.x = r2(cx); r.z = r2(cz);
  r.rect = { x0: r2(cx - Math.abs(ux) * half), x1: r2(cx + Math.abs(ux) * half), z0: r2(cz - Math.abs(uz) * half), z1: r2(cz + Math.abs(uz) * half) };
  if (r.rect.x0 < -lot.hw - 0.01 || r.rect.x1 > lot.hw + 0.01 || r.rect.z0 < -lot.hd - 0.01 || r.rect.z1 > lot.hd + 0.01) return done({ reason: 'outsideLot' });
  if (fences.length >= BL.fences) return done({ reason: 'maxItems' });
  return done();
}

const onFront = (f, zf) => Math.abs(f.z0 - zf) < 0.45 && Math.abs(f.z1 - zf) < 0.45;
// Gates for "Cercar el frente" (metres from the left lot corner): pedestrian in front of the entrance door,
// vehicle in front of the carport / pad, else beside the walkway.
export function frontGates(s, len) {
  const b = s.build, ox = s.house.offsetX ?? 0, hw = len / 2;
  const mode = s.mode === 'build' && b;
  const entry = mode ? buildEntry(b) : null, pad = mode ? buildPad(b) : null;
  let xp = (entry ? entry.x : 0) + ox;
  let xv = pad ? (pad.x0 + pad.x1) / 2 + ox : !mode && s.house.carport ? ox + (s.house.width / 2 + 1.8) * (s.house.carportSide === 'left' ? -1 : 1) : xp + 3.5;
  if (Math.abs(xv - xp) < 2.4) xv = xp + (xv >= xp ? 2.4 : -2.4);
  const clamp = (x, w) => Math.min(hw - w / 2 - 0.15, Math.max(-hw + w / 2 + 0.15, x));
  xp = clamp(xp, 1.0); xv = clamp(xv, 3.2);
  if (Math.abs(xv - xp) < 2.2) xv = clamp(xp + (xp < 0 ? 2.4 : -2.4), 3.2);
  return [{ at: r2(xp + hw), w: 1.0, kind: 'peatonal' }, { at: r2(xv + hw), w: 3.2, kind: 'vehicular' }].sort((p, q) => p.at - q.at);
}

// ---- placing (mutates the build it is given; returns { ids, level } or false + reason) -----------------
function ensureLevel(b, lv) {
  if (lv < b.levels.length) return true;
  if (lv > b.levels.length || b.levels.length >= BL.levels) return fail('maxLevels');
  b.levels.push(emptyLevel());
  return true;
}

// Wall pieces of level L lying on the line of one rectangle side, between its corners.
function sideWalls(L, side, rc) {
  const out = [];
  for (const w of L.walls) {
    if (side === 'front' || side === 'back') {
      const zz = side === 'front' ? rc.z1 : rc.z0;
      if (!isH(w) || Math.abs(w.z0 - zz) > 0.02) continue;
      const a = Math.min(w.x0, w.x1), c = Math.max(w.x0, w.x1);
      if (c <= rc.x0 + 0.02 || a >= rc.x1 - 0.02) continue;
      out.push(w);
    } else {
      const xx = side === 'right' ? rc.x1 : rc.x0;
      if (!isV(w) || Math.abs(w.x0 - xx) > 0.02) continue;
      const a = Math.min(w.z0, w.z1), c = Math.max(w.z0, w.z1);
      if (c <= rc.z0 + 0.02 || a >= rc.z1 - 0.02) continue;
      out.push(w);
    }
  }
  return out;
}
const SIDES = ['front', 'back', 'left', 'right'];
const sideMid = (side, rc) => (side === 'front' ? [(rc.x0 + rc.x1) / 2, rc.z1] : side === 'back' ? [(rc.x0 + rc.x1) / 2, rc.z0] : side === 'left' ? [rc.x0, (rc.z0 + rc.z1) / 2] : [rc.x1, (rc.z0 + rc.z1) / 2]);
// Is that side of the rectangle shared with an existing room (rooms = before placement)?
function sideShared(rooms, side, rc) {
  const [nx, nz] = SIDE_N[side];
  let hit = 0;
  for (const f of [0.2, 0.5, 0.8]) {
    const px = side === 'left' || side === 'right' ? (side === 'left' ? rc.x0 : rc.x1) : rc.x0 + (rc.x1 - rc.x0) * f;
    const pz = side === 'front' || side === 'back' ? (side === 'back' ? rc.z0 : rc.z1) : rc.z0 + (rc.z1 - rc.z0) * f;
    if (rooms.some((rm) => roomContains(rm, px + nx * 0.3, pz + nz * 0.3))) hit++;
  }
  return hit >= 2;
}
// Put an opening on a side of the rectangle at fraction `pos` (from the low-coordinate corner). Returns its id or null.
function openingOnSide(b, L, side, rc, spec) {
  const walls = sideWalls(L, side, rc);
  const horiz = side === 'front' || side === 'back';
  const want = horiz ? rc.x0 + (rc.x1 - rc.x0) * (spec.pos ?? 0.5) : rc.z0 + (rc.z1 - rc.z0) * (spec.pos ?? 0.5);
  let best = null;
  for (const w of walls) {
    const len = wallLen(w);
    const along = horiz ? (want - w.x0) / ((w.x1 - w.x0) / len) : (want - w.z0) / ((w.z1 - w.z0) / len);
    const top = Math.min(b.floorHeight - 0.3, (w.h ?? b.floorHeight) - 0.1);
    if (top - (spec.sill ?? 0) < 0.4) continue;
    const at = fitOnSeg(len, w.openings, spec.w, along);
    if (at === null) continue;
    const miss = Math.abs(at - along);
    if (!best || miss < best.miss) best = { w, at, miss };
  }
  if (!best) return null;
  const id = BO.addOpening(b, best.w.id, spec.kind, best.at, { w: spec.w, h: spec.h, sill: spec.sill, style: spec.style });
  return id || null;
}

function anchorRoom(b, lv, type, x, z) {
  b.rooms ??= [];
  const taken = new Set(b.rooms.map((a) => a.key));
  for (let n = 0; n < 100; n++) {
    const key = `${lv}:${type}:${n}`;
    if (taken.has(key)) continue;
    b.rooms.push({ key, type, x: r2(x), z: r2(z) });
    return key;
  }
  return null;
}

// Walls with a room on both sides are interior (no outside finish, not copied by addLevel).
function fixExt(L, ids) {
  const rooms = inferRooms(L);
  for (const w of L.walls) {
    if (ids && !ids.has(w.id)) continue;
    const len = wallLen(w), nx = -(w.z1 - w.z0) / len, nz = (w.x1 - w.x0) / len;
    const mx = (w.x0 + w.x1) / 2, mz = (w.z0 + w.z1) / 2, o = w.t / 2 + 0.15;
    const a = rooms.some((r) => roomContains(r, mx + nx * o, mz + nz * o)), c = rooms.some((r) => roomContains(r, mx - nx * o, mz - nz * o));
    w.ext = !(a && c);
  }
}

// Applies a fitted placement to build `b` (the store passes a clone). ctx = { floor } (default floor finish).
export function applyPiece(b, pc, f, ctx = {}) {
  const k = pc.kind;
  if (k === 'roof') { BO.setBuildRoof(b, pc.roof); return { ids: [], level: f.level }; }
  if (k === 'extra') {
    if (pc.flat) BO.setBuildRoof(b, { type: 'flat' });
    BO.setBuildExtras(b, pc.extras);
    return { ids: [], level: f.level };
  }
  if (k === 'fence') {
    const half = pc.len / 2, [ux, uz] = rotV(1, 0, rad(f.rot));
    const id = BO.addFence(b, f.x - ux * half, f.z - uz * half, f.x + ux * half, f.z + uz * half, { type: pc.type });
    return id ? { ids: [mergeFences(b, id)], level: 0 } : false;
  }
  if (k === 'frontFence') {
    b.fences = b.fences.filter((q) => !onFront(q, f.z));
    const id = BO.addFence(b, -f.w / 2, f.z, f.w / 2, f.z, { type: pc.type });
    if (!id) return false;
    BO.setFence(b, id, { gates: f.gates });
    return { ids: [id], level: 0 };
  }
  if (k === 'gate') return BO.addGate(b, f.fenceId, f.at, pc.gate) ? { ids: [f.fenceId], level: 0 } : false;
  if (k === 'opening') {
    const o = pc.open;
    const id = BO.addOpening(b, f.wallId, o.kind, f.at, { w: o.w, h: o.h, sill: o.sill, style: o.style });
    return id ? { ids: [id], level: f.level } : false;
  }
  const lv = f.level;
  if (k === 'stairs') {
    if (lv >= b.levels.length - 1 && !ensureLevel(b, lv + 1)) return false;
    const th = rad(f.rot), [fx, fz] = rotV(0, pc.len / 2, th);
    const id = BO.addStairs(b, lv, f.x + fx, f.z + fz, th, { w: pc.w, len: pc.len });
    if (id) connectStairs(b, lv + 1);
    return id ? { ids: [id], level: lv } : false;
  }
  if (!ensureLevel(b, lv)) return false;
  const L = b.levels[lv];
  delete b.hint;
  if (k === 'wall') {
    const half = pc.len / 2, [ux, uz] = rotV(1, 0, rad(f.rot));
    const before = new Set(L.walls.map((w) => w.id));
    const id = BO.addWall(b, lv, f.x - ux * half, f.z - uz * half, f.x + ux * half, f.z + uz * half, { t: pc.t, h: pc.h, ext: true });
    if (!id) return false;
    return { ids: b.levels[lv].walls.filter((w) => !before.has(w.id)).map((w) => w.id), level: lv };
  }
  if (k === 'column') {
    const id = BO.addColumn(b, lv, f.x, f.z, { s: pc.s });
    return id ? { ids: [id], level: lv } : false;
  }
  if (k === 'slab' || k === 'porch' || k === 'carport' || k === 'balcony') {
    const rect = { ...f.rect, finish: pc.finish ?? (k === 'carport' ? undefined : ctx.floor) };
    if (k !== 'slab') rect.kind = k;
    if (!rect.finish) delete rect.finish;
    const id = BO.addSlab(b, lv, rect);
    return id ? { ids: [id], level: lv } : false;
  }
  if (k !== 'room') return fail('badValue');
  // ---- room: 4 walls (shared ones dedupe into the existing wall), slab, door, windows, type anchor ----
  const rc = f.rect, t = pc.t;
  const roomsBefore = inferRooms(L);
  const shell = roomsBefore.find((rm) => rectInRoom(rm, rc) && isEmptyShell(L, rm)) ?? null;
  const shared = Object.fromEntries(SIDES.map((sd) => [sd, sideShared(roomsBefore, sd, rc)]));
  const beforeIds = new Set(L.walls.map((w) => w.id));
  const edges = [[rc.x0, rc.z1, rc.x1, rc.z1], [rc.x1, rc.z0, rc.x1, rc.z1], [rc.x0, rc.z0, rc.x1, rc.z0], [rc.x0, rc.z0, rc.x0, rc.z1]];
  for (const e of edges) if (!BO.addWall(b, lv, ...e, { t, ext: true })) return false;
  const Lw = b.levels[lv];
  const newWalls = Lw.walls.filter((w) => !beforeIds.has(w.id)).map((w) => w.id);
  const slabId = BO.addSlab(b, lv, { x0: rc.x0 - t / 2, z0: rc.z0 - t / 2, x1: rc.x1 + t / 2, z1: rc.z1 + t / 2, finish: ROOM_FLOOR[pc.room] ?? ctx.floor });
  if (!slabId) return false;
  const ids = [...newWalls, slabId];
  const cx = (rc.x0 + rc.x1) / 2, cz = (rc.z0 + rc.z1) / 2;
  // Subdividing a shell: its type anchor moves to what is left of it, so the new room gets its own type.
  if (shell) {
    const after = inferRooms(Lw);
    const rest = after.filter((rm) => roomContains(shell, rm.x, rm.z) && !roomContains(rm, cx, cz)).sort((a, c) => c.net - a.net)[0];
    for (const a of b.rooms ?? []) if (+a.key[0] === lv && roomContains(shell, a.x, a.z) && a.x > rc.x0 && a.x < rc.x1 && a.z > rc.z0 && a.z < rc.z1) {
      if (rest) { a.x = r2(rest.x); a.z = r2(rest.z); } else a.key = '';
    }
    b.rooms = (b.rooms ?? []).filter((a) => a.key);
  }
  anchorRoom(b, lv, pc.room, cx, cz);
  // Windows on walls that just became interior go first, so the door can take their place.
  fixInteriorOpenings(b, lv, { convert: false });
  // Door: the side with the best neighbour (hall / sala / galería / stairs first; never into a bathroom; no exterior
  // door upstairs). Sala, cocina, comedor and lavado may face the yard. The piece's own side breaks ties.
  const dSide = worldSide(pc.door.side, f.rot);
  const sides = SIDES.map((sd) => ({ sd, ...sideNeighbour(b, lv, sd, rc, roomsBefore, shell, pc.room) }))
    .map((o) => ({ ...o, score: doorScore(pc.room, o.nb, lv) + (o.sd === dSide ? 0.3 : 0) }))
    .filter((o) => o.score > -50)
    .sort((a, c) => c.score - a.score);
  let doorSide = null;
  for (const o of sides) {
    const spec = { ...OPEN_DEFAULTS[pc.door.kind], ...pc.door };
    const id = openingOnSide(b, Lw, o.sd, rc, { ...spec, pos: o.nb === 'outside' && o.sd === dSide ? pc.door.pos : o.pos }) ?? openingOnSide(b, Lw, o.sd, rc, { ...spec, pos: 0.5 });
    if (id) { ids.push(id); doorSide = o.sd; break; }
  }
  for (const wn of pc.windows ?? []) {
    const sd = worldSide(wn.side, f.rot);
    if (shared[sd]) continue;
    const id = openingOnSide(b, Lw, sd, rc, wn) ?? (sd !== doorSide ? openingOnSide(b, Lw, sd, rc, { ...wn, pos: 0.5 }) : null);
    if (id) ids.push(id);
  }
  fixExt(Lw, new Set(sideWallsAll(Lw, rc)));
  fixInteriorOpenings(b, lv);
  if (lv > 0) connectStairs(b, lv);
  return { ids, level: lv };
}

// ---- stairs arrival ----
// Where segment P crosses segment W: { t } along W (0..1), or null.
function segCross(px0, pz0, px1, pz1, wx0, wz0, wx1, wz1) {
  const dx = px1 - px0, dz = pz1 - pz0, ex = wx1 - wx0, ez = wz1 - wz0, den = dx * ez - dz * ex;
  if (Math.abs(den) < 1e-9) return null;
  const u = ((wx0 - px0) * dz - (wz0 - pz0) * dx) / den, v = ((wx0 - px0) * ez - (wz0 - pz0) * ex) / den;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? { t: u } : null;
}
const stairLen = (b, st) => st.len ?? Math.max(12, Math.ceil(b.floorHeight / 0.185)) * 0.27;
// Where a stair run from the floor below arrives: the point just past its top step.
function stairArrival(b, st) {
  const len = stairLen(b, st), fx = -Math.sin(st.rot), fz = -Math.cos(st.rot);
  return { x: st.x + fx * (len + 0.45), z: st.z + fz * (len + 0.45), fx, fz, len };
}
// The upper room the stairs serve: { rm, inside } (the top step lands in it, or within 1.2 m of its walls), or null.
function stairTarget(b, li, st, rooms = inferRooms(b.levels[li])) {
  const A = stairArrival(b, st);
  // Inside only when the top steps are in the room too (else a wall stands between the stairs and the room).
  const top = { x: st.x + A.fx * (A.len - 0.3), z: st.z + A.fz * (A.len - 0.3) };
  const inRm = rooms.find((rm) => roomContains(rm, A.x, A.z) && roomContains(rm, top.x, top.z));
  if (inRm) return { rm: inRm, inside: true, A };
  let best = null;
  for (const rm of rooms) {
    let d = Infinity;
    for (let i = 0; i < rm.poly.length; i++) {
      const [ax, az] = rm.poly[i], [bx, bz] = rm.poly[(i + 1) % rm.poly.length];
      d = Math.min(d, segDist(A.x, A.z, ax, az, bx, bz).d);
    }
    if (d <= 1.2 && (!best || d < best.d)) best = { rm, d };
  }
  return best ? { rm: best.rm, inside: false, A } : null;
}
// Stairs rising from level li - 1 into level li: when the top lands outside a room, a landing slab is laid
// (railed by the open-edge rule) and the nearest room gets a door on the wall facing the landing.
export function connectStairs(b, li) {
  const L = b.levels[li];
  if (!L || li < 1) return;
  for (const st of b.levels[li - 1].stairs) {
    const rooms = inferRooms(L);
    const tg = stairTarget(b, li, st, rooms);
    if (!tg || tg.inside) continue;
    const A = tg.A, len = A.len;
    // Landing: from the hole to 1.3 m past the top, the stair width + 0.6.
    let reach = len + 1.3;
    for (let dd = len; dd <= len + 1.3; dd += 0.05) if (roomContains(tg.rm, st.x + A.fx * dd, st.z + A.fz * dd)) { reach = Math.max(len + 0.2, dd - 0.05); break; }
    const end = { x: st.x + A.fx * reach, z: st.z + A.fz * reach }, mid = { x: st.x + A.fx * (len - 0.6), z: st.z + A.fz * (len - 0.6) };
    const ax = Math.cos(st.rot), az = -Math.sin(st.rot), hw = st.w / 2 + 0.3;
    const xs = [end.x, mid.x].flatMap((q) => [q + ax * hw, q - ax * hw]), zs = [end.z, mid.z].flatMap((q) => [q + az * hw, q - az * hw]);
    const land = { x0: r2(Math.min(...xs)), x1: r2(Math.max(...xs)), z0: r2(Math.min(...zs)), z1: r2(Math.max(...zs)) };
    const tx = st.x + A.fx * (len + 0.1), tz = st.z + A.fz * (len + 0.1);
    if (!L.slabs.some((q) => tx > q.x0 && tx < q.x1 && tz > q.z0 && tz < q.z1)) BO.addSlab(b, li, { ...land, finish: 'ceramica' });
    // Door on the room wall the climb runs into (else the one nearest the arrival), unless one is already close.
    const p0 = { x: st.x + A.fx * (len - 0.3), z: st.z + A.fz * (len - 0.3) }, p1 = { x: st.x + A.fx * (len + 1.6), z: st.z + A.fz * (len + 1.6) };
    let best = null;
    for (const w of L.walls) {
      if (!wallOnPoly(w, tg.rm.poly)) continue;
      const hit = segCross(p0.x, p0.z, p1.x, p1.z, w.x0, w.z0, w.x1, w.z1);
      const sd = hit ? { ...hit, d: -1 } : segDist(A.x, A.z, w.x0, w.z0, w.x1, w.z1);
      if (!best || sd.d < best.sd.d) best = { w, sd };
    }
    if (!best) continue;
    const { w } = best, wl = wallLen(w);
    if (w.openings.some((o) => o.kind !== 'window' && Math.abs(o.at - best.sd.t * wl) < 1.6)) continue;
    w.openings = w.openings.filter((o) => !(o.kind === 'window' && Math.abs(o.at - best.sd.t * wl) < 1.2));
    const at = fitOnSeg(wl, w.openings, 0.9, best.sd.t * wl);
    if (at !== null) BO.addOpening(b, w.id, 'door', at, { w: 0.9 });
  }
}

const PUBLIC = ['sala', 'comedor', 'pasillo', 'cuarto', 'galeria', 'escalera', 'landing'];
const OPEN_TO_YARD = ['sala', 'cocina', 'comedor', 'lavado'];
// How good a door from a room of type `T` onto neighbour `nb` is (< -50 = never).
function doorScore(T, nb, lv) {
  if (nb === 'bano' || nb === 'air' || nb === 'gap') return -99;
  if (nb === 'outside') return lv > 0 ? -99 : OPEN_TO_YARD.includes(T) ? 2.5 : 0.5;
  if (nb === 'balcon') return 2;
  if (PUBLIC.includes(nb)) return 3;
  if (nb === 'cocina') return ['comedor', 'sala', 'lavado'].includes(T) ? 3 : 1.5;
  // Bedroom to bedroom is a last resort (below the yard); a bathroom may open into a bedroom (en-suite).
  return T === 'bano' ? 1.2 : 0.4;
}
// What lies beyond one side of a room rectangle: a room type, 'galeria' / 'balcon' (outdoor slab), 'escalera'
// (stair hole from below), 'landing' (bare floor upstairs), 'outside' (ground yard) or 'air' (nothing upstairs).
// `pos` = where along the side that neighbour is (fraction from the low corner), for the door.
function sideNeighbour(b, lv, side, rc, rooms, shell, T = 'dormitorio') {
  const L = b.levels[lv], [nx, nz] = SIDE_N[side];
  const below = lv > 0 ? b.levels[lv - 1].stairs : [];
  const hits = new Map();
  for (let i = 1; i <= 7; i++) {
    const fr = i / 8;
    const px = (side === 'left' ? rc.x0 : side === 'right' ? rc.x1 : rc.x0 + (rc.x1 - rc.x0) * fr) + nx * 0.35;
    const pz = (side === 'back' ? rc.z0 : side === 'front' ? rc.z1 : rc.z0 + (rc.z1 - rc.z0) * fr) + nz * 0.35;
    let nb;
    const rm = rooms.find((q) => roomContains(q, px, pz));
    // A sliver of room (< 0.9 m deep beyond this side) is no place to walk into.
    if (rm && !roomContains(rm, px + nx * 0.6, pz + nz * 0.6)) nb = 'gap';
    else if (rm) nb = rm === shell ? 'cuarto' : typeOf(b, lv, rm);
    else {
      const sl = L.slabs.find((q) => px > q.x0 && px < q.x1 && pz > q.z0 && pz < q.z1);
      if (sl?.kind === 'porch' || sl?.kind === 'carport') nb = 'galeria';
      else if (sl?.kind === 'balcony') nb = 'balcon';
      else if (below.some((st) => { const len = st.len ?? 4.6, u = (px - st.x) * -Math.sin(st.rot) + (pz - st.z) * -Math.cos(st.rot), v = (px - st.x) * Math.cos(st.rot) + (pz - st.z) * -Math.sin(st.rot); return u > len - 1.5 && u < len + 1.2 && Math.abs(v) < st.w / 2 + 0.6; })) nb = 'escalera';
      else if (sl) nb = lv > 0 ? 'landing' : 'galeria';
      else nb = lv > 0 ? 'air' : 'outside';
    }
    if (!hits.has(nb)) hits.set(nb, []);
    hits.get(nb).push(fr);
  }
  let best = null;
  for (const [nb, frs] of hits) {
    const sc = doorScore(T, nb, lv) * 10 + frs.length;
    if (!best || sc > best.sc) best = { nb, frs, sc };
  }
  return { nb: best.nb, pos: best.frs.reduce((a, c) => a + c, 0) / best.frs.length };
}

// Interior walls (a room on both sides) carry no windows: the first one becomes a door when the two rooms are
// not connected yet (never into a bathroom), the rest are removed. Run after every placement / group move.
export function fixInteriorOpenings(b, li, { convert = true } = {}) {
  const L = b.levels[li];
  if (!L) return;
  const rooms = inferRooms(L);
  const type = rooms.map((rm) => typeOf(b, li, rm));
  const sidesOf = (w) => {
    const len = wallLen(w), nx = -(w.z1 - w.z0) / len, nz = (w.x1 - w.x0) / len, o = w.t / 2 + 0.2;
    const out = [];
    for (const f of [0.25, 0.5, 0.75]) {
      const mx = w.x0 + (w.x1 - w.x0) * f, mz = w.z0 + (w.z1 - w.z0) * f;
      const a = rooms.findIndex((r) => roomContains(r, mx + nx * o, mz + nz * o)), c = rooms.findIndex((r) => roomContains(r, mx - nx * o, mz - nz * o));
      if (a >= 0 && c >= 0 && a !== c) out.push(a < c ? `${a}|${c}` : `${c}|${a}`);
    }
    return out.length >= 2 ? out[0] : null;
  };
  const pairs = new Map(), connected = new Set();
  for (const w of L.walls) {
    const k = sidesOf(w);
    if (!k) continue;
    pairs.set(w, k);
    if (w.openings.some((o) => o.kind !== 'window')) connected.add(k);
  }
  for (const [w, k] of pairs) {
    const wins = w.openings.filter((o) => o.kind === 'window');
    if (!wins.length) continue;
    w.openings = w.openings.filter((o) => o.kind !== 'window');
    const [a, c] = k.split('|').map(Number);
    if (!convert || connected.has(k) || type[a] === 'bano' || type[c] === 'bano') continue;
    const at = fitOnSeg(wallLen(w), w.openings, 0.9, wins[0].at);
    if (at !== null && BO.addOpening(b, w.id, 'door', at, { w: 0.9 })) connected.add(k);
  }
}
const sideWallsAll = (L, rc) => SIDES.flatMap((sd) => sideWalls(L, sd, rc).map((w) => w.id));

// A fence piece dropped end to end with a collinear fence of the same type / height / colour joins it into one
// segment (so a 3.2 m vehicle gate fits on two 3 m pieces). Returns the surviving id.
function mergeFences(b, id) {
  let cur = b.fences.find((f) => f.id === id);
  for (let guard = 0; guard < 8 && cur; guard++) {
    const len = Math.hypot(cur.x1 - cur.x0, cur.z1 - cur.z0), ux = (cur.x1 - cur.x0) / len, uz = (cur.z1 - cur.z0) / len;
    const o = b.fences.find((f) => {
      if (f === cur || f.type !== cur.type || f.h !== cur.h || f.color !== cur.color) return false;
      const fl = Math.hypot(f.x1 - f.x0, f.z1 - f.z0), fx = (f.x1 - f.x0) / fl, fz = (f.z1 - f.z0) / fl;
      if (Math.abs(ux * fz - uz * fx) > 0.01) return false;
      return [[f.x0, f.z0], [f.x1, f.z1]].some(([px, pz]) => [[cur.x0, cur.z0], [cur.x1, cur.z1]].some(([qx, qz]) => Math.hypot(px - qx, pz - qz) < 0.05));
    });
    if (!o) break;
    // Project every end on the line; the merged fence spans min..max, gates keep their place.
    const pts = [[cur.x0, cur.z0], [cur.x1, cur.z1], [o.x0, o.z0], [o.x1, o.z1]].map(([x, z]) => ({ x, z, s: (x - cur.x0) * ux + (z - cur.z0) * uz }));
    pts.sort((p, q) => p.s - q.s);
    const a = pts[0], c = pts[3];
    const gates = [];
    for (const f of [cur, o]) {
      const fl = Math.hypot(f.x1 - f.x0, f.z1 - f.z0);
      for (const g of f.gates ?? []) {
        const gx = f.x0 + ((f.x1 - f.x0) / fl) * g.at, gz = f.z0 + ((f.z1 - f.z0) / fl) * g.at;
        gates.push({ ...g, at: r2((gx - a.x) * ux + (gz - a.z) * uz) });
      }
    }
    Object.assign(o, { x0: r2(a.x), z0: r2(a.z), x1: r2(c.x), z1: r2(c.z) });
    if (gates.length) o.gates = gates.sort((p, q) => p.at - q.at); else delete o.gates;
    b.fences = b.fences.filter((f) => f !== cur);
    cur = o;
  }
  return cur?.id ?? id;
}

// Mini build with just the piece at the origin (rot 0) on `level`: what the ghost and thumbnails draw.
export function pieceBuild(pieceId, { level = 0, floorHeight = 3.0, wallT = 0.15, floor = 'porcelanato' } = {}) {
  const pc = pieceById(pieceId);
  if (!pc) return null;
  const b = emptyBuild({ floorHeight });
  b.roof.parapet = false;
  for (let i = 0; i < level; i++) b.levels.push(emptyLevel());
  const lv = level;
  if (pc.kind === 'opening') {
    const len = Math.max(1.2, pc.open.w + 0.5);
    const id = BO.addWall(b, lv, -len / 2, 0, len / 2, 0, { t: wallT + 0.04, ext: true });
    if (id) BO.addOpening(b, id, pc.open.kind, len / 2, { w: pc.open.w, h: pc.open.h, sill: pc.open.sill, style: pc.open.style });
    return b;
  }
  if (LOT_KINDS.includes(pc.kind) || pc.kind === 'roof' || pc.kind === 'extra') return b;
  const hw = (pc.kind === 'stairs' ? pc.w : pc.w) / 2, hd = (pc.kind === 'stairs' ? pc.len : pc.d) / 2;
  const f = { level: lv, x: 0, z: 0, rot: 0, rect: { x0: -hw, x1: hw, z0: -hd, z1: hd } };
  if (pc.kind === 'stairs') { b.levels.push(emptyLevel()); BO.addStairs(b, lv, 0, hd, 0, { w: pc.w, len: pc.len }); return b; }
  applyPiece(b, pc, f, { floor });
  delete b.hint;
  return b;
}

// ---- groups ----------------------------------------------------------------------------------------
const onPoly = (poly, x, z, eps = 0.03) => {
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
    if (segDist(x, z, ax, az, bx, bz).d < eps) return true;
  }
  return false;
};
const wallOnPoly = (w, poly) => onPoly(poly, w.x0, w.z0) && onPoly(poly, w.x1, w.z1) && onPoly(poly, (w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2);
const wallSidesIn = (w, r) => {
  const len = wallLen(w), nx = -(w.z1 - w.z0) / len, nz = (w.x1 - w.x0) / len, mx = (w.x0 + w.x1) / 2, mz = (w.z0 + w.z1) / 2, o = w.t / 2 + 0.2;
  return [[mx + nx * o, mz + nz * o], [mx - nx * o, mz - nz * o]];
};
const roomLabel = (type) => ({ es: roomName(type, 'es'), en: roomName(type, 'en') });

// Members of an inferred room: { walls (non-shared boundary + inside), shared (boundary walls another room touches), slabs, columns, stairs }.
function roomMembers(b, li, rm) {
  const L = b.levels[li], rooms = roomsOf(b, li);
  const walls = [], shared = [];
  for (const w of L.walls) {
    if (wallOnPoly(w, rm.poly)) {
      const [p, q] = wallSidesIn(w, rm);
      const other = [p, q].find((pt) => !roomContains(rm, pt[0], pt[1]));
      if (other && rooms.some((o) => o !== rm && roomContains(o, other[0], other[1]))) shared.push(w.id);
      else walls.push(w.id);
    } else if (roomContains(rm, (w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2)) walls.push(w.id);
  }
  const pad = 0.3;
  const inBox = (x0, z0, x1, z1) => x0 >= rm.x0 - pad && x1 <= rm.x1 + pad && z0 >= rm.z0 - pad && z1 <= rm.z1 + pad;
  const slabs = L.slabs.filter((s) => !s.kind && inBox(s.x0, s.z0, s.x1, s.z1) && roomContains(rm, (s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2)).map((s) => s.id);
  const columns = (L.columns ?? []).filter((c) => roomContains(rm, c.x, c.z)).map((c) => c.id);
  const stairs = L.stairs.filter((s) => roomContains(rm, s.x - Math.sin(s.rot) * 0.5, s.z - Math.cos(s.rot) * 0.5)).map((s) => s.id);
  return { walls, shared, slabs, columns, stairs };
}

// What is at (x, z) house-local on `level`: a column, wall, stairs, room, slab, fence or yard item.
export function groupAt(s, level, x, z) {
  const px = +x, pz = +z;
  if (!Number.isFinite(px) || !Number.isFinite(pz)) return null;
  const ox = s.house.offsetX ?? 0, oz = s.house.offsetZ ?? 0;
  const b = s.mode === 'build' ? s.build : null;
  if (b) {
    const li = Math.max(0, Math.min(b.levels.length - 1, Math.floor(+level || 0)));
    const L = b.levels[li];
    const mk = (kind, ids, label, x0, z0, x1, z1, extra = {}) => ({ kind, ids, level: li, label, x: r2((x0 + x1) / 2), z: r2((z0 + z1) / 2), w: r2(x1 - x0), d: r2(z1 - z0), ...extra });
    for (const c of L.columns ?? []) if (Math.abs(c.x - px) <= c.s / 2 + 0.15 && Math.abs(c.z - pz) <= c.s / 2 + 0.15) return mk('column', [c.id], { es: 'Columna', en: 'Column' }, c.x - c.s / 2, c.z - c.s / 2, c.x + c.s / 2, c.z + c.s / 2);
    let wb = null;
    for (const w of L.walls) { const sd = segDist(px, pz, w.x0, w.z0, w.x1, w.z1); if (sd.d <= w.t / 2 + 0.06 && (!wb || sd.d < wb.d)) wb = { w, d: sd.d }; }
    if (wb) { const w = wb.w; return mk('wall', [w.id], { es: 'Pared', en: 'Wall' }, Math.min(w.x0, w.x1), Math.min(w.z0, w.z1), Math.max(w.x0, w.x1), Math.max(w.z0, w.z1), { length: r2(wallLen(w)) }); }
    for (const st of L.stairs) {
      const len = st.len ?? Math.max(12, Math.ceil(b.floorHeight / 0.185)) * 0.27;
      const fx = -Math.sin(st.rot), fz = -Math.cos(st.rot), ax = Math.cos(st.rot), az = -Math.sin(st.rot);
      const u = (px - st.x) * fx + (pz - st.z) * fz, v = (px - st.x) * ax + (pz - st.z) * az;
      if (u >= -0.1 && u <= len + 0.1 && Math.abs(v) <= st.w / 2 + 0.1) {
        const xs = [st.x, st.x + fx * len].flatMap((q) => [q + ax * st.w / 2, q - ax * st.w / 2]), zs = [st.z, st.z + fz * len].flatMap((q) => [q + az * st.w / 2, q - az * st.w / 2]);
        return mk('stairs', [st.id], { es: 'Escalera', en: 'Stairs' }, Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs));
      }
    }
    const rm = roomsOf(b, li).find((r) => roomContains(r, px, pz));
    if (rm) {
      const m = roomMembers(b, li, rm);
      const type = (b.rooms ?? []).find((a) => +a.key[0] === li && roomContains(rm, a.x, a.z))?.type ?? 'cuarto';
      return mk('room', [...m.walls, ...m.slabs, ...m.columns, ...m.stairs], roomLabel(type), rm.x0, rm.z0, rm.x1, rm.z1, { shared: m.shared });
    }
    for (let i = L.slabs.length - 1; i >= 0; i--) {
      const sl = L.slabs[i];
      if (px < sl.x0 || px > sl.x1 || pz < sl.z0 || pz > sl.z1) continue;
      const label = sl.kind === 'porch' ? { es: 'Galería', en: 'Porch' } : sl.kind === 'carport' ? { es: 'Marquesina', en: 'Carport' } : sl.kind === 'balcony' ? { es: 'Balcón', en: 'Balcony' } : { es: 'Piso', en: 'Floor' };
      return mk('slab', [sl.id], label, sl.x0, sl.z0, sl.x1, sl.z1);
    }
  }
  const lx = px + ox, lz = pz + oz;
  for (const f of s.build?.fences ?? []) {
    if (segDist(lx, lz, f.x0, f.z0, f.x1, f.z1).d <= 0.3) return { kind: 'fence', ids: [f.id], level: 0, label: { es: 'Cerca', en: 'Fence' }, x: r2((f.x0 + f.x1) / 2 - ox), z: r2((f.z0 + f.z1) / 2 - oz), w: r2(Math.abs(f.x1 - f.x0)), d: r2(Math.abs(f.z1 - f.z0)) };
  }
  let it = null;
  for (const q of s.yard?.items ?? []) { const d = Math.hypot(q.x - lx, q.z - lz); if (d <= 1.2 && (!it || d < it.d)) it = { q, d }; }
  if (it) {
    const pc = pieceById(`yard-${it.q.type}`);
    return { kind: 'yard', ids: [it.q.id], level: 0, label: pc?.name ?? { es: it.q.type, en: it.q.type }, x: r2(it.q.x - ox), z: r2(it.q.z - oz), w: pc?.w ?? 1, d: pc?.d ?? 1 };
  }
  return null;
}

// Where each id lives: { walls, slabs, columns, stairs, openings: [[wallId, openingId]], fences, items, level, bbox (house-local) }.
function resolveIds(s, ids) {
  const set = new Set(ids);
  const b = s.build;
  const out = { walls: [], slabs: [], columns: [], stairs: [], openings: [], fences: [], items: [], level: null };
  const ox = s.house.offsetX ?? 0, oz = s.house.offsetZ ?? 0;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  const grow = (a, c, d, e) => { x0 = Math.min(x0, a); z0 = Math.min(z0, c); x1 = Math.max(x1, d); z1 = Math.max(z1, e); };
  b?.levels.forEach((L, li) => {
    for (const w of L.walls) {
      if (set.has(w.id)) { out.walls.push(w.id); out.level ??= li; grow(Math.min(w.x0, w.x1), Math.min(w.z0, w.z1), Math.max(w.x0, w.x1), Math.max(w.z0, w.z1)); }
      for (const o of w.openings) if (set.has(o.id) && !set.has(w.id)) out.openings.push([w.id, o.id]);
    }
    for (const sl of L.slabs) if (set.has(sl.id)) { out.slabs.push(sl.id); out.level ??= li; grow(sl.x0, sl.z0, sl.x1, sl.z1); }
    for (const c of L.columns ?? []) if (set.has(c.id)) { out.columns.push(c.id); out.level ??= li; grow(c.x - c.s / 2, c.z - c.s / 2, c.x + c.s / 2, c.z + c.s / 2); }
    for (const st of L.stairs) if (set.has(st.id)) { out.stairs.push(st.id); out.level ??= li; const q = stairRect(st); grow(q.x0, q.z0, q.x1, q.z1); }
  });
  for (const f of b?.fences ?? []) if (set.has(f.id)) { out.fences.push(f.id); grow(Math.min(f.x0, f.x1) - ox, Math.min(f.z0, f.z1) - oz, Math.max(f.x0, f.x1) - ox, Math.max(f.z0, f.z1) - oz); }
  for (const it of s.yard?.items ?? []) if (set.has(it.id)) { out.items.push(it.id); grow(it.x - ox - 0.5, it.z - oz - 0.5, it.x - ox + 0.5, it.z - oz + 0.5); }
  out.level ??= 0;
  out.bbox = Number.isFinite(x0) ? { x0, x1, z0, z1 } : null;
  out.count = out.walls.length + out.slabs.length + out.columns.length + out.stairs.length + out.openings.length + out.fences.length + out.items.length;
  return out;
}

// Rooms fully inside the group's walls (they move with it; their shared walls get copied).
function groupRooms(b, R) {
  if (!R.walls.length) return [];
  const wset = new Set(R.walls);
  const L = b.levels[R.level];
  return roomsOf(b, R.level).filter((rm) => L.walls.some((w) => wset.has(w.id) && wallOnPoly(w, rm.poly)) && rm.x0 >= R.bbox.x0 - 0.05 && rm.x1 <= R.bbox.x1 + 0.05 && rm.z0 >= R.bbox.z0 - 0.05 && rm.z1 <= R.bbox.z1 + 0.05);
}

// Snapped move of a group (pure): { ok, dx, dz, snaps, reason? }.
// Footprint of a stair run (house-local rectangle).
function stairRect(st) {
  const len = st.len ?? 4.6, fx = -Math.sin(st.rot), fz = -Math.cos(st.rot), ax = Math.cos(st.rot), az = -Math.sin(st.rot);
  const xs = [st.x, st.x + fx * len].flatMap((q) => [q + ax * st.w / 2, q - ax * st.w / 2]), zs = [st.z, st.z + fz * len].flatMap((q) => [q + az * st.w / 2, q - az * st.w / 2]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}
const unionRect = (list) => list.length ? { x0: Math.min(...list.map((r) => r.x0)), x1: Math.max(...list.map((r) => r.x1)), z0: Math.min(...list.map((r) => r.z0)), z1: Math.max(...list.map((r) => r.z1)) } : null;

// Validated (and, for plain moves, snapped) group move / rotate / copy (pure): { ok, dx, dz, rot, snaps, reason? }.
// opts: rot (degrees about the group centre), snap (default true, only without rot), copy (the original stays,
// so it counts as an obstacle). The same checks as fitPiece: outsideLot, overlap, noSupport.
export function fitGroup(s, ids, dx, dz, { rot = 0, snap = true, copy = false } = {}) {
  const R = resolveIds(s, ids);
  let mx = +dx || 0, mz = +dz || 0;
  const rotD = normRot(rot);
  if (!R.count || !R.bbox) return { ok: false, dx: 0, dz: 0, rot: rotD, snaps: [], reason: 'notFound' };
  const lot = lotBox(s);
  const b = s.build;
  const cx0 = (R.bbox.x0 + R.bbox.x1) / 2, cz0 = (R.bbox.z0 + R.bbox.z1) / 2;
  const th = rad(rotD), c = Math.round(Math.cos(th)), sn = Math.round(Math.sin(th));
  // Same map as store.rotateGroup / moveGroup: rotate about the bbox centre, then shift.
  const Tr = (r) => {
    const pts = [[r.x0, r.z0], [r.x1, r.z1]].map(([x, z]) => [cx0 + (x - cx0) * c + (z - cz0) * sn + mx, cz0 - (x - cx0) * sn + (z - cz0) * c + mz]);
    return { x0: Math.min(pts[0][0], pts[1][0]), x1: Math.max(pts[0][0], pts[1][0]), z0: Math.min(pts[0][1], pts[1][1]), z1: Math.max(pts[0][1], pts[1][1]) };
  };
  let snaps = [];
  const lotOnly = !R.walls.length && !R.slabs.length && !R.columns.length && !R.stairs.length;
  if (b && !lotOnly && snap && !rotD) {
    const bb = R.bbox, hw = (bb.x1 - bb.x0) / 2, hd = (bb.z1 - bb.z0) / 2;
    const skip = new Set([...R.walls, ...R.slabs, ...R.columns, ...R.stairs]);
    const sn2 = snapRect(b, R.level > 0 ? [R.level, R.level - 1] : [R.level], cx0 + mx, cz0 + mz, hw, hd, R.walls.length ? 'center' : 'outer', 0.15, b.grid ?? 0.5, skip);
    mx = sn2.x - cx0; mz = sn2.z - cz0; snaps = sn2.snaps;
  } else if (lotOnly && snap) { mx = Math.round(mx * 10) / 10; mz = Math.round(mz * 10) / 10; }
  mx = r2(mx); mz = r2(mz);
  const nb = Tr(R.bbox);
  const res = { ok: true, dx: mx, dz: mz, rot: rotD, snaps };
  const bad = (reason) => ({ ...res, ok: false, reason });
  if (lotOnly ? (nb.x0 + lot.ox < -lot.hw - 0.01 || nb.x1 + lot.ox > lot.hw + 0.01 || nb.z0 + lot.oz < -lot.hd - 0.01 || nb.z1 + lot.oz > lot.hd + 0.01) : !inLot(lot, nb)) return bad('outsideLot');
  if (!b || lotOnly || !b.levels[R.level]) return res;
  const li = R.level, L = b.levels[li];
  const rooms = R.walls.length ? groupRooms(b, R) : [];
  const ignore = copy ? {} : { ignoreRooms: rooms, ignoreIds: new Set([...R.walls, ...R.slabs, ...R.columns, ...R.stairs]) };
  const checks = [];
  if (rooms.length) checks.push(['room', unionRect(rooms)]);
  const slabs = L.slabs.filter((q) => R.slabs.includes(q.id));
  // Room slabs travel with their room (checked as the room); bare / outdoor slabs are checked on their own.
  for (const q of slabs) if (!rooms.some((rm) => roomContains(rm, (q.x0 + q.x1) / 2, (q.z0 + q.z1) / 2))) checks.push([q.kind ?? 'slab', q]);
  for (const st of L.stairs) if (R.stairs.includes(st.id)) checks.push(['stairs', stairRect(st)]);
  for (const [kind, rect] of checks) {
    const tr = Tr(rect);
    const why = footprintReason(b, li, tr, kind, ignore);
    if (why) return bad(why);
    if (li > 0 && (kind === 'room' || kind === 'slab' || kind === 'porch') && supportOf(b, li - 1, tr) < 0.5) return bad('noSupport');
    if (kind === 'carport' && li > 0) return bad('noSupport');
  }
  return res;
}
export { fail as refuse };

// Moves / rotates / copies the elements of a group with the point map T (house-local) and rotation dTh (radians).
// Mutates build `b` and the yard item list `items` (lot-local). Returns { ids } (new ids when copying) or false.
export function transformGroup(s, b, items, ids, T, dTh = 0, { copy = false } = {}) {
  const R = resolveIds({ ...s, build: b, yard: { items } }, ids);
  if (!R.count) return fail('notFound');
  const ox = s.house.offsetX ?? 0, oz = s.house.offsetZ ?? 0;
  const used = b ? allIds(b) : new Set();
  const newIds = [];
  const lotT = (x, z) => { const [a, c] = T(x - ox, z - oz); return [r2(a + ox), r2(c + oz)]; };
  if (b?.levels[R.level]) {
    const li = R.level, L = b.levels[li];
    const wset = new Set(R.walls);
    const own = R.walls.length ? groupRooms(b, R) : [];
    const anchors = (b.rooms ?? []).filter((a) => +a.key[0] === li && own.some((rm) => roomContains(rm, a.x, a.z)));
    const boundary = new Set();
    for (const rm of roomsOf(b, li)) for (const w of L.walls) if (wallOnPoly(w, rm.poly)) boundary.add(w.id);
    const moved = [], touched = new Set();
    const tw = (w, keepId) => {
      const [x0, z0] = T(w.x0, w.z0), [x1, z1] = T(w.x1, w.z1);
      return { ...clone(w), id: keepId ? w.id : mkId(b, used), x0: r2(x0), z0: r2(z0), x1: r2(x1), z1: r2(z1), openings: w.openings.map((o) => ({ ...clone(o), id: keepId ? o.id : mkId(b, used) })) };
    };
    const groupNodes = new Set();
    for (const w of L.walls) if (wset.has(w.id)) { groupNodes.add(nodeKey(w.x0, w.z0)); groupNodes.add(nodeKey(w.x1, w.z1)); }
    for (const w of L.walls) if (wset.has(w.id)) moved.push(tw(w, !copy));
    // Shared walls of the moved rooms stay with the neighbour; the room gets its own copy (no openings).
    for (const rm of own) for (const w of L.walls) {
      if (wset.has(w.id) || !wallOnPoly(w, rm.poly)) continue;
      const c = tw(w, false);
      c.openings = [];
      c.ext = true;
      moved.push(c);
    }
    if (!copy) {
      // Free walls (not on any room outline) whose end touches the group stretch to follow.
      for (const w of L.walls) {
        if (wset.has(w.id) || boundary.has(w.id)) continue;
        for (const e of [0, 1]) {
          const kx = e ? w.x1 : w.x0, kz = e ? w.z1 : w.z0;
          if (!groupNodes.has(nodeKey(kx, kz))) continue;
          touched.add(nodeKey(kx, kz));
          const [nx, nz] = T(kx, kz);
          if (e) { w.x1 = r2(nx); w.z1 = r2(nz); } else { w.x0 = r2(nx); w.z0 = r2(nz); }
        }
      }
      for (const k of groupNodes) touched.add(k);
      L.walls = L.walls.filter((w) => !wset.has(w.id));
      L.walls = L.walls.filter((w) => wallLen(w) >= 0.3);
    }
    for (const w of moved) { touched.add(nodeKey(w.x0, w.z0)); touched.add(nodeKey(w.x1, w.z1)); }
    if (L.walls.length + moved.length > BL.walls) return fail('limit');
    L.walls.push(...moved);
    for (const w of moved) newIds.push(w.id);
    if (moved.length || touched.size) { splitWalls(b, L); mergeWalls(L, touched); }
    // Slabs, columns, stairs.
    for (const id of R.slabs) {
      const sl = L.slabs.find((q) => q.id === id);
      const [ax, az] = T(sl.x0, sl.z0), [cx, cz] = T(sl.x1, sl.z1);
      const n = { ...clone(sl), x0: r2(Math.min(ax, cx)), x1: r2(Math.max(ax, cx)), z0: r2(Math.min(az, cz)), z1: r2(Math.max(az, cz)) };
      if (copy) { n.id = mkId(b, used); if (L.slabs.length >= BL.slabs) return fail('limit'); L.slabs.push(n); } else Object.assign(sl, n);
      newIds.push(n.id);
    }
    for (const id of R.columns) {
      const c = L.columns.find((q) => q.id === id);
      const [x, z] = T(c.x, c.z);
      const n = { ...c, x: r2(x), z: r2(z) };
      if (copy) { n.id = mkId(b, used); if (L.columns.length >= BL.columns) return fail('limit'); L.columns.push(n); } else Object.assign(c, n);
      newIds.push(n.id);
    }
    for (const id of copy ? [] : R.stairs) {
      const st = L.stairs.find((q) => q.id === id);
      const [x, z] = T(st.x, st.z);
      const k = Math.round((st.rot + dTh) / (Math.PI / 2));
      const n = { ...st, x: r2(x), z: r2(z), rot: (((k % 4) + 4) % 4) * (Math.PI / 2) };
      if (copy) { n.id = mkId(b, used); if (L.stairs.length >= BL.stairs) return fail('limit'); L.stairs.push(n); } else Object.assign(st, n);
      newIds.push(n.id);
    }
    // Room types travel with their rooms.
    for (const a of anchors) {
      const [x, z] = T(a.x, a.z);
      if (copy) anchorRoom(b, li, a.type, x, z); else { a.x = r2(x); a.z = r2(z); }
    }
    if (R.walls.length) { fixExt(L, null); fixInteriorOpenings(b, li); }
    connectStairs(b, li);
    connectStairs(b, li + 1);
  }
  for (const id of R.fences) {
    const f = b.fences.find((q) => q.id === id);
    const [x0, z0] = lotT(f.x0, f.z0), [x1, z1] = lotT(f.x1, f.z1);
    const n = { ...clone(f), x0, z0, x1, z1 };
    if (copy) { n.id = mkId(b, used); if (b.fences.length >= BL.fences) return fail('limit'); b.fences.push(n); } else Object.assign(f, n);
    newIds.push(n.id);
  }
  for (const id of R.items) {
    const it = items.find((q) => q.id === id);
    const [x, z] = lotT(it.x, it.z);
    const n = { ...it, x, z, rot: +((((it.rot ?? 0) + dTh) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)).toFixed(4) };
    if (copy) { n.id = Math.random().toString(36).slice(2, 9); if (items.length >= MAX_YARD_ITEMS) return fail('maxItems'); items.push(n); } else Object.assign(it, n);
    newIds.push(n.id);
  }
  return { ids: newIds };
}

// Removes the elements of a group (walls merge back where they can). Mutates b / items.
export function removeGroupIn(s, b, items, ids) {
  const R = resolveIds({ ...s, build: b, yard: { items } }, ids);
  if (!R.count) return fail('notFound');
  const set = new Set(ids);
  if (b) {
    for (const [wid, oid] of R.openings) BO.removeOpening(b, wid, oid);
    for (const L of b.levels) {
      const touched = new Set();
      for (const w of L.walls) if (set.has(w.id)) { touched.add(nodeKey(w.x0, w.z0)); touched.add(nodeKey(w.x1, w.z1)); }
      L.walls = L.walls.filter((w) => !set.has(w.id));
      if (touched.size) mergeWalls(L, touched);
      L.slabs = L.slabs.filter((q) => !set.has(q.id));
      L.stairs = L.stairs.filter((q) => !set.has(q.id));
      L.columns = (L.columns ?? []).filter((q) => !set.has(q.id));
    }
    b.fences = b.fences.filter((f) => !set.has(f.id));
  }
  for (let i = items.length - 1; i >= 0; i--) if (set.has(items[i].id)) items.splice(i, 1);
  return true;
}

export const groupBox = (s, ids) => resolveIds(s, ids);
