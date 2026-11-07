// Parametric house generator. Front faces +z, ground at y = 0.
// Produces layered groups (per floor, roof, interiors) so the engine can
// cut the house open, plus 2D collision segments for walk mode.
import { Shape, Path, ExtrudeGeometry, ShapeGeometry, BufferGeometry, Float32BufferAttribute, Vector3, Vector2, Group, Sprite, SpriteMaterial, TorusGeometry, SphereGeometry, CylinderGeometry, LatheGeometry, PlaneGeometry, Matrix4, DoubleSide } from 'three';
import { createBuilder, mat4 } from './builder.js';
import { layoutHouse, roomName, T, P, FLOOR_T } from './layout.js';
import { labelCanvas, makeTexture } from './textures.js';
import { floorSpec } from './floors.js';
import { kit, furnitureSlots, sofa, armchair, bed, nightstand, coffeeTable, chair, diningTable, pendant, ceilingLight, tvUnit, bookshelf, desk, officeChair, rug, plant } from './indoor.js';

const PITCH = { hip: 24, gable: 26, shed: 10 };
const IRON = '#2c2c2c';
const ALUMINUM = '#c9ccd0';
const CURTAIN_ROOMS = new Set(['sala', 'dormitorio', 'principal']);

const num = (v, lo, hi, d) => (v !== null && v !== '' && Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d);
const pick = (v, list, d) => (list.includes(v) ? v : d);
const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

export function openingDims(kind, h, FH = 3) {
  const style = h.windowStyle;
  // Keep every opening under the lintel + next slab, whatever the ceiling height.
  const maxTop = FH - 0.42;
  const fit = (d) => ({ ...d, h: Math.max(0.5, Math.min(d.h, maxTop - d.sill)) });
  switch (kind) {
    case 'door': return fit({ w: h.doorStyle === 'double' ? 1.5 : h.doorStyle === 'glass' ? 1.2 : 1.0, h: style === 'arched' ? 2.6 : 2.3, sill: 0, arched: style === 'arched', door: true });
    case 'slider': return fit({ w: 2.0, h: 2.35, sill: 0, slider: true });
    case 'small': return fit({ w: 0.7, h: 0.6, sill: 1.65 });
    case 'narrow': return fit({ w: 0.6, h: 1.7, sill: 0.6, arched: style === 'arched' });
    default:
      if (style === 'tall') return fit({ w: 1.5, h: 2.25, sill: 0.25 });
      if (style === 'arched') return fit({ w: 1.1, h: 2.0, sill: 0.6, arched: true });
      if (style === 'louvered') return fit({ w: 1.3, h: 1.4, sill: 0.95, louvered: true });
      return fit({ w: 1.3, h: 1.3, sill: 1.0 });
  }
}

// Outline of an opening (rect, or rect with a half-circle top).
function outline(p, x, y, w, h, arched) {
  if (!arched) {
    p.moveTo(x, y); p.lineTo(x + w, y); p.lineTo(x + w, y + h); p.lineTo(x, y + h); p.lineTo(x, y);
    return p;
  }
  const r = w / 2, top = y + h - r;
  p.moveTo(x, y); p.lineTo(x + w, y); p.lineTo(x + w, top);
  p.absarc(x + r, top, r, 0, Math.PI, false);
  p.lineTo(x, y);
  return p;
}

function ring(w, h, arched, inset, depth) {
  const s = outline(new Shape(), 0, 0, w, h, arched);
  s.holes.push(outline(new Path(), inset, inset, w - 2 * inset, h - 2 * inset, arched));
  return new ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 16 });
}

// Turn a +z facing planar geometry around to face -z (wall linings face the room).
function flip(g) {
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setZ(i, -n.getZ(i));
  return g;
}

// A curtain panel with soft folds, hanging down from its top edge at y = ph.
function drape(pw, ph) {
  const folds = Math.max(2, Math.round(pw / 0.11));
  const g = new PlaneGeometry(pw, ph, folds * 2, 1);
  g.translate(0, ph / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, -0.03 * Math.sin((p.getX(i) / pw + 0.5) * folds * Math.PI * 2) - 0.03);
  g.computeVertexNormals();
  return g;
}

// Turned concrete baluster, 0.8 m tall (shared profile).
function balusterGeo() {
  const pts = [[0, 0], [0.055, 0], [0.055, 0.06], [0.035, 0.08], [0.03, 0.14], [0.058, 0.3], [0.062, 0.36], [0.04, 0.46], [0.027, 0.6], [0.034, 0.7], [0.05, 0.74], [0.05, 0.8], [0, 0.8]];
  return new LatheGeometry(pts.map(([x, y]) => new Vector2(x, y)), 8);
}

// Planar polygon with UVs measured along the eave (u) and up the slope (v).
function roofPlane(pts) {
  const [a, b] = pts;
  const e = new Vector3().subVectors(b, a).setY(0).normalize();
  const n = new Vector3().subVectors(pts[1], pts[0]).cross(new Vector3().subVectors(pts[2], pts[0])).normalize();
  if (n.y < 0) { pts = [...pts].reverse(); n.negate(); }
  const s = new Vector3().crossVectors(n, e).normalize();
  if (s.y < 0) s.negate();
  const pos = [], uv = [], nor = [];
  for (let i = 1; i < pts.length - 1; i++) {
    for (const p of [pts[0], pts[i], pts[i + 1]]) {
      pos.push(p.x, p.y, p.z);
      nor.push(n.x, n.y, n.z);
      const d = new Vector3().subVectors(p, a);
      uv.push(d.dot(e), d.dot(s));
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}

const v3 = (x, y, z) => new Vector3(x, y, z);

export function buildHouse(state, mats, lang = 'es', { interiors = true } = {}) {
  const h = state.house;
  const I = state.interior ?? {};
  const { floors: F, width: W, depth: D } = h;
  // New settings are read defensively: older saves may not have them yet.
  const FH = num(h.floorHeight, 2.5, 4, 3);
  const C = h.colors;
  const top = P + F * FH;
  const fancy = h.style === 'colonial' || h.style === 'caribena';
  const modern = h.style === 'moderna';
  const flatRoof = h.roof.type === 'flat';
  const eaves = num(h.eaves, 0.1, 1.5, 0.6);
  const columnStyle = pick(h.columnStyle, ['square', 'round', 'classic'], modern || h.style === 'campo' ? 'square' : h.style === 'colonial' ? 'classic' : 'round');
  const railStyle = pick(h.railing, ['iron', 'balusters', 'glass', 'concrete'], modern ? 'glass' : h.style === 'colonial' ? 'balusters' : 'iron');
  const doorStyle = pick(h.doorStyle, ['panel', 'double', 'glass'], modern ? 'glass' : h.style === 'campo' ? 'panel' : 'double');
  const outFloor = pick(h.floorFinishOut, ['tile', 'terracotta', 'concrete'], modern ? 'concrete' : h.style === 'campo' ? 'terracotta' : 'tile');
  const hd = { ...h, doorStyle };
  const H = FH - 0.25; // clear room height: ceiling sits under the next slab
  const plan = layoutHouse(h);

  const M = {
    walls: { material: mats.paint(C.walls, h.wallFinish === 'block' ? 'block' : 'smooth', { grime: true }), part: 'walls' },
    trim: { material: mats.paint(C.trim), part: 'trim' },
    base: { material: h.wallFinish === 'stone-base' ? mats.textured('stone', '#ffffff', { roughness: 0.95, normalScale: 1.2 }) : mats.paint(C.base, 'smooth', { grime: true }), part: 'base' },
    door: { material: mats.textured('wood', C.door, { roughness: 0.6 }), part: 'door' },
    frame: { material: mats.plain(C.windows, { roughness: 0.45, metalness: 0.25 }), part: 'windows' },
    glass: { material: mats.glass(), part: 'windows' },
    glassWin: { material: mats.glass('window'), part: 'windows' },
    clear: { material: mats.clearGlass(), part: null, shadow: false },
    accent: { material: mats.textured('wood', C.accent, { roughness: 0.65 }), part: 'accent' },
    roof: { material: mats.roof(h.roof.material, h.roof.color), part: 'roof', keepUV: true },
    roofFlat: { material: mats.textured('roofSlab', h.roof.color, { roughness: 0.9, normalScale: 0.5 }), part: 'roof' },
    outFloor: { material: mats.outFloor(outFloor), part: null },
    concrete: { material: mats.textured('concrete', '#d7d3cc'), part: null },
    iron: { material: mats.plain(IRON, { roughness: 0.5, metalness: 0.6 }), part: null },
    alu: { material: mats.plain(ALUMINUM, { roughness: 0.35, metalness: 0.8 }), part: null },
    tank: { material: mats.plain('#1d1f21', { roughness: 0.55 }), part: null },
    solar: { material: mats.plain('#1b2a4a', { roughness: 0.15, metalness: 0.6 }), part: null },
    casing: { material: mats.plain('#f7f6f2', { roughness: 0.55 }), part: null },
    leaf: { material: mats.wood(I.wood), part: null },
    ceiling: { material: mats.plain('#f8f7f3', { roughness: 0.95 }), part: null, shadow: false },
    plaster: { material: mats.paint('#ece8e1', 'smooth', { soft: true }), part: null },
    tread: { material: mats.wood(I.wood), part: null },
    beam: { material: mats.textured('wood', '#8a6446', { roughness: 0.8 }), part: null },
    curtain: { material: mats.textured('fabric', '#e9dfcf', { roughness: 1, side: DoubleSide, normalScale: 0.4 }), part: null, shadow: false },
  };
  // Built-in furniture slots: four of them are user-editable, so they carry `furn:*` parts.
  const FS = furnitureSlots(mats, I, (k) => (k === 'wood' ? 'furn:wood' : k === 'sofa' ? 'furn:sofa' : null));
  FS.cabinets = { material: mats.textured('wood', isHex(I.cabinets) ? I.cabinets : '#6f5a48', { roughness: 0.75, side: DoubleSide }), part: 'furn:cabinets' };
  FS.counter = { material: mats.counter(I.counter), part: 'furn:counter' };
  FS.tile = { material: mats.textured('wallTile', '#ffffff', { roughness: 1, side: DoubleSide }), part: null };
  FS.mirror = { material: mats.mirror(), part: null };
  FS.clear = M.clear;
  FS.kick = { material: mats.plain('#2a2522', { roughness: 0.8 }), part: null };
  FS.bathRug = { material: mats.fabric('#9fb3b8'), part: null, shadow: false };

  // Per-room finishes: room override, else the whole-house default.
  const defWall = isHex(I.wallColor) ? I.wallColor : '#f5f2ec';
  const ov = (r) => (r && I.rooms && typeof I.rooms === 'object' && I.rooms[r.key]) || {};
  const wallOf = (r) => ({ material: mats.paint(isHex(ov(r).wall) ? ov(r).wall : defWall, 'smooth', { soft: true }), part: r ? `room:${r.key}` : null });
  // Finish per room: floor, tone, layout, tile size and zócalo, each room's own else the house default.
  // The floor's texture grid starts at the room's corner, so tiles are cut at the far walls like real work.
  const floorOf = (r) => ({ material: mats.floor(floorSpec(I, r?.key)), part: r ? `room:${r.key}` : null, uvShift: r ? [-r.x0, -r.z0] : null });
  // Baseboard: the zócalo color when one is picked, else cut from the floor material.
  const baseOf = (r) => {
    const sp = floorSpec(I, r?.key);
    return { material: sp.baseboard ? mats.plain(sp.baseboard, { roughness: 0.5 }) : mats.floor(sp), part: r ? `room:${r.key}` : null };
  };
  const wKey = (r) => `wall:${r?.key ?? '-'}`;
  const fKey = (r) => `floor:${r?.key ?? '-'}`;
  const bKey = (r) => `zoc:${r?.key ?? '-'}`;

  const layers = { roof: createBuilder() };
  for (let i = 0; i < F; i++) { layers[`f${i}`] = createBuilder(); layers[`in${i}`] = createBuilder({ skip: !interiors }); layers[`cap${i}`] = createBuilder(); }
  const CUT = 1.35; // cutaway height above each floor
  const capM = { material: mats.plain('#5d615f', { roughness: 0.9 }), part: null, shadow: false };
  const segments = [];
  const labels = [];
  const lights = [];
  const BAL = balusterGeo();

  // ---- facades -------------------------------------------------------------
  const facades = {
    front: { len: W, M: mat4(-W / 2, 0, D / 2 - T, 0), u: (o) => o.x + W / 2 },
    back: { len: W, M: mat4(W / 2, 0, -D / 2 + T, Math.PI), u: (o) => W / 2 - o.x },
    left: { len: D - 2 * T, M: mat4(-W / 2 + T, 0, -D / 2 + T, -Math.PI / 2), u: (o) => o.z + D / 2 - T },
    right: { len: D - 2 * T, M: mat4(W / 2 - T, 0, D / 2 - T, Math.PI / 2), u: (o) => D / 2 - T - o.z },
  };
  const toWorld2D = (f, u) => {
    const p = new Vector3(u, 0, 0).applyMatrix4(facades[f].M);
    return [p.x, p.z];
  };

  for (const fl of plan) {
    const L = layers[`f${fl.level}`];
    const y0 = P + fl.level * FH;
    for (const [name, fc] of Object.entries(facades)) {
      const ops = fl.openings[name]
        .map((o) => ({ ...o, u: fc.u(o), d: openingDims(o.kind, hd, FH) }))
        .filter((o) => o.u - o.d.w / 2 > 0.25 && o.u + o.d.w / 2 < fc.len - 0.25);
      // Wall with holes.
      const s = new Shape();
      s.moveTo(0, 0); s.lineTo(fc.len, 0); s.lineTo(fc.len, FH); s.lineTo(0, FH); s.lineTo(0, 0);
      for (const o of ops) s.holes.push(outline(new Path(), o.u - o.d.w / 2, o.d.sill, o.d.w, o.d.h, o.d.arched));
      L.add('walls', new ExtrudeGeometry(s, { depth: T, bevelEnabled: false, curveSegments: 16 }), fc.M.clone().multiply(mat4(0, y0, 0)), M.walls);

      // Collision: wall pieces between doors.
      let u = 0;
      for (const o of [...ops.filter((k) => k.d.door || k.d.slider)].sort((a, b) => a.u - b.u)) {
        segments.push({ a: toWorld2D(name, u), b: toWorld2D(name, o.u - o.d.w / 2), level: fl.level });
        u = o.u + o.d.w / 2;
      }
      segments.push({ a: toWorld2D(name, u), b: toWorld2D(name, fc.len), level: fl.level });

      for (const o of ops) addOpening(L, fc.M, o, y0, fl.level);
      lineFacade(fl, name, fc, ops, y0);
      // Section cap: the wall as a floor plan draws it, with gaps at openings.
      let cu = 0;
      for (const o of ops.filter((k) => k.d.sill < CUT && k.d.sill + k.d.h > CUT).sort((a, b) => a.u - b.u)) {
        const e = o.u - o.d.w / 2;
        if (e > cu) layers[`cap${fl.level}`].box('cap', capM, e - cu, 0.03, T, (cu + e) / 2, y0 + CUT, T / 2, fc.M);
        cu = o.u + o.d.w / 2;
      }
      if (fc.len > cu) layers[`cap${fl.level}`].box('cap', capM, fc.len - cu, 0.03, T, (cu + fc.len) / 2, y0 + CUT, T / 2, fc.M);
    }
    // Slab edge band between floors.
    if (fl.level > 0) L.box('trim', M.trim, W + 0.08, 0.24, D + 0.08, 0, y0 - 0.12, 0);
    buildInterior(fl, y0);
  }

  // Inside face of an outer wall: one painted lining per room (with the same
  // holes as the facade), baseboards, and curtains on living/bedroom windows.
  function lineFacade(fl, name, fc, ops, y0) {
    const IN = layers[`in${fl.level}`];
    const W2 = W / 2, D2 = D / 2;
    const span = {
      front: (r) => Math.abs(r.z1 - fl.zF) < 0.01 && [r.x0 + W2, r.x1 + W2],
      back: (r) => Math.abs(r.z0 - fl.zB) < 0.01 && [W2 - r.x1, W2 - r.x0],
      left: (r) => Math.abs(r.x0 - fl.xL) < 0.01 && [r.z0 + D2 - T, r.z1 + D2 - T],
      right: (r) => Math.abs(r.x1 - fl.xR) < 0.01 && [D2 - T - r.z1, D2 - T - r.z0],
    }[name];
    const lo = name === 'front' || name === 'back' ? T : 0;
    const hi = name === 'front' || name === 'back' ? fc.len - T : fc.len;
    const segs = fl.rooms.map((r) => { const sp = span(r); return sp && { r, a: sp[0], b: sp[1] }; }).filter(Boolean).sort((p, q) => p.a - q.a);
    if (!segs.length) return;
    segs[0].a = lo;
    segs[segs.length - 1].b = hi;
    for (let i = 1; i < segs.length; i++) {
      // Close gaps, then never split an opening: move the joint to its nearer edge.
      let m = (segs[i - 1].b + segs[i].a) / 2;
      for (const o of ops) {
        const e0 = o.u - o.d.w / 2 - 0.03, e1 = o.u + o.d.w / 2 + 0.03;
        if (m > e0 && m < e1) m = m - e0 < e1 - m ? e0 : e1;
      }
      segs[i - 1].b = m; segs[i].a = m;
    }
    const FM = fc.M.clone().multiply(mat4(0, y0, 0));
    for (const { r, a, b } of segs) {
      if (b - a < 0.02) continue;
      const mine = ops.filter((o) => o.u > a && o.u < b);
      const doors = mine.filter((o) => o.d.sill < 0.05).sort((p, q) => p.u - q.u);
      const s = new Shape();
      s.moveTo(a, FLOOR_T);
      for (const o of doors) {
        // Doors notch the bottom edge instead of being holes.
        const l = o.u - o.d.w / 2, rr = o.u + o.d.w / 2, tp = o.d.sill + o.d.h;
        s.lineTo(l, FLOOR_T);
        if (o.d.arched) { s.lineTo(l, tp - o.d.w / 2); s.absarc(o.u, tp - o.d.w / 2, o.d.w / 2, Math.PI, 0, true); }
        else { s.lineTo(l, tp); s.lineTo(rr, tp); }
        s.lineTo(rr, FLOOR_T);
      }
      s.lineTo(b, FLOOR_T); s.lineTo(b, H); s.lineTo(a, H); s.lineTo(a, FLOOR_T);
      for (const o of mine) if (o.d.sill >= 0.05) s.holes.push(outline(new Path(), o.u - o.d.w / 2, o.d.sill, o.d.w, o.d.h, o.d.arched));
      IN.add(wKey(r), flip(new ShapeGeometry(s, 12)), FM.clone().multiply(mat4(0, 0, -0.004)), wallOf(r));
      // Baseboard (zócalo) in the room's floor finish, broken at doors.
      let bu = a;
      for (const o of [...doors, { u: b + 9, d: { w: 0 } }]) {
        const e = Math.min(b, o.u - o.d.w / 2);
        if (e - bu > 0.05) IN.box(bKey(r), baseOf(r), e - bu, 0.08, 0.014, (bu + e) / 2, FLOOR_T + 0.04, -0.011, FM);
        bu = o.u + o.d.w / 2;
      }
      if (CURTAIN_ROOMS.has(r.type)) for (const o of mine) if (!o.d.door) curtain(IN, FM, o, a, b, r);
    }
  }

  function curtain(IN, FM, o, a, b, r) {
    const { w, sill, h: oh } = o.d;
    const rodY = Math.min(H - 0.08, sill + oh + 0.14);
    const floorLen = r.type === 'sala' || sill < 0.7;
    const bottom = floorLen ? FLOOR_T + 0.015 : Math.max(FLOOR_T + 0.05, sill - 0.2);
    const ph = rodY - 0.035 - bottom;
    const want = Math.min(0.5, w * 0.3 + 0.16);
    const rl = Math.min(w + 2 * want, b - a - 0.1);
    IN.geo('rod', M.iron, new CylinderGeometry(0.011, 0.011, rl, 8), Math.max(a + 0.05 + rl / 2, Math.min(b - 0.05 - rl / 2, o.u)), rodY, -0.09, FM, 0, 0, Math.PI / 2);
    for (const side of [-1, 1]) {
      const inner = o.u + side * (w / 2 - 0.1);
      const outer = side < 0 ? Math.max(a + 0.04, inner - want) : Math.min(b - 0.04, inner + want);
      const pw = Math.abs(outer - inner);
      if (pw < 0.15) continue;
      IN.add('curtain', drape(pw, ph), FM.clone().multiply(mat4((inner + outer) / 2, bottom, -0.07)), M.curtain);
    }
  }

  function addOpening(L, FM, o, y0, level) {
    const { w, h: oh, sill, arched } = o.d;
    const x = o.u - w / 2;
    const at = (lx, ly, lz) => FM.clone().multiply(mat4(lx, y0 + ly, lz));
    const F0 = at(0, 0, 0);
    // Reveal surround on the outside face + a lintel band above it.
    const sw = fancy ? 0.16 : 0.1;
    if (!modern || o.d.door) {
      L.add('trim', ring(w + sw * 2, oh + sw, arched, sw, 0.04), at(x - sw, sill, T), M.trim);
      if (!arched && !modern) L.box('trim', M.trim, w + sw * 2 + 0.12, 0.12, 0.07, o.u, sill + oh + sw + 0.06, T + 0.035, F0);
      if (arched && fancy) L.box('trim', M.trim, 0.16, 0.24, 0.07, o.u, sill + oh + sw / 2, T + 0.04, F0); // keystone
    }
    if (o.d.door) { frontDoor(L, o, x, F0, at, level); return; }
    if (o.d.slider) {
      L.add('frame', ring(w, oh, false, 0.06, 0.1), at(x, sill, T * 0.4), M.frame);
      for (const k of [0, 1]) {
        L.add('frame', ring(w / 2 + 0.02, oh - 0.12, false, 0.05, 0.03), at(x + 0.06 + k * (w / 2 - 0.08), sill + 0.06, T * 0.45 + (k ? -0.025 : 0.015)), M.frame);
        // Glass panes face outward only, so from inside you look through them.
        L.add('glassWin', new PlaneGeometry(w / 2 - 0.08, oh - 0.22), at(x + 0.06 + k * (w / 2 - 0.08) + (w / 2 + 0.02) / 2, sill + oh / 2, T * 0.45 + (k ? -0.01 : 0.03)), M.glassWin);
      }
      return;
    }
    // Window frame (visible depth), glass, sashes / mullions / louvers.
    L.add('frame', ring(w, oh, arched, 0.06, 0.1), at(x, sill, T * 0.3), M.frame);
    if (o.d.louvered) {
      const n = Math.floor((oh - 0.12) / 0.11);
      for (let i = 0; i < n; i++) {
        const g = mat4(o.u, sill + 0.1 + i * 0.11 + 0.05, T * 0.55, 0, -0.55);
        L.box('frame', M.frame, w - 0.12, 0.1, 0.012, 0, 0, 0, FM.clone().multiply(mat4(0, y0, 0)).multiply(g));
      }
      L.box('frame', M.frame, 0.04, oh - 0.12, 0.05, o.u, sill + oh / 2, T * 0.55, F0);
      L.add('glassWin', new PlaneGeometry(w - 0.14, oh - 0.14), at(o.u, sill + oh / 2, T * 0.32), M.glassWin);
    } else {
      const gs = outline(new Shape(), 0, 0, w - 0.12, oh - 0.12, arched);
      L.add('glassWin', new ShapeGeometry(gs, 16), at(x + 0.06, sill + 0.06, T * 0.5), M.glassWin);
      if (!arched && o.kind !== 'small' && w > 0.9) {
        // Two sliding sashes (ventanas corredizas) overlapping at the middle.
        for (const k of [0, 1]) L.add('frame', ring(w / 2 - 0.02, oh - 0.12, false, 0.04, 0.03), at(x + 0.06 + k * (w / 2 - 0.1), sill + 0.06, T * 0.5 + (k ? -0.035 : 0.008)), M.frame);
        if (h.windowStyle === 'tall') L.box('frame', M.frame, w - 0.12, 0.04, 0.05, o.u, sill + oh * 0.7, T * 0.55, F0);
      } else if (o.kind !== 'small') {
        L.box('frame', M.frame, 0.04, oh - 0.12, 0.05, o.u, sill + oh / 2, T * 0.55, F0);
        if (h.windowStyle === 'tall' || arched) L.box('frame', M.frame, w - 0.12, 0.04, 0.05, o.u, sill + oh * (arched ? 0.62 : 0.7), T * 0.55, F0);
      }
    }
    // Sill outside (projecting, with a drip edge) and a stool inside.
    L.box('trim', M.trim, w + 0.24, 0.06, 0.17, o.u, sill - 0.03, T + 0.055, F0);
    L.box('trim', M.trim, w + 0.24, 0.025, 0.03, o.u, sill - 0.07, T + 0.125, F0);
    L.box('casing', M.casing, w + 0.1, 0.03, 0.08, o.u, sill - 0.015, -0.03, F0);
    // Shutters on traditional styles.
    if (!modern && h.style !== 'campo' && o.kind === 'window' && !arched) {
      for (const side of [-1, 1]) {
        const sx = o.u + side * (w / 2 + 0.2 + w / 4);
        L.box('accent', M.accent, w / 2, oh, 0.04, sx, sill + oh / 2, T + 0.05, F0);
        for (let k = 0; k < oh / 0.12 - 1; k++) L.box('accent', M.accent, w / 2 - 0.08, 0.02, 0.03, sx, sill + 0.1 + k * 0.12, T + 0.08, F0);
      }
    }
    // Rejas (decorative window bars).
    if (h.windowBars && o.kind !== 'small') {
      const bw = w + 0.08, bh = (arched ? oh - w / 2 : oh) + 0.04;
      const z = T + 0.09;
      L.add('frame', ring(bw, bh, false, 0.03, 0.025), at(o.u - bw / 2, sill - 0.02, z), M.frame);
      const n = Math.max(3, Math.round(bw / 0.13));
      for (let i = 1; i < n; i++) L.box('frame', M.frame, 0.018, bh, 0.018, o.u - bw / 2 + (i * bw) / n, sill - 0.02 + bh / 2, z + 0.012, F0);
      for (const t of [0.33, 0.66]) L.box('frame', M.frame, bw, 0.025, 0.02, o.u, sill + bh * t, z + 0.012, F0);
      for (let i = 0; i < Math.max(1, Math.floor(bw / 0.45)); i++) {
        const cx = o.u - bw / 2 + ((i + 0.5) * bw) / Math.max(1, Math.floor(bw / 0.45));
        L.add('frame', new TorusGeometry(0.1, 0.012, 6, 20), at(cx, sill + bh * 0.495, z + 0.012), M.frame);
      }
    }
  }

  // Front door by style: panel (single), double (two leaves), glass (wood leaf + tall light).
  function frontDoor(L, o, x, F0, at, level) {
    const { w, h: oh, sill, arched } = o.d;
    L.add('frame', ring(w, oh, arched, 0.07, 0.15), at(x, sill, T * 0.25), M.frame);
    const zL = T * 0.35, lt = 0.055;
    const leaves = doorStyle === 'double' ? 2 : 1;
    const lw = (w - 0.14) / leaves;
    const square = arched && (leaves === 2 || doorStyle === 'glass');
    const lh = (square ? oh - w / 2 : oh) - 0.07;
    for (let i = 0; i < leaves; i++) {
      const lx = x + 0.07 + i * lw;
      const ds = outline(new Shape(), 0, 0, lw - 0.006, lh, arched && !square);
      if (doorStyle === 'glass') {
        const gw = Math.min(0.42, lw * 0.4), gx = (lw - gw) / 2, gh = lh - 0.55;
        ds.holes.push(outline(new Path(), gx, 0.3, gw, gh, false));
        L.add('door', new ExtrudeGeometry(ds, { depth: lt, bevelEnabled: false }), at(lx, sill, zL), M.door);
        L.box('glass', M.glass, gw + 0.02, gh + 0.02, 0.012, lx + gx + gw / 2, sill + 0.3 + gh / 2, zL + lt / 2, F0);
        // Long pull bar on standoffs.
        const hx = lx + lw - 0.11;
        L.box('alu', M.alu, 0.028, 1.1, 0.028, hx, sill + 1.05, zL + lt + 0.07, F0);
        for (const dy of [-0.45, 0.45]) L.box('alu', M.alu, 0.016, 0.016, 0.07, hx, sill + 1.05 + dy, zL + lt + 0.035, F0);
        continue;
      }
      L.add('door', new ExtrudeGeometry(ds, { depth: lt, bevelEnabled: false, curveSegments: 16 }), at(lx, sill, zL), M.door);
      // Raised, bevelled panels: 2 columns on a wide single leaf, 3 rows.
      const cols = leaves === 1 && lw > 0.8 ? 2 : 1;
      const rows = 3, top = (arched && !square ? lh - lw / 2 : lh) - 0.12;
      const ph = (top - 0.14) / rows, pw = (lw - 0.12) / cols;
      for (let c = 0; c < cols; c++) for (let k = 0; k < rows; k++) {
        const hgt = k === 1 ? ph * 0.55 : ph * 1.15;
        const y = k === 0 ? 0.14 + hgt / 2 : k === 1 ? 0.14 + ph * 1.15 + 0.06 + hgt / 2 : top - hgt / 2;
        if (y + hgt / 2 > top + 0.01) continue;
        L.rbox('door', M.door, pw - 0.07, hgt - 0.06, 0.03, 0.012, lx + 0.06 + pw * (c + 0.5), sill + y, zL + lt + 0.005, F0);
      }
      // Lever handle with a back plate.
      const hx = lx + (leaves === 2 ? (i === 0 ? lw - 0.09 : 0.09) : lw - 0.09);
      L.box('alu', M.alu, 0.045, 0.2, 0.012, hx, sill + 1.02, zL + lt + 0.006, F0);
      L.box('alu', M.alu, 0.12, 0.018, 0.018, hx + (i === 0 ? -0.04 : 0.04), sill + 1.05, zL + lt + 0.045, F0);
    }
    if (square) L.add('glass', new ShapeGeometry(new Shape().absarc(0, 0, w / 2 - 0.07, 0, Math.PI, false)), at(x + w / 2, sill + oh - w / 2, T * 0.45), M.glass);
    // Threshold, and steps down to the yard when there is no porch.
    L.box('trim', M.trim, w + 0.3, 0.05, 0.35, o.u, sill - 0.02, T + 0.15, F0);
    if (level === 0 && !h.porch && o.kind === 'door') {
      const rise = P / 3;
      for (let i = 0; i < 3; i++) {
        const ht = P - i * rise, dz = 0.36 + i * 0.3;
        L.box('concrete', M.concrete, w + 0.9 - i * 0.0, ht, 0.32, o.u, -P + ht / 2, T + dz - 0.16 + 0.17, F0);
        L.box('outFloor', M.outFloor, w + 0.92, 0.02, 0.33, o.u, -P + ht + 0.01, T + dz - 0.16 + 0.17, F0);
      }
    }
  }

  // ---- plinth, floor bands, corners --------------------------------------------
  const G = layers.f0;
  G.box('base', M.base, W + 0.12, P, D + 0.12, 0, P / 2, 0);
  if (h.wallFinish === 'stone-base') {
    // Stone skirt on the front between openings, plus full plinth.
    const door = openingDims('door', hd, FH);
    for (const [x0, x1] of [[-W / 2, -door.w / 2 - 0.2], [door.w / 2 + 0.2, W / 2]]) {
      if (x1 - x0 > 0.2) G.box('base', M.base, x1 - x0, 0.75, 0.05, (x0 + x1) / 2, P + 0.375, D / 2 + 0.025);
    }
  }
  if (fancy || h.style === 'campo') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) G.box('trim', M.trim, 0.3, top - P, 0.3, sx * (W / 2 - 0.12), P + (top - P) / 2, sz * (D / 2 - 0.12));
  }

  // ---- porch (galería), balcony, carport ---------------------------------------
  const PD = 2.6;
  const balconyOverPorch = h.porch && h.balcony && F > 1;

  function column(L, x, z, y0, y1) {
    const ht = y1 - y0;
    if (columnStyle === 'square') {
      L.box('trim', M.trim, 0.38, 0.14, 0.38, x, y0 + 0.07, z);
      L.box('trim', M.trim, 0.28, ht - 0.26, 0.28, x, y0 + 0.14 + (ht - 0.26) / 2, z);
      L.box('trim', M.trim, 0.36, 0.12, 0.36, x, y1 - 0.06, z);
    } else if (columnStyle === 'round') {
      L.box('trim', M.trim, 0.38, 0.18, 0.38, x, y0 + 0.09, z);
      L.cyl('trim', M.trim, 0.13, 0.15, ht - 0.34, x, y0 + 0.18 + (ht - 0.34) / 2, z, null, 24);
      L.cyl('trim', M.trim, 0.19, 0.14, 0.1, x, y1 - 0.11, z, null, 24);
      L.box('trim', M.trim, 0.38, 0.06, 0.38, x, y1 - 0.03, z);
    } else {
      // Classic: plinth, torus base, tapered shaft, astragal ring, echinus, abacus.
      L.box('trim', M.trim, 0.42, 0.12, 0.42, x, y0 + 0.06, z);
      L.add('trim', new TorusGeometry(0.165, 0.04, 8, 24), mat4(x, y0 + 0.16, z, 0, Math.PI / 2), M.trim);
      L.cyl('trim', M.trim, 0.17, 0.17, 0.06, x, y0 + 0.15, z, null, 24);
      const sh = ht - 0.5;
      L.cyl('trim', M.trim, 0.125, 0.15, sh, x, y0 + 0.2 + sh / 2, z, null, 24);
      L.add('trim', new TorusGeometry(0.13, 0.02, 6, 24), mat4(x, y0 + 0.2 + sh, z, 0, Math.PI / 2), M.trim);
      L.cyl('trim', M.trim, 0.21, 0.13, 0.14, x, y1 - 0.15, z, null, 24);
      L.box('trim', M.trim, 0.44, 0.08, 0.44, x, y1 - 0.04, z);
    }
  }

  // Railing between two points by the chosen style; y is the walking surface.
  function railing(L, x0, z0, x1, z1, y) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.15) return;
    const ry = Math.atan2(-(z1 - z0), x1 - x0);
    const Mx = mat4(x0, y, z0, ry);
    if (railStyle === 'glass') {
      const n = Math.max(1, Math.ceil(len / 1.5));
      for (let i = 0; i < n; i++) L.box('clear', M.clear, len / n - 0.03, 0.86, 0.015, ((i + 0.5) * len) / n, 0.53, 0, Mx);
      L.box('alu', M.alu, len, 0.09, 0.06, len / 2, 0.045, 0, Mx);
      L.rbox('alu', M.alu, len, 0.05, 0.06, 0.02, len / 2, 0.98, 0, Mx);
      return;
    }
    if (railStyle === 'concrete') {
      L.box('walls', M.walls, len, 0.92, 0.14, len / 2, 0.46, 0, Mx);
      L.box('trim', M.trim, len + 0.04, 0.06, 0.2, len / 2, 0.95, 0, Mx);
      return;
    }
    if (railStyle === 'balusters') {
      L.rbox('trim', M.trim, len, 0.09, 0.17, 0.025, len / 2, 0.93, 0, Mx);
      L.box('trim', M.trim, len, 0.08, 0.15, len / 2, 0.04, 0, Mx);
      const n = Math.floor(len / 0.17);
      for (let i = 1; i < n; i++) L.add('trim', BAL.clone(), Mx.clone().multiply(mat4((i * len) / n, 0.08, 0)), M.trim);
      for (const t of [0, len]) L.box('trim', M.trim, 0.2, 1.0, 0.2, t, 0.5, 0, Mx);
      return;
    }
    // Iron: square pickets between rails, scroll rings, posts every ~2 m.
    L.box('iron', M.iron, len, 0.045, 0.05, len / 2, 0.97, 0, Mx);
    L.box('iron', M.iron, len, 0.03, 0.03, len / 2, 0.1, 0, Mx);
    const n = Math.max(2, Math.floor(len / 0.12));
    for (let i = 1; i < n; i++) L.box('iron', M.iron, 0.016, 0.86, 0.016, (i * len) / n, 0.53, 0, Mx);
    const k = Math.max(1, Math.floor(len / 1.0));
    for (let i = 0; i < k; i++) L.add('iron', new TorusGeometry(0.09, 0.009, 4, 16), Mx.clone().multiply(mat4(((i + 0.5) * len) / k, 0.78, 0)), M.iron);
    const np = Math.max(1, Math.round(len / 2));
    for (let i = 0; i <= np; i++) L.box('iron', M.iron, 0.045, 1.0, 0.045, (i * len) / np, 0.5, 0, Mx);
  }

  function gingerbread(L, x0, x1, y, z) {
    // Scalloped fretwork band hanging under an eave (Puerto Plata style).
    const len = x1 - x0, n = Math.max(2, Math.round(len / 0.5)), sw = len / n;
    const s = new Shape();
    s.moveTo(0, 0.28); s.lineTo(len, 0.28); s.lineTo(len, 0.12);
    for (let i = n - 1; i >= 0; i--) {
      s.absarc(i * sw + sw / 2, 0.12, sw / 2, 0, Math.PI, true);
    }
    s.lineTo(0, 0.28);
    for (let i = 0; i < n; i++) s.holes.push(new Path().absarc(i * sw + sw / 2, 0.2, 0.035, 0, Math.PI * 2, true));
    L.add('trim', new ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false, curveSegments: 6 }), mat4(x0, y - 0.28, z), M.trim);
  }

  function leanTo(L, pts) {
    L.add('roof', roofPlane(pts), null, M.roof);
  }

  const doorX = 0;
  const doorTop = openingDims('door', hd, FH).h;
  if (h.porch) {
    const L = layers.f0;
    const z0 = D / 2, z1 = D / 2 + PD;
    L.box('base', M.base, W, P, PD, 0, P / 2, (z0 + z1) / 2);
    L.box('outFloor', M.outFloor, W - 0.02, 0.02, PD - 0.02, 0, P + 0.01, (z0 + z1) / 2);
    for (let i = 0; i < 3; i++) {
      const ht = P - i * 0.15;
      L.box('concrete', M.concrete, 2.2, ht - 0.02, 0.32, doorX, (ht - 0.02) / 2, z1 + 0.16 + i * 0.32);
      L.box('outFloor', M.outFloor, 2.22, 0.02, 0.33, doorX, ht - 0.01, z1 + 0.16 + i * 0.32);
    }
    const yTop = balconyOverPorch || flatRoof ? P + FH : P + FH - (F === 1 ? 0.55 : 0.2);
    const xs = [];
    const n = Math.max(2, Math.round(W / 3.4) + 1);
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + 0.25 + (i * (W - 0.5)) / (n - 1);
      if (Math.abs(x - doorX) > 1.3) xs.push(x);
    }
    for (const x of xs) column(L, x, z1 - 0.25, P, yTop - 0.25);
    L.box('trim', M.trim, W, 0.25, 0.3, 0, yTop - 0.125, z1 - 0.25);
    if (fancy) {
      railing(L, -W / 2 + 0.25, z1 - 0.25, doorX - 1.15, z1 - 0.25, P);
      railing(L, doorX + 1.15, z1 - 0.25, W / 2 - 0.25, z1 - 0.25, P);
    }
    if (h.style === 'colonial') gingerbread(L, -W / 2 + 0.1, W / 2 - 0.1, yTop - 0.25, z1 - 0.2);
    // Porch ceiling lights.
    for (const x of [-W / 4, W / 4]) ceilingLight(kit(L, FS, mat4(x, yTop - 0.03, (z0 + z1) / 2), 'k:'), 0.12);
    // Collision for columns.
    for (const x of xs) segments.push({ a: [x - 0.15, z1 - 0.25], b: [x + 0.15, z1 - 0.25], level: 0 });

    if (balconyOverPorch || flatRoof) {
      L.box('trim', M.trim, W + 0.1, 0.28, PD + 0.15, 0, yTop + 0.14, (z0 + z1) / 2 + 0.07);
      L.box('trim', M.trim, W - 0.4, 0.02, PD - 0.4, 0, yTop - 0.01, (z0 + z1) / 2);
      if (balconyOverPorch) {
        const U = layers.f1;
        U.box('outFloor', M.outFloor, W - 0.1, 0.02, PD, 0, yTop + 0.29, (z0 + z1) / 2);
        railing(U, -W / 2 + 0.05, z1, W / 2 - 0.05, z1, yTop + 0.28);
        railing(U, -W / 2 + 0.05, z0, -W / 2 + 0.05, z1, yTop + 0.28);
        railing(U, W / 2 - 0.05, z0, W / 2 - 0.05, z1, yTop + 0.28);
      }
    } else {
      const yA = yTop + 0.55, yE = yTop - 0.08;
      leanTo(L, [v3(-W / 2 - 0.3, yE, z1 + 0.35), v3(W / 2 + 0.3, yE, z1 + 0.35), v3(W / 2 + 0.3, yA, z0), v3(-W / 2 - 0.3, yA, z0)]);
      L.box('trim', M.trim, W + 0.6, 0.2, 0.05, 0, yE - 0.06, z1 + 0.37);
      // Ceiling and side boards under the lean-to.
      L.box('trim', M.trim, W, 0.03, PD, 0, yTop - 0.02, (z0 + z1) / 2);
      for (const sx of [-1, 1]) {
        const tri = new Shape().moveTo(0, 0).lineTo(PD + 0.35, 0).lineTo(0, yA - yE).lineTo(0, 0);
        L.add('trim', new ExtrudeGeometry(tri, { depth: 0.04, bevelEnabled: false }), mat4(sx * (W / 2 + 0.3) + (sx > 0 ? 0.04 : 0), yE, z0, -Math.PI / 2), M.trim);
      }
      if (fancy) gingerbread(L, -W / 2 - 0.25, W / 2 + 0.25, yE - 0.15, z1 + 0.33);
    }
  } else if (h.balcony && F > 1) {
    const U = layers.f1;
    const bw = Math.min(5, W * 0.5), y = P + FH;
    U.box('trim', M.trim, bw, 0.22, 1.5, 0, y, D / 2 + 0.75);
    U.box('outFloor', M.outFloor, bw - 0.04, 0.02, 1.48, 0, y + 0.115, D / 2 + 0.75);
    railing(U, -bw / 2, D / 2 + 1.45, bw / 2, D / 2 + 1.45, y + 0.11);
    railing(U, -bw / 2, D / 2, -bw / 2, D / 2 + 1.45, y + 0.11);
    railing(U, bw / 2, D / 2, bw / 2, D / 2 + 1.45, y + 0.11);
    G.box('trim', M.trim, 2.4, 0.15, 1.1, doorX, P + doorTop + 0.35, D / 2 + 0.55);
  } else {
    // Door canopy.
    G.box('trim', M.trim, 2.4, 0.15, 1.1, doorX, P + doorTop + 0.35, D / 2 + 0.55);
  }

  // Modern accent portal around the entry.
  if (modern) {
    const L = layers.f0;
    const pw = 3.0, ph = Math.min(top - 0.2, P + FH + (F > 1 ? FH * 0.45 : 0)) - P;
    const z = D / 2 + 0.2;
    L.box('accent', M.accent, 0.35, ph, 0.4, doorX - pw / 2, P + ph / 2, z);
    L.box('accent', M.accent, 0.35, ph, 0.4, doorX + pw / 2, P + ph / 2, z);
    L.box('accent', M.accent, pw + 0.35, 0.35, 0.4, doorX, P + ph - 0.175, z);
  }

  let carport = null;
  if (h.carport) {
    const L = layers.f0;
    const s = h.carportSide === 'left' ? -1 : 1;
    const CW = 3.6;
    const zFront = D / 2 + (h.porch ? PD : 0.6);
    const zBack = Math.max(-D / 2, zFront - 6.2);
    const xIn = s * (W / 2), xOut = s * (W / 2 + CW);
    const cx = (xIn + xOut) / 2, cz = (zFront + zBack) / 2;
    L.box('concrete', M.concrete, CW, 0.08, zFront - zBack, cx, 0.04, cz);
    // One-storey pitched roofs: keep the lean-to low enough to tuck under the eave.
    const yTop = flatRoof ? P + FH : F === 1 ? P + FH - 0.5 : P + FH - 0.1;
    for (const z of [zFront - 0.25, zBack + 0.25, ...(zFront - zBack > 5.5 ? [cz] : [])]) column(L, xOut - s * 0.25, z, 0.08, yTop - 0.25);
    L.box('trim', M.trim, 0.3, 0.25, zFront - zBack, xOut - s * 0.25, yTop - 0.125, cz);
    if (flatRoof) {
      L.box('trim', M.trim, CW + 0.15, 0.28, zFront - zBack + 0.2, cx + s * 0.075, yTop + 0.14, cz);
    } else {
      const yA = yTop + 0.45, yE = yTop - 0.05;
      const xa = xIn, xe = xOut + s * 0.35;
      leanTo(L, [v3(xe, yE, zFront + 0.3), v3(xe, yE, zBack - 0.3), v3(xa, yA, zBack - 0.3), v3(xa, yA, zFront + 0.3)]);
      L.box('trim', M.trim, 0.05, 0.2, zFront - zBack + 0.6, xe + s * 0.02, yE - 0.06, cz);
      L.box('trim', M.trim, CW, 0.03, zFront - zBack, cx, yTop - 0.02, cz);
    }
    carport = { x: cx, z: cz, w: CW, zFront, zBack };
    segments.push({ a: [xOut - s * 0.4, zBack + 0.1], b: [xOut - s * 0.1, zBack + 0.1], level: 0 });
  }

  // ---- roof -------------------------------------------------------------------
  const R = layers.roof;
  R.box('trim', M.trim, W, 0.18, D, 0, top + 0.09, 0); // ceiling slab
  if (flatRoof) buildFlatRoof(R);
  else buildPitchedRoof(R, h.roof.type);

  function buildFlatRoof(R) {
    // The eaves setting sets how far the roof lip / cornice projects.
    const lip = 0.1 + eaves * 0.25;
    const ph = h.roofTerrace ? (railStyle === 'concrete' ? 1.0 : 0.3) : 0.5;
    const pt = 0.15;
    R.box('roofFlat', M.roofFlat, W + 2 * lip, 0.26, D + 2 * lip, 0, top + 0.13, 0);
    const ox = W / 2 + lip - pt / 2, oz = D / 2 + lip - pt / 2;
    R.box('walls', M.walls, W + 2 * lip, ph, pt, 0, top + 0.26 + ph / 2, oz);
    R.box('walls', M.walls, W + 2 * lip, ph, pt, 0, top + 0.26 + ph / 2, -oz);
    R.box('walls', M.walls, pt, ph, D + 2 * lip - 2 * pt, -ox, top + 0.26 + ph / 2, 0);
    R.box('walls', M.walls, pt, ph, D + 2 * lip - 2 * pt, ox, top + 0.26 + ph / 2, 0);
    // Coping + cornice band.
    const yc = top + 0.26 + ph + 0.03;
    for (const [w, d, x, z] of [[W + 2 * lip + 0.1, 0.25, 0, oz], [W + 2 * lip + 0.1, 0.25, 0, -oz], [0.25, D + 2 * lip + 0.1, -ox, 0], [0.25, D + 2 * lip + 0.1, ox, 0]]) {
      R.box('trim', M.trim, w, 0.06, d, x, yc, z);
    }
    R.box('trim', M.trim, W + 2 * lip + 0.12, 0.12, D + 2 * lip + 0.12, 0, top + 0.02, 0);
    if (h.roofTerrace && railStyle !== 'concrete') {
      const yr = top + 0.26 + ph + 0.06;
      railing(R, -ox, oz, ox, oz, yr); railing(R, -ox, -oz, ox, -oz, yr);
      railing(R, -ox, -oz, -ox, oz, yr); railing(R, ox, -oz, ox, oz, yr);
    }
    if (h.roofTerrace) {
      // Stair housing (caseta) at back-left with a door to the terrace.
      const cw = 2.8, cd = 2.6, ch = 2.4;
      const cx = -W / 2 + 0.3 + cw / 2, cz = -D / 2 + 0.3 + cd / 2, cy = top + 0.26;
      R.box('walls', M.walls, cw, ch, cd, cx, cy + ch / 2, cz);
      R.box('trim', M.trim, cw + 0.3, 0.18, cd + 0.3, cx, cy + ch + 0.09, cz);
      R.box('door', M.door, 0.9, 2.05, 0.06, cx + 0.5, cy + 1.03, cz + cd / 2 + 0.02);
      R.box('trim', M.trim, 1.1, 0.1, 0.08, cx + 0.5, cy + 2.1, cz + cd / 2 + 0.03);
      // Pergola over the terrace (modern only).
      if (modern && W > 10) {
        const px0 = 0, px1 = W / 2 - 0.6, pz0 = -1.5, pz1 = D / 2 - 0.8, py = cy + 2.5;
        for (const [x, z] of [[px0, pz0], [px1, pz0], [px0, pz1], [px1, pz1]]) R.box('accent', M.accent, 0.15, 2.5, 0.15, x, cy + 1.25, z);
        for (let x = px0; x <= px1 + 0.01; x += 0.45) R.box('accent', M.accent, 0.07, 0.2, pz1 - pz0 + 0.4, x, py, (pz0 + pz1) / 2);
      }
    }
    if (h.waterTank) tank(R, W / 2 - 1.1, top + 0.26, -D / 2 + 1.1, 1);
    if (h.solar) {
      const n = Math.max(2, Math.min(5, Math.floor((W - 5) / 1.15)));
      for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 1.15 + 0.8, z = -0.6 - r * 2.0;
        const Mp = mat4(x, top + 0.75, z, 0, -0.22);
        R.box('solar', M.solar, 1.05, 0.04, 1.75, 0, 0, 0, Mp);
        R.box('alu', M.alu, 1.1, 0.03, 0.05, 0, 0, 0.88, Mp);
        R.box('alu', M.alu, 0.04, 0.5, 0.04, x - 0.45, top + 0.5, z + 0.7);
        R.box('alu', M.alu, 0.04, 0.5, 0.04, x + 0.45, top + 0.5, z + 0.7);
      }
    }
  }

  function tank(L, x, y, z, scale = 1) {
    // Black ribbed polyethylene tank (tinaco) on a small base.
    L.box('concrete', M.concrete, 1.4 * scale, 0.2, 1.4 * scale, x, y + 0.1, z);
    L.cyl('tank', M.tank, 0.56 * scale, 0.6 * scale, 1.25 * scale, x, y + 0.2 + 0.625 * scale, z, null, 28);
    for (let i = 1; i < 5; i++) L.add('tank', new TorusGeometry(0.595 * scale, 0.025, 6, 28), mat4(x, y + 0.2 + i * 0.25 * scale, z, 0, Math.PI / 2), M.tank);
    const dome = new SphereGeometry(0.56 * scale, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.scale(1, 0.35, 1);
    L.add('tank', dome, mat4(x, y + 0.2 + 1.25 * scale, z), M.tank);
    L.cyl('tank', M.tank, 0.18, 0.18, 0.1, x, y + 0.2 + 1.25 * scale + 0.22, z, null, 16);
  }

  function buildPitchedRoof(R, type) {
    const o = eaves;
    const tan = Math.tan((PITCH[type] * Math.PI) / 180);
    const X = W / 2 + o, Z = D / 2 + o;
    const yE = top;
    let frontHalfWidth = () => X;
    const fascia = (a, b) => {
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const ry = Math.atan2(-(b.z - a.z), b.x - a.x);
      R.box('trim', M.trim, len + 0.04, 0.24, 0.05, len / 2, -0.1, 0.0, mat4(a.x, a.y, a.z, ry));
    };
    const beam = (a, b, wdt = 0.16) => {
      const len = a.distanceTo(b);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const m = new Matrix4().lookAt(a, b, v3(0, 1, 0));
      m.setPosition(mid);
      R.box('roofCap', { ...M.roof, keepUV: false }, wdt, 0.1, len, 0, 0, 0, m);
    };
    // Boxed eave: flat soffit under the overhang, closed by the fascia board.
    const soffit = new Shape().moveTo(-X, -Z).lineTo(X, -Z).lineTo(X, Z).lineTo(-X, Z).lineTo(-X, -Z);
    soffit.holes.push(new Path().moveTo(-W / 2, -D / 2).lineTo(W / 2, -D / 2).lineTo(W / 2, D / 2).lineTo(-W / 2, D / 2).lineTo(-W / 2, -D / 2));
    const sg = new ShapeGeometry(soffit);
    sg.rotateX(Math.PI / 2);
    R.add('trim', sg, mat4(0, yE - 0.19, 0), M.trim);
    // Cornice (crown band) where the walls meet the soffit.
    for (const [w, d, x, z] of [[W + 0.12, 0.06, 0, D / 2 + 0.03], [W + 0.12, 0.06, 0, -D / 2 - 0.03], [0.06, D, -W / 2 - 0.03, 0], [0.06, D, W / 2 + 0.03, 0]]) {
      R.box('trim', M.trim, w, 0.12, d, x, yE - 0.26, z);
    }

    if (type === 'hip') {
      const alongX = W >= D;
      const [a, b] = alongX ? [X, Z] : [Z, X];
      const r = a - b, yR = yE + b * tan;
      const tf = (p) => (alongX ? p : v3(p.z, p.y, -p.x));
      const c1 = tf(v3(-a, yE, b)), c2 = tf(v3(a, yE, b)), c3 = tf(v3(a, yE, -b)), c4 = tf(v3(-a, yE, -b));
      const ra = tf(v3(-r, yR, 0)), rb = tf(v3(r, yR, 0));
      frontHalfWidth = (z) => (alongX ? r + ((a - r) * z) / b : (X * (z - r)) / Math.max(0.01, Z - r));
      R.add('roof', roofPlane([c1, c2, rb, ra]), null, M.roof);
      R.add('roof', roofPlane([c3, c4, ra, rb]), null, M.roof);
      R.add('roof', roofPlane([c2, c3, rb]), null, M.roof);
      R.add('roof', roofPlane([c4, c1, ra]), null, M.roof);
      for (const [p, q] of [[c1, c2], [c2, c3], [c3, c4], [c4, c1]]) fascia(p, q);
      beam(ra, rb); beam(c1, ra); beam(c4, ra); beam(c2, rb); beam(c3, rb);
    } else if (type === 'gable') {
      const yR = yE + Z * tan;
      const c1 = v3(-X, yE, Z), c2 = v3(X, yE, Z), c3 = v3(X, yE, -Z), c4 = v3(-X, yE, -Z);
      const ra = v3(-X, yR, 0), rb = v3(X, yR, 0);
      R.add('roof', roofPlane([c1, c2, rb, ra]), null, M.roof);
      R.add('roof', roofPlane([c3, c4, ra, rb]), null, M.roof);
      fascia(c1, c2); fascia(c3, c4);
      beam(ra, rb);
      // Gable walls + barge boards + vent.
      for (const sx of [-1, 1]) {
        const s = new Shape().moveTo(-D / 2, 0).lineTo(D / 2, 0).lineTo(D / 2, o * tan).lineTo(0, Z * tan - 0.05).lineTo(-D / 2, o * tan).lineTo(-D / 2, 0);
        R.add('walls', new ExtrudeGeometry(s, { depth: T, bevelEnabled: false }), mat4(sx > 0 ? W / 2 : -W / 2 + T, yE, 0, -Math.PI / 2), M.walls);
        const bargeA = v3(sx * (X + 0.02), yE - 0.05, Z), bargeB = v3(sx * (X + 0.02), yR - 0.05, 0), bargeC = v3(sx * (X + 0.02), yE - 0.05, -Z);
        for (const [p, q] of [[bargeA, bargeB], [bargeB, bargeC]]) {
          const len = p.distanceTo(q);
          const m = new Matrix4().lookAt(p, q, v3(0, 1, 0));
          m.setPosition(p.clone().add(q).multiplyScalar(0.5));
          R.box('trim', M.trim, 0.06, 0.24, len, 0, 0, 0, m);
        }
        const vy = yE + Z * tan * 0.45;
        R.add('trim', ring(0.8, 0.6, true, 0.06, 0.05), mat4(sx * (W / 2 + 0.02), vy, sx * 0.4, sx * Math.PI / 2), M.trim);
        for (let k = 0; k < 4; k++) R.box('trim', M.trim, 0.03, 0.06, 0.66, sx * (W / 2 + 0.04), vy + 0.1 + k * 0.1, 0);
      }
      if (h.style === 'colonial') {
        gingerbread(R, -X + 0.05, X - 0.05, yE - 0.2, Z - 0.02);
      }
    } else {
      // Shed: high at the back.
      const yB = yE + 2 * Z * tan;
      const c1 = v3(-X, yE, Z), c2 = v3(X, yE, Z), c3 = v3(X, yB, -Z), c4 = v3(-X, yB, -Z);
      R.add('roof', roofPlane([c1, c2, c3, c4]), null, M.roof);
      fascia(c1, c2); fascia(c3, c4);
      const hf = o * tan, hb = (o + D) * tan;
      for (const sx of [-1, 1]) {
        const s = new Shape().moveTo(-D / 2, 0).lineTo(D / 2, 0).lineTo(D / 2, hf).lineTo(-D / 2, hb).lineTo(-D / 2, 0);
        R.add('walls', new ExtrudeGeometry(s, { depth: T, bevelEnabled: false }), mat4(sx > 0 ? W / 2 : -W / 2 + T, yE, 0, -Math.PI / 2), M.walls);
      }
      R.box('walls', M.walls, W, hb, T, 0, yE + hb / 2, -D / 2 + T / 2);
      R.box('walls', M.walls, W, hf, T, 0, yE + hf / 2, D / 2 - T / 2);
    }
    if (h.waterTank) {
      // Tank on a steel stand behind the house.
      const x = W / 2 - 1.2, z = -D / 2 - Math.max(1.4, eaves + 0.8), ht = Math.min(top, 3.2);
      for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) layers.f0.box('iron', M.iron, 0.08, ht, 0.08, x + dx, ht / 2, z + dz);
      layers.f0.box('iron', M.iron, 1.4, 0.08, 1.4, x, ht, z);
      tank(layers.f0, x, ht - 0.16, z, 0.9);
      segments.push({ a: [x - 0.7, z], b: [x + 0.7, z], level: 0 });
    }
    if (h.solar && type !== 'shed') {
      // Flush panels on the front slope, as many as fit its width.
      const zc = Math.min(Z * 0.5, D / 2 - 1.2);
      const y = yE + (Z - zc) * tan + 0.07;
      const halfW = frontHalfWidth(zc) - 0.5;
      const n = Math.min(6, Math.floor((2 * halfW) / 1.12));
      for (let i = 0; i < n; i++) {
        R.box('solar', M.solar, 1.05, 0.04, 1.7, 0, 0, 0, mat4((i - (n - 1) / 2) * 1.12, y, zc, 0, Math.atan(tan)));
      }
    }
  }

  // ---- interiors --------------------------------------------------------------
  function buildInterior(fl, y0) {
    const lvl = fl.level, IN = layers[`in${lvl}`], CAP = layers[`cap${lvl}`];
    const yF = y0 + FLOOR_T;
    // Finished floor per room, sitting on the slab.
    for (const r of fl.rooms) IN.box(fKey(r), floorOf(r), r.x1 - r.x0, FLOOR_T, r.z1 - r.z0, (r.x0 + r.x1) / 2, y0 + FLOOR_T / 2, (r.z0 + r.z1) / 2);
    if (!fl.rooms.some((r) => r.type === 'pasillo') && fl.zHallFront - fl.zHallBack > 0.01) {
      IN.box(fKey(null), floorOf(null), fl.xR - fl.xL, FLOOR_T, fl.zHallFront - fl.zHallBack, 0, y0 + FLOOR_T / 2, (fl.zHallFront + fl.zHallBack) / 2);
    }
    // Ceiling, seen from below in walk mode (clipped away in cutaway).
    IN.add('ceiling', new PlaneGeometry(W - 2 * T, D - 2 * T).rotateX(Math.PI / 2), mat4(0, y0 + H, 0), M.ceiling);

    // Partitions as two half-thickness skins, one per adjacent room, so each
    // side takes that room's paint; baseboards in that room's floor finish.
    const roomAt = (x, z) => fl.rooms.find((r) => x > r.x0 - 0.001 && x < r.x1 + 0.001 && z > r.z0 - 0.001 && z < r.z1 + 0.001) ?? null;
    const skins = (x0, z0, x1, z1, ya, yb, base = true) => {
      const horiz = Math.abs(z0 - z1) < 1e-6;
      const a = horiz ? Math.min(x0, x1) : Math.min(z0, z1), b = horiz ? Math.max(x0, x1) : Math.max(z0, z1);
      const c = horiz ? z0 : x0;
      const cuts = new Set([a, b]);
      for (const r of fl.rooms) for (const v of horiz ? [r.x0, r.x1] : [r.z0, r.z1]) if (v > a + 0.02 && v < b - 0.02) cuts.add(v);
      const pts = [...cuts].sort((p, q) => p - q);
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i], q = pts[i + 1], m = (p + q) / 2, len = q - p;
        for (const s of [-1, 1]) {
          const r = horiz ? roomAt(m, c + s * 0.2) : roomAt(c + s * 0.2, m);
          const off = c + s * 0.03;
          if (horiz) IN.box(wKey(r), wallOf(r), len, yb - ya, 0.06, m, (ya + yb) / 2, off);
          else IN.box(wKey(r), wallOf(r), 0.06, yb - ya, len, off, (ya + yb) / 2, m);
          if (!base) continue;
          const o2 = c + s * 0.067;
          if (horiz) IN.box(bKey(r), baseOf(r), len, 0.08, 0.014, m, yF + 0.04, o2);
          else IN.box(bKey(r), baseOf(r), 0.014, 0.08, len, o2, yF + 0.04, m);
        }
      }
    };
    for (const [x0, z0, x1, z1] of fl.walls) {
      skins(x0, z0, x1, z1, y0, y0 + H);
      CAP.box('cap', capM, x0 === x1 ? 0.12 : Math.hypot(x1 - x0, z1 - z0), 0.03, x0 === x1 ? Math.hypot(x1 - x0, z1 - z0) : 0.12, (x0 + x1) / 2, y0 + CUT, (z0 + z1) / 2);
      segments.push({ a: [x0, z0], b: [x1, z1], level: lvl });
    }
    // Door gaps: wall above (header), casing, and the door leaf standing open.
    const head = yF + Math.min(2.1, H - FLOOR_T - 0.2);
    for (const dr of fl.doors ?? []) {
      if (dr.room.type === 'escalera') continue;
      skins(dr.x - dr.w / 2, dr.z, dr.x + dr.w / 2, dr.z, head, y0 + H, false);
      if (!dr.leaf) continue;
      for (const s of [-1, 1]) IN.box('casing', M.casing, 0.05, head - yF, 0.16, dr.x + s * (dr.w / 2 - 0.025), yF + (head - yF) / 2, dr.z);
      IN.box('casing', M.casing, dr.w, 0.05, 0.16, dr.x, head - 0.025, dr.z);
      const r = dr.room, lw = dr.w - 0.1, lh = head - yF - 0.06, hx = dr.x - dr.w / 2 + 0.05;
      const flat = r.z1 - r.z0 < 3.05 && r.type !== 'bano' && hx - lw > r.x0 + 0.1;
      const leafM = flat
        ? mat4(hx - lw / 2, yF + 0.01 + lh / 2, dr.z + dr.into * 0.1, 0)
        : mat4(hx + 0.03, yF + 0.01 + lh / 2, dr.z + dr.into * (0.08 + lw / 2), Math.PI / 2);
      IN.box('leaf', M.leaf, lw, lh, 0.04, 0, 0, 0, leafM);
      for (const fz of [-1, 1]) for (const py of [-lh / 4 + 0.05, lh / 4 + 0.05]) IN.rbox('leaf', M.leaf, lw - 0.2, lh / 2 - 0.24, 0.012, 0.004, 0, py, fz * 0.022, leafM);
      for (const fz of [-1, 1]) IN.geo('knob', M.alu, new SphereGeometry(0.028, 10, 8), lw / 2 - 0.07, 0, fz * 0.05, leafM);
    }

    let biggest = null;
    for (const r of fl.rooms) {
      const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
      const rw = r.x1 - r.x0, rd = r.z1 - r.z0;
      // Ceiling lights (rooms with a pendant get it from their furniture).
      const ceil = kit(IN, FS, mat4(cx, y0 + H, cz), 'k:');
      if (I.ceiling === 'vigas') ceil.cyl('metal', 0.004, 0.004, 0.17, 0, -0.085, 0, 4);
      const drop = I.ceiling === 'vigas' ? 0.17 : 0;
      if (r.hidden) {
        for (const x of rw > 6 ? [fl.xL + rw / 4, fl.xR - rw / 4] : [cx]) ceilingLight(kit(IN, FS, mat4(x, y0 + H - drop, cz), 'k:'), 0.12);
        continue;
      }
      if (r.type !== 'comedor') ceilingLight(kit(IN, FS, mat4(cx, y0 + H - drop, cz), 'k:'), r.type === 'bano' || r.type === 'escalera' ? 0.13 : 0.18);
      labels.push({ text: roomName(r.type, lang), x: cx, y: y0 + 2.0, z: cz, level: lvl, type: r.type, area: rw * rd });
      if (!biggest || rw * rd > (biggest.x1 - biggest.x0) * (biggest.z1 - biggest.z0)) biggest = r;
      furnish(fl, r, yF, IN);
    }
    if (biggest) lights.push({ level: lvl, x: (biggest.x0 + biggest.x1) / 2, y: y0 + H - 0.4, z: (biggest.z0 + biggest.z1) / 2 });

    // Exposed wood beams (vigas) across the depth, under the ceiling.
    if (I.ceiling === 'vigas') {
      const n = Math.max(2, Math.round((fl.xR - fl.xL) / 0.85));
      for (let i = 0; i < n; i++) IN.box('beam', M.beam, 0.1, 0.16, D - 2 * T, fl.xL + ((i + 0.5) * (fl.xR - fl.xL)) / n, y0 + H - 0.08, 0);
      for (const z of [fl.zB + 0.06, fl.zF - 0.06]) IN.box('beam', M.beam, fl.xR - fl.xL, 0.12, 0.12, 0, y0 + H - 0.06, z);
    }
  }

  // Furniture in a room-local frame: u across the room, v away from its outer wall.
  function furnish(fl, r, yF, IN) {
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const rw = r.x1 - r.x0, rd = r.z1 - r.z0;
    const back = r.band !== 'front';
    const inward = back ? 1 : -1;
    const wallZ = back ? r.z0 : r.z1;
    const K = kit(IN, FS, mat4(cx, yF, wallZ, back ? 0 : Math.PI), 'k:');
    const toU = (x) => (x - cx) * inward;
    const facade = back ? 'back' : 'front';
    const wins = fl.openings[facade].filter((o) => o.kind !== 'door' && o.kind !== 'slider' && o.x > r.x0 && o.x < r.x1).map((o) => ({ u: toU(o.x), ...openingDims(o.kind, hd, FH) }));
    // Which local end (u sign) is an outside side wall, if any.
    const extSide = Math.abs(r.x0 - fl.xL) < 0.01 ? -inward : Math.abs(r.x1 - fl.xR) < 0.01 ? inward : 0;
    const ceilY = H - FLOOR_T;
    switch (r.type) {
      case 'principal':
      case 'dormitorio': {
        const bw = r.type === 'principal' ? Math.min(1.6, rw - 1.0) : rw > 2.9 ? 1.35 : Math.min(1.0, rw - 0.9);
        const bl = Math.min(2.0, rd - 0.9);
        if (bw < 0.8 || bl < 1.6) break;
        const v0 = 0.2;
        // Keep the headboard clear of low openings (balcony slider, tall windows).
        const block = fl.openings[facade].filter((o) => o.x > r.x0 - 1 && o.x < r.x1 + 1).map((o) => ({ u: toU(o.x), ...openingDims(o.kind, hd, FH) })).filter((o) => o.sill < 0.9).map((o) => [o.u - o.w / 2 - 0.05, o.u + o.w / 2 + 0.05]);
        const fits = (uc, hw) => uc - hw >= -rw / 2 + 0.05 && uc + hw <= rw / 2 - 0.05 && !block.some(([a0, a1]) => uc + hw > a0 && uc - hw < a1);
        const spot = (hw) => [0, ...block.flatMap(([a0, a1]) => [a1 + hw, a0 - hw])].filter((uc) => fits(uc, hw)).sort((p, q) => Math.abs(p) - Math.abs(q))[0];
        const withStands = (rw - bw) / 2 - 0.12 >= 0.48 ? spot(bw / 2 + 0.6) : undefined;
        const uc = withStands ?? spot(bw / 2 + 0.06);
        if (uc !== undefined) {
          bed(K.at(uc, 0, v0 + 0.08 + bl / 2), bw, bl, { panels: bw > 1.2 ? 3 : 2 });
          if (withStands !== undefined) for (const sx of [-1, 1]) nightstand(K.at(uc + sx * (bw / 2 + 0.36), 0, v0 + 0.2));
          rug(K.at(uc, 0, Math.min(rd - 0.95, v0 + 0.08 + bl * 0.72)), Math.min(rw - 0.5, bw + 1.1), 1.6);
        } else if (rw >= bl + 0.6) {
          // No clear outer wall: headboard against the side wall away from the door hinge.
          const sgn = inward, vm = Math.max(bw / 2 + 0.7, Math.min(rd / 2, rd - bw / 2 - 1.1));
          const Sd = K.at(sgn * rw / 2, 0, vm, sgn > 0 ? -Math.PI / 2 : Math.PI / 2);
          bed(Sd.at(0, 0, v0 + 0.08 + bl / 2), bw, bl, { panels: bw > 1.2 ? 3 : 2 });
          if (rd - bw > 1.6) nightstand(Sd.at(-(bw / 2 + 0.36), 0, v0 + 0.2));
          rug(Sd.at(0, 0, v0 + 0.08 + bl * 0.7), Math.min(rd - 0.6, bw + 1.0), 1.5);
        }
        // Dresser on the hall wall, on the side away from the door hinge.
        if (rd - (v0 + 0.08 + bl) > 1.3 && rw > 3.1) {
          const D0 = K.at(inward * (rw / 2 - 0.62), 0, rd - 0.26, Math.PI);
          D0.rbox('wood', 1.0, 0.78, 0.45, 0.015, 0, 0.47, 0);
          for (let k = 0; k < 3; k++) { D0.box('wood', 0.94, 0.22, 0.012, 0, 0.2 + k * 0.245, 0.228); D0.box('metal', 0.16, 0.014, 0.018, 0, 0.27 + k * 0.245, 0.24); }
          for (const sx of [-1, 1]) D0.cyl('wood', 0.02, 0.016, 0.08, sx * 0.44, 0.04, 0, 6);
          D0.box('mirror', 0.7, 0.8, 0.02, 0, 1.4, -0.2);
          D0.rbox('wood', 0.76, 0.86, 0.025, 0.01, 0, 1.4, -0.215);
        }
        break;
      }
      case 'sala': {
        const sw = Math.min(2.3, rw - 1.1);
        if (sw < 1.4) break;
        const sv = 0.5 + 0.46, cv = sv + 0.46 + 0.62;
        sofa(K.at(0, 0, sv), sw);
        coffeeTable(K.at(0, 0, cv), Math.min(1.1, sw * 0.55), 0.6);
        rug(K.at(0, 0, cv - 0.15), Math.min(2.9, rw - 0.6), Math.min(2.2, rd - 0.8));
        if (rd - 0.35 - (cv + 0.3) > 0.9) tvUnit(K.at(0, 0, rd - 0.3, Math.PI), Math.min(1.8, rw - 1.4), { tv: 1.25 });
        if (rw - sw > 2.1) armchair(K.at(sw / 2 + 0.62, 0, cv - 0.05, -Math.PI / 2 + 0.3));
        plant(K.at((extSide || -1) * (rw / 2 - 0.35), 0, 0.35), 1.1, 5);
        break;
      }
      case 'comedor': {
        const tw = Math.min(1.8, rw - 1.5), td = 0.95;
        if (tw < 0.9) break;
        const tv = Math.min(rd / 2 + 0.2, rd - 1.2);
        const Tk = K.at(0, 0, tv);
        diningTable(Tk, tw, td);
        const nc = tw > 1.5 ? 3 : 2;
        for (let i = 0; i < nc; i++) for (const sz of [-1, 1]) chair(Tk.at(-tw / 2 + ((i + 0.5) * tw) / nc, 0, sz * (td / 2 + 0.14), sz > 0 ? Math.PI : 0));
        if (rw - tw > 2.0) for (const sx of [-1, 1]) chair(Tk.at(sx * (tw / 2 + 0.18), 0, 0, sx > 0 ? -Math.PI / 2 : Math.PI / 2));
        pendant(K.at(0, ceilY, tv), Math.max(0.3, ceilY - 1.55));
        break;
      }
      case 'cocina': kitchen(K, rw, rd, wins, extSide, ceilY); break;
      case 'bano': bathroom(K, rw, rd); break;
      case 'lavado': laundry(K, rw, rd, ceilY); break;
      case 'closet': closet(K, rw, rd, ceilY); break;
      case 'escalera': stairs(IN, fl, r, yF - FLOOR_T); break;
      case 'estudio': {
        const dw = Math.min(1.4, rw - 0.8);
        if (dw < 0.8) break;
        desk(K.at(0, 0, 0.45), dw);
        officeChair(K.at(0, 0, 1.0, Math.PI));
        if (rw > 2.4) bookshelf(K.at(-(rw / 2 - 0.18), 0, Math.min(rd - 0.6, 1.8), Math.PI / 2), 0.9, Math.min(1.85, ceilY - 0.2), 0.32, 11);
        plant(K.at(rw / 2 - 0.35, 0, 0.35), 0.9, 9);
        break;
      }
      default:
    }
  }

  function kitchen(K, rw, rd, wins, extSide, ceilY) {
    const len = rw - 0.12;
    if (len < 1.6) return;
    // Fridge at the inner end (away from an outside side wall).
    const fSide = extSide ? -extSide : 1;
    const fu = fSide * (len / 2 - 0.39);
    const Fr = K.at(fu, 0, 0.38);
    Fr.rbox('steel', 0.74, 1.82, 0.7, 0.025, 0, 0.91, 0);
    Fr.box('black', 0.72, 0.008, 0.006, 0, 1.2, 0.352);
    for (const [y, hh] of [[1.55, 0.42], [0.8, 0.55]]) Fr.rbox('steel', 0.025, hh, 0.035, 0.01, -fSide * 0.29, y, 0.37);
    Fr.rbox('cabinets', 0.78, Math.max(0.2, ceilY - 1.9), 0.6, 0.01, 0, (ceilY + 1.86) / 2, -0.03);
    const a = fSide > 0 ? -len / 2 : -len / 2 + 0.8, b = fSide > 0 ? len / 2 - 0.8 : len / 2;
    if (b - a < 0.8) return;
    // Sink under a window when there is one; cooktop on the far side of it.
    const win = wins.find((wn) => wn.u > a + 0.35 && wn.u < b - 0.35);
    const su = win ? win.u : Math.max(a + 0.35, Math.min(b - 0.35, (a + b) / 2 - fSide * 0.3));
    const right = b - su > su - a;
    let cu = right ? Math.min(b - 0.36, su + 1.0) : Math.max(a + 0.36, su - 1.0);
    if (Math.abs(cu - su) < 0.68) cu = null;
    const mid = (a + b) / 2, run = b - a;
    K.box('kick', run, 0.1, 0.5, mid, 0.05, 0.25);
    K.box('cabinets', run, 0.76, 0.56, mid, 0.48, 0.28);
    const n = Math.max(1, Math.round(run / 0.5)), dw = run / n;
    for (let i = 0; i < n; i++) {
      const u = a + dw * (i + 0.5);
      if (cu != null && Math.abs(u - cu) < dw * 0.6) {
        K.rbox('black', dw - 0.01, 0.56, 0.02, 0.006, cu, 0.46, 0.57);
        K.box('steel', dw - 0.12, 0.02, 0.03, cu, 0.8, 0.6);
        continue;
      }
      K.rbox('cabinets', dw - 0.008, 0.18, 0.02, 0.004, u, 0.77, 0.57);
      K.rbox('cabinets', dw - 0.008, 0.5, 0.02, 0.004, u, 0.41, 0.57);
      K.box('steel', 0.16, 0.012, 0.02, u, 0.77, 0.59);
      K.box('steel', 0.012, 0.12, 0.02, u + (i % 2 ? -1 : 1) * (dw / 2 - 0.05), 0.56, 0.59);
    }
    // Countertop with a cut-out for the sink.
    const ty = 0.9, ct = 0.04;
    const piece = (u0, u1, v, d) => { if (u1 - u0 > 0.01) K.rbox('counter', u1 - u0, ct, d, 0.005, (u0 + u1) / 2, ty, v); };
    piece(a - 0.01, su - 0.3, 0.31, 0.62);
    piece(su + 0.3, b + 0.01, 0.31, 0.62);
    piece(su - 0.3, su + 0.3, 0.05, 0.1);
    piece(su - 0.3, su + 0.3, 0.58, 0.08);
    // Stainless basin (open box) + gooseneck faucet.
    K.box('steel', 0.58, 0.01, 0.44, su, ty - 0.2, 0.32);
    for (const v of [0.1, 0.54]) K.box('steel', 0.58, 0.2, 0.01, su, ty - 0.1, v);
    for (const s of [-1, 1]) K.box('steel', 0.01, 0.2, 0.44, su + s * 0.29, ty - 0.1, 0.32);
    K.cyl('steel', 0.018, 0.024, 0.3, su, ty + 0.17, 0.07, 10);
    K.geo('steel', new TorusGeometry(0.1, 0.013, 6, 14, Math.PI), su, ty + 0.32, 0.17, Math.PI / 2);
    K.box('steel', 0.02, 0.1, 0.02, su + 0.08, ty + 0.06, 0.07, 0, 0, 0.5);
    if (cu != null) {
      K.box('black', 0.6, 0.012, 0.52, cu, ty + 0.026, 0.31);
      for (const [du, dv, rr] of [[-0.15, 0.18, 0.065], [0.15, 0.18, 0.08], [-0.15, 0.43, 0.08], [0.15, 0.43, 0.065]]) K.geo('steel', new TorusGeometry(rr, 0.008, 4, 22), cu + du, ty + 0.035, dv, 0, Math.PI / 2);
      // Chimney hood.
      K.rbox('steel', 0.62, 0.12, 0.48, 0.012, cu, 1.64, 0.25);
      K.box('steel', 0.26, Math.max(0.1, ceilY - 1.7), 0.24, cu, (ceilY + 1.7) / 2, 0.13);
    }
    // Backsplash tiles and upper cabinets, both skipping windows (and the hood).
    const gaps = wins.map((wn) => [wn.u - wn.w / 2 - 0.08, wn.u + wn.w / 2 + 0.08]);
    const cut = (u0, u1, holes) => {
      let parts = [[u0, u1]];
      for (const [g0, g1] of holes) parts = parts.flatMap(([p, q]) => (g1 <= p || g0 >= q ? [[p, q]] : [[p, g0], [g1, q]].filter(([x, y]) => y - x > 0.2)));
      return parts;
    };
    const bsTop = 1.5;
    for (const [p, q] of cut(a, b, gaps)) K.box('tile', q - p, bsTop - ty - 0.02, 0.012, (p + q) / 2, (bsTop + ty + 0.02) / 2, 0.006);
    const uy = 1.52, uh = Math.min(0.72, ceilY - 0.1 - uy);
    if (uh > 0.3) {
      for (const [p, q] of cut(a, b, cu != null ? [...gaps, [cu - 0.34, cu + 0.34]] : gaps)) {
        K.box('cabinets', q - p, uh, 0.33, (p + q) / 2, uy + uh / 2, 0.165);
        const m = Math.max(1, Math.round((q - p) / 0.45)), ww = (q - p) / m;
        for (let i = 0; i < m; i++) {
          K.rbox('cabinets', ww - 0.008, uh - 0.01, 0.02, 0.004, p + ww * (i + 0.5), uy + uh / 2, 0.34);
          K.box('steel', 0.012, 0.1, 0.02, p + ww * (i + 0.5) + (i % 2 ? -1 : 1) * (ww / 2 - 0.05), uy + 0.08, 0.36);
        }
      }
    }
    // Island with stools when the kitchen is deep enough.
    if (rd > 3.7 && len > 2.2) {
      const iw = Math.min(1.8, len * 0.55), iv = 0.62 + 1.05 + 0.45;
      K.box('kick', iw - 0.1, 0.1, 0.8, 0, 0.05, iv - 0.05);
      K.box('cabinets', iw, 0.76, 0.86, 0, 0.48, iv);
      K.rbox('counter', iw + 0.08, ct, 1.1, 0.006, 0, ty, iv + 0.1);
      const ns = iw > 1.5 ? 3 : 2;
      for (let i = 0; i < ns; i++) {
        const S0 = K.at(-iw / 2 + ((i + 0.5) * iw) / ns, 0, iv + 0.75);
        S0.cyl('sofa', 0.19, 0.19, 0.06, 0, 0.68, 0, 18);
        for (let k = 0; k < 4; k++) { const an = (k / 4) * Math.PI * 2 + 0.78; S0.bar('metal', [Math.cos(an) * 0.18, 0, Math.sin(an) * 0.18], [Math.cos(an) * 0.12, 0.66, Math.sin(an) * 0.12], 0.012, 6); }
        S0.geo('metal', new TorusGeometry(0.15, 0.008, 4, 18), 0, 0.3, 0, 0, Math.PI / 2);
      }
      for (const s of [-1, 1]) pendant(K.at(s * iw * 0.25, ceilY, iv), Math.max(0.3, ceilY - 1.7));
    }
  }

  // Laundry: washer + dryer under a shelf, a lavadero (utility tub) when there is room. Origin at the outer wall.
  function laundry(K, rw, rd, ceilY) {
    if (rw < 1.4 || rd < 1.2) return;
    const appliance = (A, dryer) => {
      A.rbox('porcelain', 0.6, 0.85, 0.62, 0.02, 0, 0.425, 0.33);
      A.box('black', 0.56, 0.07, 0.01, 0, 0.8, 0.645);
      A.cyl('steel', 0.225, 0.225, 0.02, 0, 0.42, 0.645, 24, Math.PI / 2);
      A.cyl(dryer ? 'clear' : 'black', 0.185, 0.185, 0.024, 0, 0.42, 0.65, 24, Math.PI / 2);
      A.cyl('steel', 0.025, 0.025, 0.012, 0.2, 0.8, 0.652, 10, Math.PI / 2);
    };
    const pair = Math.min(rw - 0.2, 1.3);
    const sinkW = rw >= 2.5 ? 0.8 : 0;
    const u0 = sinkW ? -rw / 2 + 0.12 + pair / 2 : 0;
    appliance(K.at(u0 - 0.33, 0, 0), false);
    appliance(K.at(u0 + 0.33, 0, 0), true);
    for (const [i, c] of ['book0', 'book3', 'book4', 'pot'].entries()) K.rbox(c, 0.16, 0.26, 0.1, 0.012, u0 - 0.5 + i * 0.3, 1.78, 0.12);
    K.box('wood', pair, 0.03, 0.3, u0, 1.62, 0.15);
    K.box('wood', pair, 0.03, 0.3, u0, 1.95, 0.15);
    if (sinkW) {
      const su = rw / 2 - 0.12 - sinkW / 2;
      K.rbox('porcelain', sinkW, 0.85, 0.55, 0.02, su, 0.425, 0.28);
      K.box('steel', sinkW - 0.2, 0.015, 0.3, su - 0.12, 0.855, 0.25);
            K.cyl('steel', 0.014, 0.016, 0.28, su - 0.12, 1.0, 0.06, 10);
      K.cyl('steel', 0.01, 0.01, 0.14, su - 0.12, 1.13, 0.12, 8, Math.PI / 2);
    }
  }

  // Walk-in closet: shelving with a hanging rail and clothes. Origin at the outer wall.
  function closet(K, rw, rd, ceilY) {
    if (rw < 1.2 || rd < 1.0) return;
    const hang = ['linen', 'blanket', 'accent', 'sofa', 'pillow'];
    const run = rw - 0.16, top = Math.min(2.2, ceilY - 0.1);
    // Back panel, two side uprights and a rail at 1.75 m.
    K.box('wood', run, top, 0.02, 0, top / 2, 0.015);
    for (const sx of [-1, 1]) K.box('wood', 0.025, top, 0.4, sx * (run / 2), top / 2, 0.2);
    const cols = Math.max(1, Math.round(run / 0.85)), cw = run / cols;
    for (let i = 1; i < cols; i++) K.box('wood', 0.025, 1.3, 0.4, -run / 2 + i * cw, 0.65, 0.2);
    for (const y of [0.35, 0.7, 1.05]) for (let i = 0; i < cols; i++) K.box('wood', cw - 0.03, 0.025, 0.38, -run / 2 + (i + 0.5) * cw, y, 0.2);
    K.box('wood', run, 0.025, 0.4, 0, 1.3, 0.2);
    K.cyl('steel', 0.012, 0.012, run, 0, 1.75, 0.22, 8, 0, Math.PI / 2);
    const n = Math.floor(run / 0.085);
    for (let i = 0; i < n; i++) {
      const u = -run / 2 + 0.06 + i * 0.085;
      if (u > run / 2 - 0.04) break;
      const gh = 0.4 + ((i * 13) % 5) * 0.02;
      K.box(hang[(i * 7 + (i >> 2)) % hang.length], 0.035, gh, 0.4, u, 1.72 - gh / 2, 0.22);
    }
    for (let i = 0; i < cols; i++) {
      const u = -run / 2 + (i + 0.5) * cw;
      K.rbox('linen', cw - 0.12, 0.16, 0.3, 0.02, u, 0.43, 0.2);
      K.rbox('blanket', cw - 0.14, 0.14, 0.3, 0.02, u, 0.785, 0.2);
    }
  }

  function toilet(Tt) {
    Tt.rbox('porcelain', 0.4, 0.36, 0.17, 0.03, 0, 0.6, 0.11);
    Tt.rbox('porcelain', 0.42, 0.035, 0.19, 0.012, 0, 0.8, 0.11);
    Tt.cyl('steel', 0.02, 0.02, 0.01, 0, 0.82, 0.11, 10);
    Tt.geo('porcelain', new CylinderGeometry(0.19, 0.14, 0.4, 20).scale(1, 1, 1.3), 0, 0.2, 0.44);
    Tt.geo('porcelain', new CylinderGeometry(0.2, 0.2, 0.03, 20).scale(1, 1, 1.3), 0, 0.415, 0.45);
  }

  // Vanity (origin at the wall behind it): cabinet, counter, vessel basin, mirror.
  function vanity(V, vw) {
    V.rbox('cabinets', vw, 0.62, 0.46, 0.01, 0, 0.5, 0.24);
    V.rbox('cabinets', vw - 0.01, 0.58, 0.02, 0.005, 0, 0.5, 0.475);
    V.box('steel', 0.2, 0.012, 0.02, 0, 0.72, 0.49);
    V.rbox('counter', vw + 0.02, 0.03, 0.48, 0.005, 0, 0.83, 0.245);
    V.geo('porcelain', new LatheGeometry([[0, 0], [0.09, 0], [0.16, 0.04], [0.18, 0.13], [0.17, 0.13], [0.15, 0.05], [0.085, 0.015], [0, 0.015]].map(([x, y]) => new Vector2(x, y)), 22), 0, 0.845, 0.27);
    V.cyl('steel', 0.014, 0.016, 0.32, 0, 1.0, 0.07, 10);
    V.cyl('steel', 0.01, 0.01, 0.16, 0, 1.15, 0.14, 8, Math.PI / 2);
    const mw = Math.min(0.75, vw * 0.9);
    V.rbox('wood', mw + 0.05, 0.65, 0.02, 0.008, 0, 1.3, 0.01);
    V.box('mirror', mw, 0.6, 0.012, 0, 1.3, 0.024);
  }

  // Shower: tray, tiled walls, a fixed glass screen and a rain head.
  // Local frame: u0..u1 across, v 0..sd from the back wall; glass on the `glassAt` edge.
  function shower(K, u0, u1, sd, { sideWall = u1, glassAlongV = true } = {}) {
    const sw = u1 - u0, su = (u0 + u1) / 2;
    K.rbox('porcelain', sw - 0.02, 0.05, sd - 0.02, 0.01, su, 0.025, sd / 2);
    K.box('tile', sw, 1.6, 0.012, su, 0.82, 0.006);
    if (sideWall != null) K.box('tile', 0.012, 1.6, sd, sideWall - Math.sign(sideWall - su) * 0.006, 0.82, sd / 2);
    if (glassAlongV) {
      const gx = sideWall === u1 ? u0 : u1;
      K.box('clear', 0.012, 1.95, sd * 0.85, gx, 1.0, sd * 0.425);
      K.box('steel', 0.03, 0.03, sd * 0.85, gx, 1.98, sd * 0.425);
    } else {
      K.box('clear', sw * 0.6, 1.95, 0.012, u0 + sw * 0.3, 1.0, sd);
      K.box('steel', sw * 0.6, 0.03, 0.03, u0 + sw * 0.3, 1.98, sd);
    }
    K.cyl('steel', 0.012, 0.012, 0.3, su, 1.98, 0.15, 6, Math.PI / 2);
    K.cyl('steel', 0.1, 0.1, 0.015, su, 1.965, 0.3, 18);
    K.cyl('steel', 0.04, 0.04, 0.04, su, 1.1, 0.02, 14, Math.PI / 2);
  }

  function bathroom(K, rw, rd) {
    if (rw < 2.0) {
      // Narrow bath: shower across the back, toilet and vanity on the side walls.
      const sd = 0.9;
      if (rd >= 2.6) {
        shower(K, -rw / 2, rw / 2, sd, { sideWall: null, glassAlongV: false });
        K.box('tile', 0.012, 1.6, sd, -rw / 2 + 0.006, 0.82, sd / 2);
        K.box('tile', 0.012, 1.6, sd, rw / 2 - 0.006, 0.82, sd / 2);
        K.rbox('bathRug', 0.5, 0.012, 0.4, 0.004, rw / 4, 0.006, sd + 0.3);
      }
      const v0 = rd >= 2.6 ? sd + 0.15 : 0.1;
      toilet(K.at(-rw / 2, 0, v0 + 0.3, Math.PI / 2));
      if (rw - 0.68 - 0.46 >= 0.4 && rd - v0 > 1.6) vanity(K.at(rw / 2, 0, v0 + 1.1, -Math.PI / 2), 0.7);
      K.rbox('steel', 0.5, 0.02, 0.05, 0.01, 0, 1.1, rd - 0.04);
      return;
    }
    const sw = Math.min(0.95, rw * 0.45), sd = Math.min(1.2, rd - 1.25);
    const hasShower = sd >= 0.8;
    if (hasShower) {
      shower(K, rw / 2 - sw, rw / 2, sd);
      K.rbox('bathRug', 0.6, 0.012, 0.4, 0.004, rw / 2 - sw / 2 - 0.05, 0.006, sd + 0.32);
    }
    // Toilet at the other end, against the outer wall; vanity between.
    toilet(K.at(-rw / 2 + 0.42, 0, 0));
    const va = -rw / 2 + 0.8, vb = hasShower ? rw / 2 - sw - 0.08 : rw / 2 - 0.1;
    const vw = Math.min(0.9, vb - va);
    if (vw >= 0.45) vanity(K.at((va + vb) / 2, 0, 0), vw);
    K.rbox('steel', 0.5, 0.02, 0.05, 0.01, -rw / 2 + 0.42, 1.1, 0.03);
  }

  // Straight stair from the hall toward the back wall, one flight per floor.
  function stairs(IN, fl, r, y0) {
    const rw = r.x1 - r.x0, rd = r.z1 - r.z0;
    const sw = Math.min(1.1, rw - 0.3);
    const zs = (fl.zHallBack ?? r.z1) - 0.15;
    const side = (r.x0 + r.x1) / 2 > 0 ? -1 : 1; // balustrade on the side facing the house center
    // The flight hugs the wall on the other side, so the wall handrail is within reach.
    const cx = side > 0 ? r.x0 + 0.06 + sw / 2 : r.x1 - 0.06 - sw / 2;
    if (fl.level === F - 1 && !(flatRoof && h.roofTerrace)) {
      // Top floor: a guard rail where the flight from below arrives.
      const z = zs - 0.05;
      IN.box('tread', M.tread, sw + 0.06, 0.05, 0.06, cx, y0 + 0.95, z);
      for (let i = 0; i <= 4; i++) IN.box('iron', M.iron, 0.02, 0.9, 0.02, cx - sw / 2 + (i * sw) / 4, y0 + 0.47, z);
      return;
    }
    const n = Math.max(12, Math.ceil(FH / 0.185)), rise = FH / n;
    const run = Math.min(0.27, (rd - 0.5) / n);
    for (let i = 0; i < n; i++) {
      const zc = zs - run * (i + 0.5), ht = rise * (i + 1);
      IN.box('plaster', M.plaster, sw, ht, run, cx, y0 + ht / 2, zc);
      IN.box('tread', M.tread, sw + 0.03, 0.035, run + 0.03, cx, y0 + ht + 0.0175, zc + 0.015);
    }
    // Balustrade: posts every few steps + a sloped handrail.
    const px = cx + side * (sw / 2 - 0.04);
    const pts = [];
    for (let i = 0; i < n; i += 3) pts.push(i);
    if (pts[pts.length - 1] !== n - 1) pts.push(n - 1);
    for (const i of pts) {
      const zc = zs - run * (i + 0.5), yb = y0 + rise * (i + 1) + 0.035;
      IN.box('iron', M.iron, 0.035, 0.9, 0.035, px, yb + 0.45, zc);
    }
    const a = v3(px, y0 + rise + 0.035 + 0.92, zs - run * 0.5), b = v3(px, y0 + FH + 0.035 + 0.92, zs - run * (n - 0.5));
    const m = new Matrix4().lookAt(a, b, v3(0, 1, 0));
    m.setPosition(a.clone().add(b).multiplyScalar(0.5));
    IN.rbox('tread', M.tread, 0.06, 0.05, a.distanceTo(b) + 0.06, 0.015, 0, 0, 0, m);
    // Wall-side handrail on brackets.
    const wx = cx - side * (sw / 2 + 0.01);
    const a2 = a.clone().setX(wx), b2 = b.clone().setX(wx);
    const m2 = new Matrix4().lookAt(a2, b2, v3(0, 1, 0));
    m2.setPosition(a2.clone().add(b2).multiplyScalar(0.5));
    IN.geo('rail', M.alu, new CylinderGeometry(0.02, 0.02, a2.distanceTo(b2), 8).rotateX(Math.PI / 2), 0, 0, 0, m2);
  }

  // ---- assemble ---------------------------------------------------------------
  const group = new Group();
  group.name = 'house';
  const rooms = plan.flatMap((fl) => fl.rooms.map((r) => ({
    key: r.key, type: r.type, level: fl.level, band: r.band, name: roomName(r.type, lang),
    area: Math.round((r.x1 - r.x0) * (r.z1 - r.z0) * 10) / 10, hidden: !!r.hidden,
    x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1,
  })));
  // Light sources (bulbs, lamp shades, window glass) share materials, so one call toggles them all.
  const glow = [[FS.bulb.material, 3], [FS.shade.material, 1.1], [M.glassWin.material, 1.2]];
  const setLightsOn = (on) => { for (const [m, k] of glow) m.emissiveIntensity = on ? k : 0; };
  setLightsOn(false);
  const out = { group, layers: {}, segments, labels, rooms, lights, setLightsOn, carport, top, cut: CUT, stats: { footprint: Math.round(W * D), area: Math.round(W * D * F), floors: F, missingBedrooms: plan.missing.bedrooms, missingBathrooms: plan.missing.bathrooms } };
  for (const [name, b] of Object.entries(layers)) {
    const g = b.build();
    g.name = name;
    out.layers[name] = g;
    group.add(g);
  }
  BAL.dispose();
  // Room label sprites (shown in cutaway and plan view).
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
  out.labelGroup = lg;
  group.add(lg);
  return out;
}
