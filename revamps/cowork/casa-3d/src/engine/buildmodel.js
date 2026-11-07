// Build mode data model (no three.js): schema defaults, sanitize, wall graph
// (split / merge / mitre points), slab grids, room inference, snapping and the
// pure edit operations the store wraps. Spec: .squad/BUILD.md, API: CONTRACT.md "v4 build API".
import { floorIds, toneIds, patternIds, tileSizeIds } from './floors.js';

export const BL = { walls: 200, slabs: 60, fences: 120, openings: 12, levels: 3, stairs: 8, columns: 80 };
export const GRIDS = [0.1, 0.25, 0.5, 1];
export const OPENING_KINDS = ['door', 'window', 'arch', 'slider', 'garage'];
export const OPENING_STYLES = ['standard', 'tall', 'arched', 'louvered', 'panel', 'double', 'glass', 'flat', 'round'];
export const WALL_FINISHES = ['smooth', 'block', 'stone', 'brick'];
export const FENCE_TYPES = ['block', 'rejas', 'madera', 'malla', 'piedra'];
export const GATE_KINDS = ['peatonal', 'vehicular'];
export const ROOF_TYPES = ['flat', 'hip', 'gable', 'shed'];
export const ROOF_MATERIALS = ['concrete', 'tile', 'metal'];
export const OPEN_DEFAULTS = {
  door: { w: 0.9, h: 2.1, sill: 0 },
  window: { w: 1.2, h: 1.2, sill: 1.0 },
  arch: { w: 1.2, h: 2.3, sill: 0 },
  slider: { w: 2.0, h: 2.3, sill: 0 },
  garage: { w: 2.8, h: 2.2, sill: 0 },
};
export const FENCE_DEFAULT_H = { block: 1.9, rejas: 1.9, madera: 1.5, malla: 1.8, piedra: 1.4 };
export const SLAB_T = 0.2;       // structural slab thickness
export const MIN_WALL = 0.3;
export const SLAB_KINDS = ['porch', 'carport', 'balcony'];
export const EXTRA_KEYS = ['roofTerrace', 'pergola', 'waterTank', 'solar', 'entryPortal'];

// Why the last edit failed ('tooShort' | 'noFit' | 'overlap' | 'limit' | 'badValue' | 'needLevel' | 'levelsMax' | 'notFound').
let reason = '';
export const lastReason = () => reason;
const fail = (code) => { reason = code; return false; };
export const WALL_H_EXTRA = 1.5;   // walls may be this much taller than the floor height (parapet, gable, garage)
const clone = (o) => structuredClone(o);
const plainObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const fin = (v) => (v !== null && v !== '' && v !== undefined && typeof v !== 'boolean' && Number.isFinite(+v) ? +v : NaN);
const num = (v, lo, hi, d) => { const n = fin(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const r2 = (v) => Math.round(v * 100) / 100;
export const uid = () => Math.random().toString(36).slice(2, 9);
const pick = (v, list, d) => (list.includes(v) ? v : d);

// ---- construction -------------------------------------------------------------------------------
export function emptyLevel() { return { slabs: [], walls: [], stairs: [], columns: [] }; }
export function emptyBuild(house = {}) {
  return {
    grid: 0.5,
    floorHeight: num(house.floorHeight, 2.7, 3.6, 3.0),
    levels: [emptyLevel()],
    roof: { type: 'flat', material: 'concrete', color: '#e9e6df', overhang: 0.6, parapet: true },
    fences: [],
    rooms: [],
    extras: { roofTerrace: false, pergola: false, waterTank: false, solar: false, entryPortal: false },
  };
}

export const wallLen = (w) => Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
const nodeKey = (x, z) => `${Math.round(x * 100)},${Math.round(z * 100)}`;

export function allIds(b) {
  const s = new Set();
  for (const L of b.levels) {
    for (const w of L.walls) { s.add(w.id); for (const o of w.openings ?? []) s.add(o.id); }
    for (const x of L.slabs) s.add(x.id);
    for (const x of L.stairs) s.add(x.id);
    for (const x of L.columns ?? []) s.add(x.id);
  }
  for (const f of b.fences) s.add(f.id);
  return s;
}
function mkId(b, used = allIds(b)) {
  let id;
  do id = uid(); while (used.has(id));
  used.add(id);
  return id;
}

// ---- sanitize -----------------------------------------------------------------------------------
// Returns a valid build or null. `lot` = { x0, x1, z0, z1 } in house-local meters (walls / slabs),
// fences are clamped to the lot itself (lot-local).
export function sanitizeBuild(raw, { house = {}, land = { width: 24, depth: 32 }, offsetX = 0, offsetZ = 0, interiorFloor = 'porcelanato' } = {}) {
  if (!plainObj(raw)) return null;
  try {
    const b = {};
    b.grid = GRIDS.reduce((best, g) => (Math.abs(g - +raw.grid) < Math.abs(best - +raw.grid) ? g : best), 0.5);
    if (!Number.isFinite(+raw.grid)) b.grid = 0.5;
    b.floorHeight = num(raw.floorHeight, 2.7, 3.6, 3.0);
    const FH = b.floorHeight;
    const lx0 = -land.width / 2 - offsetX + 0.2, lx1 = land.width / 2 - offsetX - 0.2;
    const lz0 = -land.depth / 2 - offsetZ + 0.2, lz1 = land.depth / 2 - offsetZ - 0.2;
    const used = new Set();
    const idOk = (id) => typeof id === 'string' && /^[a-z0-9_-]{1,16}$/i.test(id) && !used.has(id);
    const takeId = (id) => { const k = idOk(id) ? id : mkId({ levels: [], fences: [] }, used); used.add(k); return k; };
    const levelsIn = Array.isArray(raw.levels) ? raw.levels.slice(0, BL.levels) : [];
    if (!levelsIn.length) levelsIn.push({});
    b.levels = levelsIn.map((Lr, li) => {
      const L = plainObj(Lr) ? Lr : {};
      const out = { slabs: [], walls: [], stairs: [], columns: [] };
      for (const s of (Array.isArray(L.slabs) ? L.slabs : []).slice(0, BL.slabs)) {
        if (!plainObj(s)) continue;
        let x0 = fin(s.x0), z0 = fin(s.z0), x1 = fin(s.x1), z1 = fin(s.z1);
        if (![x0, z0, x1, z1].every(Number.isFinite)) continue;
        [x0, x1] = [Math.min(x0, x1), Math.max(x0, x1)];
        [z0, z1] = [Math.min(z0, z1), Math.max(z0, z1)];
        x0 = Math.max(lx0, x0); x1 = Math.min(lx1, x1); z0 = Math.max(lz0, z0); z1 = Math.min(lz1, z1);
        if (x1 - x0 < 0.5 || z1 - z0 < 0.5) continue;
        const o = { id: takeId(s.id), x0: r2(x0), z0: r2(z0), x1: r2(x1), z1: r2(z1), finish: pick(s.finish, floorIds, pick(interiorFloor, floorIds, 'porcelanato')) };
        if (toneIds.includes(s.tone)) o.tone = s.tone;
        if (patternIds.includes(s.pattern)) o.pattern = s.pattern;
        if (tileSizeIds.includes(s.tileSize)) o.tileSize = s.tileSize;
        if (s.raised === false) o.raised = false;
        if (SLAB_KINDS.includes(s.kind)) o.kind = s.kind;
        out.slabs.push(o);
      }
      for (const w of (Array.isArray(L.walls) ? L.walls : []).slice(0, BL.walls)) {
        if (!plainObj(w)) continue;
        const x0 = fin(w.x0), z0 = fin(w.z0), x1 = fin(w.x1), z1 = fin(w.z1);
        if (![x0, z0, x1, z1].every(Number.isFinite)) continue;
        const o = {
          id: takeId(w.id),
          x0: r2(Math.min(lx1, Math.max(lx0, x0))), z0: r2(Math.min(lz1, Math.max(lz0, z0))),
          x1: r2(Math.min(lx1, Math.max(lx0, x1))), z1: r2(Math.min(lz1, Math.max(lz0, z1))),
          t: +num(w.t, 0.1, 0.3, 0.2).toFixed(2),
          h: w.h === null || w.h === undefined ? null : +num(w.h, 0.5, FH + WALL_H_EXTRA, FH).toFixed(2),
          ext: w.ext === true,
        };
        if (wallLen(o) < MIN_WALL) continue;
        if (o.h !== null && Math.abs(o.h - FH) < 0.005) o.h = null;
        if (isHex(w.inColor)) o.inColor = w.inColor;
        if (isHex(w.outColor)) o.outColor = w.outColor;
        if (WALL_FINISHES.includes(w.finish)) o.finish = w.finish;
        o.openings = sanitizeOpenings(w.openings, o, FH, used);
        const sk = nodeKey(o.x0, o.z0) + '|' + nodeKey(o.x1, o.z1), sk2 = nodeKey(o.x1, o.z1) + '|' + nodeKey(o.x0, o.z0);
        if (out.walls.some((q) => { const k = nodeKey(q.x0, q.z0) + '|' + nodeKey(q.x1, q.z1); return k === sk || k === sk2; })) continue;
        out.walls.push(o);
      }
      for (const st of (Array.isArray(L.stairs) ? L.stairs : []).slice(0, BL.stairs)) {
        if (!plainObj(st) || li >= levelsIn.length - 1) continue;
        const x = fin(st.x), z = fin(st.z);
        if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
        const k = Math.round((fin(st.rot) || 0) / (Math.PI / 2));
        const o = { id: takeId(st.id), x: r2(Math.min(lx1, Math.max(lx0, x))), z: r2(Math.min(lz1, Math.max(lz0, z))), rot: ((k % 4) + 4) % 4 * (Math.PI / 2), w: +num(st.w, 0.7, 2.2, 1.0).toFixed(2) };
        const len = fin(st.len);
        if (Number.isFinite(len)) o.len = +Math.min(8, Math.max(1.5, len)).toFixed(2);
        out.stairs.push(o);
      }
      // Columns (v5): free-standing plastered columns, centre x / z, side s, height h (null = floor height).
      for (const c of (Array.isArray(L.columns) ? L.columns : []).slice(0, BL.columns)) {
        if (!plainObj(c)) continue;
        const x = fin(c.x), z = fin(c.z);
        if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
        const o = { id: takeId(c.id), x: r2(Math.min(lx1, Math.max(lx0, x))), z: r2(Math.min(lz1, Math.max(lz0, z))), s: +num(c.s, 0.2, 0.6, 0.3).toFixed(2), h: c.h === null || c.h === undefined ? null : +num(c.h, 0.5, FH + WALL_H_EXTRA, FH).toFixed(2) };
        if (o.h !== null && Math.abs(o.h - FH) < 0.005) o.h = null;
        if (out.columns.some((q) => Math.hypot(q.x - o.x, q.z - o.z) < 0.05)) continue;
        out.columns.push(o);
      }
      return out;
    });
    const rin = plainObj(raw.roof) ? raw.roof : {};
    b.roof = {
      type: pick(rin.type, ROOF_TYPES, 'flat'), material: pick(rin.material, ROOF_MATERIALS, 'concrete'),
      color: isHex(rin.color) ? rin.color : '#e9e6df', overhang: +num(rin.overhang, 0, 1.5, 0.6).toFixed(2), parapet: rin.parapet !== false,
    };
    const ex = plainObj(raw.extras) ? raw.extras : {};
    b.extras = Object.fromEntries(EXTRA_KEYS.map((k) => [k, ex[k] === true]));
    b.fences = [];
    const fx = land.width / 2, fz = land.depth / 2;
    for (const f of (Array.isArray(raw.fences) ? raw.fences : []).slice(0, BL.fences)) {
      if (!plainObj(f)) continue;
      const x0 = fin(f.x0), z0 = fin(f.z0), x1 = fin(f.x1), z1 = fin(f.z1);
      if (![x0, z0, x1, z1].every(Number.isFinite)) continue;
      const type = pick(f.type, FENCE_TYPES, 'block');
      const o = {
        id: takeId(f.id),
        x0: r2(Math.min(fx, Math.max(-fx, x0))), z0: r2(Math.min(fz, Math.max(-fz, z0))), x1: r2(Math.min(fx, Math.max(-fx, x1))), z1: r2(Math.min(fz, Math.max(-fz, z1))),
        type, h: +num(f.h, 0.4, 3.5, FENCE_DEFAULT_H[type]).toFixed(2), color: isHex(f.color) ? f.color : '#f7f5ef',
      };
      const len = Math.hypot(o.x1 - o.x0, o.z1 - o.z0);
      if (len < 0.5) continue;
      const gl = Array.isArray(f.gates) ? f.gates : plainObj(f.gate) ? [f.gate] : [];
      const gates = cleanGates(gl, len);
      if (gates.length) o.gates = gates;
      b.fences.push(o);
    }
    if (plainObj(raw.hint) && ['x0', 'z0', 'x1', 'z1'].every((k) => Number.isFinite(fin(raw.hint[k])))) b.hint = { x0: +raw.hint.x0, z0: +raw.hint.z0, x1: +raw.hint.x1, z1: +raw.hint.z1 };
    b.rooms = [];
    for (const a of (Array.isArray(raw.rooms) ? raw.rooms : []).slice(0, 120)) {
      if (!plainObj(a) || typeof a.key !== 'string' || !/^\d:[a-z]+:\d{1,2}$/.test(a.key)) continue;
      const x = fin(a.x), z = fin(a.z);
      if (!Number.isFinite(x) || !Number.isFinite(z) || +a.key[0] >= b.levels.length) continue;
      b.rooms.push({ key: a.key, type: a.key.split(':')[1], x: r2(x), z: r2(z) });
    }
    if (plainObj(raw.prev)) b.prev = { floors: Math.round(num(raw.prev.floors, 1, 3, 1)), floorHeight: num(raw.prev.floorHeight, 2.7, 3.6, 3.0) };
    refreshRooms(b);
    return b;
  } catch {
    return null;
  }
}

// Gates of one fence segment: clamped inside, sorted, no overlaps.
function cleanGates(list, len) {
  const out = [];
  for (const g of list.slice(0, 6)) {
    if (!plainObj(g)) continue;
    const kind = pick(g.kind, GATE_KINDS, 'peatonal');
    const gw = +num(g.w, 0.8, 6, kind === 'vehicular' ? 3.2 : 1.0).toFixed(2);
    if (len < gw + 0.2) continue;
    const at = +num(g.at, gw / 2 + 0.1, len - gw / 2 - 0.1, len / 2).toFixed(2);
    if (out.some((q) => Math.abs(q.at - at) < (q.w + gw) / 2 + 0.1)) continue;
    out.push({ at, w: gw, kind });
  }
  return out.sort((p, q) => p.at - q.at);
}

function sanitizeOpenings(list, wall, FH, used) {
  const out = [];
  if (!Array.isArray(list)) return out;
  const len = wallLen(wall);
  for (const o of list.slice(0, BL.openings * 2)) {
    if (out.length >= BL.openings) break;
    if (!plainObj(o) || !OPENING_KINDS.includes(o.kind)) continue;
    const d = OPEN_DEFAULTS[o.kind];
    const w = +num(o.w, 0.4, Math.min(6, len - 0.3), d.w).toFixed(2);
    if (len - 0.3 < 0.4) continue;
    const maxTop = FH - 0.3;
    const sill = +num(o.sill, 0, maxTop - 0.4, d.sill).toFixed(2);
    const wallTop = wall.h ?? FH;
    const h = +num(o.h, 0.4, Math.max(0.4, Math.min(maxTop, wallTop - 0.1) - sill), Math.min(d.h, Math.max(0.4, Math.min(maxTop, wallTop - 0.1) - sill))).toFixed(2);
    const margin = 0.12;
    const at = num(o.at, w / 2 + margin, len - w / 2 - margin, NaN);
    if (!Number.isFinite(at)) continue;
    const q = { id: typeof o.id === 'string' && /^[a-z0-9_-]{1,16}$/i.test(o.id) && !used.has(o.id) ? o.id : mkId({ levels: [], fences: [] }, used), kind: o.kind, at: r2(at), w, h, sill, style: OPENING_STYLES.includes(o.style) ? o.style : null };
    used.add(q.id);
    if (o.top === 'arch' || o.top === 'flat') q.top = o.top;
    if (typeof o.bars === 'boolean') q.bars = o.bars;
    // Overlapping openings: the later one is dropped.
    if (out.some((p) => Math.abs(p.at - q.at) < (p.w + q.w) / 2 + 0.08)) continue;
    out.push(q);
  }
  return out.sort((a, b) => a.at - b.at);
}

// ---- grid decomposition of slab rectangles ------------------------------------------------------
// A grid over the distinct x / z of the rectangles; each cell is owned by the LAST slab covering its
// centre (later slabs sit on top), or -1. Holes (rects) clear cells.
export function slabGrid(slabs, holes = [], extra = {}) {
  const xs = new Set(extra.x ?? []), zs = new Set(extra.z ?? []);
  for (const s of slabs) { xs.add(s.x0); xs.add(s.x1); zs.add(s.z0); zs.add(s.z1); }
  for (const h of holes) { xs.add(h.x0); xs.add(h.x1); zs.add(h.z0); zs.add(h.z1); }
  const X = [...xs].sort((a, b) => a - b), Z = [...zs].sort((a, b) => a - b);
  const nx = Math.max(0, X.length - 1), nz = Math.max(0, Z.length - 1);
  const owner = new Int16Array(nx * nz).fill(-1);
  const inside = (r, cx, cz) => cx > r.x0 && cx < r.x1 && cz > r.z0 && cz < r.z1;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const cx = (X[i] + X[i + 1]) / 2, cz = (Z[j] + Z[j + 1]) / 2;
    let o = -1;
    slabs.forEach((s, k) => { if (inside(s, cx, cz)) o = k; });
    if (o >= 0 && holes.some((h) => inside(h, cx, cz))) o = -1;
    owner[j * nx + i] = o;
  }
  return { X, Z, nx, nz, owner, at: (i, j) => (i < 0 || j < 0 || i >= nx || j >= nz ? -1 : owner[j * nx + i]) };
}

// Merge cells with the same owner into few rectangles: runs along x, then stack identical runs along z.
export function gridRects(g, ownerOf = (o) => o) {
  const runs = [];
  for (let j = 0; j < g.nz; j++) {
    let i = 0;
    while (i < g.nx) {
      const o = g.at(i, j);
      if (o < 0) { i++; continue; }
      let k = i;
      while (k + 1 < g.nx && g.at(k + 1, j) === o) k++;
      runs.push({ i0: i, i1: k, j0: j, j1: j, o });
      i = k + 1;
    }
  }
  const out = [];
  const open = new Map();
  for (let j = 0; j <= g.nz; j++) {
    const row = runs.filter((r) => r.j0 === j);
    const next = new Map();
    for (const r of row) {
      const key = `${r.i0}:${r.i1}:${r.o}`;
      const prev = open.get(key);
      if (prev) { prev.j1 = j; next.set(key, prev); open.delete(key); }
      else next.set(key, r);
    }
    for (const r of open.values()) out.push(r);
    open.clear();
    for (const [k, v] of next) open.set(k, v);
  }
  return out.map((r) => ({ x0: g.X[r.i0], x1: g.X[r.i1 + 1], z0: g.Z[r.j0], z1: g.Z[r.j1 + 1], owner: ownerOf(r.o) }));
}

// Boundary segments of the covered area: { x0, z0, x1, z1, nx, nz } with an outward unit normal.
export function gridEdges(g, covered = (o) => o >= 0) {
  const segs = [];
  const cov = (i, j) => covered(g.at(i, j));
  // horizontal edges (constant z): between cell (i,j-1) and (i,j)
  for (let j = 0; j <= g.nz; j++) {
    let run = null;
    for (let i = 0; i <= g.nx; i++) {
      const a = i < g.nx && cov(i, j - 1), b = i < g.nx && cov(i, j);
      const dir = a && !b ? 1 : !a && b ? -1 : 0; // outward normal z
      if (dir && run && run.dir === dir) run.x1 = g.X[i + 1];
      else {
        if (run) segs.push({ x0: run.x0, z0: g.Z[j], x1: run.x1, z1: g.Z[j], nx: 0, nz: run.dir });
        run = dir ? { x0: g.X[i], x1: g.X[i + 1], dir } : null;
      }
    }
  }
  for (let i = 0; i <= g.nx; i++) {
    let run = null;
    for (let j = 0; j <= g.nz; j++) {
      const a = j < g.nz && cov(i - 1, j), b = j < g.nz && cov(i, j);
      const dir = a && !b ? 1 : !a && b ? -1 : 0;
      if (dir && run && run.dir === dir) run.z1 = g.Z[j + 1];
      else {
        if (run) segs.push({ x0: g.X[i], z0: run.z0, x1: g.X[i], z1: run.z1, nx: run.dir, nz: 0 });
        run = dir ? { z0: g.Z[j], z1: g.Z[j + 1], dir } : null;
      }
    }
  }
  return segs;
}

// ---- wall graph: nodes, mitre points ----------------------------------------------------------
// Per wall: the u (distance along the wall from its first end) of the left (+v) and right (-v) edge at each end.
export function wallFrames(walls) {
  const frames = new Map();
  for (const w of walls) {
    const len = wallLen(w);
    const dx = (w.x1 - w.x0) / len, dz = (w.z1 - w.z0) / len;
    frames.set(w.id, { w, len, dx, dz, nx: -dz, nz: dx, t: w.t, lA: 0, rA: 0, lB: len, rB: len });
  }
  const nodes = new Map();
  for (const w of walls) {
    for (const end of [0, 1]) {
      const x = end ? w.x1 : w.x0, z = end ? w.z1 : w.z0;
      const k = nodeKey(x, z);
      if (!nodes.has(k)) nodes.set(k, { x, z, list: [] });
      const f = frames.get(w.id);
      nodes.get(k).list.push({ id: w.id, end, dx: end ? -f.dx : f.dx, dz: end ? -f.dz : f.dz, t: w.t });
    }
  }
  const hubs = [];
  for (const nd of nodes.values()) {
    const L = nd.list;
    if (L.length < 2) continue;
    for (const e of L) e.ang = Math.atan2(e.dz, e.dx);
    L.sort((a, b) => a.ang - b.ang);
    const pts = [];
    const k = L.length;
    for (let i = 0; i < k; i++) {
      const a = L[i], b = L[(i + 1) % k];
      // left edge of a (ccw side) meets right edge of b
      const cross = a.dx * b.dz - a.dz * b.dx;
      const ta = a.t / 2, tb = b.t / 2;
      let sa, sb;
      const limit = 4 * Math.max(a.t, b.t) + 0.2;
      if (k === 1 || Math.abs(cross) < 1e-4) { sa = 0; sb = 0; }
      else {
        // P = left offset of a: (−a.dz, a.dx)*ta ; Q = right offset of b: (b.dz, −b.dx)*tb
        const Px = -a.dz * ta, Pz = a.dx * ta, Qx = b.dz * tb, Qz = -b.dx * tb;
        sa = ((Qx - Px) * b.dz - (Qz - Pz) * b.dx) / cross;
        sb = ((Qx - Px) * a.dz - (Qz - Pz) * a.dx) / cross;
        if (!Number.isFinite(sa) || Math.abs(sa) > limit || Math.abs(sb) > limit || sa < -limit / 2 || sb < -limit / 2) { sa = 0; sb = 0; }
      }
      const fa = frames.get(a.id), fb = frames.get(b.id);
      // a's left side (relative to dir away from node); b's right side
      setEdge(fa, a.end, 'left', sa);
      setEdge(fb, b.end, 'right', sb);
      const px = nd.x + (-a.dz) * ta + a.dx * sa, pz = nd.z + a.dx * ta + a.dz * sa;
      pts.push([px, pz]);
    }
    if (k >= 3) hubs.push({ x: nd.x, z: nd.z, pts });
  }
  return { frames, hubs, nodes };
}
// A wall end's "left" is relative to the direction away from the node: at end A that is the wall's +v side, at end B its -v side.
function setEdge(f, end, side, u) {
  if (!end) { if (side === 'left') f.lA = u; else f.rA = u; }
  else if (side === 'left') f.rB = f.len - u;
  else f.lB = f.len - u;
}

// ---- level helpers ----------------------------------------------------------------------------
export const levelOf = (b, id) => b.levels.findIndex((L) => L.walls.some((w) => w.id === id) || L.slabs.some((s) => s.id === id) || L.stairs.some((s) => s.id === id) || (L.columns ?? []).some((c) => c.id === id));
function findWall(b, id) {
  for (let li = 0; li < b.levels.length; li++) {
    const w = b.levels[li].walls.find((x) => x.id === id);
    if (w) return { w, L: b.levels[li], li };
  }
  return null;
}

function snapEnds(L) {
  const W = L.walls, R = 0.06;
  const pts = [];
  for (const w of W) for (const e of [0, 1]) {
    const x = e ? w.x1 : w.x0, z = e ? w.z1 : w.z0;
    const near = pts.find((p) => Math.hypot(p.x - x, p.z - z) < R);
    if (near) { if (e) { w.x1 = near.x; w.z1 = near.z; } else { w.x0 = near.x; w.z0 = near.z; } }
    else pts.push({ x, z });
  }
}

// Split walls at T / X junctions (and collinear overlaps), drop duplicates.
export function splitWalls(b, L) {
  snapEnds(L);
  const W = L.walls, n = W.length, E = MIN_WALL;
  const cut = W.map(() => []);
  const G = W.map((w) => ({ len: wallLen(w), dx: w.x1 - w.x0, dz: w.z1 - w.z0 }));
  for (let a = 0; a < n; a++) {
    const A = W[a], ga = G[a];
    for (let c = 0; c < n; c++) {
      if (a === c) continue;
      const C = W[c], gc = G[c];
      for (const [px, pz] of [[C.x0, C.z0], [C.x1, C.z1]]) {
        const s = ((px - A.x0) * ga.dx + (pz - A.z0) * ga.dz) / ga.len;
        const d = Math.abs((px - A.x0) * ga.dz - (pz - A.z0) * ga.dx) / ga.len;
        if (d < 0.03 && s > E && s < ga.len - E) cut[a].push(s);
      }
      if (c > a) {
        const den = ga.dx * gc.dz - ga.dz * gc.dx;
        if (Math.abs(den) > 1e-9) {
          const t = ((C.x0 - A.x0) * gc.dz - (C.z0 - A.z0) * gc.dx) / den;
          const u = ((C.x0 - A.x0) * ga.dz - (C.z0 - A.z0) * ga.dx) / den;
          const sa = t * ga.len, sc = u * gc.len;
          if (sa > E && sa < ga.len - E && sc > E && sc < gc.len - E) { cut[a].push(sa); cut[c].push(sc); }
        }
      }
    }
  }
  const used = allIds(b);
  const out = [];
  W.forEach((w, a) => {
    const len = G[a].len;
    const ds = [...new Set(cut[a].map((s) => Math.round(s * 100) / 100))].sort((p, q) => p - q);
    const pts = [0];
    for (const s of ds) if (s - pts[pts.length - 1] >= E && len - s >= E) pts.push(s);
    pts.push(len);
    if (pts.length === 2) { out.push(w); return; }
    const ux = G[a].dx / len, uz = G[a].dz / len;
    for (let i = 0; i < pts.length - 1; i++) {
      const s0 = pts[i], s1 = pts[i + 1];
      const piece = { ...clone({ ...w, openings: [] }), id: i === 0 ? w.id : mkId(b, used) };
      piece.x0 = i === 0 ? w.x0 : r2(w.x0 + ux * s0); piece.z0 = i === 0 ? w.z0 : r2(w.z0 + uz * s0);
      piece.x1 = i === pts.length - 2 ? w.x1 : r2(w.x0 + ux * s1); piece.z1 = i === pts.length - 2 ? w.z1 : r2(w.z0 + uz * s1);
      const pl = s1 - s0;
      for (const o of w.openings ?? []) {
        if (o.at < s0 || o.at >= s1) continue;
        const at = o.at - s0, half = o.w / 2 + 0.1;
        if (half * 2 > pl - 0.02) continue; // would not fit
        piece.openings.push({ ...o, at: r2(Math.min(pl - half, Math.max(half, at))) });
      }
      out.push(piece);
    }
  });
  // duplicates (same end points): keep the first
  const seen = new Set();
  L.walls = out.filter((w) => {
    const a = nodeKey(w.x0, w.z0), c = nodeKey(w.x1, w.z1);
    const k = a < c ? `${a}|${c}` : `${c}|${a}`;
    if (seen.has(k) || a === c) return false;
    seen.add(k);
    return true;
  });
}

const sameProps = (a, c) => a.t === c.t && a.h === c.h && a.ext === c.ext && a.inColor === c.inColor && a.outColor === c.outColor && a.finish === c.finish;

// Merge collinear walls that meet at exactly two-wall nodes, same props. Only nodes in `keys` (or all when null).
export function mergeWalls(L, keys = null) {
  let again = true;
  let guard = 0;
  while (again && guard++ < 50) {
    again = false;
    const by = new Map();
    for (const w of L.walls) for (const e of [0, 1]) {
      const k = nodeKey(e ? w.x1 : w.x0, e ? w.z1 : w.z0);
      if (!by.has(k)) by.set(k, []);
      by.get(k).push({ w, e });
    }
    for (const [k, list] of by) {
      if (list.length !== 2 || (keys && !keys.has(k))) continue;
      const [p, q] = list;
      if (p.w === q.w || !sameProps(p.w, q.w)) continue;
      const lp = wallLen(p.w), lq = wallLen(q.w);
      const dp = [(p.w.x1 - p.w.x0) / lp, (p.w.z1 - p.w.z0) / lp], dq = [(q.w.x1 - q.w.x0) / lq, (q.w.z1 - q.w.z0) / lq];
      const sp = p.e ? 1 : -1, sq = q.e ? 1 : -1; // directions pointing INTO the node
      const cross = dp[0] * dq[1] - dp[1] * dq[0];
      if (Math.abs(cross) > 0.01 || dp[0] * sp * dq[0] * sq + dp[1] * sp * dq[1] * sq > -0.99) continue;
      // Merge q into p: orient p so the node is its end B, q so the node is its start A.
      const a = p.e ? p.w : flipWall(p.w), c = q.e ? flipWall(q.w) : q.w;
      const la = wallLen(a);
      const merged = { ...a, x1: c.x1, z1: c.z1, openings: [...a.openings, ...c.openings.map((o) => ({ ...o, at: r2(o.at + la) }))] };
      const keep = [];
      for (const o of merged.openings.sort((m, n) => m.at - n.at)) if (!keep.some((m) => Math.abs(m.at - o.at) < (m.w + o.w) / 2 + 0.05) && keep.length < BL.openings) keep.push(o);
      merged.openings = keep;
      L.walls = L.walls.filter((w) => w !== p.w && w !== q.w);
      L.walls.push(merged);
      again = true;
      break;
    }
  }
}
function flipWall(w) {
  const len = wallLen(w);
  return { ...w, x0: w.x1, z0: w.z1, x1: w.x0, z1: w.z0, openings: w.openings.map((o) => ({ ...o, at: r2(len - o.at) })).sort((a, c) => a.at - c.at) };
}

function endKeys(L, ids) {
  const s = new Set();
  for (const w of L.walls) if (!ids || ids.includes(w.id)) { s.add(nodeKey(w.x0, w.z0)); s.add(nodeKey(w.x1, w.z1)); }
  return s;
}

// ---- room inference ----------------------------------------------------------------------------
function polyArea(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const [x0, z0] = p[i], [x1, z1] = p[(i + 1) % p.length]; a += x0 * z1 - x1 * z0; }
  return a / 2;
}
function pointInPoly(x, z, p) {
  let ins = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i], [xj, zj] = p[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}
function cleanPoly(p) {
  let pts = p.slice();
  let ch = true;
  while (ch && pts.length > 2) {
    ch = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length], c = pts[(i + 1) % pts.length], m = pts[i];
      if (Math.abs(a[0] - c[0]) < 1e-6 && Math.abs(a[1] - c[1]) < 1e-6) { pts.splice(i, 1); ch = true; break; }
    }
  }
  return pts;
}
// An interior point of a polygon (centroid when inside, else the middle of the widest scan interval).
function interiorPoint(poly, holes = []) {
  const ok = (x, z) => pointInPoly(x, z, poly) && !holes.some((h) => pointInPoly(x, z, h));
  let cx = 0, cz = 0, A = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, z0] = poly[i], [x1, z1] = poly[(i + 1) % poly.length];
    const c = x0 * z1 - x1 * z0; A += c; cx += (x0 + x1) * c; cz += (z0 + z1) * c;
  }
  if (Math.abs(A) > 1e-9) { cx /= 3 * A; cz /= 3 * A; if (ok(cx, cz)) return [cx, cz]; }
  const zs = poly.map((p) => p[1]);
  const zmin = Math.min(...zs), zmax = Math.max(...zs);
  let best = null;
  for (let k = 1; k < 12; k++) {
    const z = zmin + ((zmax - zmin) * k) / 12;
    const xsx = [];
    for (let i = 0; i < poly.length; i++) {
      const [x0, z0] = poly[i], [x1, z1] = poly[(i + 1) % poly.length];
      if ((z0 > z) !== (z1 > z)) xsx.push(x0 + ((z - z0) / (z1 - z0)) * (x1 - x0));
    }
    xsx.sort((a, c) => a - c);
    for (let i = 0; i + 1 < xsx.length; i += 2) {
      const mid = (xsx[i] + xsx[i + 1]) / 2, w = xsx[i + 1] - xsx[i];
      if (ok(mid, z) && (!best || w > best.w)) best = { w, p: [mid, z] };
    }
  }
  return best ? best.p : [cx, cz];
}

// Closed wall loops over a slab -> rooms. Candidates are unlabeled: use assignRoomKeys().
export function inferRooms(L) {
  const nodes = new Map();
  const edges = [];
  const getN = (x, z) => {
    const k = nodeKey(x, z);
    if (!nodes.has(k)) nodes.set(k, { x, z, out: [], k });
    return nodes.get(k);
  };
  for (const w of L.walls) {
    const a = getN(w.x0, w.z0), c = getN(w.x1, w.z1);
    if (a === c) continue;
    const e1 = { a, b: c, ang: Math.atan2(c.z - a.z, c.x - a.x), t: w.t, used: false };
    const e2 = { a: c, b: a, ang: Math.atan2(a.z - c.z, a.x - c.x), t: w.t, used: false };
    e1.twin = e2; e2.twin = e1;
    a.out.push(e1); c.out.push(e2);
    edges.push(e1, e2);
  }
  for (const n of nodes.values()) n.out.sort((p, q) => p.ang - q.ang);
  // component ids for hole detection
  const comp = new Map();
  let cid = 0;
  for (const n of nodes.values()) {
    if (comp.has(n)) continue;
    const st = [n];
    comp.set(n, cid);
    while (st.length) { const m = st.pop(); for (const e of m.out) if (!comp.has(e.b)) { comp.set(e.b, cid); st.push(e.b); } }
    cid++;
  }
  const faces = [];
  for (const e0 of edges) {
    if (e0.used) continue;
    const poly = [];
    const tsum = [];
    let e = e0, guard = 0;
    while (!e.used && guard++ < 2000) {
      e.used = true;
      poly.push([e.a.x, e.a.z]);
      tsum.push(e.t);
      const list = e.b.out;
      const i = list.indexOf(e.twin);
      e = list[(i - 1 + list.length) % list.length];
    }
    const clean = cleanPoly(poly);
    if (clean.length < 3) continue;
    faces.push({ poly: clean, area: polyArea(clean), comp: comp.get(e0.a), t: tsum.reduce((s, v) => s + v, 0) / tsum.length });
  }
  const inner = faces.filter((f) => f.area > 1e-6);
  const outer = faces.filter((f) => f.area < -1e-6);
  const covered = (x, z) => L.slabs.some((s) => x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1);
  const rooms = [];
  for (const f of inner) {
    const holes = [];
    let area = f.area;
    for (const o of outer) {
      if (o.comp === f.comp) continue;
      if (pointInPoly(o.poly[0][0], o.poly[0][1], f.poly)) { holes.push(o.poly); area += o.area; }
    }
    const [px, pz] = interiorPoint(f.poly, holes);
    if (!covered(px, pz)) continue;
    let perim = 0;
    for (let i = 0; i < f.poly.length; i++) perim += Math.hypot(f.poly[(i + 1) % f.poly.length][0] - f.poly[i][0], f.poly[(i + 1) % f.poly.length][1] - f.poly[i][1]);
    const net = Math.max(0, area - (perim * f.t) / 2 + f.t * f.t);
    if (net < 0.8) continue;
    const xs = f.poly.map((p) => p[0]), zs = f.poly.map((p) => p[1]);
    rooms.push({ poly: f.poly, holes, area, net, x: px, z: pz, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), t: f.t });
  }
  rooms.sort((p, q) => p.z0 - q.z0 || p.x0 - q.x0);
  return rooms;
}
export const roomContains = (r, x, z) => pointInPoly(x, z, r.poly) && !r.holes.some((h) => pointInPoly(x, z, h));

// Keys `${level}:${type}:${n}`. Stable: a candidate keeps the key of the previous anchor lying inside it.
export function assignRoomKeys(prev, level, cands) {
  const anchors = prev.filter((a) => +a.key[0] === level);
  const taken = new Set();
  const out = new Array(cands.length).fill(null);
  const pairs = [];
  cands.forEach((c, ci) => anchors.forEach((a, ai) => { if (roomContains(c, a.x, a.z)) pairs.push({ ci, ai, d: Math.hypot(a.x - c.x, a.z - c.z) }); }));
  pairs.sort((p, q) => p.d - q.d);
  const usedA = new Set();
  for (const p of pairs) {
    if (out[p.ci] || usedA.has(p.ai)) continue;
    out[p.ci] = anchors[p.ai].key;
    usedA.add(p.ai);
    taken.add(anchors[p.ai].key);
  }
  cands.forEach((c, ci) => {
    if (out[ci]) return;
    const type = 'cuarto';
    for (let n = 0; n < 100; n++) {
      const key = `${level}:${type}:${n}`;
      if (!taken.has(key)) { out[ci] = key; taken.add(key); break; }
    }
  });
  return out;
}

// Inferred rooms of every level with stable keys; updates b.rooms (anchors) in place.
export function refreshRooms(b) {
  const out = [];
  const anchors = [];
  b.levels.forEach((L, li) => {
    const cands = inferRooms(L);
    const keys = assignRoomKeys(b.rooms ?? [], li, cands);
    cands.forEach((c, i) => {
      c.key = keys[i];
      c.level = li;
      c.type = keys[i].split(':')[1];
      anchors.push({ key: c.key, type: c.type, x: r2(c.x), z: r2(c.z) });
      out.push(c);
    });
  });
  b.rooms = anchors;
  return out;
}
export const buildRooms = (b) => refreshRooms(clone(b));

// ---- snapping + info ----------------------------------------------------------------------------
export function snapPointOf(b, x, z, level, { radius = 0.3, grid } = {}) {
  const g = grid ?? b.grid ?? 0.5;
  const px = +x, pz = +z;
  if (!Number.isFinite(px) || !Number.isFinite(pz)) return { x: 0, z: 0, kind: 'grid' };
  const isFence = level === 'fence' || level === -1;
  const segs = isFence ? b.fences : b.levels[Math.max(0, Math.min(b.levels.length - 1, level | 0))]?.walls ?? [];
  let best = null;
  const consider = (cx, cz, kind, id, d) => { if (d <= radius && (!best || d < best.d - 1e-9 || (d < best.d + 1e-9 && PRI[kind] < PRI[best.kind]))) best = { x: r2(cx), z: r2(cz), kind, id, d }; };
  const PRI = { end: 0, mid: 1, wall: 2 };
  for (const s of segs) {
    consider(s.x0, s.z0, 'end', s.id, Math.hypot(px - s.x0, pz - s.z0));
    consider(s.x1, s.z1, 'end', s.id, Math.hypot(px - s.x1, pz - s.z1));
  }
  if (best) return { x: best.x, z: best.z, kind: best.kind, id: best.id };
  for (const s of segs) {
    const mx = (s.x0 + s.x1) / 2, mz = (s.z0 + s.z1) / 2;
    consider(mx, mz, 'mid', s.id, Math.hypot(px - mx, pz - mz));
  }
  if (best) return { x: best.x, z: best.z, kind: best.kind, id: best.id };
  for (const s of segs) {
    const dx = s.x1 - s.x0, dz = s.z1 - s.z0, l2 = dx * dx + dz * dz;
    if (l2 < 1e-9) continue;
    const t = Math.max(0, Math.min(1, ((px - s.x0) * dx + (pz - s.z0) * dz) / l2));
    const cx = s.x0 + t * dx, cz = s.z0 + t * dz;
    consider(cx, cz, 'wall', s.id, Math.hypot(px - cx, pz - cz));
  }
  if (best) return { x: best.x, z: best.z, kind: best.kind, id: best.id };
  return { x: r2(Math.round(px / g) * g), z: r2(Math.round(pz / g) * g), kind: 'grid' };
}

// Min / max for every editable number, so the UI can disable the +/- buttons at the limits.
export function buildLimits(b) {
  const FH = b.floorHeight;
  return {
    wallH: [0.5, +(FH + WALL_H_EXTRA).toFixed(2)], wallT: [0.1, 0.3], wallLength: [MIN_WALL, 60],
    openingW: [0.4, 6], openingH: [0.4, +(FH - 0.3).toFixed(2)], openingSill: [0, +(FH - 0.7).toFixed(2)],
    fenceH: [0.4, 3.5], gateW: [0.8, 6], floorHeight: [2.7, 3.6], overhang: [0, 1.5], levels: [1, BL.levels],
    stairsW: [0.7, 2.2], stairsLen: [1.5, 8],
  };
}

export function buildInfoOf(b, level = 0) {
  const lv = Math.max(0, Math.min(b.levels.length - 1, Math.floor(+level) || 0));
  const L = b.levels[lv];
  const area = (s) => +((s.x1 - s.x0) * (s.z1 - s.z0)).toFixed(2);
  const slabArea = (S) => {
    const g = slabGrid(S);
    let a = 0;
    for (let j = 0; j < g.nz; j++) for (let i = 0; i < g.nx; i++) if (g.at(i, j) >= 0) a += (g.X[i + 1] - g.X[i]) * (g.Z[j + 1] - g.Z[j]);
    return +a.toFixed(2);
  };
  const m = (v) => +v.toFixed(2);
  return {
    level: lv, levels: b.levels.length, grid: b.grid, floorHeight: b.floorHeight,
    walls: L.walls.map((w) => ({ ...clone(w), length: m(wallLen(w)) })),
    slabs: L.slabs.map((s) => ({ ...clone(s), area: area(s) })),
    stairs: clone(L.stairs),
    columns: clone(L.columns ?? []),
    fences: b.fences.map((f) => ({ ...clone(f), gate: f.gates?.[0], length: m(Math.hypot(f.x1 - f.x0, f.z1 - f.z0)) })),
    limits: buildLimits(b),
    hint: b.hint ?? null,
    totals: {
      area: b.levels.map((l) => slabArea(l.slabs)),
      areaTotal: m(b.levels.reduce((s, l) => s + slabArea(l.slabs), 0)),
      wallMetres: m(b.levels.reduce((s, l) => s + l.walls.reduce((q, w) => q + wallLen(w), 0), 0)),
      levelWallMetres: m(L.walls.reduce((q, w) => q + wallLen(w), 0)),
      fenceMetres: m(b.fences.reduce((s, f) => s + Math.hypot(f.x1 - f.x0, f.z1 - f.z0), 0)),
      walls: b.levels.reduce((s, l) => s + l.walls.length, 0),
      openings: b.levels.reduce((s, l) => s + l.walls.reduce((q, w) => q + w.openings.length, 0), 0),
      fences: b.fences.length,
      columns: b.levels.reduce((s, l) => s + (l.columns?.length ?? 0), 0),
    },
  };
}

// ---- edit operations (mutate the build they are given; return a result or false) -------------------
const lvlOk = (b, level) => Number.isInteger(level) && level >= 0 && level < b.levels.length;
const cleanWallOpts = (o = {}) => {
  const out = {};
  if (o.t !== undefined) out.t = num(o.t, 0.1, 0.3, 0.2);
  if (o.h !== undefined) out.h = o.h === null ? null : num(o.h, 0.5, 5.2, null);
  if (o.ext !== undefined) out.ext = !!o.ext;
  if (isHex(o.inColor)) out.inColor = o.inColor;
  if (isHex(o.outColor)) out.outColor = o.outColor;
  if (WALL_FINISHES.includes(o.finish)) out.finish = o.finish;
  return out;
};

// Move wall nodes while keeping the house orthogonal: a wall that is horizontal / vertical keeps its direction,
// so the node at its other end slides with the perpendicular part of the move (and so on down the chain).
function moveNodes(b, L, seeds) {
  const disp = new Map();   // nodeKey -> { x, z, dx, dz }
  const queue = [];
  const put = (x, z, dx, dz) => {
    const k = nodeKey(x, z);
    let d = disp.get(k);
    if (!d) { d = { x, z, dx: null, dz: null }; disp.set(k, d); }
    let changed = false;
    if (dx !== null && d.dx === null) { d.dx = dx; changed = true; }
    if (dz !== null && d.dz === null) { d.dz = dz; changed = true; }
    if (changed) queue.push(k);
  };
  for (const sd of seeds) put(sd.x, sd.z, Math.abs(sd.dx) > 1e-9 ? sd.dx : null, Math.abs(sd.dz) > 1e-9 ? sd.dz : null);
  const nodes = new Map();
  for (const w of L.walls) for (const e of [0, 1]) {
    const k = nodeKey(e ? w.x1 : w.x0, e ? w.z1 : w.z0);
    if (!nodes.has(k)) nodes.set(k, []);
    nodes.get(k).push({ w, e });
  }
  let guard = 0;
  while (queue.length && guard++ < 2000) {
    const k = queue.shift();
    const d = disp.get(k);
    for (const { w, e } of nodes.get(k) ?? []) {
      const ox = e ? w.x0 : w.x1, oz = e ? w.z0 : w.z1;
      const horiz = Math.abs(w.z1 - w.z0) < 0.005, vert = Math.abs(w.x1 - w.x0) < 0.005;
      // the other end must follow the component that would otherwise tilt the wall
      if (horiz && !vert && d.dz !== null) put(ox, oz, null, d.dz);
      else if (vert && !horiz && d.dx !== null) put(ox, oz, d.dx, null);
    }
  }
  const moved = [];
  for (const w of L.walls) {
    for (const e of [0, 1]) {
      const d = disp.get(nodeKey(e ? w.x1 : w.x0, e ? w.z1 : w.z0));
      if (!d) continue;
      const nx = r2((e ? w.x1 : w.x0) + (d.dx ?? 0)), nz = r2((e ? w.z1 : w.z0) + (d.dz ?? 0));
      if (e) { w.x1 = nx; w.z1 = nz; } else { w.x0 = nx; w.z0 = nz; }
      if (!moved.includes(w)) moved.push(w);
    }
  }
  if (moved.some((w) => wallLen(w) < MIN_WALL)) return fail('tooShort');
  for (const w of moved) fitOpenings(w, b.floorHeight);
  const touched = new Set();
  for (const d of disp.values()) { touched.add(nodeKey(d.x, d.z)); touched.add(nodeKey(d.x + (d.dx ?? 0), d.z + (d.dz ?? 0))); }
  splitWalls(b, L);
  mergeWalls(L, touched);
  return true;
}

export const ops = {
  __reset() { reason = ''; },
  addWall(b, level, x0, z0, x1, z1, opts = {}) {
    if (!lvlOk(b, level)) return false;
    const c = [x0, z0, x1, z1].map(fin);
    if (!c.every(Number.isFinite)) return false;
    const L = b.levels[level];
    const w = { id: mkId(b), x0: r2(c[0]), z0: r2(c[1]), x1: r2(c[2]), z1: r2(c[3]), t: 0.2, h: null, ext: false, ...cleanWallOpts(opts), openings: [] };
    if (w.h !== null && w.h !== undefined) w.h = +Math.min(b.floorHeight + WALL_H_EXTRA, w.h).toFixed(2);
    if (w.h !== null && Math.abs(w.h - b.floorHeight) < 0.005) w.h = null;
    if (wallLen(w) < MIN_WALL) return fail('tooShort');
    if (L.walls.length + 1 > BL.walls) return fail('limit');
    L.walls.push(w);
    const touched = new Set([nodeKey(w.x0, w.z0), nodeKey(w.x1, w.z1)]);
    splitWalls(b, L);
    mergeWalls(L, touched);
    if (L.walls.length > BL.walls) return false;
    return w.id;
  },
  moveWallEnd(b, id, end, x, z) {
    const f = findWall(b, id);
    const nx = fin(x), nz = fin(z);
    if (!f || !Number.isFinite(nx) || !Number.isFinite(nz)) return fail('badValue');
    const e = end === 1 || end === 'b' || end === 'B' ? 1 : 0;
    const ox = e ? f.w.x1 : f.w.x0, oz = e ? f.w.z1 : f.w.z0;
    const px = r2(nx), pz = r2(nz);
    if (Math.abs(px - ox) < 1e-6 && Math.abs(pz - oz) < 1e-6) return false;
    return moveNodes(b, f.L, [{ x: ox, z: oz, dx: px - ox, dz: pz - oz }]);
  },
  moveWallBy(b, id, dx, dz) {
    const f = findWall(b, id);
    const mx = fin(dx), mz = fin(dz);
    if (!f || !Number.isFinite(mx) || !Number.isFinite(mz) || (Math.abs(mx) < 1e-6 && Math.abs(mz) < 1e-6)) return false;
    const w = f.w;
    return moveNodes(b, f.L, [{ x: w.x0, z: w.z0, dx: mx, dz: mz }, { x: w.x1, z: w.z1, dx: mx, dz: mz }]);
  },
  // Make a wall `len` metres long keeping the end named by `anchor` ('a' = first end stays, 'b' = second end stays).
  // Connected perpendicular walls slide along (the house stays square).
  setWallLength(b, id, len, anchor = 'a') {
    const f = findWall(b, id);
    const L2 = fin(len);
    if (!f || !Number.isFinite(L2)) return fail('badValue');
    if (L2 < MIN_WALL) return fail('tooShort');
    const w = f.w, cur = wallLen(w);
    if (Math.abs(L2 - cur) < 0.005) return false;
    const dx = (w.x1 - w.x0) / cur, dz = (w.z1 - w.z0) / cur;
    if (anchor === 'b' || anchor === 'B' || anchor === 1) return moveNodes(b, f.L, [{ x: w.x0, z: w.z0, dx: r2(w.x1 - dx * L2) - w.x0, dz: r2(w.z1 - dz * L2) - w.z0 }]);
    return moveNodes(b, f.L, [{ x: w.x1, z: w.z1, dx: r2(w.x0 + dx * L2) - w.x1, dz: r2(w.z0 + dz * L2) - w.z1 }]);
  },
  setWall(b, id, patch) {
    const f = findWall(b, id);
    if (!f || !plainObj(patch)) return false;
    const before = JSON.stringify(f.w);
    const o = cleanWallOpts(patch);
    for (const k of ['inColor', 'outColor', 'finish']) if (patch[k] === null) delete f.w[k];
    Object.assign(f.w, o);
    if (f.w.h !== null && f.w.h !== undefined) f.w.h = +Math.min(b.floorHeight + WALL_H_EXTRA, f.w.h).toFixed(2);
    if (f.w.h !== null && f.w.h !== undefined && Math.abs(f.w.h - b.floorHeight) < 0.005) f.w.h = null;
    fitOpenings(f.w, b.floorHeight);
    return JSON.stringify(f.w) !== before;
  },
  removeWall(b, id) {
    const f = findWall(b, id);
    if (!f) return false;
    const touched = new Set([nodeKey(f.w.x0, f.w.z0), nodeKey(f.w.x1, f.w.z1)]);
    f.L.walls = f.L.walls.filter((w) => w !== f.w);
    mergeWalls(f.L, touched);
    return true;
  },
  addOpening(b, wallId, kind, at, opts = {}) {
    const f = findWall(b, wallId);
    if (!f || !OPENING_KINDS.includes(kind)) return false;
    const w = f.w;
    if (w.openings.length >= BL.openings) return fail('limit');
    const len = wallLen(w), d = OPEN_DEFAULTS[kind], FH = b.floorHeight;
    const ow = +num(opts.w, 0.4, 6, d.w).toFixed(2);
    if (ow > len - 0.3) return fail('noFit');
    const sill = +num(opts.sill, 0, FH - 0.7, d.sill).toFixed(2);
    const maxTop = Math.min(FH - 0.3, (w.h ?? FH) - 0.1);
    const oh = +num(opts.h, 0.4, Math.max(0.4, maxTop - sill), Math.min(d.h, Math.max(0.4, maxTop - sill))).toFixed(2);
    const pos = num(at, ow / 2 + 0.12, len - ow / 2 - 0.12, len / 2);
    if (w.openings.some((p) => Math.abs(p.at - pos) < (p.w + ow) / 2 + 0.08)) return fail('overlap');
    const o = { id: mkId(b), kind, at: r2(pos), w: ow, h: oh, sill, style: OPENING_STYLES.includes(opts.style) ? opts.style : null };
    if (opts.top === 'arch' || opts.top === 'flat') o.top = opts.top;
    if (typeof opts.bars === 'boolean') o.bars = opts.bars;
    w.openings.push(o);
    w.openings.sort((p, c) => p.at - c.at);
    return o.id;
  },
  setOpening(b, wallId, openingId, patch) {
    const f = findWall(b, wallId);
    const o = f?.w.openings.find((x) => x.id === openingId);
    if (!o || !plainObj(patch)) return false;
    const before = JSON.stringify(f.w.openings);
    const len = wallLen(f.w), FH = b.floorHeight;
    const next = { ...o };
    if (patch.kind !== undefined) { if (!OPENING_KINDS.includes(patch.kind)) return false; next.kind = patch.kind; }
    if (patch.w !== undefined) next.w = +num(patch.w, 0.4, Math.min(6, len - 0.3), o.w).toFixed(2);
    if (patch.sill !== undefined) next.sill = +num(patch.sill, 0, FH - 0.7, o.sill).toFixed(2);
    const maxTop = Math.min(FH - 0.3, (f.w.h ?? FH) - 0.1);
    if (patch.h !== undefined) next.h = +num(patch.h, 0.4, Math.max(0.4, maxTop - next.sill), o.h).toFixed(2);
    next.h = Math.min(next.h, Math.max(0.4, maxTop - next.sill));
    if (patch.at !== undefined) next.at = r2(num(patch.at, next.w / 2 + 0.12, len - next.w / 2 - 0.12, o.at));
    else next.at = r2(num(next.at, next.w / 2 + 0.12, len - next.w / 2 - 0.12, o.at));
    if (patch.style !== undefined) next.style = OPENING_STYLES.includes(patch.style) ? patch.style : null;
    if (patch.top !== undefined) { if (patch.top === 'arch' || patch.top === 'flat') next.top = patch.top; else delete next.top; }
    if (patch.bars !== undefined) { if (typeof patch.bars === 'boolean') next.bars = patch.bars; else delete next.bars; }
    if (f.w.openings.some((p) => p !== o && Math.abs(p.at - next.at) < (p.w + next.w) / 2 + 0.08)) return false;
    Object.assign(o, next);
    f.w.openings.sort((p, c) => p.at - c.at);
    return JSON.stringify(f.w.openings) !== before;
  },
  removeOpening(b, wallId, openingId) {
    const f = findWall(b, wallId);
    if (!f) return false;
    const n = f.w.openings.length;
    f.w.openings = f.w.openings.filter((o) => o.id !== openingId);
    return f.w.openings.length < n;
  },
  addSlab(b, level, rect = {}) {
    if (!lvlOk(b, level) || !plainObj(rect)) return false;
    const c = ['x0', 'z0', 'x1', 'z1'].map((k) => fin(rect[k]));
    if (!c.every(Number.isFinite)) return false;
    const L = b.levels[level];
    if (L.slabs.length >= BL.slabs) return false;
    const s = { id: mkId(b), x0: r2(Math.min(c[0], c[2])), z0: r2(Math.min(c[1], c[3])), x1: r2(Math.max(c[0], c[2])), z1: r2(Math.max(c[1], c[3])), finish: pick(rect.finish, floorIds, b.defaultFinish ?? 'porcelanato') };
    if (s.x1 - s.x0 < 0.5 || s.z1 - s.z0 < 0.5) return false;
    if (toneIds.includes(rect.tone)) s.tone = rect.tone;
    if (patternIds.includes(rect.pattern)) s.pattern = rect.pattern;
    if (tileSizeIds.includes(rect.tileSize)) s.tileSize = rect.tileSize;
    if (rect.raised === false) s.raised = false;
    if (SLAB_KINDS.includes(rect.kind)) s.kind = rect.kind;
    if (s.kind === 'carport') { s.raised = false; if (!rect.finish) s.finish = 'cemento'; }
    L.slabs.push(s);
    return s.id;
  },
  setSlab(b, id, patch) {
    if (!plainObj(patch)) return false;
    for (const L of b.levels) {
      const s = L.slabs.find((x) => x.id === id);
      if (!s) continue;
      const before = JSON.stringify(s);
      const n = { ...s };
      for (const k of ['x0', 'z0', 'x1', 'z1']) if (patch[k] !== undefined) { const v = fin(patch[k]); if (!Number.isFinite(v)) return false; n[k] = r2(v); }
      [n.x0, n.x1] = [Math.min(n.x0, n.x1), Math.max(n.x0, n.x1)];
      [n.z0, n.z1] = [Math.min(n.z0, n.z1), Math.max(n.z0, n.z1)];
      if (n.x1 - n.x0 < 0.5 || n.z1 - n.z0 < 0.5) return false;
      if (patch.finish !== undefined) { if (!floorIds.includes(patch.finish)) return false; n.finish = patch.finish; }
      if (patch.raised !== undefined) { if (patch.raised === false) n.raised = false; else delete n.raised; }
      if (patch.kind !== undefined) { if (SLAB_KINDS.includes(patch.kind)) n.kind = patch.kind; else delete n.kind; }
      if (n.kind === 'carport' && patch.kind === 'carport') { n.raised = false; if (patch.finish === undefined) n.finish = 'cemento'; }
      for (const [k, list] of [['tone', toneIds], ['pattern', patternIds], ['tileSize', tileSizeIds]]) {
        if (patch[k] === undefined) continue;
        if (patch[k] === null) delete n[k]; else if (list.includes(patch[k])) n[k] = patch[k]; else return false;
      }
      Object.assign(s, n);
      for (const k of ['tone', 'pattern', 'tileSize', 'raised', 'kind']) if (!(k in n)) delete s[k];
      return JSON.stringify(s) !== before;
    }
    return false;
  },
  removeSlab(b, id) {
    for (const L of b.levels) {
      const n = L.slabs.length;
      L.slabs = L.slabs.filter((s) => s.id !== id);
      if (L.slabs.length < n) return true;
    }
    return false;
  },
  // opts.shell === false: an empty level (Piezas mode, rooms are dropped on it); else copy the outer ring + slabs.
  addLevel(b, opts = {}) {
    if (b.levels.length >= BL.levels) return fail('levelsMax');
    if (opts?.shell === false) { b.levels.push(emptyLevel()); return b.levels.length - 1; }
    const below = b.levels[b.levels.length - 1];
    const L = emptyLevel();
    const used = allIds(b);
    const ring = below.walls.filter((w) => w.ext);
    for (const w of ring) L.walls.push({ ...clone(w), id: mkId(b, used), openings: w.openings.filter((o) => o.kind !== 'door' && o.kind !== 'garage' && o.kind !== 'arch').map((o) => ({ ...clone(o), id: mkId(b, used) })) });
    // Slabs of the level above start as a copy of the one below, minus the stair hole it leaves for itself.
    for (const s of below.slabs) if (!s.kind) L.slabs.push({ ...clone(s), id: mkId(b, used) });
    b.levels.push(L);
    return b.levels.length - 1;
  },
  removeLevel(b) {
    if (b.levels.length <= 1) return false;
    b.levels.pop();
    b.levels[b.levels.length - 1].stairs = [];
    b.rooms = b.rooms.filter((a) => +a.key[0] < b.levels.length);
    return true;
  },
  addStairs(b, level, x, z, rot = 0, opts = {}) {
    if (!lvlOk(b, level)) return false;
    const px = fin(x), pz = fin(z);
    if (!Number.isFinite(px) || !Number.isFinite(pz)) return false;
    if (level >= b.levels.length - 1) return fail(b.levels.length >= BL.levels ? 'levelsMax' : 'needLevel');
    const L = b.levels[level];
    if (L.stairs.length >= BL.stairs) return false;
    const k = Math.round((fin(rot) || 0) / (Math.PI / 2));
    const s = { id: mkId(b), x: r2(px), z: r2(pz), rot: (((k % 4) + 4) % 4) * (Math.PI / 2), w: +num(opts.w, 0.7, 2.2, 1.0).toFixed(2) };
    if (Number.isFinite(fin(opts.len))) s.len = +num(opts.len, 1.5, 8, 4.5).toFixed(2);
    L.stairs.push(s);
    return s.id;
  },
  setStairs(b, id, patch) {
    if (!plainObj(patch)) return false;
    for (const L of b.levels) {
      const s = L.stairs.find((x) => x.id === id);
      if (!s) continue;
      const before = JSON.stringify(s);
      if (patch.x !== undefined && Number.isFinite(fin(patch.x))) s.x = r2(fin(patch.x));
      if (patch.z !== undefined && Number.isFinite(fin(patch.z))) s.z = r2(fin(patch.z));
      if (patch.rot !== undefined && Number.isFinite(fin(patch.rot))) { const k = Math.round(fin(patch.rot) / (Math.PI / 2)); s.rot = (((k % 4) + 4) % 4) * (Math.PI / 2); }
      if (patch.w !== undefined) s.w = +num(patch.w, 0.7, 2.2, s.w).toFixed(2);
      if (patch.len !== undefined) { if (patch.len === null) delete s.len; else s.len = +num(patch.len, 1.5, 8, 4.5).toFixed(2); }
      return JSON.stringify(s) !== before;
    }
    return false;
  },
  removeStairs(b, id) {
    for (const L of b.levels) {
      const n = L.stairs.length;
      L.stairs = L.stairs.filter((s) => s.id !== id);
      if (L.stairs.length < n) return true;
    }
    return false;
  },
  // Columns (v5): x / z house-local centre; opts / patch { s, h } (h null = floor height).
  addColumn(b, level, x, z, opts = {}) {
    if (!lvlOk(b, level)) return false;
    const px = fin(x), pz = fin(z);
    if (!Number.isFinite(px) || !Number.isFinite(pz)) return fail('badValue');
    const L = b.levels[level];
    L.columns ??= [];
    if (L.columns.length >= BL.columns) return fail('limit');
    if (L.columns.some((c) => Math.hypot(c.x - px, c.z - pz) < 0.05)) return fail('overlap');
    const c = { id: mkId(b), x: r2(px), z: r2(pz), s: +num(opts.s, 0.2, 0.6, 0.3).toFixed(2), h: opts.h == null ? null : +num(opts.h, 0.5, b.floorHeight + WALL_H_EXTRA, b.floorHeight).toFixed(2) };
    if (c.h !== null && Math.abs(c.h - b.floorHeight) < 0.005) c.h = null;
    L.columns.push(c);
    return c.id;
  },
  setColumn(b, id, patch) {
    if (!plainObj(patch)) return false;
    for (const L of b.levels) {
      const c = (L.columns ?? []).find((q) => q.id === id);
      if (!c) continue;
      const before = JSON.stringify(c);
      for (const k of ['x', 'z']) if (patch[k] !== undefined) { const v = fin(patch[k]); if (!Number.isFinite(v)) return fail('badValue'); c[k] = r2(v); }
      if (patch.s !== undefined) c.s = +num(patch.s, 0.2, 0.6, c.s).toFixed(2);
      if (patch.h !== undefined) c.h = patch.h === null ? null : +num(patch.h, 0.5, b.floorHeight + WALL_H_EXTRA, b.floorHeight).toFixed(2);
      if (c.h !== null && Math.abs(c.h - b.floorHeight) < 0.005) c.h = null;
      return JSON.stringify(c) !== before;
    }
    return fail('notFound');
  },
  removeColumn(b, id) {
    for (const L of b.levels) {
      const n = L.columns?.length ?? 0;
      L.columns = (L.columns ?? []).filter((c) => c.id !== id);
      if (L.columns.length < n) return true;
    }
    return fail('notFound');
  },
  setBuildRoof(b, patch) {
    if (!plainObj(patch)) return false;
    const before = JSON.stringify(b.roof);
    const r = b.roof;
    if (patch.type !== undefined) { if (!ROOF_TYPES.includes(patch.type)) return false; r.type = patch.type; }
    if (patch.material !== undefined) { if (!ROOF_MATERIALS.includes(patch.material)) return false; r.material = patch.material; }
    if (patch.color !== undefined) { if (!isHex(patch.color)) return false; r.color = patch.color; }
    if (patch.overhang !== undefined) r.overhang = +num(patch.overhang, 0, 1.5, r.overhang).toFixed(2);
    if (patch.parapet !== undefined) r.parapet = !!patch.parapet;
    return JSON.stringify(r) !== before;
  },
  addFence(b, x0, z0, x1, z1, opts = {}) {
    const c = [x0, z0, x1, z1].map(fin);
    if (!c.every(Number.isFinite) || b.fences.length >= BL.fences) return false;
    if (Math.hypot(c[2] - c[0], c[3] - c[1]) < 0.5) return false;
    const type = pick(opts.type, FENCE_TYPES, 'block');
    const f = { id: mkId(b), x0: r2(c[0]), z0: r2(c[1]), x1: r2(c[2]), z1: r2(c[3]), type, h: +num(opts.h, 0.4, 3.5, FENCE_DEFAULT_H[type]).toFixed(2), color: isHex(opts.color) ? opts.color : '#f7f5ef' };
    b.fences.push(f);
    return f.id;
  },
  setFence(b, id, patch) {
    const f = b.fences.find((x) => x.id === id);
    if (!f || !plainObj(patch)) return false;
    const before = JSON.stringify(f);
    for (const k of ['x0', 'z0', 'x1', 'z1']) if (patch[k] !== undefined) { const v = fin(patch[k]); if (!Number.isFinite(v)) return false; f[k] = r2(v); }
    if (Math.hypot(f.x1 - f.x0, f.z1 - f.z0) < 0.5) return false;
    if (patch.type !== undefined) { if (!FENCE_TYPES.includes(patch.type)) return false; f.type = patch.type; }
    if (patch.h !== undefined) f.h = +num(patch.h, 0.4, 3.5, f.h).toFixed(2);
    if (patch.color !== undefined) { if (!isHex(patch.color)) return false; f.color = patch.color; }
    if (patch.gate !== undefined || patch.gates !== undefined) {
      const g = patch.gates ?? (patch.gate === null ? [] : patch.gate ? [patch.gate] : []);
      f.gates = Array.isArray(g) ? g : [];
    }
    delete f.gate;
    {
      const len = Math.hypot(f.x1 - f.x0, f.z1 - f.z0);
      const gs = cleanGates(f.gates ?? [], len);
      if (gs.length) f.gates = gs; else delete f.gates;
    }
    return JSON.stringify(f) !== before;
  },
  removeFence(b, id) {
    const n = b.fences.length;
    b.fences = b.fences.filter((f) => f.id !== id);
    return b.fences.length < n;
  },
  // Adds a gate; a fence segment can have several. Fails only when too short for it or overlapping another gate.
  addGate(b, fenceId, at, kind = 'peatonal') {
    const f = b.fences.find((x) => x.id === fenceId);
    if (!f) return fail('notFound');
    const k = pick(kind, GATE_KINDS, 'peatonal');
    const len = Math.hypot(f.x1 - f.x0, f.z1 - f.z0);
    const gw = k === 'vehicular' ? 3.2 : 1.0;
    if (len < gw + 0.2) return fail('tooShort');
    const pos = +num(at, gw / 2 + 0.1, len - gw / 2 - 0.1, len / 2).toFixed(2);
    if ((f.gates ?? []).some((q) => Math.abs(q.at - pos) < (q.w + gw) / 2 + 0.1)) return fail('overlap');
    f.gates = [...(f.gates ?? []), { at: pos, w: gw, kind: k }].sort((p, q) => p.at - q.at);
    return true;
  },
  // Removes the gate nearest to `at` (metres along the fence), or all gates when `at` is omitted.
  removeGate(b, fenceId, at) {
    const f = b.fences.find((x) => x.id === fenceId);
    if (!f || !f.gates?.length) return false;
    if (at == null) delete f.gates;
    else {
      const i = f.gates.reduce((best, g, k) => (Math.abs(g.at - at) < Math.abs(f.gates[best].at - at) ? k : best), 0);
      f.gates.splice(i, 1);
      if (!f.gates.length) delete f.gates;
    }
    return true;
  },
  setBuildExtras(b, patch) {
    if (!plainObj(patch)) return false;
    b.extras ??= {};
    const before = JSON.stringify(b.extras);
    for (const k of EXTRA_KEYS) if (patch[k] !== undefined) b.extras[k] = !!patch[k];
    return JSON.stringify(b.extras) !== before;
  },
  setGrid(b, g) {
    const v = fin(g);
    if (!Number.isFinite(v)) return false;
    const best = GRIDS.reduce((a, c) => (Math.abs(c - v) < Math.abs(a - v) ? c : a), 0.5);
    if (b.grid === best) return false;
    b.grid = best;
    return true;
  },
};

// Keep openings that still fit after a wall changed length / height.
function fitOpenings(w, FH) {
  const len = wallLen(w);
  const maxTop = Math.min(FH - 0.3, (w.h ?? FH) - 0.1);
  const out = [];
  for (const o of w.openings) {
    const h = Math.min(o.h, maxTop - o.sill);
    if (o.w > len - 0.3 || h < 0.4) continue;
    const at = Math.min(len - o.w / 2 - 0.12, Math.max(o.w / 2 + 0.12, o.at));
    if (out.some((p) => Math.abs(p.at - at) < (p.w + o.w) / 2 + 0.08)) continue;
    out.push({ ...o, h: +h.toFixed(2), at: r2(at) });
  }
  w.openings = out;
}

// A slab with no wall of its level standing on it (an open terrace / pad): no posts, no roof of its own.
export function slabHasWalls(L, s) {
  return L.walls.some((w) => { const mx = (w.x0 + w.x1) / 2, mz = (w.z0 + w.z1) / 2; return mx >= s.x0 - 0.3 && mx <= s.x1 + 0.3 && mz >= s.z0 - 0.3 && mz <= s.z1 + 0.3; });
}

export { findWall, nodeKey, endKeys, pointInPoly, polyArea, mkId, isHex, r2, fail, moveNodes, fitOpenings, clone as bclone };

// Bounding box (house-local) of everything built, or null.
export function buildBBox(b) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const L of b.levels) {
    for (const w of L.walls) { x0 = Math.min(x0, w.x0, w.x1); x1 = Math.max(x1, w.x0, w.x1); z0 = Math.min(z0, w.z0, w.z1); z1 = Math.max(z1, w.z0, w.z1); }
    for (const s of L.slabs) { x0 = Math.min(x0, s.x0); x1 = Math.max(x1, s.x1); z0 = Math.min(z0, s.z0); z1 = Math.max(z1, s.z1); }
    for (const c of L.columns ?? []) { x0 = Math.min(x0, c.x - c.s / 2); x1 = Math.max(x1, c.x + c.s / 2); z0 = Math.min(z0, c.z - c.s / 2); z1 = Math.max(z1, c.z + c.s / 2); }
  }
  return Number.isFinite(x0) ? { x0, x1, z0, z1 } : null;
}

// The raised-less ground slab (carport / parking pad), the biggest one, or null.
export function buildPad(b) {
  let best = null;
  for (const s of b.levels[0].slabs) if ((s.raised === false || s.kind === 'carport') && (!best || (s.x1 - s.x0) * (s.z1 - s.z0) > (best.x1 - best.x0) * (best.z1 - best.z0))) best = s;
  return best;
}
// The main entrance: the front-most ground door / slider on an exterior wall, as a house-local point + width.
export function buildEntry(b) {
  let best = null;
  for (const w of b.levels[0].walls) {
    if (!w.ext) continue;
    const len = wallLen(w);
    for (const o of w.openings) {
      if (o.kind !== 'door' && o.kind !== 'slider') continue;
      const x = w.x0 + ((w.x1 - w.x0) / len) * o.at, z = w.z0 + ((w.z1 - w.z0) / len) * o.at;
      if (!best || z > best.z) best = { x, z, w: o.w };
    }
  }
  return best;
}

// Walkway (door -> pedestrian gate) and driveway (carport -> vehicle gate) for a hand-built house, as lot-local
// rectangles { x, z, w, d } (centre + size). Nothing is placed under fence panels: paths end at a gate, or at the lot edge.
export function yardPlanOf(s) {
  const b = s.build, h = s.house;
  const ox = h.offsetX, oz = h.offsetZ, front = s.land.depth / 2;
  const rects = { walk: [], drive: [] };
  const seg = (arr, x0, z0, x1, z1, w) => {
    if (Math.abs(x1 - x0) < 0.01 && Math.abs(z1 - z0) < 0.01) return;
    arr.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0) < 0.01 ? w : Math.abs(x1 - x0) + w, d: Math.abs(z1 - z0) < 0.01 ? w : Math.abs(z1 - z0) });
  };
  const gateOf = (kind, near) => {
    let best = null;
    for (const f of b.fences) {
      const len = Math.hypot(f.x1 - f.x0, f.z1 - f.z0);
      for (const g of f.gates ?? []) {
        if (g.kind !== kind) continue;
        const x = f.x0 + ((f.x1 - f.x0) / len) * g.at, z = f.z0 + ((f.z1 - f.z0) / len) * g.at;
        if (!best || Math.abs(x - near) < Math.abs(best.x - near)) best = { x, z, w: g.w };
      }
    }
    return best;
  };
  const entry = buildEntry(b);
  if (entry) {
    const ex = ox + entry.x;
    let zEdge = entry.z + 0.3;
    for (const q of b.levels[0].slabs) if (q.kind === 'porch' && q.raised !== false && entry.x > q.x0 && entry.x < q.x1 && entry.z <= q.z1) zEdge = Math.max(zEdge, q.z1);
    const sz = oz + zEdge + 0.9;
    const g = gateOf('peatonal', ex);
    const w = 1.3;
    if (g && sz < g.z - 0.5) {
      const zm = Math.max(sz, g.z - 2.2);
      seg(rects.walk, ex, sz, ex, zm, w);
      seg(rects.walk, ex, zm, g.x, zm, w);
      seg(rects.walk, g.x, zm, g.x, g.z, w);
    } else if (!g && sz < front - 0.3) seg(rects.walk, ex, sz, ex, front, w);
  }
  const pad = buildPad(b);
  if (pad) {
    const px = ox + (pad.x0 + pad.x1) / 2, pz = oz + pad.z1, pw = Math.min(pad.x1 - pad.x0, 3.6);
    const g = gateOf('vehicular', px);
    if (g && pz < g.z - 0.5) {
      const zm = Math.max(pz, g.z - 3.0);
      seg(rects.drive, px, pz, px, zm, pw);
      seg(rects.drive, px, zm, g.x, zm, Math.max(pw, 3.2));
      seg(rects.drive, g.x, zm, g.x, g.z, Math.min(g.w, 3.4));
    } else if (!g && pz < front) seg(rects.drive, px, pz, px, front, pw);
  }
  return rects;
}

// What the camera / sun code should see as "the house" in build mode: the built footprint (bounding box);
// with { lot: true } the yard + land + pool code gets a house centred on the entrance door and carport info.
// The house group itself keeps using the real offsets. Auto mode returns the state itself.
export function effectiveState(s, { lot = false } = {}) {
  if (s.mode !== 'build' || !s.build) return s;
  const bb = buildBBox(s.build);
  if (!bb) return s;
  const h = s.house;
  let cx = (bb.x0 + bb.x1) / 2, w = Math.max(2, bb.x1 - bb.x0);
  let carport = false, carportSide = 'right';
  if (lot) {
    const entry = buildEntry(s.build), pad = buildPad(s.build);
    if (entry) { cx = entry.x; w = 2 * Math.max(Math.abs(bb.x0 - cx), Math.abs(bb.x1 - cx), 2); }
    if (pad) { carport = true; carportSide = (pad.x0 + pad.x1) / 2 >= cx ? 'right' : 'left'; }
  }
  return {
    ...s,
    ...(lot ? { yardPlan: yardPlanOf(s), yard: { ...s.yard, garden: false } } : {}),
    house: {
      ...h,
      width: w, depth: Math.max(2, bb.z1 - bb.z0),
      offsetX: h.offsetX + cx, offsetZ: h.offsetZ + (bb.z0 + bb.z1) / 2,
      porch: false, carport, carportSide, waterTank: false, roofTerrace: false,
    },
  };
}
