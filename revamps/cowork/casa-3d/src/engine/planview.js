// Plano view overlay: room labels with exact sizes, the selected-room outline,
// and (when plan editing is on) drag handles for partitions and the hall wall.
// Everything lives in the engine's overlay scene and keeps a constant on-screen
// size, so it stays readable and touchable at any zoom. Geometry changes go
// through the store; this file only draws and measures.
import { Group, Sprite, SpriteMaterial, Mesh, PlaneGeometry, MeshBasicMaterial, Vector3, MathUtils } from 'three';
import { P, T, roomName } from './layout.js';
import { makeTexture } from './textures.js';

// REVAMP "Plano": one signal colour, Caribe teal.
const ACCENT = '#0B6E7F', ACCENT_DARK = '#07505D';
const FONT = 'Archivo, "Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif';
const HIT = 26;       // css px from a handle's center: a 52 px touch box
const SNAP = 0.05;    // meters
const fmt = (v) => v.toFixed(2);

export function createPlanView({ overlay, camera, container, store, ctx }) {
  const group = new Group();
  group.name = 'planview';
  group.visible = false;
  overlay.add(group);

  const labels = new Map();   // room key -> { sp, room, w, d, shown, sel }
  const handles = [];         // { sp, kind, level, band, index, x, z, vertical }
  const preview = new Map();  // room key -> { w, d } while dragging
  let edit = false, unit = 0.02, drag = null, selKey = null;
  const tmp = new Vector3();
  const dpr = () => Math.min(3, Math.max(1, window.devicePixelRatio || 1));

  // ---- drawing helpers -----------------------------------------------------------------
  const measure = document.createElement('canvas').getContext('2d');
  const lineFont = (size, weight) => `${weight} ${size}px ${FONT}`;
  function layoutLines(lines) {
    let w = 0, h = 0;
    for (const [text, size, weight] of lines) {
      measure.font = lineFont(size, weight);
      w = Math.max(w, Math.ceil(measure.measureText(text).width));
      h += Math.round(size * 1.2);
    }
    return { w: w + 14, h: h + 8 };
  }
  function drawLines(lines, sel) {
    const { w, h } = layoutLines(lines), k = dpr();
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * k); c.height = Math.ceil(h * k);
    const g = c.getContext('2d');
    g.scale(k, k);
    g.fillStyle = sel ? ACCENT : 'rgba(255,255,255,0.93)';
    g.beginPath(); g.roundRect(0.5, 0.5, w - 1, h - 1, 9); g.fill();
    g.strokeStyle = sel ? 'rgba(255,255,255,0.7)' : 'rgba(28,27,25,0.18)'; g.lineWidth = 1; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let y = 4;
    for (const [text, size, weight, color] of lines) {
      const lh = Math.round(size * 1.2);
      g.font = lineFont(size, weight);
      g.fillStyle = sel ? '#ffffff' : color ?? '#1B1F1E';
      g.fillText(text, w / 2, y + lh / 2 + 0.5);
      y += lh;
    }
    return { canvas: c, w, h };
  }
  function setCanvas(sp, cv) {
    sp.material.map?.dispose();
    const t = makeTexture(cv.canvas);
    t.wrapS = t.wrapT = 1001;
    sp.material.map = t;
    sp.material.needsUpdate = true;
    sp.userData.px = [cv.w, cv.h];
  }
  const newSprite = (order) => {
    const sp = new Sprite(new SpriteMaterial({ depthTest: false, transparent: true }));
    sp.renderOrder = order;
    sp.userData.px = [10, 10];
    return sp;
  };
  function disposeSprite(sp) {
    sp.material.map?.dispose();
    sp.material.dispose();
    sp.removeFromParent();
  }

  // Handle art: a pill with arrows. Shared textures (one per orientation and state).
  const handleTex = new Map();
  function handleCanvas(vertical, active) {
    const key = `${vertical}:${active}`;
    if (!handleTex.has(key)) {
      const w = vertical ? 28 : 46, h = vertical ? 46 : 28, k = dpr();
      const c = document.createElement('canvas');
      c.width = Math.ceil(w * k); c.height = Math.ceil(h * k);
      const g = c.getContext('2d');
      g.scale(k, k);
      g.shadowColor = 'rgba(0,0,0,0.3)'; g.shadowBlur = 5; g.shadowOffsetY = 1.5;
      g.fillStyle = active ? ACCENT_DARK : ACCENT;
      g.beginPath(); g.roundRect(3, 3, w - 6, h - 6, Math.min(w, h) / 2 - 3); g.fill();
      g.shadowColor = 'transparent';
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#fff';
      // Arrow head: tip 6 px out along (dx,dy), 12 px wide at its base.
      const tri = (cx, cy, dx, dy) => {
        g.beginPath();
        g.moveTo(cx + dx * 6, cy + dy * 6);
        g.lineTo(cx - dx * 2 - dy * 6, cy - dy * 2 + dx * 6);
        g.lineTo(cx - dx * 2 + dy * 6, cy - dy * 2 - dx * 6);
        g.closePath(); g.fill();
      };
      if (vertical) { tri(w / 2, h / 2 - 9, 0, -1); tri(w / 2, h / 2 + 9, 0, 1); } else { tri(w / 2 - 12, h / 2, -1, 0); tri(w / 2 + 12, h / 2, 1, 0); }
      g.fillRect(vertical ? w / 2 - 6 : w / 2 - 1.2, vertical ? h / 2 - 1.2 : h / 2 - 6, vertical ? 12 : 2.4, vertical ? 2.4 : 12);
      handleTex.set(key, { canvas: c, w, h });
    }
    return handleTex.get(key);
  }

  // ---- ghost line, dimension readout, selected outline ---------------------------------------
  const flat = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mkMesh = (color, opacity, order) => {
    const m = new Mesh(flat, new MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false }));
    m.renderOrder = order;
    m.visible = false;
    m.raycast = () => {};
    group.add(m);
    return m;
  };
  const ghost = mkMesh(ACCENT, 0.9, 12);
  const edges = [0, 1, 2, 3].map(() => mkMesh(ACCENT, 1, 11));
  const dimSp = newSprite(14);
  dimSp.visible = false;
  group.add(dimSp);

  // ---- level data --------------------------------------------------------------------------------
  const levelRooms = () => {
    const lvl = ctx.level();
    return lvl == null ? [] : ctx.rooms().filter((r) => r.level === lvl);
  };
  const bandRooms = (band) => levelRooms().filter((r) => r.band === band).sort((a, b) => a.x0 - b.x0);
  const floorY = () => {
    const { house: h } = store.get();
    return P + (ctx.level() ?? 0) * h.floorHeight + 1.6;
  };

  function clear() {
    for (const e of labels.values()) disposeSprite(e.sp);
    labels.clear();
    for (const hd of handles) disposeSprite(hd.sp);
    handles.length = 0;
  }

  // Rebuild sprites for the current level / rooms. Cheap enough to call after every house rebuild.
  function sync() {
    clear();
    const lvl = ctx.level();
    group.visible = ctx.view() === 'top' && lvl != null;
    if (!group.visible) { hideTransient(); return; }
    const { house: h } = store.get();
    group.position.set(h.offsetX, 0, h.offsetZ);
    const y = floorY();
    for (const r of levelRooms()) {
      if (r.hidden) continue;
      const sp = newSprite(12);
      sp.position.set((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2);
      group.add(sp);
      labels.set(r.key, { sp, room: r, w: r.x1 - r.x0, d: r.z1 - r.z0, shown: '', sel: false });
    }
    if (edit) {
      const add = (kind, band, index, x, z, vertical) => {
        const sp = newSprite(13);
        sp.position.set(x, y, z);
        group.add(sp);
        handles.push({ sp, kind, level: lvl, band, index, x, z, vertical, active: false });
      };
      for (const band of ['front', 'back']) {
        const list = bandRooms(band);
        // Handle sits near the hall side so it never covers the room's label.
        for (let i = 1; i < list.length; i++) add('wall', band, i, list[i].x0, band === 'back' ? list[i].z1 - 0.6 : list[i].z0 + 0.6, false);
      }
      const front = bandRooms('front');
      if (front.length) {
        const wide = front.reduce((a, b) => (b.x1 - b.x0 > a.x1 - a.x0 ? b : a));
        add('hall', 'front', 0, (wide.x0 + wide.x1) / 2, wide.z0, true);
      }
      if (drag) for (const hd of handles) hd.active = sameHandle(hd, drag);
    }
    refresh();
  }

  const sameHandle = (a, b) => a.kind === b.kind && a.level === b.level && a.band === b.band && a.index === b.index;

  function computeUnit() {
    const dist = Math.max(1, Math.abs(camera.position.y - floorY()));
    return (2 * dist * Math.tan(MathUtils.degToRad(camera.fov / 2))) / Math.max(1, container.clientHeight);
  }

  // Pick the richest label that fits the room on screen.
  function variantFor(e, name, short) {
    const w = e.w, d = e.d;
    const size = `${fmt(w)} × ${fmt(d)} m`, area = `${(w * d).toFixed(1)} m²`;
    const opts = [
      { id: 'full', lines: [[name, 15, 700], [size, 13, 600], [area, 12, 500, '#5d615f']] },
      { id: 'two', lines: [[name, 13, 700], [size, 12, 600]] },
      { id: 'name', lines: [[name, 12, 700]] },
      { id: 'short', lines: [[short, 11, 700]] },
    ];
    const availW = w / unit - 6, availH = d / unit - 6;
    const keyOf = (o) => o.id + o.lines.map((l) => l[0]).join('|');
    for (const [i, o] of opts.entries()) {
      const m = layoutLines(o.lines);
      if (m.w <= availW && m.h <= availH) return { ...o, key: keyOf(o), smaller: opts.slice(i + 1).map((q) => ({ ...q, key: keyOf(q) })) };
    }
    // Narrow room: still say what it is (short name, 11 px), even if it overflows a little.
    return { ...opts[3], key: keyOf(opts[3]), smaller: [] };
  }

  function refresh() {
    if (!group.visible) return;
    unit = computeUnit();
    const lang = ctx.lang();
    // Biggest rooms first; a label that would overlap one already placed drops to a smaller variant, else hides.
    const placed = [];
    const order = [...labels].sort((a, b) => (b[1].room.x1 - b[1].room.x0) * (b[1].room.z1 - b[1].room.z0) - (a[1].room.x1 - a[1].room.x0) * (a[1].room.z1 - a[1].room.z0));
    for (const [key, e] of order) {
      const pv = preview.get(key);
      if (pv) { e.w = pv.w; e.d = pv.d; } else { e.w = e.room.x1 - e.room.x0; e.d = e.room.z1 - e.room.z0; }
      const sel = key === selKey;
      const v = variantFor(e, e.room.label ?? roomName(e.room.type, lang), e.room.shortLabel ?? e.room.label ?? roomName(e.room.type, lang));
      if (!v) { e.sp.visible = false; e.shown = ''; continue; }
      const { x, z } = e.sp.position;
      const rectOf = (o) => { const m = layoutLines(o.lines); const hw = ((m.w + 4) * unit) / 2, hh = ((m.h + 4) * unit) / 2; return [x - hw, x + hw, z - hh, z + hh]; };
      const clash = (q) => placed.some((p) => q[0] < p[1] && q[1] > p[0] && q[2] < p[3] && q[3] > p[2]);
      let pick = null;
      for (const o of [v, ...v.smaller]) { const q = rectOf(o); if (!clash(q)) { pick = o; placed.push(q); break; } }
      // The selected room always keeps its tag.
      if (!pick && sel) { pick = v; placed.push(rectOf(v)); }
      if (!pick) { e.sp.visible = false; continue; }
      e.sp.visible = true;
      const tag = pick.key + (sel ? '*' : '');
      if (tag !== e.shown) { setCanvas(e.sp, drawLines(pick.lines, sel)); e.shown = tag; }
      e.sp.scale.set(e.sp.userData.px[0] * unit, e.sp.userData.px[1] * unit, 1);
    }
    for (const hd of handles) {
      const tag = `${hd.vertical}:${hd.active}`;
      if (hd.sp.userData.tag !== tag) { setCanvas(hd.sp, handleCanvas(hd.vertical, hd.active)); hd.sp.userData.tag = tag; }
      hd.sp.scale.set(hd.sp.userData.px[0] * unit, hd.sp.userData.px[1] * unit, 1);
    }
    updateOutline();
    if (dimSp.visible) dimSp.scale.set(dimSp.userData.px[0] * unit, dimSp.userData.px[1] * unit, 1);
    if (ghost.visible && drag) placeGhost(drag.value);
  }

  function updateOutline() {
    const r = selKey && levelRooms().find((x) => x.key === selKey && !x.hidden);
    for (const m of edges) m.visible = !!r && group.visible;
    if (!r || !group.visible) return;
    const t = 3.5 * unit, y = floorY() - 0.1;
    const w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const set = (m, sx, sz, x, z) => { m.scale.set(sx, 1, sz); m.position.set(x, y, z); };
    set(edges[0], w, t, cx, r.z0 + t / 2);
    set(edges[1], w, t, cx, r.z1 - t / 2);
    set(edges[2], t, d - 2 * t, r.x0 + t / 2, cz);
    set(edges[3], t, d - 2 * t, r.x1 - t / 2, cz);
  }

  function hideTransient() {
    ghost.visible = false;
    dimSp.visible = false;
    for (const m of edges) m.visible = false;
  }

  // ---- hit testing + dragging --------------------------------------------------------------------
  function hit(clientX, clientY) {
    if (!edit || !group.visible || !handles.length) return null;
    const r = container.getBoundingClientRect();
    let best = null, bd = Infinity;
    for (const hd of handles) {
      tmp.set(hd.x + group.position.x, floorY(), hd.z + group.position.z).project(camera);
      const sx = (tmp.x * 0.5 + 0.5) * r.width + r.left, sy = (-tmp.y * 0.5 + 0.5) * r.height + r.top;
      const dx = Math.abs(clientX - sx), dy = Math.abs(clientY - sy);
      if (dx <= HIT && dy <= HIT && dx + dy < bd) { bd = dx + dy; best = hd; }
    }
    return best;
  }

  function placeGhost(value) {
    const { house: h } = store.get();
    const y = floorY() - 0.2, t = 6 * unit;
    ghost.visible = true;
    if (drag.kind === 'wall') {
      const list = bandRooms(drag.band), a = list[drag.index];
      ghost.scale.set(t, 1, a.z1 - a.z0);
      ghost.position.set(value, y, (a.z0 + a.z1) / 2);
    } else {
      const zF = h.depth / 2 - T;
      ghost.scale.set(h.width - 2 * T, 1, t);
      ghost.position.set(0, y, zF - value);
    }
  }

  function begin(hd) {
    const { house: h } = store.get();
    if (hd.kind === 'wall') {
      const info = store.wallInfo(hd.level, hd.band, hd.index);
      if (!info) return null;
      const list = bandRooms(hd.band);
      drag = { ...hd, info, value: info.x, orig: info.x, left: list[hd.index - 1], right: list[hd.index] };
    } else {
      const range = store.frontRange(), plan = store.planInfo(hd.level);
      drag = { ...hd, range, hall: plan.hall.z1 - plan.hall.z0, value: plan.frontDepth, orig: plan.frontDepth };
    }
    for (const x of handles) x.active = sameHandle(x, drag);
    refresh();
    placeGhost(drag.value);
    readout();
    return { ...drag, depth: h.depth };
  }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // pt = pointer in house-local meters. Returns the snapped, clamped target (or null when not dragging).
  function move(pt) {
    if (!drag) return null;
    if (drag.kind === 'wall') {
      const { left0, lo, hi } = drag.info;
      drag.value = clamp(left0 + Math.round((pt.x - left0) / SNAP) * SNAP, lo, hi);
    } else {
      const { house: h } = store.get();
      const zF = h.depth / 2 - T;
      drag.value = clamp(Math.round((zF - pt.z) / SNAP) * SNAP, drag.range.lo, drag.range.hi);
    }
    readout();
    placeGhost(drag.value);
    refresh();
    return { kind: drag.kind, level: drag.level, band: drag.band, index: drag.index, value: drag.value };
  }

  // Dimension label + live sizes for the rooms touching the dragged wall.
  function readout() {
    preview.clear();
    let text;
    if (drag.kind === 'wall') {
      const wl = drag.value - drag.info.left0, wr = drag.info.right1 - drag.value;
      text = `${fmt(wl)} m  |  ${fmt(wr)} m`;
      const dl = drag.left.z1 - drag.left.z0, dr = drag.right.z1 - drag.right.z0;
      preview.set(drag.left.key, { w: wl, d: dl });
      preview.set(drag.right.key, { w: wr, d: dr });
      dimSp.position.set(drag.value, floorY(), (drag.left.z0 + drag.left.z1) / 2 - 38 * unit);
    } else {
      const { house: h } = store.get();
      const inner = h.depth - 2 * T, back = inner - drag.value - drag.hall;
      text = `${fmt(drag.value)} m  |  ${fmt(back)} m`;
      for (const r of bandRooms('front')) preview.set(r.key, { w: r.x1 - r.x0, d: drag.value });
      for (const r of bandRooms('back')) preview.set(r.key, { w: r.x1 - r.x0, d: back });
      dimSp.position.set(drag.x, floorY(), h.depth / 2 - T - drag.value - 34 * unit);
    }
    setCanvas(dimSp, drawLines([[text, 15, 700]], true));
    dimSp.visible = true;
    dimSp.scale.set(dimSp.userData.px[0] * unit, dimSp.userData.px[1] * unit, 1);
  }

  function end() {
    const d = drag;
    drag = null;
    preview.clear();
    ghost.visible = false;
    dimSp.visible = false;
    for (const x of handles) x.active = false;
    if (group.visible) refresh();
    return d && { kind: d.kind, level: d.level, band: d.band, index: d.index, value: d.value, orig: d.orig };
  }

  return {
    group,
    sync,
    refresh,
    hit,
    begin,
    move,
    end,
    isDragging: () => !!drag,
    setEdit(on) {
      edit = !!on;
      sync();
    },
    isEdit: () => edit,
    setSelected(key) {
      selKey = key;
      if (group.visible) { for (const e of labels.values()) e.shown = ''; refresh(); }
    },
    // Screen-constant size needs the camera distance: call when the camera moved.
    onCamera() {
      if (group.visible) refresh();
    },
    dispose() {
      clear();
      for (const m of [ghost, ...edges]) m.material.dispose();
      flat.dispose();
      disposeSprite(dimSp);
      group.removeFromParent();
    },
  };
}
