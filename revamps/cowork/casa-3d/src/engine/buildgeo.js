// Build mode geometry: walls with mitred joints and real openings, slabs, stairs, posts, railings, rooms.
// Produces the same group shape as buildHouse (layers f{i}, in{i}, cap{i}, roof, labelGroup, rooms, segments,
// lights...) so cutaway, walk, plan view, picks, lights and photo keep working. Roofs: buildroof.js.
import { Shape, Path, ExtrudeGeometry, ShapeGeometry, BufferGeometry, Float32BufferAttribute, Vector2, Vector3, Group, Sprite, SpriteMaterial, TorusGeometry, CylinderGeometry, PlaneGeometry, LatheGeometry, ShapeUtils, Matrix4, DoubleSide } from 'three';
import { createBuilder, mat4 } from './builder.js';
import { P, FLOOR_T, roomName } from './layout.js';
import { labelCanvas, makeTexture } from './textures.js';
import { floorSpec, normalizeFloor } from './floors.js';
import { kit, furnitureSlots, ceilingLight } from './indoor.js';
import { buildRoof } from './buildroof.js';
import { slabHasWalls, wallFrames, slabGrid, gridRects, gridEdges, wallLen, refreshRooms, roomContains, buildPad, buildBBox, buildEntry, SLAB_T, OPEN_DEFAULTS } from './buildmodel.js';

const IRON = '#2c2c2c';
const ALUMINUM = '#c9ccd0';
const CUT = 1.35;          // cutaway height above each floor
const PAD_TOP = 0.1;
const PORCH_DROP = 0.3;   // separate porch / carport roofs sit this far below the main eave       // top of a ground slab that is not raised (carport pad)
const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

// ---- triangle soup: fast flat-shaded faces, flushed once per bucket into a layer builder ------------
class Soup {
  constructor(layer) { this.layer = layer; this.m = new Map(); }
  tri(key, opts, a, b, c, n, uv) {
    let s = this.m.get(key);
    if (!s) { s = { opts, pos: [], nor: [], uv: uv ? [] : null }; this.m.set(key, s); }
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * cx + cy * cy + cz * cz < 1e-14) return;
    const flip = cx * n[0] + cy * n[1] + cz * n[2] < 0;
    const p2 = flip ? c : b, p3 = flip ? b : c;
    s.pos.push(a[0], a[1], a[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2]);
    if (s.uv && uv) { const u2 = flip ? uv[2] : uv[1], u3 = flip ? uv[1] : uv[2]; s.uv.push(uv[0][0], uv[0][1], u2[0], u2[1], u3[0], u3[1]); }
    for (let i = 0; i < 3; i++) s.nor.push(n[0], n[1], n[2]);
  }
  quad(key, opts, a, b, c, d, n) { this.tri(key, opts, a, b, c, n); this.tri(key, opts, a, c, d, n); }
  flush() {
    for (const [key, s] of this.m) {
      if (!s.pos.length) continue;
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(s.pos, 3));
      g.setAttribute('normal', new Float32BufferAttribute(s.nor, 3));
      if (s.uv) g.setAttribute('uv', new Float32BufferAttribute(s.uv, 2));
      this.layer.add(key, g, null, s.opts);
    }
    this.m.clear();
  }
}

// Outline of an opening (rect, or rect with a half-circle top) as a closed (u, y) polyline.
function outlinePts(x, y, w, h, arched, n = 14) {
  if (!arched) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const r = w / 2, top = y + h - r;
  const pts = [[x, y], [x + w, y], [x + w, top]];
  for (let i = 1; i < n; i++) { const a = (i / n) * Math.PI; pts.push([x + r + r * Math.cos(a), top + r * Math.sin(a)]); }
  pts.push([x, top]);
  return pts;
}
function outline(p, x, y, w, h, arched) {
  const pts = outlinePts(x, y, w, h, arched, 16);
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  p.lineTo(pts[0][0], pts[0][1]);
  return p;
}
function ring(w, h, arched, inset, depth) {
  const s = outline(new Shape(), 0, 0, w, h, arched);
  s.holes.push(outline(new Path(), inset, inset, w - 2 * inset, h - 2 * inset, arched));
  return new ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 16 });
}

// Triangulate a (u, y) polygon with holes and emit it on a plane via map(u, y) -> [x, y, z].
function faceUY(soup, key, opts, map, nrm, contour, holes = []) {
  const pts = contour.map((p) => new Vector2(p[0], p[1]));
  const hs = holes.map((h) => h.map((p) => new Vector2(p[0], p[1])));
  const tris = ShapeUtils.triangulateShape(pts, hs);
  const all = [...pts, ...hs.flat()];
  for (const [i, j, k] of tris) soup.tri(key, opts, map(all[i].x, all[i].y), map(all[j].x, all[j].y), map(all[k].x, all[k].y), nrm);
}

function balusterGeo() {
  const pts = [[0, 0], [0.055, 0], [0.055, 0.06], [0.035, 0.08], [0.03, 0.14], [0.058, 0.3], [0.062, 0.36], [0.04, 0.46], [0.027, 0.6], [0.034, 0.7], [0.05, 0.74], [0.05, 0.8], [0, 0.8]];
  return new LatheGeometry(pts.map(([x, y]) => new Vector2(x, y)), 8);
}

// `hide` = ids left out of the geometry (engine.dropAnim draws them separately while they settle in).
export function buildBuildHouse(state, mats, lang = 'es', { interiors = true, interiorLevels = null, hide = null } = {}) {
  const h = state.house, I = state.interior ?? {}, b = state.build;
  const FH = b.floorHeight, NL = b.levels.length;
  const C = h.colors;
  const modern = h.style === 'moderna';
  const fancy = h.style === 'colonial' || h.style === 'caribena';
  const railStyle = ['iron', 'balusters', 'glass', 'concrete'].includes(h.railing) ? h.railing : 'iron';
  const doorStyleDef = ['panel', 'double', 'glass'].includes(h.doorStyle) ? h.doorStyle : 'panel';
  const winStyleDef = ['standard', 'tall', 'arched', 'louvered'].includes(h.windowStyle) ? h.windowStyle : 'standard';
  const H = FH - SLAB_T;            // clear room height under the next slab
  const y0Of = (li) => P + li * FH;
  const defWall = isHex(I.wallColor) ? I.wallColor : '#f5f2ec';

  // ---- materials (same families as buildHouse) ----
  const M = {
    trim: { material: mats.paint(C.trim), part: 'trim' },
    base: { material: h.wallFinish === 'stone-base' ? mats.textured('stone', '#ffffff', { roughness: 0.95, normalScale: 1.2 }) : mats.paint(C.base, 'smooth', { grime: true }), part: 'base' },
    plinth: { material: mats.paint(C.base, 'smooth', { grime: true }), part: 'base' },
    door: { material: mats.textured('wood', C.door, { roughness: 0.6 }), part: 'door' },
    frame: { material: mats.plain(C.windows, { roughness: 0.45, metalness: 0.25 }), part: 'windows' },
    glass: { material: mats.glass(), part: 'windows' },
    glassWin: { material: mats.glass('window'), part: 'windows' },
    clear: { material: mats.clearGlass(), part: null, shadow: false },
    accent: { material: mats.textured('wood', C.accent, { roughness: 0.65 }), part: 'accent' },
    concrete: { material: mats.textured('concrete', '#d7d3cc'), part: null },
    slabBody: { material: mats.textured('concrete', '#cfcbc4'), part: null },
    iron: { material: mats.plain(IRON, { roughness: 0.5, metalness: 0.6 }), part: null },
    alu: { material: mats.plain(ALUMINUM, { roughness: 0.35, metalness: 0.8 }), part: null },
    casing: { material: mats.plain('#f7f6f2', { roughness: 0.55 }), part: null },
    leaf: { material: mats.wood(I.wood), part: null },
    ceiling: { material: mats.plain('#f8f7f3', { roughness: 0.95 }), part: null, shadow: false },
    plaster: { material: mats.paint('#ece8e1', 'smooth', { soft: true }), part: null },
    tread: { material: mats.wood(I.wood), part: null },
    garage: { material: mats.plain('#e8e5de', { roughness: 0.55, metalness: 0.15 }), part: 'door' },
    cap: { material: mats.plain('#5d615f', { roughness: 0.9 }), part: null, shadow: false },
  };
  const top = y0Of(NL - 1) + FH;
  const FS = furnitureSlots(mats, I, () => null);
  const outFinishId = (w) => w.finish ?? (h.wallFinish === 'block' ? 'block' : 'smooth');
  const outPaint = (w) => {
    const f = outFinishId(w);
    const color = isHex(w.outColor) ? w.outColor : f === 'brick' ? '#b9694d' : C.walls;
    if (f === 'stone') return { material: mats.textured('stone', '#ffffff', { roughness: 0.95, normalScale: 1.2 }), part: 'walls', k: 'stone' };
    if (f === 'brick') return { material: mats.textured('brick', color, { roughness: 0.9, normalScale: 1 }), part: 'walls', k: `brick${color}` };
    return { material: mats.paint(color, f === 'block' ? 'block' : 'smooth', { grime: true }), part: 'walls', k: `${f}${color}` };
  };
  const inBase = (w) => { const c = isHex(w.inColor) ? w.inColor : defWall; return { material: mats.paint(c, 'smooth', { soft: true }), part: null, k: c }; };
  const ov = (r) => (r && I.rooms && typeof I.rooms === 'object' && I.rooms[r.key]) || {};
  const roomWall = (r, w) => { const c = isHex(w?.inColor) ? w.inColor : isHex(ov(r).wall) ? ov(r).wall : defWall; return { material: mats.paint(c, 'smooth', { soft: true }), part: r ? `room:${r.key}` : null, k: c }; };
  const specOf = (slab, r) => {
    const base = { floor: slab.finish ?? I.floor, floorTone: slab.tone ?? I.floorTone, floorPattern: slab.pattern ?? I.floorPattern, tileSize: slab.tileSize ?? I.tileSize, baseboard: I.baseboard };
    const o = ov(r);
    return normalizeFloor({ floor: o.floor ?? base.floor, floorTone: o.floorTone ?? base.floorTone, floorPattern: o.floorPattern ?? base.floorPattern, tileSize: o.tileSize ?? base.tileSize, baseboard: o.baseboard ?? base.baseboard });
  };

  // ---- layers ----
  const layers = { roof: createBuilder() };
  for (let i = 0; i < NL; i++) {
    layers[`f${i}`] = createBuilder();
    layers[`in${i}`] = createBuilder({ skip: !interiors || (interiorLevels != null && i > interiorLevels) });
    layers[`cap${i}`] = createBuilder();
  }
  const soups = {};
  const soup = (name) => (soups[name] ??= new Soup(layers[name]));
  const segments = [], labels = [], lights = [];
  const BAL = balusterGeo();

  // ---- rooms (closed wall loops over a slab) ----
  const rooms = refreshRooms({ ...b, rooms: b.rooms.slice() });
  const roomAt = (li, x, z) => rooms.find((r) => r.level === li && roomContains(r, x, z)) ?? null;

  // ---- per level ----
  const stairsHoles = (li) => (li > 0 ? b.levels[li - 1].stairs.map((s) => stairHole(s)) : []);
  const stairRun = (s) => {
    const n = Math.max(12, Math.ceil(FH / 0.185));
    const len = s.len ?? n * 0.27;
    return { n, len, run: len / n, rise: FH / n };
  };
  function stairFrame(s) {
    // Local frame: origin = middle of the first riser line, forward = -z rotated by rot, across = +x.
    return { fx: -Math.sin(s.rot), fz: -Math.cos(s.rot), ax: Math.cos(s.rot), az: -Math.sin(s.rot) };
  }
  function stairHole(s) {
    const { n, len, run } = stairRun(s);
    const k0 = Math.max(0, Math.ceil((FH - 2.24) / (FH / n))) * run - 0.02;
    const f = stairFrame(s), hw = s.w / 2 + 0.06;
    const pts = [[-hw, k0], [hw, k0], [hw, len + 0.02], [-hw, len + 0.02]].map(([a, d]) => [s.x + f.ax * a + f.fx * d, s.z + f.az * a + f.fz * d]);
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), s, k0, f, hw, len };
  }

  for (let li = 0; li < NL; li++) {
    const L = b.levels[li];
    const y0 = y0Of(li);
    const F = soup(`f${li}`), FL = layers[`f${li}`], IN = layers[`in${li}`], INS = soup(`in${li}`), CAP = soup(`cap${li}`);
    const ceilIN = li > 0 ? layers[`in${li - 1}`] : null;

    // ---- slabs: structure, edge band, floor finish per room, ceiling below ----
    const holes = stairsHoles(li);
    const lvRooms = rooms.filter((r) => r.level === li);
    const gx = [], gz = [];
    for (const r of lvRooms) for (const p of r.poly) { gx.push(p[0]); gz.push(p[1]); }
    const gStruct = slabGrid(L.slabs, holes);
    const slabRects = gridRects(gStruct);
    const topOf = (s) => (li === 0 ? (s.raised === false ? PAD_TOP : P) : y0);
    for (const r of slabRects) {
      const s = L.slabs[r.owner], top = topOf(s);
      if (hide?.has(s.id)) continue;
      const bottom = li === 0 ? 0 : y0 - SLAB_T;
      FL.box(`slab${li}`, M.slabBody, r.x1 - r.x0, top - bottom, r.z1 - r.z0, (r.x0 + r.x1) / 2, (top + bottom) / 2, (r.z0 + r.z1) / 2);
    }
    // Edge band (trim) / plinth (ground) on the outline.
    for (const e of gridEdges(gStruct)) {
      const len = Math.hypot(e.x1 - e.x0, e.z1 - e.z0);
      const cx = (e.x0 + e.x1) / 2, cz = (e.z0 + e.z1) / 2;
      const raised = li > 0 || L.slabs.some((s) => s.raised !== false && cx >= s.x0 - 0.01 && cx <= s.x1 + 0.01 && cz >= s.z0 - 0.01 && cz <= s.z1 + 0.01);
      const isHole = holes.some((hl) => cx > hl.x0 - 0.02 && cx < hl.x1 + 0.02 && cz > hl.z0 - 0.02 && cz < hl.z1 + 0.02);
      const horiz = e.nz !== 0;
      const bw = li === 0 ? (raised ? P : PAD_TOP) : 0.24, ext = li === 0 ? 0.06 : 0.04, thick = ext + 0.02;
      if (isHole) continue;
      const by = li === 0 ? bw / 2 : y0 - 0.12;
      const pos = (n) => [cx + e.nx * n, cz + e.nz * n];
      const [px, pz] = pos(ext / 2 - 0.01);
      const sizeA = len + (isHole ? 0 : 2 * ext), sizeB = thick;
      FL.box(`edge${li}`, li === 0 ? M.plinth : M.trim, horiz ? sizeA : sizeB, bw, horiz ? sizeB : sizeA, px, by, pz);
    }
    // Floor finish: planes per (slab, room) cell run, tile grid starts at the slab corner.
    const gFin = slabGrid(L.slabs, holes, { x: gx, z: gz });
    for (let j = 0; j < gFin.nz; j++) for (let i = 0; i < gFin.nx; i++) {
      const si = gFin.at(i, j);
      if (si < 0) continue;
      const r = lvRooms.find((q) => roomContains(q, (gFin.X[i] + gFin.X[i + 1]) / 2, (gFin.Z[j] + gFin.Z[j + 1]) / 2));
      gFin.owner[j * gFin.nx + i] = si * 128 + (r ? lvRooms.indexOf(r) + 1 : 0);
    }
    for (const q of gridRects(gFin)) {
      const si = Math.floor(q.owner / 128), ri = (q.owner % 128) - 1;
      const slab = L.slabs[si], room = ri >= 0 ? lvRooms[ri] : null;
      const spec = specOf(slab, room);
      const top = topOf(slab) + FLOOR_T;
      const key = `floor${li}:${si}:${room?.key ?? '-'}`;
      const opts = { material: mats.floor(spec), part: room ? `room:${room.key}` : null, uvShift: [-slab.x0, -slab.z0], shadow: false };
      F.quad(key, opts, [q.x0, top, q.z0], [q.x0, top, q.z1], [q.x1, top, q.z1], [q.x1, top, q.z0], [0, 1, 0]);
    }
    // Ceiling under this slab, seen from the room below (walk mode).
    if (ceilIN && !ceilIN.skip) {
      const S = soup(`in${li - 1}`);
      for (const r of slabRects) S.quad(`ceil${li}`, M.ceiling, [r.x0, y0 - SLAB_T - 0.002, r.z0], [r.x1, y0 - SLAB_T - 0.002, r.z0], [r.x1, y0 - SLAB_T - 0.002, r.z1], [r.x0, y0 - SLAB_T - 0.002, r.z1], [0, -1, 0]);
    }
    if (li === NL - 1) {
      // Ceiling under the roof slab, over every room of the top floor.
      const S = soup(`in${li}`);
      const gRoof = slabGrid(L.slabs, []);
      for (const r of gridRects(gRoof)) S.quad(`ceil${li + 1}`, M.ceiling, [r.x0, y0 + FH - SLAB_T - 0.002, r.z0], [r.x1, y0 + FH - SLAB_T - 0.002, r.z0], [r.x1, y0 + FH - SLAB_T - 0.002, r.z1], [r.x0, y0 + FH - SLAB_T - 0.002, r.z1], [0, -1, 0]);
    }
    // Stair hole guard rail (the arrival edge stays open).
    for (const hl of holes) {
      const { f, hw, k0, len, s } = hl;
      const topY = y0 + FLOOR_T;
      const P2 = (a, d) => [s.x + f.ax * a + f.fx * d, s.z + f.az * a + f.fz * d];
      railing(layers[`in${li}`], ...P2(-hw, k0), ...P2(hw, k0), topY);
      railing(layers[`in${li}`], ...P2(-hw, k0), ...P2(-hw, len - 0.02), topY);
      railing(layers[`in${li}`], ...P2(hw, k0), ...P2(hw, len - 0.02), topY);
    }

    // ---- walls ----
    const { frames, hubs } = wallFrames(L.walls);
    const inSlab = (x, z) => L.slabs.some((s) => x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1);
    const hasWallNear = (x, z, r = 0.25) => L.walls.some((w) => {
      const dx = w.x1 - w.x0, dz = w.z1 - w.z0, l2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - w.x0) * dx + (z - w.z0) * dz) / l2));
      return Math.hypot(x - (w.x0 + t * dx), z - (w.z0 + t * dz)) < r + w.t / 2;
    });
    const yb = li === 0 ? 0 : y0;
    for (const w of L.walls) {
      if (hide?.has(w.id)) continue;
      // An upper wall with no slab under it would poke through the roof below: leave it out.
      if (li > 0) { const mx = (w.x0 + w.x1) / 2, mz = (w.z0 + w.z1) / 2; if (!L.slabs.some((q) => mx >= q.x0 - 0.3 && mx <= q.x1 + 0.3 && mz >= q.z0 - 0.3 && mz <= q.z1 + 0.3)) continue; }
      const f = frames.get(w.id);
      const t = w.t, ht = t / 2;
      const wh = w.h ?? FH;
      const yt = y0 + wh + (w.h == null ? 0.003 : 0);
      const A = [w.x0, w.z0], d = [f.dx, f.dz], n = [f.nx, f.nz];
      const W3 = (u, v, y) => [A[0] + d[0] * u + n[0] * v, y, A[1] + d[1] * u + n[1] * v];
      const straightA = Math.max(f.lA, f.rA) + 0.02, straightB = Math.min(f.lB, f.rB) - 0.02;
      // Openings, kept inside the straight part of the wall.
      const ops = [];
      for (const o of w.openings) {
        const hh = Math.min(o.h, wh - o.sill - 0.1);
        if (hh < 0.3 || o.w > straightB - straightA) continue;
        const c = Math.max(straightA + o.w / 2, Math.min(straightB - o.w / 2, o.at));
        ops.push({ ...o, c, o0: c - o.w / 2, o1: c + o.w / 2, h: hh });
      }
      ops.sort((p, q) => p.c - q.c);
      for (let i = 1; i < ops.length; i++) if (ops[i].o0 < ops[i - 1].o1 + 0.04) { ops.splice(i, 1); i--; }
      const sideAt = (s, u) => {
        const x = A[0] + d[0] * u + n[0] * s * (ht + 0.14), z = A[1] + d[1] * u + n[1] * s * (ht + 0.14);
        const room = roomAt(li, x, z);
        const inside = !w.ext || !!room;
        return { kind: inside ? 'in' : 'out', room };
      };
      const outSurface = outPaint(w);
      const baseSurface = inBase(w);
      for (const s of [1, -1]) {
        const u0 = s > 0 ? f.lA : f.rA, u1 = s > 0 ? f.lB : f.rB;
        const v = s * ht;
        const map = (u, y) => W3(u, v, y);
        const nrm = [n[0] * s, 0, n[1] * s];
        const cuts = [u0];
        for (const o of ops) cuts.push(o.o0, o.o1);
        cuts.push(u1);
        for (let k = 0; k < cuts.length; k += 2) {
          const ua = cuts[k], ub = cuts[k + 1];
          if (ub - ua < 0.004) continue;
          const info = sideAt(s, (ua + ub) / 2);
          const surf = info.kind === 'out' ? outSurface : baseSurface;
          F.quad(`wall:${info.kind}:${surf.k}`, surf, map(ua, yb), map(ub, yb), map(ub, yt), map(ua, yt), nrm);
          if (info.kind === 'in') {
            // Room lining (paint override + room pick) and baseboard.
            const rs = roomWall(info.room, w);
            const off = [nrm[0] * 0.003, 0, nrm[2] * 0.003];
            const m2 = (u, y) => { const p = map(u, y); return [p[0] + off[0], p[1], p[2] + off[2]]; };
            INS.quad(`lin:${rs.k}:${info.room?.key ?? '-'}`, rs, m2(ua, y0 + FLOOR_T), m2(ub, y0 + FLOOR_T), m2(ub, Math.min(yt, y0 + H)), m2(ua, Math.min(yt, y0 + H)), nrm);
            if (!IN.skip && ub - ua > 0.1) {
              const mp = W3((ua + ub) / 2, 0, 0);
              const spec = specOf(L.slabs.find((q) => mp[0] > q.x0 - 0.01 && mp[0] < q.x1 + 0.01 && mp[2] > q.z0 - 0.01 && mp[2] < q.z1 + 0.01) ?? { finish: I.floor }, info.room);
              const bm = spec.baseboard ? { material: mats.plain(spec.baseboard, { roughness: 0.5 }), part: info.room ? `room:${info.room.key}` : null } : { material: mats.floor(spec), part: info.room ? `room:${info.room.key}` : null };
              const mid = W3((ua + ub) / 2, v + s * 0.01, y0 + FLOOR_T + 0.04);
              IN.box(`zoc:${spec.id}:${spec.tone}:${spec.baseboard ?? '-'}:${info.room?.key ?? '-'}`, bm, ub - ua - 0.01, 0.08, 0.014, mid[0], mid[1], mid[2], null, Math.atan2(-d[1], d[0]));
            }
          }
        }
      }
      // Wall base band (outside, ground level): stone skirt or a plain plinth strip.
      if (li === 0) {
        const bandH = h.wallFinish === 'stone-base' ? 0.75 : 0.28;
        for (const s of [1, -1]) {
          const u0 = s > 0 ? f.lA : f.rA, u1 = s > 0 ? f.lB : f.rB;
          const cutsB = [u0];
          for (const o of ops) if (o.sill < bandH) cutsB.push(o.o0, o.o1);
          cutsB.push(u1);
          for (let k = 0; k < cutsB.length; k += 2) {
            const ua = cutsB[k], ub = cutsB[k + 1];
            if (ub - ua < 0.1) continue;
            if (sideAt(s, (ua + ub) / 2).kind !== 'out' || !w.ext) continue;
            const e = 0.012, v = s * (ht + e), mp = (u, y) => W3(u, v, y);
            const nrm = [n[0] * s, 0, n[1] * s];
            // The band starts at grade unless the plinth covers the foot of the wall.
            const bm = (ua + ub) / 2, bpx = A[0] + d[0] * bm + n[0] * s * (ht + 0.3), bpz = A[1] + d[1] * bm + n[1] * s * (ht + 0.3);
            const raisedOut = L.slabs.some((q) => q.raised !== false && bpx > q.x0 && bpx < q.x1 && bpz > q.z0 && bpz < q.z1);
            const by0 = raisedOut ? P : 0.0;
            F.quad(`wbase:${h.wallFinish}`, M.base, mp(ua, by0), mp(ub, by0), mp(ub, P + bandH), mp(ua, P + bandH), nrm);
            F.quad(`wbase:${h.wallFinish}`, M.base, mp(ua, P + bandH), mp(ub, P + bandH), W3(ub, s * ht, P + bandH), W3(ua, s * ht, P + bandH), [0, 1, 0]);
          }
        }
      }
      // Wall tops, section caps for the cutaway, collision.
      const topQuad = (ua, ub, y, key, S, mt) => {
        const first = ua <= straightA, last = ub >= straightB;
        const lA = first ? f.lA : ua, rA = first ? f.rA : ua, lB = last ? f.lB : ub, rB = last ? f.rB : ub;
        S.quad(key, mt, W3(lA, ht, y), W3(lB, ht, y), W3(rB, -ht, y), W3(rA, -ht, y), [0, 1, 0]);
      };
      const topCuts = [Math.min(f.lA, f.rA)];
      for (const o of ops) topCuts.push(o.o0, o.o1);
      topCuts.push(Math.max(f.lB, f.rB));
      const topMat = { material: outSurface.material, part: 'walls' };
      for (let k = 0; k < topCuts.length; k += 2) {
        const ua = topCuts[k], ub = topCuts[k + 1];
        if (ub - ua < 0.004) continue;
        topQuad(ua, ub, yt, `wtop:${outSurface.k}`, F, topMat);
        if (yt > y0 + CUT) topQuad(ua, ub, y0 + CUT + 0.002, `cap${li}`, CAP, M.cap);
      }
      if (w.h != null) {
        // Low walls get a coping on top.
        const mx = (w.x0 + w.x1) / 2, mz = (w.z0 + w.z1) / 2;
        FL.box(`cop:${li}`, M.casing, f.len + 0.02, 0.05, t + 0.06, mx, yt + 0.025, mz, null, Math.atan2(-d[1], d[0]));
      }
      // Under-sill pieces above the cut still show in the section.
      for (const o of ops) if (o.sill > CUT && yt > y0 + CUT) CAP.quad(`cap${li}`, M.cap, W3(o.o0, ht, y0 + CUT + 0.002), W3(o.o1, ht, y0 + CUT + 0.002), W3(o.o1, -ht, y0 + CUT + 0.002), W3(o.o0, -ht, y0 + CUT + 0.002), [0, 1, 0]);
      // Collision: the wall minus walkable openings.
      let su = 0;
      for (const o of ops.filter((q) => q.sill < 0.3 && q.kind !== 'window')) {
        if (o.o0 > su) segments.push({ a: [A[0] + d[0] * su, A[1] + d[1] * su], b: [A[0] + d[0] * o.o0, A[1] + d[1] * o.o0], level: li });
        su = o.o1;
      }
      segments.push({ a: [A[0] + d[0] * su, A[1] + d[1] * su], b: [w.x1, w.z1], level: li });
      // Reveals and openings.
      for (const o of ops) opening(li, w, f, o, { y0, yb, yt, wh, W3, d, n, sideAt, outSurface, baseSurface });
    }
    // Hubs (3+ walls meeting): just a top face.
    for (const hub of hubs) {
      const ids = L.walls.filter((w) => [[w.x0, w.z0], [w.x1, w.z1]].some(([x, z]) => Math.abs(x - hub.x) < 0.011 && Math.abs(z - hub.z) < 0.011));
      const topY = Math.max(...ids.map((w) => y0 + (w.h ?? FH) + (w.h == null ? 0.003 : 0)));
      const pts = hub.pts.slice().sort((p, q) => Math.atan2(p[1] - hub.z, p[0] - hub.x) - Math.atan2(q[1] - hub.z, q[0] - hub.x));
      const surf = outPaint(ids[0]);
      for (let i = 1; i < pts.length - 1; i++) {
        F.tri(`wtop:${surf.k}`, { material: surf.material, part: 'walls' }, [pts[0][0], topY, pts[0][1]], [pts[i][0], topY, pts[i][1]], [pts[i + 1][0], topY, pts[i + 1][1]], [0, 1, 0]);
        if (topY > y0 + CUT) CAP.tri(`cap${li}`, M.cap, [pts[0][0], y0 + CUT + 0.002, pts[0][1]], [pts[i][0], y0 + CUT + 0.002, pts[i][1]], [pts[i + 1][0], y0 + CUT + 0.002, pts[i + 1][1]], [0, 1, 0]);
      }
    }

    // ---- stairs ----
    for (const s of L.stairs) if (!hide?.has(s.id)) buildStair(li, s, y0, IN);

    // ---- columns (v5): plastered shaft on a plinth, with a cap; each column is its own pick part ----
    for (const c of L.columns ?? []) {
      if (hide?.has(c.id)) continue;
      const own = L.slabs.find((q) => c.x >= q.x0 && c.x <= q.x1 && c.z >= q.z0 && c.z <= q.z1);
      const baseY = own ? topOf(own) + FLOOR_T : li === 0 ? 0 : y0;
      const topY = c.h != null ? baseY + c.h : Math.max(baseY + 0.5, y0 + FH - 0.01);
      columnAt(FL, c, baseY, topY);
      segments.push({ a: [c.x - c.s / 2, c.z], b: [c.x + c.s / 2, c.z], level: li });
    }

    // ---- posts under open slab edges + balcony railings ----
    for (const e of gridEdges(gStruct)) {
      const len = Math.hypot(e.x1 - e.x0, e.z1 - e.z0);
      const cx = (e.x0 + e.x1) / 2, cz = (e.z0 + e.z1) / 2;
      if (holes.some((hl) => cx > hl.x0 - 0.02 && cx < hl.x1 + 0.02 && cz > hl.z0 - 0.02 && cz < hl.z1 + 0.02)) continue;
      // Portions of the edge without a wall (sampled every 0.25 m) are open.
      const nSamp = Math.max(1, Math.ceil(len / 0.25));
      const open = [];
      let cur = null;
      for (let k = 0; k < nSamp; k++) {
        const tt = (k + 0.5) / nSamp;
        const px = e.x0 + (e.x1 - e.x0) * tt, pz = e.z0 + (e.z1 - e.z0) * tt;
        const isOpen = !hasWallNear(px - e.nx * 0.12, pz - e.nz * 0.12, 0.12);
        if (isOpen && cur) cur.t1 = (k + 1) / nSamp;
        else if (isOpen) { cur = { t0: k / nSamp, t1: (k + 1) / nSamp }; open.push(cur); }
        else cur = null;
      }
      const tx = (e.x1 - e.x0) / len, tz = (e.z1 - e.z0) / len;
      for (const seg of open) {
        const ax = e.x0 + (e.x1 - e.x0) * seg.t0, az = e.z0 + (e.z1 - e.z0) * seg.t0, bx = e.x0 + (e.x1 - e.x0) * seg.t1, bz = e.z0 + (e.z1 - e.z0) * seg.t1;
        const sl = Math.hypot(bx - ax, bz - az);
        if (sl < 0.3) continue;
        // Posts carry whatever sits above (the next slab, the roof, or a porch / carport roof of their own).
        const own = L.slabs.find((q) => cx - e.nx * 0.1 >= q.x0 - 0.02 && cx - e.nx * 0.1 <= q.x1 + 0.02 && cz - e.nz * 0.1 >= q.z0 - 0.02 && cz - e.nz * 0.1 <= q.z1 + 0.02) ?? L.slabs[0];
        const upCover = li < NL - 1 && b.levels[li + 1].slabs.some((q) => cx - e.nx * 0.3 > q.x0 && cx - e.nx * 0.3 < q.x1 && cz - e.nz * 0.3 > q.z0 && cz - e.nz * 0.3 < q.z1);
        const ownRoof = own.kind === 'porch' || own.kind === 'carport';
        const bare = !own.kind && !slabHasWalls(L, own);
        const topY = upCover ? y0 + FH - 0.01 : ownRoof ? y0 + FH - PORCH_DROP - 0.01 : own.kind === 'balcony' || bare ? null : y0 + FH - 0.01;
        const baseY = (li === 0 ? (own.raised === false ? PAD_TOP : P) : y0) + FLOOR_T;
        if (topY != null) {
          const np = Math.max(1, Math.round(sl / 3.2));
          for (let k = 0; k <= np; k++) {
            const inset = k === 0 ? 0.2 : k === np ? -0.2 : 0;
            const px = ax + ((bx - ax) * k) / np + tx * inset - e.nx * 0.2, pz = az + ((bz - az) * k) / np + tz * inset - e.nz * 0.2;
            let ty = topY;
            for (const q of L.slabs) if ((q.kind === 'porch' || q.kind === 'carport') && px > q.x0 - 0.35 && px < q.x1 + 0.35 && pz > q.z0 - 0.35 && pz < q.z1 + 0.35 && !(li < NL - 1 && b.levels[li + 1].slabs.some((u) => px > u.x0 && px < u.x1 && pz > u.z0 && pz < u.z1))) ty = Math.min(ty, y0 + FH - PORCH_DROP - 0.01);
            postAt(FL, px, pz, baseY, ty);
            segments.push({ a: [px - 0.15, pz], b: [px + 0.15, pz], level: li });
          }
        }
        // Ground porch of a traditional house: railing along the open edges, with a gap at the entry steps.
        if (li === 0 && own.kind === 'porch' && fancy) {
          const en = buildEntry(b);
          if (e.nz !== 0 && en) {
            const g0 = en.x - 1.15, g1 = en.x + 1.15, lo = Math.min(ax, bx), hi = Math.max(ax, bx);
            if (lo < g0) railing(FL, lo, az - e.nz * 0.25, Math.min(hi, g0), az - e.nz * 0.25, P + FLOOR_T);
            if (hi > g1) railing(FL, Math.max(lo, g1), az - e.nz * 0.25, hi, az - e.nz * 0.25, P + FLOOR_T);
          } else if (e.nz === 0) railing(FL, ax - e.nx * 0.25, az, bx - e.nx * 0.25, bz, P + FLOOR_T);
        }
        // Open slab edge above ground = balcony: railing along it.
        if (li > 0) railing(FL, ax - e.nx * 0.06, az - e.nz * 0.06, bx - e.nx * 0.06, bz - e.nz * 0.06, y0 + FLOOR_T);
      }
    }
    // Entry steps: only on the outside of a door that opens from a room to the yard (or onto a raised porch edge).
    if (li === 0) {
      const inPorch = (x, z) => L.slabs.some((q) => q.kind === 'porch' && q.raised !== false && x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1);
      for (const w of L.walls) {
        if (!w.ext) continue;
        const f = frames.get(w.id);
        for (const o of w.openings) {
          if (!(o.kind === 'door' || o.kind === 'slider' || o.kind === 'garage' || o.kind === 'arch') || o.sill > 0.05 || o.kind === 'garage') continue;
          const px = w.x0 + f.dx * o.at, pz = w.z0 + f.dz * o.at;
          for (const s of [1, -1]) {
            const ox = f.nx * s, oz = f.nz * s, r = w.t / 2 + 0.15;
            const inRoom = roomAt(0, px - ox * r, pz - oz * r) && !roomAt(0, px + ox * r, pz + oz * r);
            if (!inRoom) continue;
            const outX = px + ox * r, outZ = pz + oz * r;
            let dEdge = w.t / 2;
            if (inSlab(outX, outZ)) {
              // Only a raised porch is walked across; at-grade pads and room slabs get no steps.
              if (!inPorch(outX, outZ)) break;
              dEdge = -1;
              for (let dd = r; dd < 7; dd += 0.1) {
                const qx = px + ox * dd, qz = pz + oz * dd;
                if (hasWallNear(qx, qz, 0.05)) break;
                if (!inPorch(qx, qz)) { dEdge = dd; break; }
              }
              if (dEdge < 0) break;
            } else if (!L.slabs.some((q) => q.raised !== false && px - ox * r > q.x0 && px - ox * r < q.x1 && pz - oz * r > q.z0 && pz - oz * r < q.z1)) break;
            const rise = P / 3, sw = Math.min(o.w + 0.8, 3.0), ry = Math.atan2(ox, oz);
            for (let i = 0; i < 3; i++) {
              const ht = P - i * rise, dz = dEdge + 0.06 + 0.16 + i * 0.3;
              FL.box('steps', M.concrete, sw, ht - 0.01, 0.32, 0, (ht - 0.01) / 2, dz, mat4(px, 0, pz, ry));
              FL.box('stepsTop', { material: mats.outFloor('concrete'), part: null }, sw + 0.02, 0.02, 0.33, 0, ht + 0.0, dz, mat4(px, 0, pz, ry));
            }
            break;
          }
        }
      }
    }
    // Ceiling light per room.
    for (const r of lvRooms) {
      if (r.type === 'pasillo') continue;
      ceilingLight(kit(IN, FS, mat4(r.x, y0 + H, r.z), 'k:'), 0.15);
    }
  }

  // ---- collision for walk mode + labels + lights ----
  for (const r of rooms) {
    const li = r.level, y0 = y0Of(li);
    const hidden = r.type === 'pasillo';
    r.hidden = hidden;
    if (!hidden) {
      const text = r.type === 'cuarto' ? `${roomName(r.type, lang)} ${Math.round(r.net)} m²` : roomName(r.type, lang);
      labels.push({ text, x: r.x, y: y0 + 2.0, z: r.z, level: li, type: r.type, area: r.net });
    }
  }
  for (let li = 0; li < NL; li++) {
    const best = rooms.filter((r) => r.level === li && r.type !== 'pasillo').sort((a, c) => c.net - a.net)[0];
    if (best) lights.push({ level: li, x: best.x, y: y0Of(li) + H - 0.4, z: best.z });
  }

  // ---- components ----
  function postAt(Lr, x, z, ya, yb2) {
    const ht = yb2 - ya;
    if (ht < 0.3) return;
    Lr.box('post', M.trim, 0.3, 0.12, 0.3, x, ya + 0.06, z);
    Lr.box('post', M.trim, 0.2, ht - 0.2, 0.2, x, ya + 0.12 + (ht - 0.2) / 2, z);
    Lr.box('post', M.trim, 0.3, 0.08, 0.3, x, yb2 - 0.04, z);
  }

  // Free-standing column: base plinth (grimy base paint), plastered shaft (outside wall paint), moulded cap.
  function columnAt(Lr, c, ya, yb2) {
    const ht = yb2 - ya, s = c.s;
    if (ht < 0.3) return;
    const part = `column:${c.id}`;
    const shaft = outPaint({});
    const pb = Math.min(0.18, ht * 0.15), cap = Math.min(0.14, ht * 0.1);
    Lr.box(`colb${c.id}`, { material: M.plinth.material, part }, s + 0.08, pb, s + 0.08, c.x, ya + pb / 2, c.z);
    Lr.rbox(`col${c.id}`, { material: shaft.material, part }, s, ht - pb - cap, s, 0.012, c.x, ya + pb + (ht - pb - cap) / 2, c.z);
    Lr.box(`colc${c.id}`, { material: M.trim.material, part }, s + 0.06, cap * 0.45, s + 0.06, c.x, yb2 - cap + cap * 0.225, c.z);
    Lr.box(`colc${c.id}`, { material: M.trim.material, part }, s + 0.12, cap * 0.55, s + 0.12, c.x, yb2 - cap * 0.275, c.z);
  }

  // Railing between two points by the house style; y is the walking surface.
  function railing(Lr, x0, z0, x1, z1, y) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.15) return;
    const ry = Math.atan2(-(z1 - z0), x1 - x0);
    const Mx = mat4(x0, y, z0, ry);
    if (railStyle === 'glass') {
      const n = Math.max(1, Math.ceil(len / 1.5));
      for (let i = 0; i < n; i++) Lr.box('clear', M.clear, len / n - 0.03, 0.86, 0.015, ((i + 0.5) * len) / n, 0.53, 0, Mx);
      Lr.box('alu', M.alu, len, 0.09, 0.06, len / 2, 0.045, 0, Mx);
      Lr.rbox('alu', M.alu, len, 0.05, 0.06, 0.02, len / 2, 0.98, 0, Mx);
      return;
    }
    if (railStyle === 'concrete') {
      Lr.box('rw', { material: mats.paint(C.walls), part: 'walls' }, len, 0.92, 0.14, len / 2, 0.46, 0, Mx);
      Lr.box('trim', M.trim, len + 0.04, 0.06, 0.2, len / 2, 0.95, 0, Mx);
      return;
    }
    if (railStyle === 'balusters') {
      Lr.rbox('trim', M.trim, len, 0.09, 0.17, 0.025, len / 2, 0.93, 0, Mx);
      Lr.box('trim', M.trim, len, 0.08, 0.15, len / 2, 0.04, 0, Mx);
      const n = Math.floor(len / 0.17);
      for (let i = 1; i < n; i++) Lr.add('trim', BAL.clone(), Mx.clone().multiply(mat4((i * len) / n, 0.08, 0)), M.trim);
      for (const t of [0, len]) Lr.box('trim', M.trim, 0.2, 1.0, 0.2, t, 0.5, 0, Mx);
      return;
    }
    Lr.box('iron', M.iron, len, 0.045, 0.05, len / 2, 0.97, 0, Mx);
    Lr.box('iron', M.iron, len, 0.03, 0.03, len / 2, 0.1, 0, Mx);
    const n = Math.max(2, Math.floor(len / 0.12));
    for (let i = 1; i < n; i++) Lr.box('iron', M.iron, 0.016, 0.86, 0.016, (i * len) / n, 0.53, 0, Mx);
    const k = Math.max(1, Math.floor(len / 1.0));
    for (let i = 0; i < k; i++) Lr.add('iron', new TorusGeometry(0.09, 0.009, 4, 16), Mx.clone().multiply(mat4(((i + 0.5) * len) / k, 0.78, 0)), M.iron);
    const np = Math.max(1, Math.round(len / 2));
    for (let i = 0; i <= np; i++) Lr.box('iron', M.iron, 0.045, 1.0, 0.045, (i * len) / np, 0.5, 0, Mx);
  }

  // ---- straight stair flight ----
  function buildStair(li, s, y0, IN) {
    const { n, run, rise, len } = stairRun(s);
    const yF = y0 + FLOOR_T;
    const Mx = mat4(s.x, yF, s.z, s.rot);
    for (let i = 0; i < n; i++) {
      const ht = rise * (i + 1), zc = -run * (i + 0.5);
      IN.box('stairBody', M.plaster, s.w, ht, run, 0, ht / 2, zc, Mx);
      IN.box('stairTread', M.tread, s.w + 0.03, 0.035, run + 0.03, 0, ht + 0.0175, zc - 0.015, Mx);
    }
    const f = stairFrame(s);
    // Side rails unless a wall is right there (then a wall-mounted handrail).
    const stairsL = b.levels[li].walls;
    const nearWall = (x, z) => stairsL.some((w) => {
      const dx = w.x1 - w.x0, dz = w.z1 - w.z0, l2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - w.x0) * dx + (z - w.z0) * dz) / l2));
      return Math.hypot(x - (w.x0 + t * dx), z - (w.z0 + t * dz)) < w.t / 2 + 0.12;
    });
    for (const side of [-1, 1]) {
      const sx = s.x + f.ax * side * (s.w / 2 + 0.04) + f.fx * len * 0.5, sz = s.z + f.az * side * (s.w / 2 + 0.04) + f.fz * len * 0.5;
      const lx = side * (s.w / 2 - 0.04);
      const aPt = new Vector3(lx, rise + 0.035 + 0.92, -run * 0.5), bPt = new Vector3(lx, FH + 0.035 + 0.92, -run * (n - 0.5));
      const wall = nearWall(sx, sz);
      if (wall) {
        const a2 = aPt.clone().setX(side * (s.w / 2 + 0.02)), b2 = bPt.clone().setX(side * (s.w / 2 + 0.02));
        const m = new Matrix4().lookAt(a2, b2, new Vector3(0, 1, 0));
        m.setPosition(a2.clone().add(b2).multiplyScalar(0.5));
        IN.geo('rail', M.alu, new CylinderGeometry(0.02, 0.02, a2.distanceTo(b2), 8).rotateX(Math.PI / 2), 0, 0, 0, Mx.clone().multiply(m));
        continue;
      }
      for (let i = 0; i < n - 1; i++) IN.box('iron', M.iron, i % 2 === 0 ? 0.035 : 0.016, 0.9, i % 2 === 0 ? 0.035 : 0.016, lx, rise * (i + 1) + 0.035 + 0.45, -run * (i + 0.5), Mx);
      const m = new Matrix4().lookAt(aPt, bPt, new Vector3(0, 1, 0));
      m.setPosition(aPt.clone().add(bPt).multiplyScalar(0.5));
      IN.rbox('tread', M.tread, 0.06, 0.05, aPt.distanceTo(bPt) + 0.06, 0.015, 0, 0, 0, Mx.clone().multiply(m));
    }
    // Collision: the sides of the flight.
    for (const side of [-1, 1]) {
      const a = [s.x + f.ax * side * (s.w / 2), s.z + f.az * side * (s.w / 2)];
      segments.push({ a, b: [a[0] + f.fx * len, a[1] + f.fz * len], level: li });
    }
  }

  // ---- openings: reveals, frames, leaves ----
  function opening(li, w, fr, o, ctx) {
    const { y0, yb, yt, W3, d, n, sideAt, outSurface, baseSurface } = ctx;
    const t = w.t, ht = t / 2;
    const F = soup(`f${li}`), FL = layers[`f${li}`];
    const kind = o.kind;
    const arched = kind !== 'garage' && kind !== 'slider' && o.h > o.w / 2 + 0.25 && (o.top ? o.top === 'arch' : kind === 'arch' ? o.style !== 'flat' : o.style === 'arched' || (kind === 'window' && !o.style && winStyleDef === 'arched'));
    const ys = y0 + o.sill, oh = o.h;
    const outS = sideAt(1, o.c).kind === 'out' ? 1 : sideAt(-1, o.c).kind === 'out' ? -1 : 1;
    const exterior = sideAt(1, o.c).kind === 'out' || sideAt(-1, o.c).kind === 'out';
    const surf = exterior ? outSurface : baseSurface;
    // Face with the hole / notch on both sides (replaces the plain quad drawn by the wall loop).
    const loop = outlinePts(o.o0, ys, o.w, oh, arched);
    const atFloor = ys - yb < 0.02;
    for (const s of [1, -1]) {
      const info = sideAt(s, o.c);
      const nrm = [n[0] * s, 0, n[1] * s];
      const map = (u, y) => W3(u, s * ht, y);
      const sf = info.kind === 'out' ? outSurface : baseSurface;
      const key = `wall:${info.kind}:${sf.k}`;
      const u0 = o.o0, u1 = o.o1;
      // Below the sill + above the head as separate faces (no holes: collinear hole edges break triangulation).
      if (ys - yb > 0.004) F.quad(key, sf, map(u0, yb), map(u1, yb), map(u1, ys), map(u0, ys), nrm);
      faceUY(F, key, sf, map, nrm, uContour(u0, u1, yt, ys, oh, arched, o.w));
      if (info.kind === 'in') {
        const rs = roomWall(info.room, w);
        const off = [nrm[0] * 0.003, 0, nrm[2] * 0.003];
        const m2 = (u, y) => { const p = map(u, y); return [p[0] + off[0], p[1], p[2] + off[2]]; };
        const top = Math.min(yt, y0 + H);
        const key2 = `lin:${rs.k}:${info.room?.key ?? '-'}`;
        const S2 = soup(`in${li}`);
        if (ys - (y0 + FLOOR_T) > 0.004) S2.quad(key2, rs, m2(u0, y0 + FLOOR_T), m2(u1, y0 + FLOOR_T), m2(u1, ys), m2(u0, ys), nrm);
        faceUY(S2, key2, rs, m2, nrm, uContour(u0, u1, top, ys, oh, arched, o.w));
      }
    }
    // Reveal surfaces (jambs, head, sill) between the two faces.
    const rv = { material: surf.material, part: 'walls' };
    for (let i = 0; i < loop.length; i++) {
      const p = loop[i], q = loop[(i + 1) % loop.length];
      if (atFloor && Math.abs(p[1] - ys) < 1e-6 && Math.abs(q[1] - ys) < 1e-6) continue;
      const ex = q[0] - p[0], ey = q[1] - p[1], el = Math.hypot(ex, ey);
      if (el < 1e-4) continue;
      // inward normal in (u, y): perpendicular pointing at the opening centre
      let nu = -ey / el, ny = ex / el;
      const cu = o.c, cy = ys + oh / 2;
      if ((cu - p[0]) * nu + (cy - p[1]) * ny < 0) { nu = -nu; ny = -ny; }
      const nrm3 = [d[0] * nu, ny, d[1] * nu];
      F.quad(`reveal:${surf.k}`, rv, W3(p[0], -ht, p[1]), W3(q[0], -ht, q[1]), W3(q[0], ht, q[1]), W3(p[0], ht, p[1]), nrm3);
    }

    // ---- frame frame: local x along, z outward, origin at the wall centre line ----
    const ry = Math.atan2(n[0] * outS, n[1] * outS);
    const ex2 = o.c;
    const OM = mat4(w.x0 + d[0] * ex2, y0, w.z0 + d[1] * ex2, ry);
    const zo = ht;                    // outer face, local z
    const at = (lx, ly, lz) => new Matrix4().multiplyMatrices(OM, mat4(lx, ly, lz));
    const F0 = OM;
    const width = o.w, sill = o.sill;
    const ox = 0;
    const barsOn = o.bars ?? h.windowBars;
    const wStyle = ['standard', 'tall', 'arched', 'louvered'].includes(o.style) ? o.style : winStyleDef;
    const dStyle = ['panel', 'double', 'glass'].includes(o.style) ? o.style : doorStyleDef;
    const sw = fancy ? 0.16 : 0.1;
    const x = -width / 2;
    // Casing ring around the opening outside (traditional looks) or just on doors.
    if (exterior && kind !== 'garage' && (!modern || kind === 'door')) {
      FL.add(`trim:${li}`, ring(width + sw * 2, oh + sw, arched, sw, 0.04), at(x - sw, sill, zo), M.trim);
      if (!arched && !modern) FL.box('trim', M.trim, width + sw * 2 + 0.12, 0.12, 0.07, ox, sill + oh + sw + 0.06, zo + 0.035, F0);
      if (arched && fancy) FL.box('trim', M.trim, 0.16, 0.24, 0.07, ox, sill + oh + sw / 2, zo + 0.04, F0);
    }
    if (kind === 'arch') {
      if (!exterior) { FL.box('casing', M.casing, 0.06, oh, 0.05, x + 0.03, sill + oh / 2, zo + 0.025, F0); FL.box('casing', M.casing, 0.06, oh, 0.05, -x - 0.03, sill + oh / 2, zo + 0.025, F0); }
      return;
    }
    if (kind === 'garage') { garage(FL, o, at, F0, zo, sill, oh, width, ox); return; }
    if (kind === 'door') { door(FL, o, at, F0, zo, sill, oh, width, ox, x, arched, dStyle, li, outS, w, ctx); return; }
    if (kind === 'slider') {
      FL.add('frame', ring(width, oh, false, 0.06, 0.1), at(x, sill, zo - 0.12), M.frame);
      for (const k of [0, 1]) {
        FL.add('frame', ring(width / 2 + 0.02, oh - 0.12, false, 0.05, 0.03), at(x + 0.06 + k * (width / 2 - 0.08), sill + 0.06, zo - 0.11 + (k ? -0.025 : 0.015)), M.frame);
        FL.add('glassWin', new PlaneGeometry(width / 2 - 0.08, oh - 0.22), at(x + 0.06 + k * (width / 2 - 0.08) + (width / 2 + 0.02) / 2, sill + oh / 2, zo - 0.11 + (k ? -0.01 : 0.03)), M.glassWin);
      }
      if (sill < 0.05) FL.box('trim', M.trim, width + 0.1, 0.04, 0.3, ox, sill + 0.02, zo + 0.1, F0);
      return;
    }
    // ---- window ----
    FL.add('frame', ring(width, oh, arched, 0.06, 0.1), at(x, sill, zo - 0.14), M.frame);
    if (wStyle === 'louvered') {
      const nL = Math.floor((oh - 0.12) / 0.11);
      for (let i = 0; i < nL; i++) FL.box('frame', M.frame, width - 0.12, 0.1, 0.012, 0, 0, 0, new Matrix4().multiplyMatrices(OM, mat4(ox, sill + 0.1 + i * 0.11 + 0.05, zo - 0.09, 0, -0.55)));
      FL.box('frame', M.frame, 0.04, oh - 0.12, 0.05, ox, sill + oh / 2, zo - 0.09, F0);
      FL.add('glassWin', new PlaneGeometry(width - 0.14, oh - 0.14), at(ox, sill + oh / 2, zo - 0.12), M.glassWin);
    } else {
      const gs = outline(new Shape(), 0, 0, width - 0.12, oh - 0.12, arched);
      FL.add('glassWin', new ShapeGeometry(gs, 16), at(x + 0.06, sill + 0.06, zo - 0.1), M.glassWin);
      if (!arched && width > 0.9) {
        for (const k of [0, 1]) FL.add('frame', ring(width / 2 - 0.02, oh - 0.12, false, 0.04, 0.03), at(x + 0.06 + k * (width / 2 - 0.1), sill + 0.06, zo - 0.1 + (k ? -0.035 : 0.008)), M.frame);
        if (wStyle === 'tall') FL.box('frame', M.frame, width - 0.12, 0.04, 0.05, ox, sill + oh * 0.7, zo - 0.09, F0);
      } else if (width > 0.5) {
        FL.box('frame', M.frame, 0.04, oh - 0.12, 0.05, ox, sill + oh / 2, zo - 0.09, F0);
        if (wStyle === 'tall' || arched) FL.box('frame', M.frame, width - 0.12, 0.04, 0.05, ox, sill + oh * (arched ? 0.62 : 0.7), zo - 0.09, F0);
      }
    }
    // Sill (projecting, with drip edge) outside + stool inside.
    FL.box('trim', M.trim, width + 0.24, 0.06, 0.17, ox, sill - 0.03, zo + 0.055, F0);
    FL.box('trim', M.trim, width + 0.24, 0.025, 0.03, ox, sill - 0.07, zo + 0.125, F0);
    FL.box('casing', M.casing, width + 0.1, 0.03, 0.08, ox, sill - 0.015, -zo - 0.03, F0);
    if (exterior && !modern && h.style !== 'campo' && !arched && width > 0.8) {
      for (const side of [-1, 1]) {
        const sx = side * (width / 2 + 0.2 + width / 4);
        FL.box('accent', M.accent, width / 2, oh, 0.04, sx, sill + oh / 2, zo + 0.05, F0);
        for (let k = 0; k < oh / 0.12 - 1; k++) FL.box('accent', M.accent, width / 2 - 0.08, 0.02, 0.03, sx, sill + 0.1 + k * 0.12, zo + 0.08, F0);
      }
    }
    if (barsOn && exterior) {
      const bw = width + 0.08, bh = (arched ? oh - width / 2 : oh) + 0.04, z = zo + 0.09;
      FL.add('frame', ring(bw, bh, false, 0.03, 0.025), at(-bw / 2, sill - 0.02, z), M.frame);
      const nb = Math.max(3, Math.round(bw / 0.13));
      for (let i = 1; i < nb; i++) FL.box('frame', M.frame, 0.018, bh, 0.018, -bw / 2 + (i * bw) / nb, sill - 0.02 + bh / 2, z + 0.012, F0);
      for (const tt of [0.33, 0.66]) FL.box('frame', M.frame, bw, 0.025, 0.02, ox, sill + bh * tt, z + 0.012, F0);
      for (let i = 0; i < Math.max(1, Math.floor(bw / 0.45)); i++) {
        const cx = -bw / 2 + ((i + 0.5) * bw) / Math.max(1, Math.floor(bw / 0.45));
        FL.add('frame', new TorusGeometry(0.1, 0.012, 6, 20), at(cx, sill + bh * 0.495, z + 0.012), M.frame);
      }
    }
  }

  // Region above a floor-level opening: the wall face from the head up to `top` (arc points run right to left).
  function uContour(u0, u1, top, ys, oh, arched, w) {
    if (!arched) return [[u0, top], [u1, top], [u1, ys + oh], [u0, ys + oh]];
    const r = w / 2, yc = ys + oh - r, uc = (u0 + u1) / 2;
    const pts = [[u0, top], [u1, top], [u1, yc]];
    for (let i = 1; i < 14; i++) { const a = (i / 14) * Math.PI; pts.push([uc + r * Math.cos(a), yc + r * Math.sin(a)]); }
    pts.push([u0, yc]);
    return pts;
  }

  function door(FL, o, at, F0, zo, sill, oh, w, ox, x, arched, style, li, outS, wall, ctx) {
    FL.add('frame', ring(w, oh, arched, 0.07, 0.15), at(x, sill, zo - 0.15), M.frame);
    const zL = zo - 0.12, lt = 0.055;
    const leaves = style === 'double' ? 2 : 1;
    const lw = (w - 0.14) / leaves;
    const square = arched && (leaves === 2 || style === 'glass');
    const lh = (square ? oh - w / 2 : oh) - 0.07;
    for (let i = 0; i < leaves; i++) {
      const lx = x + 0.07 + i * lw;
      const ds = outline(new Shape(), 0, 0, lw - 0.006, lh, arched && !square);
      if (style === 'glass') {
        const gw = Math.min(0.42, lw * 0.4), gx = (lw - gw) / 2, gh = lh - 0.55;
        ds.holes.push(outline(new Path(), gx, 0.3, gw, gh, false));
        FL.add('door', new ExtrudeGeometry(ds, { depth: lt, bevelEnabled: false }), at(lx, sill, zL), M.door);
        FL.box('glass', M.glass, gw + 0.02, gh + 0.02, 0.012, lx + gx + gw / 2 - 0, sill + 0.3 + gh / 2, zL + lt / 2, F0);
        const hx = lx + lw - 0.11;
        FL.box('alu', M.alu, 0.028, 1.1, 0.028, hx, sill + 1.05, zL + lt + 0.07, F0);
        for (const dy of [-0.45, 0.45]) FL.box('alu', M.alu, 0.016, 0.016, 0.07, hx, sill + 1.05 + dy, zL + lt + 0.035, F0);
        continue;
      }
      FL.add('door', new ExtrudeGeometry(ds, { depth: lt, bevelEnabled: false, curveSegments: 16 }), at(lx, sill, zL), M.door);
      const cols = leaves === 1 && lw > 0.8 ? 2 : 1;
      const rows = 3, top = (arched && !square ? lh - lw / 2 : lh) - 0.12;
      const ph = (top - 0.14) / rows, pw = (lw - 0.12) / cols;
      for (let c = 0; c < cols; c++) for (let k = 0; k < rows; k++) {
        const hgt = k === 1 ? ph * 0.55 : ph * 1.15;
        const y = k === 0 ? 0.14 + hgt / 2 : k === 1 ? 0.14 + ph * 1.15 + 0.06 + hgt / 2 : top - hgt / 2;
        if (y + hgt / 2 > top + 0.01) continue;
        FL.rbox('door', M.door, pw - 0.07, hgt - 0.06, 0.03, 0.012, lx + 0.06 + pw * (c + 0.5), sill + y, zL + lt + 0.005, F0);
      }
      const hx = lx + (leaves === 2 ? (i === 0 ? lw - 0.09 : 0.09) : lw - 0.09);
      FL.box('alu', M.alu, 0.045, 0.2, 0.012, hx, sill + 1.02, zL + lt + 0.006, F0);
      FL.box('alu', M.alu, 0.12, 0.018, 0.018, hx + (i === 0 ? -0.04 : 0.04), sill + 1.05, zL + lt + 0.045, F0);
    }
    if (square) FL.add('glass', new ShapeGeometry(new Shape().absarc(0, 0, w / 2 - 0.07, 0, Math.PI, false)), at(ox, sill + oh - w / 2, zo - 0.1), M.glass);
    // Threshold on the outside.
    FL.box('trim', M.trim, w + 0.1, 0.03, 0.3, ox, sill + 0.015, zo + 0.08, F0);
    void li; void outS; void wall; void ctx;
  }

  function garage(FL, o, at, F0, zo, sill, oh, w, ox) {
    FL.add('frame', ring(w, oh, false, 0.08, 0.14), at(-w / 2, sill, zo - 0.16), M.trim);
    const n = Math.max(4, Math.round(oh / 0.5));
    const ph = (oh - 0.08) / n;
    FL.box('iron', M.iron, w - 0.08, oh - 0.06, 0.03, ox, sill + oh / 2, zo - 0.16, F0);
    for (let i = 0; i < n; i++) {
      FL.rbox('garage', M.garage, w - 0.1, ph - 0.02, 0.05, 0.008, ox, sill + 0.04 + ph * (i + 0.5), zo - 0.1, F0);
    }
    // small window strip on the second panel from the top
    const wn = Math.max(2, Math.round(w / 0.7));
    for (let i = 0; i < wn; i++) FL.box('glass', M.glass, (w - 0.3) / wn - 0.06, ph * 0.5, 0.012, ox - (w - 0.3) / 2 + ((i + 0.5) * (w - 0.3)) / wn, sill + 0.04 + ph * (n - 1.5), zo - 0.07, F0);
    FL.box('iron', M.iron, w - 0.1, 0.03, 0.02, ox, sill + 0.03, zo - 0.06, F0);
  }

  // Modern entry portal (accent frame around the main door).
  if (b.extras?.entryPortal) {
    const en = buildEntry(b);
    if (en) {
      const pw = 3.0, ph = Math.min(FH * (NL > 1 ? 1.45 : 1.0), top - P - 0.2) , z = en.z + 0.3, L0 = layers.f0;
      L0.box('accent', M.accent, 0.35, ph, 0.4, en.x - pw / 2, P + ph / 2, z);
      L0.box('accent', M.accent, 0.35, ph, 0.4, en.x + pw / 2, P + ph / 2, z);
      L0.box('accent', M.accent, pw + 0.35, 0.35, 0.4, en.x, P + ph - 0.175, z);
    }
  }

  // ---- assemble ----
  const roofInfo = buildRoof({ b, mats, M, layers, soup, y0Of, FH, C, h, I, railing, BAL });
  for (const sp of Object.values(soups)) sp.flush();
  const group = new Group();
  group.name = 'house';
  const outLayers = {};
  for (const [name, bd] of Object.entries(layers)) {
    const g = bd.build();
    g.name = name;
    outLayers[name] = g;
    group.add(g);
  }
  BAL.dispose();
  const glow = [[FS.bulb.material, 3], [FS.shade.material, 1.1], [M.glassWin.material, 1.2]];
  const setLightsOn = (on) => { for (const [m, k] of glow) m.emissiveIntensity = on ? k : 0; };
  setLightsOn(false);

  // Room label sprites.
  const lg = new Group();
  lg.name = 'labels';
  for (const l of labels) {
    const texc = makeTexture(labelCanvas(l.text), { repeat: 1 });
    texc.wrapS = texc.wrapT = 1001;
    const sp = new Sprite(new SpriteMaterial({ map: texc, depthTest: false, transparent: true }));
    const hgt = 0.55;
    sp.scale.set((hgt * texc.image.width) / texc.image.height, hgt, 1);
    sp.position.set(l.x, l.y, l.z);
    sp.renderOrder = 10;
    sp.userData.level = l.level;
    lg.add(sp);
  }
  lg.visible = false;
  group.add(lg);

  // Bounding box of everything built (house-local) and stats.
  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
  for (const L of b.levels) {
    for (const w of L.walls) { bx0 = Math.min(bx0, w.x0, w.x1); bx1 = Math.max(bx1, w.x0, w.x1); bz0 = Math.min(bz0, w.z0, w.z1); bz1 = Math.max(bz1, w.z0, w.z1); }
    for (const s of L.slabs) { bx0 = Math.min(bx0, s.x0); bx1 = Math.max(bx1, s.x1); bz0 = Math.min(bz0, s.z0); bz1 = Math.max(bz1, s.z1); }
  }
  const hasBox = Number.isFinite(bx0);
  const slabArea = (S) => { const g = slabGrid(S); let a = 0; for (let j = 0; j < g.nz; j++) for (let i = 0; i < g.nx; i++) if (g.at(i, j) >= 0) a += (g.X[i + 1] - g.X[i]) * (g.Z[j + 1] - g.Z[j]); return a; };
  const area = b.levels.reduce((s, L) => s + slabArea(L.slabs), 0);
  const roomsOut = rooms.map((r) => ({
    key: r.key, type: r.type, level: r.level, band: null, name: roomName(r.type, lang), area: Math.round(r.net * 10) / 10, hidden: !!r.hidden,
    x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, poly: r.poly,
  }));
  // Carport info for the yard (driveway), relative to the lot-view house centre (see effectiveState).
  let carport = null;
  const pad = buildPad(b), bb = buildBBox(b);
  if (pad && bb) {
    const entry = buildEntry(b);
    const cx = entry ? entry.x : (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2;
    carport = { x: (pad.x0 + pad.x1) / 2 - cx, z: (pad.z0 + pad.z1) / 2 - cz, w: pad.x1 - pad.x0, zFront: pad.z1 - cz, zBack: pad.z0 - cz };
  }
  return {
    group, layers: outLayers, segments, labels, rooms: roomsOut, lights, setLightsOn, carport, top, cut: CUT, labelGroup: lg,
    bbox: hasBox ? { x0: bx0, x1: bx1, z0: bz0, z1: bz1 } : null, roofTop: roofInfo?.top ?? top, interiorMax: interiorLevels,
    stats: { footprint: Math.round(slabArea(b.levels[0].slabs)), area: Math.round(area), floors: NL, missingBedrooms: 0, missingBathrooms: 0 },
  };
}

export { OPEN_DEFAULTS };
