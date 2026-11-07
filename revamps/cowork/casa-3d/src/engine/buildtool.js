// v4 "Construir": the pointer tools (Pared, Puerta, Ventana, Piso, Escalera, Cerca, Portón,
// Mover, Borrar, Pintar). Owned by the UI side; it plugs into the engine through
// engine.toolContext() / engine.setTool() / engine.setBuildLevel() / engine.highlightBuild().
//
// Design notes
// - It listens on the canvas itself (capture phase) AND exposes the tool object the engine expects.
//   Every pointer event is handled once (flag on the event), so it works with or without the hook.
// - One finger on empty ground pans when nothing is being drawn: pointerdown only "claims" the
//   gesture (and freezes the orbit controls) when a tool needs it.
// - Dragging never writes to the store: a ghost shows the result and ONE store action runs on
//   release, so undo is per element.
// - Labels, the snap marker and drag handles are DOM, re-projected every frame (always readable).
import { Color, Group, Mesh, Line, LineDashedMaterial, BufferGeometry, BoxGeometry, EdgesGeometry, LineSegments, LineBasicMaterial, MeshBasicMaterial, Raycaster, Vector2, Vector3, Plane, MOUSE, TOUCH } from 'three';
import { P } from './layout.js';
import { t, getLang } from '../i18n.js';

const MIN_LEN = 0.3;
const TAP_PX = 8;
const TAP_MS = 650;
// Defaults mirror engine/buildmodel.js (OPEN_DEFAULTS, gate widths) so the ghost matches the result.
// Stairs as buildgeo.js draws them: (x, z) = middle of the first riser, running forward (-z rotated by rot).
const stairFrame = (rot = 0) => ({ fx: -Math.sin(rot), fz: -Math.cos(rot), ax: Math.cos(rot), az: -Math.sin(rot) });
const OPEN_DEF = {
  door: { w: 0.9, h: 2.1, sill: 0 },
  arch: { w: 1.2, h: 2.3, sill: 0 },
  garage: { w: 2.8, h: 2.2, sill: 0 },
  window: { w: 1.2, h: 1.2, sill: 1.0 },
  slider: { w: 2.0, h: 2.3, sill: 0 },
};
const GATE_W = { peatonal: 1.0, vehicular: 3.2 };
const minLen = (lot) => (lot ? 0.5 : MIN_LEN);

const r2 = (n) => Math.round(n * 100) / 100;
const r05 = (n) => Math.round(n * 20) / 20;
const fm = (n) => `${(+n).toFixed(2)} ${t('unit.m')}`;
const cssVar = (name, fb) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb);

function distSeg(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const k = l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l2));
  return { d: Math.hypot(px - (a.x + k * dx), py - (a.y + k * dy)), t: k };
}
function inQuad(px, py, q) {
  let inside = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const a = q[i], b = q[j];
    if ((a.y > py) !== (b.y > py) && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function createBuildTools({ store, engine, getOpts, onState, onSelect, notify, confirm, getPiece, onPiece, onPieceSelect, onPlaced, overTray }) {
  let ctx = null;
  let canvas = null;
  let active = null;       // tool id
  let level = 0;
  let raf = 0;
  let sel = null;          // { kind, id, wallId? }
  let on = false;
  let saved = null;        // controls settings to restore
  let overlay = null;
  const pointers = new Set();
  let g = null;            // current gesture
  const S = {
    wall: { start: null, first: null, cur: null, n: 0 },
    fence: { start: null, first: null, cur: null, n: 0 },
    slab: { c1: null, cur: null },
    stairs: { cur: null },
    hover: null,           // move/delete/paint hover target
    drag: null,            // move-tool drag preview
  };
  let snapMark = null;     // { x, y, z, kind, close }
  const labels = [];       // { el, x, y, z }
  let handleSpots = [];    // [{ x, y, z, strong }]
  let handlesDirty = true;
  let fitTimer = 0;
  let lastPointerAt = 0;

  const ray = new Raycaster();
  const ndc = new Vector2();
  const plane = new Plane(new Vector3(0, 1, 0), 0);
  const v3 = new Vector3();

  // ---------- store access ----------
  const B = () => store.get().build ?? null;
  const HS = () => store.get().house;
  const fh = () => B()?.floorHeight ?? 3;
  const walls = (l = level) => B()?.levels?.[l]?.walls ?? [];
  const slabs = (l = level) => B()?.levels?.[l]?.slabs ?? [];
  const stairsOf = (l = level) => B()?.levels?.[l]?.stairs ?? [];
  const fences = () => B()?.fences ?? [];
  const wallH = (w) => w.h ?? fh();
  const grid = () => B()?.grid ?? 0.5;
  const lenOf = (w) => Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
  const off = () => ({ x: HS()?.offsetX ?? 0, z: HS()?.offsetZ ?? 0 });
  const baseY = (l = level) => (ctx?.levelY ? ctx.levelY(l) : P + l * fh());
  const lotOf = () => store.get().land ?? { width: 40, depth: 40 };
  const isLotTool = () => active === 'fence' || active === 'gate';
  // Space of the active tool: 'house' (house-local metres at the level) or 'lot' (world metres).
  const spaceOff = (lot) => (lot ? { x: 0, z: 0 } : off());
  const spaceY = (lot) => (lot ? 0 : baseY());

  // ---------- context ----------
  function getCtx() {
    let c = null;
    try { c = engine.toolContext?.() ?? null; } catch { c = null; }
    if (!c) {
      const d = engine._debug;
      if (d?.camera && d?.renderer) c = { camera: d.camera, canvas: d.renderer.domElement, controls: d.controls, scene: d.scene, requestRender: () => d.controls?.dispatchEvent?.({ type: 'change' }) };
    }
    return c;
  }
  const render = () => { try { ctx?.requestRender?.(); } catch { /* ignore */ } };

  // ---------- projection ----------
  const crect = () => canvas.getBoundingClientRect();
  function proj(wx, wy, wz) {
    const r = crect();
    v3.set(wx, wy, wz).project(ctx.camera);
    return { x: (v3.x * 0.5 + 0.5) * r.width, y: (-v3.y * 0.5 + 0.5) * r.height, z: v3.z };
  }
  function worldAt(e, y) {
    const r = crect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, ctx.camera);
    plane.constant = -y;
    return ray.ray.intersectPlane(plane, v3) ? { x: v3.x, z: v3.z } : null;
  }
  // Pointer on the tool's ground plane, in the tool's space.
  function ground(e, lot = isLotTool()) {
    const w = worldAt(e, spaceY(lot));
    if (!w) return null;
    const o = spaceOff(lot);
    return { x: w.x - o.x, z: w.z - o.z };
  }
  const toWorld = (x, y, z, lot) => { const o = spaceOff(lot); return [x + o.x, y, z + o.z]; };
  function mpp(x, z, lot) {
    const [wx, wy, wz] = toWorld(x, spaceY(lot), z, lot);
    const a = proj(wx, wy, wz), b = proj(wx + 1, wy, wz), c = proj(wx, wy, wz + 1);
    const px = Math.max(Math.hypot(b.x - a.x, b.y - a.y), Math.hypot(c.x - a.x, c.y - a.y), 1e-3);
    return 1 / px;
  }
  const hitR = (e) => (e && e.pointerType && e.pointerType !== 'mouse' ? 26 : 14);

  // ---------- snapping ----------
  function localSnap(x, z, lot) {
    const gs = grid();
    const R = 16 * mpp(x, z, lot);
    let best = null;
    const consider = (px, pz, kind) => {
      const d = Math.hypot(px - x, pz - z);
      if (d <= R && (!best || d < best.d - 1e-6)) best = { x: px, z: pz, kind, d };
    };
    if (!lot) {
      for (const w of walls()) { consider(w.x0, w.z0, 'end'); consider(w.x1, w.z1, 'end'); }
      if (!best) {
        for (const w of walls()) {
          const L = lenOf(w);
          if (L < 1e-6) continue;
          const ux = (w.x1 - w.x0) / L, uz = (w.z1 - w.z0) / L;
          const k = Math.max(0, Math.min(L, (x - w.x0) * ux + (z - w.z0) * uz));
          if (Math.abs(k - L / 2) < R) consider(w.x0 + ux * L / 2, w.z0 + uz * L / 2, 'mid');
          else consider(w.x0 + ux * k, w.z0 + uz * k, 'wall');
        }
      }
    } else {
      for (const f of fences()) { consider(f.x0, f.z0, 'end'); consider(f.x1, f.z1, 'end'); }
    }
    if (best) return { x: best.x, z: best.z, kind: best.kind };
    return { x: Math.round(x / gs) * gs, z: Math.round(z / gs) * gs, kind: 'grid' };
  }
  function snap(x, z, lot = isLotTool()) {
    let r = null;
    const radius = Math.min(0.6, Math.max(0.15, 16 * mpp(x, z, lot)));
    try { r = store.snapPoint?.(x, z, lot ? 'fence' : level, { radius }); } catch { r = null; }
    if (r && Number.isFinite(r.x) && Number.isFinite(r.z)) return clampLot({ x: r.x, z: r.z, kind: r.kind ?? 'grid' }, lot);
    const s = localSnap(x, z, lot);
    return clampLot(s, lot);
  }
  function clampLot(s, lot) {
    if (!lot) return s;
    const l = lotOf();
    return { ...s, x: Math.max(-l.width / 2, Math.min(l.width / 2, s.x)), z: Math.max(-l.depth / 2, Math.min(l.depth / 2, s.z)) };
  }
  // Straighten a free (grid) point to 0 / 45 / 90 degrees when it is close.
  function orth(a, p, lot = isLotTool()) {
    if (getOpts().straight === false) return p;
    const dx = p.x - a.x, dz = p.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) return p;
    const ang = Math.atan2(dz, dx), step = Math.PI / 4;
    const near = Math.round(ang / step) * step;
    const off0 = Math.abs(ang - near);
    if (off0 > 0.12 || off0 < 0.002) return p;
    let q;
    if (Math.abs(Math.sin(near * 2)) < 0.01) q = Math.abs(Math.cos(near)) > 0.5 ? { x: p.x, z: a.z } : { x: a.x, z: p.z };
    else { const d = r05(len / Math.SQRT2); q = { x: a.x + Math.sign(dx) * d, z: a.z + Math.sign(dz) * d }; }
    // If the straightened point still lies on a wall / end / middle, keep that snap; otherwise it is a free point.
    const sn = snap(q.x, q.z, lot);
    if (sn.kind !== 'grid' && Math.hypot(sn.x - q.x, sn.z - q.z) < 0.06) return sn;
    return { x: r2(q.x), z: r2(q.z), kind: 'grid' };
  }

  // ---------- ghost meshes ----------
  const gGroup = new Group();
  const lotGroup = new Group();
  const unit = new BoxGeometry(1, 1, 1);
  const unitEdges = new EdgesGeometry(unit);
  const pool = [];
  let used = 0;
  let mats = null;
  function ensureMats() {
    if (mats) return;
    const acc = cssVar('--accent', '#b4471f'), bad = cssVar('--bad', '#a32a1e'), good = cssVar('--accent-2', '#4e6840');
    const mk = (c, o) => new MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthTest: false, depthWrite: false });
    mats = {
      ok: mk(acc, 0.4), bad: mk(bad, 0.45), good: mk(good, 0.4),
      lineOk: new LineBasicMaterial({ color: acc, depthTest: false, transparent: true }),
      lineBad: new LineBasicMaterial({ color: bad, depthTest: false, transparent: true }),
      lineGood: new LineBasicMaterial({ color: good, depthTest: false, transparent: true }),
    };
  }
  function ghostBegin() { used = 0; }
  // Box centred at world (cx, cy, cz), sizes along local x / y / z, rotated about Y.
  function ghostBox(cx, cy, cz, sx, sy, sz, rotY, tone = 'ok', lot = false) {
    ensureMats();
    let it = pool[used];
    if (!it) {
      const m = new Mesh(unit, mats.ok);
      m.renderOrder = 998;
      m.raycast = () => {};
      const ln = new LineSegments(unitEdges, mats.lineOk);
      ln.renderOrder = 999;
      ln.raycast = () => {};
      m.add(ln);
      it = { m, ln };
      pool.push(it);
    }
    used += 1;
    const grp = lot ? lotGroup : gGroup;
    if (it.m.parent !== grp) grp.add(it.m);
    it.m.material = mats[tone] ?? mats.ok;
    it.ln.material = mats[`line${tone[0].toUpperCase()}${tone.slice(1)}`] ?? mats.lineOk;
    it.m.position.set(cx, cy, cz);
    it.m.scale.set(Math.max(sx, 0.02), Math.max(sy, 0.02), Math.max(sz, 0.02));
    it.m.rotation.set(0, rotY, 0);
    it.m.visible = true;
  }
  function ghostEnd() {
    for (let i = used; i < pool.length; i++) pool[i].m.visible = false;
    placeGroups();
    render();
  }
  // The blank start's outline: a dashed rectangle on the ground (a hint, never pickable) until the first wall exists.
  let hintLine = null;
  function updateHint() {
    const hn = B()?.hint;
    const show = on && hn && level === 0 && !walls(0).length;
    if (!show) { if (hintLine) hintLine.visible = false; return; }
    if (!hintLine) {
      hintLine = new Line(new BufferGeometry(), new LineDashedMaterial({ color: new Color(cssVar('--accent', '#b4471f')), dashSize: 0.35, gapSize: 0.22, depthTest: false, transparent: true, opacity: 0.9 }));
      hintLine.renderOrder = 997;
      hintLine.raycast = () => {};
      gGroup.add(hintLine);
    }
    const y = baseY(0) + 0.03;
    const key = `${hn.x0},${hn.z0},${hn.x1},${hn.z1},${y}`;
    if (hintLine.userData.key === key && hintLine.visible) return;
    hintLine.userData.key = key;
    hintLine.geometry.setFromPoints([[hn.x0, hn.z0], [hn.x1, hn.z0], [hn.x1, hn.z1], [hn.x0, hn.z1], [hn.x0, hn.z0]].map(([x, z]) => new Vector3(x, y, z)));
    hintLine.computeLineDistances();
    hintLine.visible = true;
    render();
  }
  function placeGroups() {
    const o = off();
    gGroup.position.set(o.x, 0, o.z);
    lotGroup.position.set(0, 0, 0);
    updateHint();
  }
  // A wall-like box between two points (in the tool's space).
  function ghostSeg(a, b, thick, height, y0, tone, lot) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const L = Math.hypot(dx, dz);
    ghostBox((a.x + b.x) / 2, y0 + height / 2, (a.z + b.z) / 2, L, height, thick, -Math.atan2(dz, dx), tone, lot);
  }
  const clearGhosts = () => { ghostBegin(); ghostEnd(); };

  // ---------- DOM overlay (labels, snap marker, handles) ----------
  function ensureOverlay() {
    if (overlay?.isConnected) return;
    overlay = document.createElement('div');
    overlay.className = 'bt-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    (canvas.parentElement ?? document.body).append(overlay);
    overlay.snap = document.createElement('div');
    overlay.snap.className = 'bt-snap';
    overlay.snap.hidden = true;
    overlay.append(overlay.snap);
    overlay.hs = [];
    labels.length = 0;
  }
  function labelEl(i) {
    ensureOverlay();
    while (labels.length <= i) {
      const el = document.createElement('div');
      el.className = 'bt-label';
      el.hidden = true;
      overlay.append(el);
      labels.push({ el, x: 0, y: 0, z: 0, on: false });
    }
    return labels[i];
  }
  function setLabel(i, text, x, y, z, cls = '') {
    const L = labelEl(i);
    L.el.textContent = text;
    L.el.className = `bt-label ${cls}`;
    L.x = x; L.y = y; L.z = z; L.on = true;
  }
  function clearLabels() { for (const L of labels) { L.on = false; L.el.hidden = true; } }

  function frame() {
    raf = 0;
    if (!on) return;
    try { layoutOverlay(); } catch { /* camera not ready */ }
    raf = requestAnimationFrame(frame);
  }
  function layoutOverlay() {
    if (!overlay || !ctx) return;
    const r = crect();
    const place = (el, p, dy = 0) => {
      const vis = p.z < 1 && p.x > -40 && p.x < r.width + 40 && p.y > -40 && p.y < r.height + 40;
      el.hidden = !vis;
      if (vis) el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y + dy)}px) translate(-50%, -50%)`;
    };
    if (snapMark) {
      overlay.snap.className = `bt-snap k-${snapMark.kind}${snapMark.close ? ' is-close' : ''}`;
      place(overlay.snap, proj(snapMark.x, snapMark.y, snapMark.z));
    } else overlay.snap.hidden = true;
    for (const L of labels) if (L.on) place(L.el, proj(L.x, L.y, L.z), -22);
    const hs = handleSpots;
    while (overlay.hs.length < hs.length) {
      const el = document.createElement('div');
      el.className = 'bt-handle';
      overlay.append(el);
      overlay.hs.push(el);
    }
    overlay.hs.forEach((el, i) => {
      const s = hs[i];
      if (!s) { el.hidden = true; return; }
      el.classList.toggle('strong', !!s.strong);
      place(el, proj(s.x, s.y, s.z));
    });
  }

  function setSnapMark(p, lot, y, close) {
    if (!p) { snapMark = null; return; }
    const [wx, , wz] = toWorld(p.x, 0, p.z, lot);
    snapMark = { x: wx, y: y ?? spaceY(lot), z: wz, kind: p.kind ?? 'grid', close: !!close };
  }

  // ---------- picking (screen space, so tilted views feel natural) ----------
  function wallQuad(w, l = level) {
    const o = off(), y0 = baseY(l), h = wallH(w);
    return [proj(w.x0 + o.x, y0, w.z0 + o.z), proj(w.x1 + o.x, y0, w.z1 + o.z), proj(w.x1 + o.x, y0 + h, w.z1 + o.z), proj(w.x0 + o.x, y0 + h, w.z0 + o.z)];
  }
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  // Score = how close the pointer is to this wall's visible face. d = 0 inside the face.
  function wallHit(w, sx, sy) {
    const q = wallQuad(w);
    const m = distSeg(sx, sy, mid(q[0], q[3]), mid(q[1], q[2]));
    const b = distSeg(sx, sy, q[0], q[1]);
    const tp = distSeg(sx, sy, q[3], q[2]);
    const inside = inQuad(sx, sy, q);
    return { d: inside ? Math.min(b.d, m.d) * 0.01 : Math.min(m.d, b.d, tp.d), t: m.t, q };
  }
  // Exact hit: the pointer ray against the wall's vertical face (nearest wins), so overlapping faces on screen never confuse two walls.
  function rayWall(sx, sy, only) {
    ndc.set((sx / crect().width) * 2 - 1, -(sy / crect().height) * 2 + 1);
    ray.setFromCamera(ndc, ctx.camera);
    const O = ray.ray.origin, D = ray.ray.direction, o = off(), y0 = baseY();
    let best = null;
    for (const w of walls()) {
      if (only && !only(w)) continue;
      const ax = w.x0 + o.x, az = w.z0 + o.z, ex = w.x1 - w.x0, ez = w.z1 - w.z0;
      const cr = D.x * ez - D.z * ex;
      if (Math.abs(cr) < 1e-9) continue;
      const qx = ax - O.x, qz = az - O.z;
      const sPar = (qx * ez - qz * ex) / cr, u = (qx * D.z - qz * D.x) / cr;
      if (sPar <= 0 || u < 0 || u > 1) continue;
      const y = O.y + sPar * D.y;
      if (y < y0 - 0.05 || y > y0 + wallH(w) + 0.05) continue;
      if (!best || sPar < best.s) best = { wall: w, s: sPar, t: u, d: 0 };
    }
    return best;
  }
  function pickWall(sx, sy, r, only) {
    const exact = rayWall(sx, sy, only);
    if (exact) return exact;
    let best = null;
    for (const w of walls()) {
      if (only && !only(w)) continue;
      const h = wallHit(w, sx, sy);
      if (h.d <= r && (!best || h.d < best.d)) best = { wall: w, ...h };
    }
    return best;
  }
  function openingQuad(w, o, l = level) {
    const L = lenOf(w), ux = (w.x1 - w.x0) / L, uz = (w.z1 - w.z0) / L;
    const a0 = o.at - o.w / 2, a1 = o.at + o.w / 2;
    const op = off(), y0 = baseY(l) + (o.sill ?? 0), y1 = y0 + o.h;
    const P0 = [w.x0 + ux * a0 + op.x, w.z0 + uz * a0 + op.z], P1 = [w.x0 + ux * a1 + op.x, w.z0 + uz * a1 + op.z];
    return [proj(P0[0], y0, P0[1]), proj(P1[0], y0, P1[1]), proj(P1[0], y1, P1[1]), proj(P0[0], y1, P0[1])];
  }
  function pickOpening(sx, sy, r) {
    let best = null;
    for (const w of walls()) {
      for (const o of w.openings ?? []) {
        const q = openingQuad(w, o);
        const d = inQuad(sx, sy, q) ? 0 : Math.min(...[0, 1, 2, 3].map((i) => distSeg(sx, sy, q[i], q[(i + 1) % 4]).d));
        if (d <= r * 0.7 && (!best || d < best.d)) best = { wall: w, opening: o, d };
      }
    }
    return best;
  }
  function pickWallEnd(sx, sy, r) {
    let best = null;
    const o = off(), y0 = baseY();
    const consider = (w, end) => {
      const p = proj((end ? w.x1 : w.x0) + o.x, y0, (end ? w.z1 : w.z0) + o.z);
      const d = Math.hypot(p.x - sx, p.y - sy);
      // The selected wall's handles get the full 44 px target; the others a smaller one, so they never steal taps meant for an opening or a wall face.
      if (d <= (sel?.id === w.id ? r : r * 0.55) && (!best || d < best.d)) best = { wall: w, end, d };
    };
    for (const w of walls()) { consider(w, 0); consider(w, 1); }
    return best;
  }
  function pickFence(sx, sy, r) {
    let best = null;
    for (const f of fences()) {
      const a = proj(f.x0, 0.5, f.z0), b = proj(f.x1, 0.5, f.z1);
      const ground0 = proj(f.x0, 0, f.z0), ground1 = proj(f.x1, 0, f.z1);
      const top0 = proj(f.x0, f.h ?? 1.8, f.z0), top1 = proj(f.x1, f.h ?? 1.8, f.z1);
      const inside = inQuad(sx, sy, [ground0, ground1, top1, top0]);
      const s = distSeg(sx, sy, a, b);
      const d = inside ? 0 : s.d;
      if (d <= r && (!best || d < best.d)) best = { fence: f, d, t: s.t };
    }
    return best;
  }
  function pickFenceEnd(sx, sy, r) {
    let best = null;
    for (const f of fences()) {
      for (const end of [0, 1]) {
        const p = proj(end ? f.x1 : f.x0, 0, end ? f.z1 : f.z0);
        const d = Math.hypot(p.x - sx, p.y - sy);
        if (d <= (sel?.id === f.id ? r : r * 0.55) && (!best || d < best.d)) best = { fence: f, end, d };
      }
    }
    return best;
  }
  const stairLen = (s) => s?.len ?? Math.max(12, Math.ceil(fh() / 0.185)) * 0.27;
  function stairQuad(s) {
    const len = stairLen(s), f = stairFrame(s.rot ?? 0);
    return [[-s.w / 2, 0], [s.w / 2, 0], [s.w / 2, len], [-s.w / 2, len]].map(([a, d]) => ({ x: s.x + f.ax * a + f.fx * d, z: s.z + f.az * a + f.fz * d }));
  }
  const inRect = (p, r) => p.x >= Math.min(r.x0, r.x1) && p.x <= Math.max(r.x0, r.x1) && p.z >= Math.min(r.z0, r.z1) && p.z <= Math.max(r.z0, r.z1);
  function pickFlat(e) {
    const p = ground(e, false);
    if (!p) return null;
    for (const s of stairsOf()) {
      const q = stairQuad(s).map((c) => ({ x: c.x, y: c.z }));
      if (inQuad(p.x, p.z, q)) return { kind: 'stairs', id: s.id };
    }
    let best = null;
    for (const sl of slabs()) if (inRect(p, sl) && (!best || Math.abs((sl.x1 - sl.x0) * (sl.z1 - sl.z0)) < best.a)) best = { kind: 'slab', id: sl.id, a: Math.abs((sl.x1 - sl.x0) * (sl.z1 - sl.z0)) };
    return best ? { kind: best.kind, id: best.id } : null;
  }
  // A wall by its base line or its top edge only (so taps inside a room reach the floor, not the tall wall faces in front of it).
  function pickWallLine(sx, sy, r) {
    let best = null;
    for (const w of walls()) {
      const q = wallQuad(w);
      // Base line only: the top edge and faces project over the floor of the room behind, which must stay selectable.
      const d = distSeg(sx, sy, q[0], q[1]).d;
      if (d <= r * 0.6 && (!best || d < best.d)) best = { wall: w, d, t: distSeg(sx, sy, mid(q[0], q[3]), mid(q[1], q[2])).t };
    }
    return best;
  }

  // What is under the pointer, for Mover / Borrar / Pintar. `kinds` limits the search.
  function hitAt(e, kinds) {
    const r = crect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top, R = hitR(e);
    const has = (k) => kinds.includes(k);
    if (has('end')) {
      const h = pickWallEnd(sx, sy, R);
      if (h) return { kind: 'end', id: h.wall.id, wall: h.wall, end: h.end };
      const fe = pickFenceEnd(sx, sy, R);
      if (fe) return { kind: 'fenceEnd', id: fe.fence.id, fence: fe.fence, end: fe.end };
    }
    if (has('opening')) {
      const h = pickOpening(sx, sy, R);
      if (h) return { kind: 'opening', id: h.opening.id, wall: h.wall, opening: h.opening };
    }
    if (has('wall')) {
      const h = pickWall(sx, sy, R);
      if (h) return { kind: 'wall', id: h.wall.id, wall: h.wall, t: h.t, sx, sy };
    }
    if (has('wallLine')) {
      const h = pickWallLine(sx, sy, R);
      if (h) return { kind: 'wall', id: h.wall.id, wall: h.wall, t: h.t, sx, sy };
    }
    if (has('fence')) {
      const h = pickFence(sx, sy, R);
      if (h) return { kind: 'fence', id: h.fence.id, fence: h.fence, t: h.t };
    }
    if (has('flat')) {
      const f = pickFlat(e);
      if (f) return f;
    }
    if (has('wallFace')) {
      const h = pickWall(sx, sy, R);
      if (h) return { kind: 'wall', id: h.wall.id, wall: h.wall, t: h.t, sx, sy };
    }
    return null;
  }

  // ---------- actions ----------
  const ok = (v) => v !== false && v != null;
  const same = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
  function say(key, kind = 'bad') { notify?.(key, kind); }

  function emit() {
    const wl = S.wall.start, fe = S.fence.start;
    const st = {
      tool: active,
      drawing: !!(wl || fe || S.slab.c1),
      canFinish: !!((active === 'wall' && wl && S.wall.n > 0) || (active === 'fence' && fe && S.fence.n > 0)),
      canCancel: !!((active === 'wall' && wl) || (active === 'fence' && fe) || (active === 'slab' && S.slab.c1)),
      phase: active === 'wall' ? (wl ? 1 : 0) : active === 'fence' ? (fe ? 1 : 0) : active === 'slab' ? (S.slab.c1 ? 1 : 0) : 0,
    };
    onState?.(st);
  }

  // ---------- chain tools: Pared / Cerca ----------
  const chainOf = () => (active === 'fence' ? S.fence : S.wall);
  function chainPreview(e) {
    const c = chainOf();
    const lot = active === 'fence';
    const o = getOpts();
    const raw = e ? ground(e, lot) : null;
    clearLabels();
    ghostBegin();
    if (!raw) { ghostEnd(); return; }
    let p = snap(raw.x, raw.z, lot);
    let close = false;
    if (c.start) {
      p = orth(c.start, p);
      close = !!c.first && c.n > 1 && Math.hypot(p.x - c.first.x, p.z - c.first.z) < 0.08;
      c.cur = p;
      const len = Math.hypot(p.x - c.start.x, p.z - c.start.z);
      const bad = len < minLen(lot);
      const thick = lot ? 0.12 : (o.wall?.t ?? 0.2);
      const height = lot ? (o.fence?.h ?? 1.8) : fh();
      ghostSeg(c.start, p, thick, height, spaceY(lot), bad ? 'bad' : close ? 'good' : 'ok', lot);
      const [mx, , mz] = toWorld((c.start.x + p.x) / 2, 0, (c.start.z + p.z) / 2, lot);
      const ang = Math.round(((Math.atan2(p.z - c.start.z, p.x - c.start.x) * 180) / Math.PI + 360) % 360);
      const prev = c.prevDir;
      let angTxt = `${ang}°`;
      if (prev != null) {
        let d = Math.abs(ang - prev) % 360;
        if (d > 180) d = 360 - d;
        angTxt = `∠ ${Math.round(180 - d)}°`;
      }
      if (len > 0.04) setLabel(0, `${fm(len)} · ${angTxt}`, mx, spaceY(lot) + (lot ? (o.fence?.h ?? 1.8) : fh()) + 0.1, mz, 'strong');
      if (close) { const [cx, , cz] = toWorld(p.x, 0, p.z, lot); setLabel(1, t('bt.close'), cx, spaceY(lot) + 0.2, cz, 'ok'); }
    }
    setSnapMark(p, lot, undefined, close);
    ghostEnd();
  }
  function chainCommit(p, lot) {
    const c = chainOf();
    const a = c.start;
    const len = Math.hypot(p.x - a.x, p.z - a.z);
    if (len < minLen(lot)) { chainFinish(); return; }
    const o = getOpts();
    let res;
    if (lot) res = store.addFence?.(a.x, a.z, p.x, p.z, { type: o.fence?.type, h: o.fence?.h, color: o.fence?.color });
    else res = store.addWall?.(level, a.x, a.z, p.x, p.z, { t: o.wall?.t, ext: o.wall?.ext });
    if (!ok(res)) { say(lot ? 'bt.fenceFail' : 'bt.wallFail'); return; }
    if (lot && store.get().yard?.fence !== 'custom') store.set?.('yard.fence', 'custom');
    handlesDirty = true;
    c.n += 1;
    c.prevDir = Math.round(((Math.atan2(p.z - a.z, p.x - a.x) * 180) / Math.PI + 360) % 360);
    const closed = c.first && c.n > 1 && Math.hypot(p.x - c.first.x, p.z - c.first.z) < 0.08;
    if (closed) { chainFinish(); say(lot ? 'bt.fenceClosed' : 'bt.wallClosed', 'good'); return; }
    c.start = { x: p.x, z: p.z };
    if (!c.first) c.first = { ...a };
  }
  function chainFinish() {
    const c = chainOf();
    Object.assign(c, { start: null, first: null, cur: null, n: 0, prevDir: null });
    clearLabels();
    clearGhosts();
    emit();
  }
  const chainHandlers = {
    claim: (e) => e.pointerType === 'mouse' || !!chainOf().start,
    hover: (e) => chainPreview(e),
    drag: (e) => chainPreview(e),
    tap: (e) => {
      const lot = active === 'fence';
      const c = chainOf();
      const raw = ground(e, lot);
      if (!raw) return;
      let p = snap(raw.x, raw.z, lot);
      if (!c.start) {
        c.start = { x: p.x, z: p.z };
        c.first = { x: p.x, z: p.z };
        c.n = 0;
        c.prevDir = null;
        emit();
        chainPreview(e);
        return;
      }
      p = orth(c.start, p);
      chainCommit(p, lot);
      emit();
      chainPreview(e);
    },
    dragEnd: (e, gs) => {
      const lot = active === 'fence';
      const c = chainOf();
      const raw = ground(e, lot);
      if (!raw) return;
      if (!gs.pre) {
        const d0 = ground({ clientX: gs.x0, clientY: gs.y0 }, lot);
        if (!d0) return;
        const a = snap(d0.x, d0.z, lot);
        c.start = { x: a.x, z: a.z };
        c.first = { x: a.x, z: a.z };
        c.n = 0;
        c.prevDir = null;
      }
      chainCommit(orth(c.start, snap(raw.x, raw.z, lot)), lot);
      emit();
      chainPreview(e);
    },
    abort: () => {},
    reset: () => chainFinish(),
  };
  // The start of a mouse drag from idle needs the pre-drag state.
  const gestureStartHook = (gs) => { gs.pre = !!(active === 'fence' ? S.fence.start : active === 'wall' ? S.wall.start : active === 'slab' ? S.slab.c1 : null); };

  // ---------- opening tools: Puerta / Ventana ----------
  function openingSpec(kind) {
    const d = OPEN_DEF[kind] ?? OPEN_DEF.door;
    return { kind, ...d };
  }
  // Where on a wall would an opening of width w sit if the pointer is at (sx, sy)?
  function placeOn(wall, tparam, spec, ignoreId) {
    const L = lenOf(wall);
    const lo = spec.w / 2 + 0.12, hi = L - lo;
    if (hi < lo || spec.w > L - 0.3) return { at: L / 2, valid: false, why: 'bt.tooWide' };
    let at = Math.max(lo, Math.min(hi, tparam * L));
    if (Math.abs(at - L / 2) < 0.15) at = L / 2; else at = r05(at);
    at = Math.max(lo, Math.min(hi, at));
    const clash = (wall.openings ?? []).some((o) => o.id !== ignoreId && Math.abs(o.at - at) < (o.w + spec.w) / 2 + 0.08);
    return { at, valid: !clash, why: clash ? 'bt.clash' : null };
  }
  function ghostOpening(wall, at, spec, tone) {
    const L = lenOf(wall), ux = (wall.x1 - wall.x0) / L, uz = (wall.z1 - wall.z0) / L;
    const y0 = baseY() + spec.sill;
    ghostBox(wall.x0 + ux * at, y0 + spec.h / 2, wall.z0 + uz * at, spec.w, spec.h, (wall.t ?? 0.2) + 0.08, -Math.atan2(wall.z1 - wall.z0, wall.x1 - wall.x0), tone);
    // Distance to both corners, as labels on the free spans.
    clearLabels();
    const left = at - spec.w / 2, right = L - (at + spec.w / 2);
    const o = off();
    const ly = baseY() + Math.min(fh(), y0 - baseY() + spec.h) + 0.15;
    setLabel(0, fm(left), wall.x0 + ux * (left / 2) + o.x, ly, wall.z0 + uz * (left / 2) + o.z, 'dist');
    setLabel(1, fm(right), wall.x0 + ux * (L - right / 2) + o.x, ly, wall.z0 + uz * (L - right / 2) + o.z, 'dist');
    setLabel(2, `${fm(spec.w)}`, wall.x0 + ux * at + o.x, ly + 0.45, wall.z0 + uz * at + o.z, 'strong');
  }
  function openingTarget(e) {
    const kindOpt = getOpts()[active]?.kind ?? (active === 'door' ? 'door' : 'window');
    const spec = openingSpec(kindOpt);
    const o = getOpts()[active] ?? {};
    const r = crect();
    const h = pickWall(e.clientX - r.left, e.clientY - r.top, hitR(e) + 10);
    if (!h) return { spec: { ...spec, ...o.size } };
    const sp = { ...spec };
    return { wall: h.wall, spec: sp, ...placeOn(h.wall, h.t, sp) };
  }
  function openingPreview(e) {
    ghostBegin();
    clearLabels();
    const tg = openingTarget(e);
    snapMark = null;
    if (tg.wall) ghostOpening(tg.wall, tg.at, tg.spec, tg.valid ? 'ok' : 'bad');
    ghostEnd();
    return tg;
  }
  const openingHandlers = {
    claim: (e) => { const r = crect(); return !!pickWall(e.clientX - r.left, e.clientY - r.top, hitR(e) + 10); },
    hover: (e) => { openingPreview(e); },
    drag: (e) => { openingPreview(e); },
    tap: (e) => placeOpening(e),
    dragEnd: (e) => placeOpening(e),
    abort: () => clearGhosts(),
    reset: () => { clearGhosts(); clearLabels(); },
  };
  function placeOpening(e) {
    const tg = openingTarget(e);
    if (!tg.wall) return;
    if (!tg.valid) { say(tg.why ?? 'bt.clash'); return; }
    const { spec } = tg;
    const before = new Set((tg.wall.openings ?? []).map((o) => o.id));
    const res = store.addOpening?.(tg.wall.id, spec.kind, tg.at, { w: spec.w, h: spec.h, sill: spec.sill });
    if (!ok(res)) { say('bt.openFail'); return; }
    const w2 = walls().find((w) => w.id === tg.wall.id);
    const added = typeof res === 'string' ? res : (w2?.openings ?? []).find((o) => !before.has(o.id))?.id;
    handlesDirty = true;
    notify?.('bt.placed.' + (spec.kind === 'window' || spec.kind === 'slider' ? 'window' : 'door'), 'good', added ? { kind: 'opening', id: added, wallId: tg.wall.id } : null);
    openingPreview(e);
  }

  // ---------- Piso ----------
  function fillRect(px, pz) {
    const ws = walls(), eps = 0.08;
    const vs = ws.filter((w) => Math.abs(w.x0 - w.x1) < eps);
    const hs = ws.filter((w) => Math.abs(w.z0 - w.z1) < eps);
    const inZ = (w, z) => z >= Math.min(w.z0, w.z1) - eps && z <= Math.max(w.z0, w.z1) + eps;
    const inX = (w, x) => x >= Math.min(w.x0, w.x1) - eps && x <= Math.max(w.x0, w.x1) + eps;
    let xl = -Infinity, xr = Infinity, zt = -Infinity, zb = Infinity;
    for (const w of vs) if (inZ(w, pz)) { if (w.x0 <= px) xl = Math.max(xl, w.x0); else xr = Math.min(xr, w.x0); }
    for (const w of hs) if (inX(w, px)) { if (w.z0 <= pz) zt = Math.max(zt, w.z0); else zb = Math.min(zb, w.z0); }
    if (![xl, xr, zt, zb].every(Number.isFinite)) return null;
    const cover = (list, axis, c, lo, hi) => {
      const iv = list.filter((w) => Math.abs((axis === 'x' ? w.z0 : w.x0) - c) < eps)
        .map((w) => (axis === 'x' ? [Math.min(w.x0, w.x1), Math.max(w.x0, w.x1)] : [Math.min(w.z0, w.z1), Math.max(w.z0, w.z1)]))
        .sort((a, b) => a[0] - b[0]);
      let at = lo;
      for (const [a, b] of iv) { if (a <= at + 0.3) at = Math.max(at, b); }
      return at >= hi - 0.3;
    };
    if (!(cover(hs, 'x', zt, xl, xr) && cover(hs, 'x', zb, xl, xr) && cover(vs, 'z', xl, zt, zb) && cover(vs, 'z', xr, zt, zb))) return null;
    return { x0: xl, z0: zt, x1: xr, z1: zb };
  }
  const sameRect = (a, b) => Math.abs(a.x0 - b.x0) < 0.1 && Math.abs(a.z0 - b.z0) < 0.1 && Math.abs(a.x1 - b.x1) < 0.1 && Math.abs(a.z1 - b.z1) < 0.1;
  function slabCommit(r) {
    const rect = { x0: Math.min(r.x0, r.x1), z0: Math.min(r.z0, r.z1), x1: Math.max(r.x0, r.x1), z1: Math.max(r.z0, r.z1) };
    if (rect.x1 - rect.x0 < 0.5 || rect.z1 - rect.z0 < 0.5) { say('bt.slabSmall'); return false; }
    if (slabs().some((s) => sameRect(s, rect))) { say('bt.slabHas'); return false; }
    const f = getOpts().floor ?? {};
    const kind = getOpts().slabKind || null;
    // Undefined keys would override the store's default finish when spread: only pass what is set.
    const extra = Object.fromEntries(Object.entries({ finish: f.finish, tone: f.tone, pattern: f.pattern, tileSize: f.tileSize }).filter(([, v]) => v != null));
    const kindPatch = kind ? { kind, ...(kind === 'carport' ? { raised: false, finish: 'cemento' } : {}) } : {};
    const res = store.addSlab?.(level, { ...rect, ...extra, ...kindPatch });
    if (!ok(res)) { say('bt.slabFail'); return false; }
    notify?.('bt.slabAdded', 'good');
    return true;
  }
  function slabPreview(e, anchor) {
    const raw = e ? ground(e, false) : null;
    clearLabels();
    ghostBegin();
    if (raw) {
      const p = snap(raw.x, raw.z, false);
      setSnapMark(p, false);
      S.slab.cur = p;
      if (anchor) {
        const x0 = Math.min(anchor.x, p.x), x1 = Math.max(anchor.x, p.x), z0 = Math.min(anchor.z, p.z), z1 = Math.max(anchor.z, p.z);
        const tone = x1 - x0 < 0.5 || z1 - z0 < 0.5 ? 'bad' : 'ok';
        ghostBox((x0 + x1) / 2, baseY() + 0.06, (z0 + z1) / 2, x1 - x0, 0.12, z1 - z0, 0, tone);
        const o = off();
        setLabel(0, `${fm(x1 - x0)} × ${fm(z1 - z0)}`, (x0 + x1) / 2 + o.x, baseY() + 0.2, (z0 + z1) / 2 + o.z, 'strong');
        setLabel(1, `${((x1 - x0) * (z1 - z0)).toFixed(1)} m²`, (x0 + x1) / 2 + o.x, baseY() + 0.2, (z0 + z1) / 2 + o.z, 'dist');
        labels[1].el.style.marginTop = '26px';
      } else {
        // Hovering inside a closed room: show what a tap would fill.
        const fr = getOpts().slabKind ? null : fillRect(raw.x, raw.z);
        if (fr && !slabs().some((s) => sameRect(s, fr))) {
          ghostBox((fr.x0 + fr.x1) / 2, baseY() + 0.06, (fr.z0 + fr.z1) / 2, fr.x1 - fr.x0, 0.12, fr.z1 - fr.z0, 0, 'good');
          const o = off();
          setLabel(0, `${((fr.x1 - fr.x0) * (fr.z1 - fr.z0)).toFixed(1)} m²`, (fr.x0 + fr.x1) / 2 + o.x, baseY() + 0.2, (fr.z0 + fr.z1) / 2 + o.z, 'ok');
        }
      }
    }
    ghostEnd();
  }
  const slabHandlers = {
    claim: (e) => e.pointerType === 'mouse' || !!S.slab.c1,
    hover: (e) => slabPreview(e, S.slab.c1),
    drag: (e, gs) => {
      const anchor = S.slab.c1 ?? (() => { const d = ground({ clientX: gs.x0, clientY: gs.y0 }, false); return d ? snap(d.x, d.z, false) : null; })();
      slabPreview(e, anchor);
    },
    tap: (e) => {
      const raw = ground(e, false);
      if (!raw) return;
      if (S.slab.c1) {
        const p = snap(raw.x, raw.z, false);
        const a = S.slab.c1;
        if (slabCommit({ x0: a.x, z0: a.z, x1: p.x, z1: p.z })) S.slab.c1 = null;
        emit();
        slabPreview(e, S.slab.c1);
        return;
      }
      const fr = getOpts().slabKind ? null : fillRect(raw.x, raw.z);
      if (fr) { slabCommit(fr); slabPreview(e, null); return; }
      const p = snap(raw.x, raw.z, false);
      S.slab.c1 = { x: p.x, z: p.z };
      emit();
      slabPreview(e, S.slab.c1);
    },
    dragEnd: (e, gs) => {
      const raw = ground(e, false);
      if (!raw) return;
      let a = S.slab.c1;
      if (!a) { const d = ground({ clientX: gs.x0, clientY: gs.y0 }, false); a = d ? snap(d.x, d.z, false) : null; }
      if (!a) return;
      const p = snap(raw.x, raw.z, false);
      if (slabCommit({ x0: a.x, z0: a.z, x1: p.x, z1: p.z })) S.slab.c1 = null;
      emit();
      slabPreview(e, S.slab.c1);
    },
    abort: () => {},
    reset: () => { S.slab.c1 = null; clearLabels(); clearGhosts(); emit(); },
  };

  // ---------- Escalera ----------
  function stairsPreview(e) {
    ghostBegin();
    clearLabels();
    const raw = e ? ground(e, false) : null;
    if (raw) {
      const o = getOpts().stairs ?? { w: 1, rot: 0 };
      const p = { x: Math.round(raw.x / 0.25) * 0.25, z: Math.round(raw.z / 0.25) * 0.25 };
      S.stairs.cur = p;
      const len = stairLen(null), f = stairFrame(o.rot ?? 0);
      const cx = p.x + f.fx * len / 2, cz = p.z + f.fz * len / 2;
      ghostBox(cx, baseY() + fh() / 2, cz, o.w ?? 1, fh(), len, o.rot ?? 0, 'ok');
      const op = off();
      setLabel(0, `${fm(o.w ?? 1)} × ${fm(len)}`, cx + op.x, baseY() + fh() + 0.2, cz + op.z, 'strong');
      setSnapMark({ ...p, kind: 'grid' }, false);
    }
    ghostEnd();
  }
  const stairsHandlers = {
    claim: (e) => e.pointerType === 'mouse',
    hover: (e) => stairsPreview(e),
    drag: (e) => stairsPreview(e),
    tap: (e) => placeStairs(e),
    dragEnd: (e) => placeStairs(e),
    abort: () => {},
    reset: () => { clearLabels(); clearGhosts(); },
  };
  async function placeStairs(e) {
    const raw = ground(e, false);
    if (!raw) return;
    const o = getOpts().stairs ?? { w: 1, rot: 0 };
    const p = { x: Math.round(raw.x / 0.25) * 0.25, z: Math.round(raw.z / 0.25) * 0.25 };
    // Stairs on the top floor need a floor above: ask first, then add it.
    if (level >= (B()?.levels?.length ?? 1) - 1) {
      const yes = confirm ? await confirm('bt.stairsAddFloor', { n: level + 2 }) : true;
      if (!yes) return;
      if (!ok(store.addLevel?.())) { say('bt.levelFail'); return; }
      notify?.('bt.levelAdded2', 'good', null, false, { n: level + 2 });
    }
    const res = store.addStairs?.(level, p.x, p.z, o.rot ?? 0, { w: o.w ?? 1 });
    if (!ok(res)) { say('bt.stairsFail'); return; }
    notify?.('bt.stairsAdded', 'good');
    stairsPreview(e);
  }

  // ---------- Portón ----------
  function gateTarget(e) {
    const r = crect();
    const h = pickFence(e.clientX - r.left, e.clientY - r.top, hitR(e) + 10);
    if (!h) return null;
    const kind = getOpts().gate?.kind ?? 'peatonal';
    const w = GATE_W[kind] ?? 1;
    const f = h.fence;
    const L = Math.hypot(f.x1 - f.x0, f.z1 - f.z0);
    const lo = w / 2 + 0.1;
    if (L < w + 0.2) return { fence: f, kind, w, at: L / 2, valid: false };
    const at = Math.max(lo, Math.min(L - lo, r05(h.t * L)));
    const gl = f.gates ?? (f.gate ? [f.gate] : []);
    // A fence piece can hold several gates only when the engine stores a list (f.gates).
    const room = !gl.length || (Array.isArray(f.gates) && gl.every((g) => Math.abs(g.at - at) >= (g.w + w) / 2 + 0.1));
    return { fence: f, kind, w, at, valid: room };
  }
  function gatePreview(e) {
    ghostBegin();
    clearLabels();
    const tg = gateTarget(e);
    if (tg) {
      const f = tg.fence, L = Math.hypot(f.x1 - f.x0, f.z1 - f.z0), ux = (f.x1 - f.x0) / L, uz = (f.z1 - f.z0) / L;
      ghostBox(f.x0 + ux * tg.at, (f.h ?? 1.8) / 2, f.z0 + uz * tg.at, tg.w, f.h ?? 1.8, 0.2, -Math.atan2(f.z1 - f.z0, f.x1 - f.x0), tg.valid ? 'good' : 'bad', true);
      setLabel(0, fm(tg.w), f.x0 + ux * tg.at, (f.h ?? 1.8) + 0.2, f.z0 + uz * tg.at, 'strong');
    }
    ghostEnd();
  }
  function placeGate(e) {
    const tg = gateTarget(e);
    if (!tg) return;
    if (!tg.valid) { say(tg.fence.gate || tg.fence.gates?.length ? (Array.isArray(tg.fence.gates) ? 'bt.gateClash' : 'bt.gateHas') : 'bt.gateFail'); return; }
    const res = store.addGate?.(tg.fence.id, tg.at, tg.kind);
    if (!ok(res)) { say('bt.gateFail'); return; }
    notify?.('bt.gateAdded', 'good');
    gatePreview(e);
  }
  const gateHandlers = {
    claim: (e) => { const r = crect(); return !!pickFence(e.clientX - r.left, e.clientY - r.top, hitR(e) + 10); },
    hover: gatePreview,
    drag: gatePreview,
    tap: placeGate,
    dragEnd: placeGate,
    abort: () => {},
    reset: () => { clearLabels(); clearGhosts(); },
  };

  // ---------- Mover (select + drag) ----------
  const MOVE_KINDS = ['end', 'opening', 'wallLine', 'fence', 'flat', 'wallFace'];
  function select(s) {
    sel = s;
    try { engine.highlightBuild?.(s?.id ?? null); } catch { /* ignore */ }
    handlesDirty = true;
    refreshHandles();
    onSelect?.(s);
  }
  function refreshHandles() {
    handleSpots = [];
    handlesDirty = false;
    if (!on) return;
    if (active === 'move') {
      const y0 = baseY(), o = off();
      for (const w of walls()) {
        const strong = sel?.id === w.id;
        handleSpots.push({ x: w.x0 + o.x, y: y0, z: w.z0 + o.z, strong }, { x: w.x1 + o.x, y: y0, z: w.z1 + o.z, strong });
      }
      for (const f of fences()) {
        const strong = sel?.id === f.id;
        handleSpots.push({ x: f.x0, y: 0, z: f.z0, strong }, { x: f.x1, y: 0, z: f.z1, strong });
      }
    }
  }
  function dragPreview(e) {
    const d = S.drag;
    if (!d) return;
    ghostBegin();
    clearLabels();
    snapMark = null;
    const lot = d.lot;
    const raw = ground(e, lot);
    if (!raw) { ghostEnd(); return; }
    if (d.type === 'end' || d.type === 'fenceEnd') {
      let p = snap(raw.x, raw.z, lot);
      p = orth(d.fixed, p, lot);
      d.to = p;
      const len = Math.hypot(p.x - d.fixed.x, p.z - d.fixed.z);
      const thick = lot ? 0.12 : (d.item.t ?? 0.2);
      ghostSeg(d.fixed, p, thick, lot ? (d.item.h ?? 1.8) : wallH(d.item), spaceY(lot), len < minLen(lot) ? 'bad' : 'ok', lot);
      const [mx, , mz] = toWorld((d.fixed.x + p.x) / 2, 0, (d.fixed.z + p.z) / 2, lot);
      setLabel(0, fm(len), mx, spaceY(lot) + (lot ? (d.item.h ?? 1.8) : wallH(d.item)) + 0.1, mz, 'strong');
      setSnapMark(p, lot);
    } else if (d.type === 'wallBody') {
      const gs = grid();
      const dx = Math.round((raw.x - d.start.x) / gs) * gs, dz = Math.round((raw.z - d.start.z) / gs) * gs;
      d.delta = { dx, dz };
      const w = d.item;
      ghostSeg({ x: w.x0 + dx, z: w.z0 + dz }, { x: w.x1 + dx, z: w.z1 + dz }, w.t ?? 0.2, wallH(w), baseY(), 'ok', false);
      const [mx, , mz] = toWorld((w.x0 + w.x1) / 2 + dx, 0, (w.z0 + w.z1) / 2 + dz, false);
      setLabel(0, `${dx >= 0 ? '+' : ''}${dx.toFixed(2)} , ${dz >= 0 ? '+' : ''}${dz.toFixed(2)} m`, mx, baseY() + wallH(w) + 0.1, mz, 'strong');
    } else if (d.type === 'fenceBody') {
      const gs = grid();
      const dx = Math.round((raw.x - d.start.x) / gs) * gs, dz = Math.round((raw.z - d.start.z) / gs) * gs;
      d.delta = { dx, dz };
      const f = d.item;
      ghostSeg({ x: f.x0 + dx, z: f.z0 + dz }, { x: f.x1 + dx, z: f.z1 + dz }, 0.12, f.h ?? 1.8, 0, 'ok', true);
    } else if (d.type === 'opening') {
      const r = crect();
      const w = d.wall;
      const sp = { w: d.item.w, h: d.item.h, sill: d.item.sill ?? 0 };
      const q = wallQuad(w);
      const m = distSeg(e.clientX - r.left, e.clientY - r.top, mid(q[0], q[3]), mid(q[1], q[2]));
      const pl = placeOn(w, m.t, sp, d.item.id);
      d.at = pl.at;
      d.valid = pl.valid;
      ghostOpening(w, pl.at, sp, pl.valid ? 'ok' : 'bad');
    }
    ghostEnd();
  }
  function moveClaim(e) {
    const h = hitAt(e, MOVE_KINDS);
    if (!h) return false;
    const lot = h.kind === 'fenceEnd' || h.kind === 'fence';
    const raw = ground(e, lot) ?? { x: 0, z: 0 };
    if (h.kind === 'end') S.drag = { type: 'end', item: h.wall, id: h.id, end: h.end, fixed: h.end ? { x: h.wall.x0, z: h.wall.z0 } : { x: h.wall.x1, z: h.wall.z1 }, lot: false, hit: h };
    else if (h.kind === 'fenceEnd') S.drag = { type: 'fenceEnd', item: h.fence, id: h.id, end: h.end, fixed: h.end ? { x: h.fence.x0, z: h.fence.z0 } : { x: h.fence.x1, z: h.fence.z1 }, lot: true, hit: h };
    else if (h.kind === 'opening') S.drag = { type: 'opening', item: h.opening, wall: h.wall, id: h.id, lot: false, hit: h };
    else if (h.kind === 'wall') S.drag = { type: 'wallBody', item: h.wall, id: h.id, start: raw, lot: false, hit: h };
    else if (h.kind === 'fence') S.drag = { type: 'fenceBody', item: h.fence, id: h.id, start: raw, lot: true, hit: h };
    else S.drag = { type: 'flat', hit: h, id: h.id };
    return true;
  }
  function moveTap(e) {
    const d = S.drag;
    S.drag = null;
    clearLabels();
    clearGhosts();
    const h = d?.hit ?? hitAt(e, MOVE_KINDS);
    if (!h) { select(null); return; }
    if (h.kind === 'end' || h.kind === 'wall') select({ kind: 'wall', id: h.wall.id });
    else if (h.kind === 'opening') select({ kind: 'opening', id: h.id, wallId: h.wall.id });
    else if (h.kind === 'fenceEnd' || h.kind === 'fence') select({ kind: 'fence', id: h.fence.id });
    else if (h.kind === 'stairs') select({ kind: 'stairs', id: h.id });
    else if (h.kind === 'slab') select({ kind: 'slab', id: h.id });
  }
  function moveDragEnd(e) {
    const d = S.drag;
    S.drag = null;
    clearLabels();
    clearGhosts();
    snapMark = null;
    if (!d) return;
    let res = true;
    if (d.type === 'end' && d.to) {
      if (Math.hypot(d.to.x - d.fixed.x, d.to.z - d.fixed.z) < MIN_LEN) { say('bt.tooShort'); return; }
      res = store.moveWallEnd?.(d.id, d.end, d.to.x, d.to.z);
    } else if (d.type === 'fenceEnd' && d.to) {
      if (Math.hypot(d.to.x - d.fixed.x, d.to.z - d.fixed.z) < 0.5) { say('bt.tooShort'); return; }
      res = store.setFence?.(d.id, d.end ? { x1: d.to.x, z1: d.to.z } : { x0: d.to.x, z0: d.to.z });
    } else if (d.type === 'wallBody' && d.delta && (d.delta.dx || d.delta.dz)) {
      res = store.moveWallBy?.(d.id, d.delta.dx, d.delta.dz);
    } else if (d.type === 'fenceBody' && d.delta && (d.delta.dx || d.delta.dz)) {
      const f = d.item;
      res = store.setFence?.(d.id, { x0: f.x0 + d.delta.dx, z0: f.z0 + d.delta.dz, x1: f.x1 + d.delta.dx, z1: f.z1 + d.delta.dz });
    } else if (d.type === 'opening' && d.at != null) {
      if (!d.valid) { say('bt.clash'); return; }
      res = Math.abs(d.at - d.item.at) < 1e-6 ? true : store.setOpening?.(d.wall.id, d.id, { at: d.at });
    }
    if (!ok(res)) say('bt.moveFail');
    handlesDirty = true;
  }
  const moveHandlers = {
    claim: moveClaim,
    hover: (e) => { if (e.pointerType === 'mouse') hoverHighlight(e); },
    drag: dragPreview,
    tap: moveTap,
    dragEnd: moveDragEnd,
    abort: () => { S.drag = null; clearLabels(); clearGhosts(); },
    reset: () => { S.drag = null; clearLabels(); clearGhosts(); },
  };
  function hoverHighlight(e) {
    const h = hitAt(e, active === 'move' ? MOVE_KINDS : active === 'paint' ? ['wall', 'flat'] : DEL_KINDS);
    const id = h?.id ?? null;
    if (S.hover !== id) { S.hover = id; try { engine.highlightBuild?.(id ?? sel?.id ?? null); } catch { /* ignore */ } }
    if (canvas) canvas.style.cursor = h ? 'pointer' : '';
  }

  // ---------- Borrar ----------
  function removeHit(h) {
    let res = false, name = 'item';
    if (h.kind === 'opening') { res = store.removeOpening?.(h.wall.id, h.id); name = 'opening'; }
    else if (h.kind === 'end' || h.kind === 'wall') { res = store.removeWall?.(h.wall.id); name = 'wall'; }
    else if (h.kind === 'fenceEnd' || h.kind === 'fence') { res = store.removeFence?.(h.fence.id); name = 'fence'; }
    else if (h.kind === 'stairs') { res = store.removeStairs?.(h.id); name = 'stairs'; }
    else if (h.kind === 'slab') { res = store.removeSlab?.(h.id); name = 'slab'; }
    if (!ok(res)) { say('bt.removeFail'); return; }
    if (sel?.id === h.id) select(null);
    handlesDirty = true;
    notify?.('bt.removed.' + name, 'good', null, true);
  }
  const DEL_KINDS = ['opening', 'wallLine', 'fence', 'flat', 'wallFace'];
  const deleteHandlers = {
    claim: (e) => !!hitAt(e, DEL_KINDS),
    hover: (e) => { if (e.pointerType === 'mouse') hoverHighlight(e); },
    drag: () => {},
    tap: (e) => { const h = hitAt(e, DEL_KINDS); if (h) removeHit(h); },
    dragEnd: () => {},
    abort: () => {},
    reset: () => {},
  };

  // ---------- Pintar ----------
  // Which face of the wall did he tap? The one turned toward the camera (the only one that can be seen and hit).
  function wallSide(h) {
    const w = h.wall;
    if (!w.ext) return 'inColor';
    const L = lenOf(w) || 1;
    const nx = -(w.z1 - w.z0) / L, nz = (w.x1 - w.x0) / L;
    const o = off();
    const mx = (w.x0 + w.x1) / 2 + o.x, mz = (w.z0 + w.z1) / 2 + o.z;
    const cp = ctx.camera.position;
    const camSide = Math.sign((cp.x - mx) * nx + (cp.z - mz) * nz) || 1;
    const ext = walls().filter((x) => x.ext);
    const cx = ext.reduce((s, x) => s + (x.x0 + x.x1) / 2, 0) / Math.max(1, ext.length) + o.x;
    const cz = ext.reduce((s, x) => s + (x.z0 + x.z1) / 2, 0) / Math.max(1, ext.length) + o.z;
    const inward = Math.sign((cx - mx) * nx + (cz - mz) * nz) || 1;
    return camSide === inward ? 'inColor' : 'outColor';
  }
  function paintAt(e) {
    const o = getOpts();
    const h = hitAt(e, ['wall', 'flat']);
    if (!h) return;
    let res = false;
    if (h.kind === 'wall') {
      // The ray hits the wall face, not the floor: use the side the pointer is on at floor level.
      const side = wallSide(h);
      const patch = { [side]: o.paint?.color, ...(o.paint?.finish ? { finish: o.paint.finish } : {}) };
      const cur = walls().find((x) => x.id === h.id);
      // Already that colour on that face: not an error.
      res = Object.entries(patch).every(([k, v]) => same(cur?.[k], v)) ? true : store.setWall?.(h.id, patch);
      if (ok(res)) notify?.(side === 'inColor' ? 'bt.paintedIn' : 'bt.paintedOut', 'good');
    } else if (h.kind === 'slab') {
      const f = o.floor ?? {};
      const patch = Object.fromEntries(Object.entries({ finish: f.finish, tone: f.tone, pattern: f.pattern, tileSize: f.tileSize }).filter(([, v]) => v != null));
      const cur = slabs().find((x) => x.id === h.id);
      res = Object.entries(patch).every(([k, v]) => cur?.[k] === v) ? true : store.setSlab?.(h.id, patch);
      if (ok(res)) notify?.('bt.paintedFloor', 'good');
    } else { say('bt.paintNo'); return; }
    if (!ok(res)) say('bt.paintFail');
  }
  const paintHandlers = {
    claim: (e) => !!hitAt(e, ['wall', 'flat']),
    hover: (e) => { if (e.pointerType === 'mouse') hoverHighlight(e); },
    drag: () => {},
    tap: paintAt,
    dragEnd: () => {},
    abort: () => {},
    reset: () => {},
  };

  // ---------- Piezas (v5) ----------
  // Ready-made pieces. Three ways in: drag a card from the tray (window-level pointer listeners, the
  // finger never touches the canvas), tap a card (the ghost is "armed" and waits for Poner aquí),
  // or grab a placed piece on the canvas (a box ghost shows where it will land; ONE moveGroup on release).
  // Fitting is store.fitPiece (pure); the see-through ghost is engine.pieceGhost.
  const LIFT = 64;
  const PZ = { id: null, piece: null, rot: 0, fit: null, mode: 'idle', ptr: null, touch: false, over: false, pt: null, sel: null, mv: null, ghostDrag: null };
  const pzLot = (p) => !!p && (p.kind === 'fence' || p.kind === 'gate' || p.kind === 'yard');
  const pzSize = () => {
    const p = PZ.piece;
    const swap = PZ.rot % 180 !== 0;
    return p ? { w: swap ? p.d : p.w, d: swap ? p.w : p.d } : { w: 0, d: 0 };
  };
  const fmN = (n) => `${+(+n).toFixed(2)}`;
  const clearBad = () => { for (const el of document.querySelectorAll('.toast-bad')) el.remove(); };
  const withSize = (p, s) => (/\d\s*m\b/.test(pzName(p)) ? pzName(p) : `${pzName(p)} ${s}`);
  const pzName = (p) => (p?.name ? p.name[getLang()] ?? p.name.es : '');
  function pzState() {
    const bad = PZ.fit && !PZ.fit.ok;
    return { mode: PZ.mode, id: PZ.id, rot: PZ.rot, ok: !!PZ.fit?.ok, reason: bad ? (PZ.fit.reason ?? 'unknown') : null, over: PZ.over, hasFit: !!PZ.fit };
  }
  const pzEmit = () => { try { onPiece?.(pzState()); } catch (err) { console.warn('piece state', err); } };
  function pzGhostOff() { try { engine.pieceGhost?.(PZ.id, null); } catch { /* ignore */ } }
  // Pointer on the piece's ground (house level floor, or the lot), optionally lifted above a finger.
  function pzGround(e, lot, lift = 0) {
    const w = worldAt({ clientX: e.clientX, clientY: e.clientY - lift }, lot ? 0 : baseY());
    if (!w) return null;
    const o = spaceOff(lot);
    return { x: w.x - o.x, z: w.z - o.z };
  }
  function pzFit(pt, quiet) {
    const p = PZ.piece;
    if (!p || !pt) return;
    let res = null;
    try { res = store.fitPiece?.(PZ.id, { level, x: pt.x, z: pt.z, rot: PZ.rot }); } catch (err) { console.warn('fitPiece', err); }
    if (!res) res = { ok: false, reason: 'unknown' };
    PZ.pt = pt;
    PZ.fit = { level, x: pt.x, z: pt.z, rot: PZ.rot, ...res };
    try { engine.pieceGhost?.(PZ.id, PZ.fit); } catch (err) { console.warn('pieceGhost', err); }
    const lot = (PZ.fit.frame ?? (pzLot(p) ? 'lot' : 'house')) === 'lot';
    const s = pzSize();
    const [wx, , wz] = toWorld(PZ.fit.x, 0, PZ.fit.z, lot);
    setLabel(0, withSize(p, `${fmN(s.w)} × ${fmN(s.d)} ${t('unit.m')}`), wx, lot ? 2 : baseY() + 3.1, wz, PZ.fit.ok ? 'strong' : 'bad');
    render();
    if (!quiet) pzEmit();
  }
  function pzReset(clear = true) {
    if (clear && PZ.id) pzGhostOff();
    window.removeEventListener('pointermove', pzMove, true);
    window.removeEventListener('pointerup', pzUp, true);
    window.removeEventListener('pointercancel', pzUp, true);
    window.removeEventListener('pointerdown', pzSecond, true);
    Object.assign(PZ, { id: null, piece: null, rot: 0, fit: null, mode: 'idle', ptr: null, over: false, pt: null, ghostDrag: null });
    if (clear) { clearLabels(); render(); }
    pzEmit();
  }
  function pzRotate() {
    if (!PZ.piece || (PZ.mode !== 'drag' && PZ.mode !== 'armed')) return;
    PZ.rot = (PZ.rot + 90) % 360;
    if (PZ.pt && !(PZ.mode === 'drag' && PZ.over)) pzFit(PZ.pt); else pzEmit();
  }
  function pzMove(e) {
    if (e.pointerId !== PZ.ptr || PZ.mode !== 'drag') return;
    const r = crect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside || overTray?.(e.clientX, e.clientY)) {
      if (!PZ.over) { PZ.over = true; PZ.fit = null; pzGhostOff(); clearLabels(); render(); }
      pzEmit();
      return;
    }
    const pt = pzGround(e, pzLot(PZ.piece), PZ.touch ? LIFT : 0);
    if (!pt) return;
    PZ.over = false;
    pzFit(pt);
  }
  // A quick second finger anywhere (except the Girar button, which handles itself) turns the held piece.
  function pzSecond(e) {
    if (PZ.mode !== 'drag' || e.pointerId === PZ.ptr || e.pointerType === 'mouse') return;
    if (e.target?.closest?.('.pz-bar')) return;
    pzRotate();
  }
  function pzUp(e) {
    if (e.pointerId !== PZ.ptr) return;
    // Let go on the Girar button: turn it and keep the piece armed so Poner aquí can finish the job.
    if (e.type === 'pointerup' && PZ.fit && document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-key="pz-rotate"]')) {
      window.removeEventListener('pointermove', pzMove, true);
      window.removeEventListener('pointerup', pzUp, true);
      window.removeEventListener('pointercancel', pzUp, true);
      window.removeEventListener('pointerdown', pzSecond, true);
      PZ.mode = 'armed'; PZ.ptr = null; PZ.over = false;
      // Keep the ghost clear of the floating bar: if it sits behind it, slide it up into the open stage.
      const bar = document.querySelector('.pz-bar')?.getBoundingClientRect();
      if (bar && PZ.fit && PZ.pt) {
        const cr = crect(), lot = pzLot(PZ.piece), o = spaceOff(lot);
        const sp = proj(PZ.pt.x + o.x, lot ? 0 : baseY(), PZ.pt.z + o.z);
        if (sp.y + cr.top > bar.top - 80) {
          const np = pzGround({ clientX: sp.x + cr.left, clientY: bar.top - 110 }, lot);
          if (np) PZ.pt = np;
        }
      }
      pzRotate();
      return;
    }
    const fit = PZ.fit, over = PZ.over, cancelled = e.type === 'pointercancel';
    if (!fit || over || cancelled) { pzReset(); return; }
    if (fit.ok) pzCommit();
    else say(`pz.r.${fit.reason && fit.reason in REASONS ? fit.reason : 'unknown'}`);
    if (PZ.mode === 'drag') pzReset();
  }
  const REASONS = { outsideLot: 1, overlap: 1, noWall: 1, noFence: 1, noRoom: 1, noSupport: 1, maxLevels: 1, maxItems: 1, upperOnly: 1, noHouse: 1, stairsNowhere: 1, unknown: 1, moveFail: 1 };
  function pzCommit() {
    const fit = PZ.fit, id = PZ.id;
    if (!fit?.ok) return false;
    let res = null;
    try { res = store.placePiece?.(id, fit); } catch (err) { console.warn('placePiece', err); }
    if (!res || res.ok === false) {
      const rs = res?.reason;
      say(`pz.r.${rs && rs in REASONS ? rs : 'unknown'}`);
      return false;
    }
    const ids = res.ids ?? [];
    try { engine.dropAnim?.(ids); } catch { /* ignore */ }
    try { navigator.vibrate?.(10); } catch { /* ignore */ }
    clearBad();
    onPlaced?.({ pieceId: id, ids, level: res.level ?? level });
    return true;
  }
  // Candidate centres for the first ghost of a tapped card: beside the house, else its middle.
  function houseBox(l = level) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    const add = (a, b, c, d) => { x0 = Math.min(x0, a, c); x1 = Math.max(x1, a, c); z0 = Math.min(z0, b, d); z1 = Math.max(z1, b, d); };
    for (const w of walls(l)) add(w.x0, w.z0, w.x1, w.z1);
    for (const s of slabs(l)) add(s.x0, s.z0, s.x1, s.z1);
    if (x0 === Infinity && l > 0) return houseBox(l - 1);
    if (x0 === Infinity) { const hn = B()?.hint; if (hn) return { x0: hn.x0, x1: hn.x1, z0: hn.z0, z1: hn.z1, empty: true }; return { x0: -2, x1: 2, z0: -2, z1: 2, empty: true }; }
    return { x0, x1, z0, z1 };
  }
  function pzStart(piece) {
    const k = piece.kind, hb = houseBox();
    const cx = (hb.x0 + hb.x1) / 2, cz = (hb.z0 + hb.z1) / 2;
    if (k === 'opening') { const w = walls()[0]; return w ? { x: (w.x0 + w.x1) / 2, z: (w.z0 + w.z1) / 2 } : { x: cx, z: cz }; }
    if (k === 'gate') { const f = fences()[0]; return f ? { x: (f.x0 + f.x1) / 2, z: (f.z0 + f.z1) / 2 } : { x: 0, z: 0 }; }
    if (pzLot(piece)) { const o = off(); return { x: o.x + cx, z: o.z + hb.z1 + 3 }; }
    if (k === 'roof' || k === 'extra' || hb.empty) return { x: cx, z: cz };
    const w = piece.w, d = piece.d;
    const cands = [{ x: hb.x1 + w / 2, z: cz }, { x: hb.x0 - w / 2, z: cz }, { x: cx, z: hb.z0 - d / 2 }, { x: cx, z: hb.z1 + d / 2 }, { x: cx, z: cz }];
    for (const c of cands) {
      const r = store.fitPiece?.(piece.id, { level, x: c.x, z: c.z, rot: 0 });
      if (r?.ok) return c;
    }
    return cands[0];
  }
  function pzArm(id) {
    const piece = getPiece?.(id);
    if (!piece || !on) return false;
    pzReset(true);
    PZ.id = id; PZ.piece = piece; PZ.mode = 'armed';
    pzFit(pzStart(piece));
    return true;
  }
  function pzGrab(e, id) {
    const piece = getPiece?.(id);
    if (!piece || !on) return false;
    pzReset(true);
    PZ.id = id; PZ.piece = piece; PZ.mode = 'drag'; PZ.ptr = e.pointerId; PZ.touch = e.pointerType !== 'mouse'; PZ.over = true;
    window.addEventListener('pointermove', pzMove, true);
    window.addEventListener('pointerup', pzUp, true);
    window.addEventListener('pointercancel', pzUp, true);
    window.addEventListener('pointerdown', pzSecond, true);
    pzMove(e);
    pzEmit();
    return true;
  }
  // After a placement in tap mode the piece stays armed: park the ghost next to what was just placed.
  function pzNext(placed) {
    if (PZ.mode !== 'armed' || !PZ.piece) return;
    const s = pzSize(), at = PZ.pt ?? { x: 0, z: 0 };
    const step = [[s.w, 0], [-s.w, 0], [0, s.d], [0, -s.d]];
    for (const [dx, dz] of step) {
      const c = { x: at.x + dx, z: at.z + dz };
      const r = store.fitPiece?.(PZ.id, { level: placed?.level ?? level, x: c.x, z: c.z, rot: PZ.rot });
      if (r?.ok) { pzFit(c); return; }
    }
    pzFit(at);
  }
  function pzPlaceArmed() {
    if (PZ.mode !== 'armed') return false;
    if (!PZ.fit?.ok) { say(`pz.r.${PZ.fit?.reason && PZ.fit.reason in REASONS ? PZ.fit.reason : 'unknown'}`); return false; }
    const ok1 = pzCommit();
    if (ok1) pzNext({ level });
    return ok1;
  }

  // ----- placed pieces: bounds, selection, grab -----
  const colsOf = (l = level) => B()?.levels?.[l]?.columns ?? [];
  function boundsOfIds(ids) {
    const b = B();
    if (!b || !ids?.length) return null;
    const set = new Set(ids);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, found = 0, lot = false, lv = level, hh = 0.3;
    const add = (a, c, d, f, pad = 0) => { x0 = Math.min(x0, a - pad, d - pad); x1 = Math.max(x1, a + pad, d + pad); z0 = Math.min(z0, c - pad, f - pad); z1 = Math.max(z1, c + pad, f + pad); found += 1; };
    (b.levels ?? []).forEach((l, li) => {
      for (const w of l.walls ?? []) if (set.has(w.id)) { add(w.x0, w.z0, w.x1, w.z1, (w.t ?? 0.2) / 2); lv = li; hh = Math.max(hh, w.h ?? fh()); }
      for (const s of l.slabs ?? []) if (set.has(s.id)) { add(s.x0, s.z0, s.x1, s.z1); lv = li; }
      for (const c of l.columns ?? []) if (set.has(c.id)) { add(c.x, c.z, c.x, c.z, (c.s ?? 0.3) / 2); lv = li; hh = Math.max(hh, c.h ?? fh()); }
      for (const s of l.stairs ?? []) if (set.has(s.id)) { const q = stairQuad(s); add(Math.min(...q.map((c) => c.x)), Math.min(...q.map((c) => c.z)), Math.max(...q.map((c) => c.x)), Math.max(...q.map((c) => c.z))); lv = li; }
    });
    for (const f of b.fences ?? []) if (set.has(f.id)) { add(f.x0, f.z0, f.x1, f.z1, 0.1); lot = true; hh = Math.max(hh, f.h ?? 1.8); }
    for (const it of store.get().yard?.items ?? []) if (set.has(it.id)) { add(it.x, it.z, it.x, it.z, 0.6); lot = true; hh = Math.max(hh, 1.5); }
    return found ? { x0, x1, z0, z1, lot, level: lv, h: hh } : null;
  }
  function pzSelect(grp) {
    PZ.sel = grp;
    try { engine.highlightBuild?.(grp?.ids ?? null); } catch { /* ignore */ }
    onPieceSelect?.(grp);
  }
  // The group under the pointer: columns and yard items by ground distance, the rest by the v4 screen picks.
  function pzGroupAt(e) {
    const gp = ground(e, false);
    const call = (x, z) => { try { return store.groupAt?.(level, x, z) ?? null; } catch (err) { console.warn('groupAt', err); return null; } };
    if (gp) for (const c of colsOf()) if (Math.hypot(c.x - gp.x, c.z - gp.z) <= (c.s ?? 0.3) / 2 + 0.3) return call(c.x, c.z);
    // The floor under the pointer wins (a room, a slab, stairs); free-standing walls and fences fall through to the screen picks.
    const g0 = gp ? call(gp.x, gp.z) : null;
    if (g0?.ids?.length && g0.kind !== 'wall') return g0;
    const h = hitAt(e, ['opening', 'wallLine', 'fence', 'flat', 'wallFace']);
    if (h) {
      let pt = null;
      if (h.kind === 'opening') { const w = h.wall, L = lenOf(w) || 1; pt = { x: w.x0 + ((w.x1 - w.x0) * h.opening.at) / L, z: w.z0 + ((w.z1 - w.z0) * h.opening.at) / L }; }
      else if (h.kind === 'wall') pt = { x: h.wall.x0 + (h.wall.x1 - h.wall.x0) * h.t, z: h.wall.z0 + (h.wall.z1 - h.wall.z0) * h.t };
      else if (h.kind === 'fence') { const o = off(); pt = { x: h.fence.x0 + (h.fence.x1 - h.fence.x0) * h.t - o.x, z: h.fence.z0 + (h.fence.z1 - h.fence.z0) * h.t - o.z }; }
      else pt = gp;
      const g1 = pt ? call(pt.x, pt.z) : null;
      if (g1?.ids?.length) return g1;
    }
    const lp = ground(e, true);
    if (lp) for (const it of store.get().yard?.items ?? []) if (Math.hypot(it.x - lp.x, it.z - lp.z) <= 1) { const o = off(); return call(it.x - o.x, it.z - o.z) ?? { kind: 'yard', ids: [it.id], label: it.type }; }
    return null;
  }
  function pzMoveBox(d) {
    ghostBegin();
    const bx = d.box, dx = d.dx, dz = d.dz;
    const cx = (bx.x0 + bx.x1) / 2 + dx, cz = (bx.z0 + bx.z1) / 2 + dz;
    const y = bx.lot ? 0 : baseY(bx.level);
    const hgt = Math.min(bx.h, 3.2);
    ghostBox(cx, y + hgt / 2, cz, bx.x1 - bx.x0, hgt, bx.z1 - bx.z0, 0, d.bad ? 'bad' : 'ok', bx.lot);
    ghostEnd();
  }
  const pieceHandlers = {
    claim(e) {
      if (PZ.mode === 'armed') {
        const lot = pzLot(PZ.piece);
        const gp = ground(e, lot);
        const c = PZ.fit ?? PZ.pt;
        const s = pzSize();
        const rad = Math.max(s.w, s.d) / 2 + 0.6;
        if (gp && c && Math.abs(gp.x - c.x) <= Math.max(rad, 0.9) && Math.abs(gp.z - c.z) <= Math.max(rad, 0.9)) { PZ.ghostDrag = true; return true; }
        return false;
      }
      if (PZ.mode !== 'idle') return false;
      const grp = pzGroupAt(e);
      if (!grp?.ids?.length) return false;
      const box = boundsOfIds(grp.ids);
      if (!box) return false;
      const start = ground(e, box.lot) ?? { x: 0, z: 0 };
      PZ.mv = { grp, box, start, dx: 0, dz: 0, bad: false, moved: false };
      return true;
    },
    hover(e) {
      if (e.pointerType !== 'mouse') return;
      if (PZ.mode === 'armed') { const pt = pzGround(e, pzLot(PZ.piece)); if (pt) pzFit(pt, true); if (canvas) canvas.style.cursor = 'copy'; return; }
      if (PZ.mode !== 'idle') return;
      const grp = pzGroupAt(e);
      if (canvas) canvas.style.cursor = grp ? 'grab' : '';
      const id = grp?.ids?.[0] ?? PZ.sel?.ids?.[0] ?? null;
      if (S.hover !== id) { S.hover = id; try { engine.highlightBuild?.(id); } catch { /* ignore */ } }
    },
    drag(e) {
      if (PZ.ghostDrag) { const pt = pzGround(e, pzLot(PZ.piece), e.pointerType === 'mouse' ? 0 : 48); if (pt) pzFit(pt); return; }
      const d = PZ.mv;
      if (!d) return;
      const gp = ground(e, d.box.lot);
      if (!gp) return;
      const gs = grid();
      d.dx = Math.round((gp.x - d.start.x) / gs) * gs;
      d.dz = Math.round((gp.z - d.start.z) / gs) * gs;
      d.moved = true;
      d.bad = false;
      if (store.fitGroup && (d.dx || d.dz)) {
        try { const f = store.fitGroup(d.grp.ids, d.dx, d.dz); if (f) { d.bad = f.ok === false; d.reason = f.reason; if (f.ok !== false && Number.isFinite(f.dx)) { d.dx = f.dx; d.dz = f.dz; } } } catch { /* ignore */ }
      }
      pzMoveBox(d);
      const bx = d.box;
      const [wx, , wz] = toWorld((bx.x0 + bx.x1) / 2 + d.dx, 0, (bx.z0 + bx.z1) / 2 + d.dz, bx.lot);
      clearLabels();
      setLabel(0, d.grp.label && typeof d.grp.label === 'object' ? (d.grp.label[getLang()] ?? d.grp.label.es) : (d.grp.label ?? ''), wx, (bx.lot ? 0 : baseY(bx.level)) + Math.min(bx.h, 3.2) + 0.3, wz, 'strong');
    },
    tap(e) {
      const wasMv = PZ.mv;
      PZ.mv = null; PZ.ghostDrag = null;
      clearGhosts(); clearLabels();
      if (PZ.mode === 'armed') {
        const pt = pzGround(e, pzLot(PZ.piece));
        if (!pt) return;
        pzFit(pt);
        return;
      }
      if (wasMv?.grp) { pzSelect(wasMv.grp); return; }
      const grp = pzGroupAt(e);
      pzSelect(grp?.ids?.length ? grp : null);
    },
    dragEnd() {
      if (PZ.ghostDrag) { PZ.ghostDrag = null; return; }
      const d = PZ.mv;
      PZ.mv = null;
      clearGhosts(); clearLabels();
      if (!d || (!d.dx && !d.dz)) return;
      if (d.bad) { const rs = d.reason; say(`pz.r.${rs && rs in REASONS ? rs : 'moveFail'}`); return; }
      let res = null;
      try { res = store.moveGroup?.(d.grp.ids, d.dx, d.dz); } catch (err) { console.warn('moveGroup', err); }
      if (!res || res.ok === false) { const rs = res?.reason ?? d.reason ?? store.buildReason?.(); say(`pz.r.${rs && rs in REASONS ? rs : 'moveFail'}`); return; }
      clearBad();
      try { engine.dropAnim?.(d.grp.ids); } catch { /* ignore */ }
      try { navigator.vibrate?.(10); } catch { /* ignore */ }
      pzSelect({ ...d.grp });
    },
    abort() { PZ.mv = null; PZ.ghostDrag = null; clearGhosts(); clearLabels(); },
    reset() { PZ.mv = null; PZ.ghostDrag = null; if (PZ.mode !== 'idle') pzReset(true); if (PZ.sel) pzSelect(null); clearGhosts(); clearLabels(); },
  };
  function pzKey(e) {
    if (e.key === 'r' || e.key === 'R') { if (PZ.mode === 'drag' || PZ.mode === 'armed') { e.preventDefault(); e.stopImmediatePropagation(); pzRotate(); } }
    else if (e.key === 'Escape' && PZ.mode !== 'idle') { e.preventDefault(); pzReset(true); }
    else if (e.key === 'Escape' && PZ.sel) pzSelect(null);
  }
  const pieces = {
    state: pzState, grab: pzGrab, arm: pzArm, disarm: () => pzReset(true), rotate: pzRotate, place: pzPlaceArmed,
    select: pzSelect, selection: () => PZ.sel, bounds: boundsOfIds,
  };

  const HANDLERS = { wall: chainHandlers, fence: chainHandlers, door: openingHandlers, window: openingHandlers, slab: slabHandlers, stairs: stairsHandlers, gate: gateHandlers, move: moveHandlers, delete: deleteHandlers, paint: paintHandlers, pieces: pieceHandlers };
  const H = () => HANDLERS[active];

  // ---------- pointer plumbing ----------
  function setControls(freeze) {
    const c = ctx?.controls;
    if (!c) return;
    c.enabled = !freeze;
  }
  function onDown(e) {
    if (e._btDown) return e._btRet;
    lastPointerAt = performance.now();
    e._btDown = true;
    pointers.add(e.pointerId);
    e._btRet = false;
    if (!on || !H()) return false;
    if (e.pointerType === 'mouse' && e.button !== 0) return false;
    if (pointers.size > 1) { abortGesture(); return false; }
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false, consumed: false, type: e.pointerType };
    gestureStartHook(g);
    let claim = false;
    try { claim = !!H().claim(e, g); } catch (err) { console.warn('buildtool claim', err); }
    g.consumed = claim;
    if (claim) setControls(true);
    e._btRet = claim;
    return claim;
  }
  function onMove(e) {
    if (e._btMove) return;
    e._btMove = true;
    if (!on || !H()) return;
    try {
      if (g && e.pointerId === g.id) {
        if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > TAP_PX) g.moved = true;
        if (g.consumed && (g.moved || e.pointerType !== 'mouse')) { H().drag(e, g); return; }
        if (g.consumed) return;
        return;
      }
      if (!g && e.pointerType === 'mouse') H().hover(e);
    } catch (err) { console.warn('buildtool move', err); }
  }
  function onUp(e) {
    if (e._btUp) return;
    e._btUp = true;
    pointers.delete(e.pointerId);
    if (!g || e.pointerId !== g.id) { if (!pointers.size) setControls(false); return; }
    const gs = g;
    g = null;
    if (gs.consumed) setControls(false);
    else if (!pointers.size) setControls(false);
    if (!on || !H()) return;
    try {
      const tap = !gs.moved && performance.now() - gs.t0 < TAP_MS;
      if (gs.consumed) {
        if (tap) H().tap(e, gs); else H().dragEnd(e, gs);
      } else if (tap) {
        // Unclaimed gestures that never moved are taps (a pan would have moved).
        H().tap(e, gs);
      }
    } catch (err) { console.warn('buildtool up', err); }
    if (active === 'delete' || active === 'paint' || active === 'move') clearHoverLater();
  }
  function clearHoverLater() { S.hover = null; }
  function onCancel(e) {
    pointers.delete(e.pointerId);
    abortGesture();
    if (!pointers.size) setControls(false);
  }
  function abortGesture() {
    if (!g) return;
    g = null;
    try { H()?.abort(); } catch { /* ignore */ }
    S.drag = null;
    setControls(false);
  }
  function onKey(e) {
    if (!on) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (active === 'pieces') { pzKey(e); return; }
    if (e.key === 'Escape') {
      if (hasPending()) { e.preventDefault(); cancel(); } else if (sel) { select(null); }
    } else if (e.key === 'Enter') {
      if (chainOf().start && (active === 'wall' || active === 'fence')) { e.preventDefault(); chainFinish(); }
    }
  }
  const hasPending = () => !!((active === 'wall' && S.wall.start) || (active === 'fence' && S.fence.start) || (active === 'slab' && S.slab.c1));

  const tool = {
    pointerdown: (e) => onDown(e),
    pointermove: (e) => onMove(e),
    pointerup: (e) => onUp(e),
    pointercancel: (e) => onCancel(e),
    cancel: () => abortGesture(),
    keydown: (e) => onKey(e),
    dispose: () => {},
  };

  const LISTEN = [['pointerdown', onDown, true], ['pointermove', onMove, true], ['pointerup', onUp, true], ['pointercancel', onCancel, true]];
  let listening = false;
  function listen(yes) {
    if (!canvas) return;
    if (yes && !listening) { for (const [ev, fn, cap] of LISTEN) canvas.addEventListener(ev, fn, cap); window.addEventListener('keydown', onKey, true); listening = true; }
    if (!yes && listening) { for (const [ev, fn, cap] of LISTEN) canvas.removeEventListener(ev, fn, cap); window.removeEventListener('keydown', onKey, true); listening = false; }
  }

  // ---------- public ----------
  function ready() { return !!(ctx ?? getCtx()); }
  function enable() {
    if (on) return true;
    ctx = getCtx();
    if (!ctx?.camera || !ctx.canvas) return false;
    canvas = ctx.canvas;
    on = true;
    ensureMats();
    ctx.scene?.add(gGroup, lotGroup);
    ensureOverlay();
    listen(true);
    const c = ctx.controls;
    if (c) {
      saved = { one: c.touches?.ONE, left: c.mouseButtons?.LEFT };
      if (c.touches) c.touches.ONE = TOUCH.PAN;
      if (c.mouseButtons) c.mouseButtons.LEFT = MOUSE.PAN;
    }
    try { engine.setTool?.(tool); } catch { /* ignore */ }
    if (!raf) raf = requestAnimationFrame(frame);
    return true;
  }
  function disable() {
    if (!on) return;
    on = false;
    listen(false);
    abortGesture();
    pointers.clear();
    setControls(false);
    const c = ctx?.controls;
    if (c && saved) {
      if (c.touches && saved.one != null) c.touches.ONE = saved.one;
      if (c.mouseButtons && saved.left != null) c.mouseButtons.LEFT = saved.left;
    }
    saved = null;
    try { engine.setTool?.(null); } catch { /* ignore */ }
    clearLabels();
    clearGhosts();
    snapMark = null;
    handleSpots = [];
    if (overlay) { overlay.snap.hidden = true; for (const el of overlay.hs) el.hidden = true; }
    if (canvas) canvas.style.cursor = '';
    ctx?.scene?.remove(gGroup, lotGroup);
    cancelAnimationFrame(raf);
    raf = 0;
    try { engine.highlightBuild?.(null); } catch { /* ignore */ }
  }
  function activate(id) {
    if (!id || !HANDLERS[id]) { deactivate(); return false; }
    if (!enable()) return false;
    if (active && active !== id) { H()?.reset(); }
    const fitNow = (id === 'fence' || id === 'gate') && active !== 'fence' && active !== 'gate';
    active = id;
    if (fitNow) { fitLot(); clearTimeout(fitTimer); fitTimer = setTimeout(() => { if ((active === 'fence' || active === 'gate') && performance.now() - lastPointerAt > 900) fitLot(); }, 1300); }
    S.drag = null;
    S.hover = null;
    snapMark = null;
    clearLabels();
    clearGhosts();
    if (id !== 'move') { if (sel) select(null); }
    handlesDirty = true;
    refreshHandles();
    emit();
    return true;
  }
  function deactivate() {
    if (active) H()?.reset();
    active = null;
    sel = null;
    disable();
    emit();
  }
  function cancel() {
    if (!active) return;
    H()?.reset();
    snapMark = null;
    emit();
  }
  function finish() {
    if (active === 'wall' || active === 'fence') chainFinish();
    else cancel();
  }
  function setLevel(l) {
    if (l === level) return;
    level = l;
    for (const k of ['wall', 'fence']) Object.assign(S[k], { start: null, first: null, cur: null, n: 0, prevDir: null });
    S.slab.c1 = null;
    clearLabels();
    clearGhosts();
    if (sel) select(null);
    if (PZ.mode === 'armed') pzFit(PZ.pt ?? pzStart(PZ.piece));
    else if (PZ.sel) pzSelect(null);
    handlesDirty = true;
    emit();
  }
  // The store changed (undo, a sheet edit...): refresh handles and drop selections that vanished.
  function sync() {
    if (!on) return;
    if (PZ.sel && !boundsOfIds(PZ.sel.ids)) pzSelect(null);
    if (PZ.mode === 'armed' && PZ.pt) pzFit(PZ.pt, true);
    if (sel) {
      const exists = sel.kind === 'wall' ? walls().some((w) => w.id === sel.id)
        : sel.kind === 'opening' ? walls().some((w) => (w.openings ?? []).some((o) => o.id === sel.id))
          : sel.kind === 'slab' ? slabs().some((s) => s.id === sel.id)
            : sel.kind === 'stairs' ? stairsOf().some((s) => s.id === sel.id)
              : fences().some((f) => f.id === sel.id);
      if (!exists) { select(null); return; }
    }
    handlesDirty = true;
    refreshHandles();
    placeGroups();
  }

  // Cerca: frame the whole lot (tilted ~60 deg, same heading) so every corner can be tapped.
  function fitLot() {
    const c = ctx?.controls, cam = ctx?.camera;
    if (!c || !cam) return;
    const l = lotOf();
    const r = crect();
    const aspect = Math.max(0.3, r.width / Math.max(1, r.height));
    const th = Math.tan((cam.fov * Math.PI) / 360);
    const el = (62 * Math.PI) / 180;
    // Free area: below the floating top controls (bar + level pills) and above the instruction bar.
    const phoneW = r.width < 1000;
    const topIn = phoneW ? 132 : 100;
    const botIn = 92;
    const free = Math.max(0.35, (r.height - topIn - botIn) / Math.max(1, r.height));
    const d = Math.max((l.depth / 2 + 1) / (th * Math.sin(el) * 0.9 * free), (l.width / 2 + 1) / (th * aspect)) * 1.05;
    // Shift so the lot is centred in the free area (front edge at the bottom: camera straight in front).
    const worldPerPx = (2 * d * th) / Math.max(1, r.height);
    const target = new Vector3(0, 0, -(((topIn - botIn) / 2) * worldPerPx) / Math.sin(el));
    const az = 0;
    const dir = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    c.target.copy(target);
    cam.position.copy(target).addScaledVector(dir, Math.min(d, c.maxDistance || 140));
    c.update();
    render();
  }

  // Camera helpers for the UI buttons.
  let camAnim = 0;
  function rotate(deg) {
    const c = ctx?.controls ?? getCtx()?.controls, cam = (ctx ?? getCtx())?.camera;
    if (!c || !cam) return;
    const target = c.target.clone();
    const startOff = cam.position.clone().sub(target);
    const a = (deg * Math.PI) / 180;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now(), dur = reduce ? 1 : 260;
    cancelAnimationFrame(camAnim);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) ** 3;
      const o = startOff.clone().applyAxisAngle(new Vector3(0, 1, 0), a * e);
      cam.position.copy(target).add(o);
      c.update();
      (ctx ?? getCtx())?.requestRender?.();
      if (k < 1) camAnim = requestAnimationFrame(step);
    };
    camAnim = requestAnimationFrame(step);
  }
  function zoom(f) {
    if (engine.zoomPlan) { engine.zoomPlan(f); return; }
    const c = ctx?.controls, cam = ctx?.camera;
    if (!c || !cam) return;
    const o = cam.position.clone().sub(c.target);
    o.setLength(Math.max(c.minDistance || 1, Math.min(c.maxDistance || 200, o.length() / f)));
    cam.position.copy(c.target).add(o);
    c.update();
    render();
  }

  return {
    ready, activate, deactivate, cancel, finish, setLevel, select, sync, rotate, zoom, tool, pieces,
    active: () => active,
    selection: () => sel,
    hasPending,
    defaults: { OPEN_DEF, GATE_W },
    dispose() { deactivate(); overlay?.remove(); overlay = null; gGroup.removeFromParent(); lotGroup.removeFromParent(); },
  };
}
