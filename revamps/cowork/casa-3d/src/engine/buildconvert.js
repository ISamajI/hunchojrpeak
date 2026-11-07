// Auto house -> explicit build data (walls with openings, slabs, stairs, roof, fence) that looks the same.
import { layoutHouse } from './layout.js';
import { openingDims } from './house.js';
import { emptyBuild, emptyLevel, splitWalls, uid, refreshRooms, r2 } from './buildmodel.js';

const T = 0.2;
const PD = 2.6;
const OUT_FLOOR = { tile: 'ceramica', terracotta: 'terracota', concrete: 'cemento' };

export function blankBuild(state) {
  const b = emptyBuild(state.house);
  b.hint = { x0: -5, z0: -4, x1: 5, z1: 4 };   // dashed outline hint for the UI, not geometry
  b.roof = { ...b.roof, type: state.house.roof?.type ?? 'flat', material: state.house.roof?.material ?? 'concrete', color: state.house.roof?.color ?? '#e9e6df', overhang: state.house.eaves ?? 0.6 };
  refreshRooms(b);
  return b;
}

export function convertAuto(state) {
  const h = state.house, I = state.interior ?? {}, yard = state.yard, land = state.land;
  const W = h.width, D = h.depth, F = h.floors, FH = h.floorHeight;
  const plan = layoutHouse(h);
  const b = emptyBuild(h);
  b.floorHeight = FH;
  b.levels = [];
  const xc = W / 2 - T / 2, zc = D / 2 - T / 2;
  const slabBase = (rect) => {
    const s = { id: uid(), ...rect };
    if (!s.finish) s.finish = I.floor ?? 'porcelanato';
    return s;
  };
  const optional = {};
  if (I.floorTone) optional.tone = I.floorTone;
  if (I.floorPattern) optional.pattern = I.floorPattern;
  if (I.tileSize) optional.tileSize = I.tileSize;
  const anchors = [];
  const openingOf = (o, fc, wall) => {
    const d = openingDims(o.kind, h, FH);
    const u = fc.u(o);
    if (!(u - d.w / 2 > 0.25 && u + d.w / 2 < fc.len - 0.25)) return null;
    const at = fc.at(o);
    const base = { id: uid(), at: r2(at), w: +d.w.toFixed(2), h: +d.h.toFixed(2), sill: +d.sill.toFixed(2), style: null };
    if (d.door) return { ...base, kind: 'door', style: h.doorStyle, top: d.arched ? 'arch' : 'flat' };
    if (d.slider) return { ...base, kind: 'slider' };
    if (o.kind === 'small') return { ...base, kind: 'window', style: 'standard', bars: false };
    if (o.kind === 'narrow') return { ...base, kind: 'window', style: 'standard', top: d.arched ? 'arch' : 'flat' };
    return { ...base, kind: 'window', style: h.windowStyle, top: d.arched ? 'arch' : 'flat' };
  };

  for (const fl of plan) {
    const L = emptyLevel();
    const facades = {
      front: { len: W, wall: [-xc, zc, xc, zc], u: (o) => o.x + W / 2, at: (o) => o.x + xc },
      right: { len: D - 2 * T, wall: [xc, zc, xc, -zc], u: (o) => D / 2 - T - o.z, at: (o) => zc - o.z },
      back: { len: W, wall: [xc, -zc, -xc, -zc], u: (o) => W / 2 - o.x, at: (o) => xc - o.x },
      left: { len: D - 2 * T, wall: [-xc, -zc, -xc, zc], u: (o) => o.z + D / 2 - T, at: (o) => o.z + zc },
    };
    for (const [name, fc] of Object.entries(facades)) {
      const wall = { id: uid(), x0: fc.wall[0], z0: fc.wall[1], x1: fc.wall[2], z1: fc.wall[3], t: T, h: null, ext: true, openings: [] };
      for (const o of fl.openings[name]) {
        const q = openingOf(o, fc, wall);
        if (q) wall.openings.push(q);
      }
      wall.openings.sort((p, c) => p.at - c.at);
      L.walls.push(wall);
    }
    // Partitions: pieces + door gaps become one continuous wall per line, with openings.
    const lines = new Map();
    const lineFor = (horiz, c) => {
      const k = `${horiz ? 'h' : 'v'}${Math.round(c * 1000)}`;
      if (!lines.has(k)) lines.set(k, { horiz, c, lo: Infinity, hi: -Infinity, doors: [] });
      return lines.get(k);
    };
    for (const [x0, z0, x1, z1] of fl.walls) {
      const horiz = Math.abs(z0 - z1) < 1e-6;
      const ln = lineFor(horiz, horiz ? z0 : x0);
      ln.lo = Math.min(ln.lo, horiz ? Math.min(x0, x1) : Math.min(z0, z1));
      ln.hi = Math.max(ln.hi, horiz ? Math.max(x0, x1) : Math.max(z0, z1));
    }
    for (const dr of fl.doors ?? []) {
      const ln = lineFor(true, dr.z);
      ln.lo = Math.min(ln.lo, dr.x - dr.w / 2);
      ln.hi = Math.max(ln.hi, dr.x + dr.w / 2);
      ln.doors.push(dr);
    }
    for (const ln of lines.values()) {
      let lo = ln.lo, hi = ln.hi;
      if (ln.horiz) {
        if (Math.abs(lo - fl.xL) < 0.02) lo = -xc;
        if (Math.abs(hi - fl.xR) < 0.02) hi = xc;
      } else {
        if (Math.abs(lo - fl.zB) < 0.02) lo = -zc;
        if (Math.abs(hi - fl.zF) < 0.02) hi = zc;
      }
      const wall = { id: uid(), t: 0.15, h: null, ext: false, openings: [] };
      if (ln.horiz) Object.assign(wall, { x0: lo, z0: ln.c, x1: hi, z1: ln.c });
      else Object.assign(wall, { x0: ln.c, z0: lo, x1: ln.c, z1: hi });
      for (const dr of ln.doors) {
        const stairs = dr.room?.type === 'escalera';
        wall.openings.push({ id: uid(), kind: stairs || !dr.leaf ? 'arch' : 'door', at: r2(dr.x - lo), w: +dr.w.toFixed(2), h: stairs ? FH - 0.35 : 2.1, sill: 0, style: dr.leaf && !stairs ? 'panel' : null, top: 'flat' });
      }
      wall.openings.sort((p, c) => p.at - c.at);
      L.walls.push(wall);
    }
    L.slabs.push(slabBase({ x0: -W / 2, z0: -D / 2, x1: W / 2, z1: D / 2, ...optional }));
    // Stairs: one straight flight from each escalera room to the floor above.
    if (fl.level < F - 1) {
      for (const r of fl.rooms.filter((x) => x.type === 'escalera')) {
        const rw = r.x1 - r.x0, rd = r.z1 - r.z0;
        const sw = Math.min(1.1, rw - 0.3);
        const zs = (fl.zHallBack ?? r.z1) - 0.15;
        const side = (r.x0 + r.x1) / 2 > 0 ? -1 : 1;
        const cx = side > 0 ? r.x0 + 0.06 + sw / 2 : r.x1 - 0.06 - sw / 2;
        const n = Math.max(12, Math.ceil(FH / 0.185));
        const run = Math.min(0.27, (rd - 0.5) / n);
        L.stairs.push({ id: uid(), x: r2(cx), z: r2(zs), rot: 0, w: +sw.toFixed(2), len: +(n * run).toFixed(2) });
      }
    }
    for (const r of fl.rooms) anchors.push({ key: r.key, type: r.type, x: r2((r.x0 + r.x1) / 2), z: r2((r.z0 + r.z1) / 2) });
    b.levels.push(L);
  }
  // Porch, balcony and carport become slabs (posts, railings and roof follow from them).
  const outF = OUT_FLOOR[h.floorFinishOut] ?? 'ceramica';
  if (h.porch) b.levels[0].slabs.push(slabBase({ x0: -W / 2, z0: D / 2, x1: W / 2, z1: D / 2 + PD, finish: outF, kind: 'porch' }));
  if (h.balcony && F > 1) {
    if (h.porch) b.levels[1].slabs.push(slabBase({ x0: -W / 2 + 0.05, z0: D / 2, x1: W / 2 - 0.05, z1: D / 2 + PD, finish: outF, kind: 'balcony' }));
    else { const bw = Math.min(5, W * 0.5); b.levels[1].slabs.push(slabBase({ x0: -bw / 2, z0: D / 2, x1: bw / 2, z1: D / 2 + 1.5, finish: outF, kind: 'balcony' })); }
  }
  let driveX = null, driveW = 3.2;
  if (h.carport) {
    const s = h.carportSide === 'left' ? -1 : 1, CW = 3.6;
    const zFront = D / 2 + (h.porch ? PD : 0.6), zBack = Math.max(-D / 2, zFront - 6.2);
    const x0 = s * (W / 2), x1 = s * (W / 2 + CW);
    b.levels[0].slabs.push(slabBase({ x0: Math.min(x0, x1), z0: zBack, x1: Math.max(x0, x1), z1: zFront, finish: 'cemento', raised: false, kind: 'carport' }));
    driveX = h.offsetX + s * (W / 2 + CW / 2);
    driveW = CW;
  } else if (yard.driveway) {
    driveX = Math.min(land.width / 2 - 2.2, h.offsetX + W / 2 + 2.2);
  }
  for (const L of b.levels) splitWalls(b, L);
  // Roof
  b.roof = { type: h.roof.type, material: h.roof.material, color: h.roof.color, overhang: h.eaves ?? 0.6, parapet: true };
  b.extras = {
    roofTerrace: !!h.roofTerrace && h.roof.type === 'flat', pergola: h.style === 'moderna' && !!h.roofTerrace && h.roof.type === 'flat' && W > 10,
    waterTank: !!h.waterTank, solar: !!h.solar, entryPortal: h.style === 'moderna',
  };
  // Lot fence with its street gates.
  if (yard.fence === 'wall' || yard.fence === 'rejas') {
    const type = yard.fence === 'wall' ? 'block' : 'rejas';
    const LW = land.width, LD = land.depth, front = LD / 2;
    const mk = (x0, z0, x1, z1, gate) => {
      const f = { id: uid(), x0, z0, x1, z1, type, h: 1.9, color: yard.fenceColor };
      if (gate) f.gates = [gate];
      b.fences.push(f);
    };
    const gates = [{ x: h.offsetX, w: 1.3, kind: 'peatonal' }];
    if (driveX != null) gates.push({ x: driveX, w: Math.max(3.4, driveW), kind: 'vehicular' });
    gates.sort((p, c) => p.x - c.x);
    const cuts = [-LW / 2, ...gates.slice(1).map((g, i) => (g.x + gates[i].x) / 2), LW / 2];
    gates.forEach((g, i) => mk(cuts[i], front, cuts[i + 1], front, { at: r2(g.x - cuts[i]), w: g.w, kind: g.kind }));
    mk(-LW / 2, -LD / 2, LW / 2, -LD / 2);
    mk(-LW / 2, -LD / 2, -LW / 2, front);
    mk(LW / 2, -LD / 2, LW / 2, front);
  }
  b.rooms = anchors;
  b.defaultFinish = undefined;
  delete b.defaultFinish;
  refreshRooms(b);
  return b;
}
