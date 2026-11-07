// v5 "Piezas" visuals: the see-through ghost that follows the finger, offscreen card thumbnails and the
// settle-in drop animation. Everything reuses the real build geometry (buildgeo / buildfence / props)
// and its own long-lived material set, so nothing here is rebuilt while dragging.
import {
  Group, Color, Mesh, CircleGeometry, RingGeometry, MeshBasicMaterial, LineSegments, EdgesGeometry, LineBasicMaterial,
  Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Box3, Vector3, Vector4, Plane,
} from 'three';
import { createMaterialSet } from './materials.js';
import { buildBuildHouse } from './buildgeo.js';
import { buildFences } from './buildfence.js';
import { buildItem } from './props.js';
import { createBuilder, mat4 } from './builder.js';
import { kit, furnitureSlots, bed, nightstand, rug, sofa, coffeeTable, tvUnit, diningTable, chair, desk, officeChair, bookshelf, plant } from './indoor.js';
import { FLOOR_T } from './layout.js';
import { pieceById, pieceBuild } from './pieces.js';
import { emptyLevel, FENCE_DEFAULT_H } from './buildmodel.js';

// REVAMP tray spec: valid = teal accent, blocked = --bad; snap markers teal. setAccent() swaps the teal for the dark theme.
const OK = new Color('#0B6E7F');
const BAD = new Color('#B3261E');
const TW = 160, TH = 120;

export function createPieceFx({ renderer, world, store, invalidate, P, getEnv, reduced }) {
  const mats = createMaterialSet();   // lives as long as the engine (ghosts, thumbs, drop animation)
  const root = new Group();
  root.name = 'pieceGhost';
  root.visible = false;
  root.renderOrder = 5;
  world.add(root);

  // ---- see-through materials ----
  const seeThrough = new Map();
  let tintOk = null;
  const ghostMat = (m) => {
    let g = seeThrough.get(m);
    if (!g) {
      g = m.clone();
      g.transparent = true;
      g.opacity = Math.min(m.opacity ?? 1, 0.55);
      g.depthWrite = false;
      g.userData.ghost = true;
      if (g.color) g.userData.base = g.color.clone();
      seeThrough.set(m, g);
    }
    return g;
  };
  const lineOk = new LineBasicMaterial({ color: OK, transparent: true, opacity: 0.9, depthTest: false });
  const lineBad = new LineBasicMaterial({ color: BAD, transparent: true, opacity: 0.9, depthTest: false });
  function setTint(ok) {
    if (tintOk === ok) return;
    tintOk = ok;
    for (const g of seeThrough.values()) {
      if (g.emissive) { g.emissive.copy(ok ? OK : BAD); g.emissiveIntensity = 0.35; }
      // A light colour tint so the piece reads teal / red, not just see-through.
      if (g.color && g.userData.base) g.color.copy(g.userData.base).lerp(ok ? OK : BAD, 0.35);
    }
  }
  function setAccent(hex) {
    OK.set(hex);
    lineOk.color.copy(OK);
    markMat.color.copy(OK);
    const t = tintOk;
    tintOk = null;
    if (t != null) setTint(t);
    invalidate();
  }

  // Strip what a single piece should not show (roof over one room, labels) and make it see-through.
  function finish(group, { ghost = true, keepRoof = false } = {}) {
    const out = new Group();
    for (const c of [...group.children]) {
      if (c.name === 'labels' || (!keepRoof && c.name === 'roof')) { dispose(c); continue; }
      out.add(c);
    }
    if (ghost) {
      const edges = [];
      out.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = false;
        o.receiveShadow = false;
        o.raycast = () => {};
        o.material = ghostMat(o.material);
        o.renderOrder = 5;
        if (o.geometry.attributes.position.count < 60000) edges.push(o);
      });
      for (const o of edges) {
        const ls = new LineSegments(new EdgesGeometry(o.geometry, 35), lineOk);
        ls.matrix.copy(o.matrix);
        ls.position.copy(o.position); ls.rotation.copy(o.rotation); ls.scale.copy(o.scale);
        ls.renderOrder = 6;
        ls.raycast = () => {};
        ls.userData.edge = true;
        o.parent.add(ls);
      }
    }
    return out;
  }
  function dispose(g) {
    g?.traverse((o) => { if (o.geometry && !o.isSprite) o.geometry.dispose(); if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } });
    g?.removeFromParent();
  }

  // Real geometry of one piece at the origin (rot 0). `ghost` = see-through + outline.
  function pieceObject(pc, { level = 0, wallT = 0.15, fenceType = 'block', fenceH = null, ghost = true, sample = false, len: fLen = null, gates = null, furnish = false } = {}) {
    const s = store.get();
    const FH = s.build?.floorHeight ?? s.house.floorHeight ?? 3;
    // Stairs live in the interior layer; porch / carport roofs in the roof layer.
    const mini = (b, opts) => finish(buildBuildHouse({ ...s, mode: 'build', build: b }, mats, 'es', { interiors: pc.kind === 'stairs' || furnish, interiorLevels: null }).group, { ghost, keepRoof: pc.kind === 'porch' || pc.kind === 'carport', ...opts });
    if (pc.kind === 'yard') {
      const g = buildItem({ id: `ghost${pc.item}`, type: pc.item, x: 0, z: 0, rot: 0 }, mats);
      const out = new Group();
      if (g) out.add(g);
      if (ghost) out.traverse((o) => { if (o.isMesh) { o.material = ghostMat(o.material); o.castShadow = false; o.raycast = () => {}; } });
      return out;
    }
    if (pc.kind === 'fence' || pc.kind === 'gate' || pc.kind === 'frontFence') {
      const B = createBuilder();
      const type = pc.kind === 'gate' ? fenceType : pc.type;
      const front = pc.kind === 'frontFence';
      const len = front ? fLen ?? 9 : pc.kind === 'fence' ? pc.len : pc.w + 0.8;
      const f = { id: 'ghost', x0: -len / 2, z0: 0, x1: len / 2, z1: 0, type, h: fenceH ?? FENCE_DEFAULT_H[type], color: '#f7f5ef' };
      if (pc.kind === 'gate') f.gates = [{ at: len / 2, w: pc.w, kind: pc.gate }];
      if (front) f.gates = gates ?? [{ at: 1.5, w: 1.0, kind: 'peatonal' }, { at: 5.6, w: 3.2, kind: 'vehicular' }];
      buildFences(B, mats, [f]);
      const g = new Group();
      g.add(B.build());
      return finish(g, { ghost });
    }
    if (pc.kind === 'roof' || pc.kind === 'extra') {
      // On the real house (ghost) or on a small sample room (thumbnail).
      if (!sample && s.mode === 'build' && s.build) {
        const b = { ...s.build, roof: { ...s.build.roof, ...(pc.roof ?? (pc.flat ? { type: 'flat' } : {})) }, extras: { ...s.build.extras, ...(pc.extras ?? {}) } };
        const g = buildBuildHouse({ ...s, build: b }, mats, 'es', { interiors: false }).group;
        const out = new Group();
        for (const c of [...g.children]) { if (c.name === 'roof') out.add(c); else dispose(c); }
        return finish(out, { ghost, keepRoof: true });
      }
      const b = pieceBuild('dormitorio', { floorHeight: FH, floor: s.interior?.floor });
      b.roof = { ...b.roof, parapet: true, ...(pc.roof ?? { type: 'flat' }) };
      b.extras = { ...b.extras, ...(pc.extras ?? {}) };
      return mini(b, { keepRoof: true });
    }
    const b = pieceBuild(pc.id, { level, floorHeight: FH, wallT, floor: s.interior?.floor });
    if (!b) return new Group();
    if (pc.kind === 'opening' && !ghost) b.levels[level].walls.forEach((w) => { w.t = 0.15; });
    return mini(b);
  }

  // Card furniture: build-mode rooms carry no fixed furniture, so the thumbnail dresses the room by its type.
  // Origin = room centre; w x d = wall centre lines; the back wall is -z.
  function furnishThumb(group, type, w, d, interior) {
    const B = createBuilder();
    const FS = furnitureSlots(mats, interior);
    const y = P + FLOOR_T, iw = w - 0.15, id = d - 0.15;
    const K = kit(B, FS, mat4(0, y, -id / 2), 'k:');   // faces +z from the back wall
    switch (type) {
      case 'dormitorio': case 'principal': {
        const bw = type === 'principal' ? 1.6 : Math.min(1.35, iw - 1.1);
        bed(K.at(0, 0, 0.08 + 1.0), bw, 2.0, { panels: bw > 1.2 ? 3 : 2 });
        if (iw - bw > 1.2) for (const sx of [-1, 1]) nightstand(K.at(sx * (bw / 2 + 0.36), 0, 0.2));
        rug(K.at(0, 0, 1.5), Math.min(iw - 0.4, bw + 1.0), 1.5);
        break;
      }
      case 'sala':
        sofa(K.at(0, 0, 0.5), Math.min(2.3, iw - 1.2));
        coffeeTable(K.at(0, 0, 1.55), 1.0, 0.6);
        rug(K.at(0, 0, 1.5), Math.min(2.8, iw - 0.6), Math.min(2.0, id - 0.8));
        tvUnit(K.at(0, 0, id - 0.3, Math.PI), Math.min(1.8, iw - 1.4));
        plant(K.at(-iw / 2 + 0.35, 0, 0.35), 1.1, 5);
        break;
      case 'comedor': {
        const T = K.at(0, 0, id / 2);
        diningTable(T, Math.min(1.6, iw - 1.4), 0.9);
        for (const sx of [-0.4, 0.4]) { chair(T.at(sx, 0, -0.75)); chair(T.at(sx, 0, 0.75, Math.PI)); }
        break;
      }
      case 'estudio':
        desk(K.at(0, 0, 0.35), 1.2);
        officeChair(K.at(0, 0, 0.95, Math.PI));
        bookshelf(K.at(iw / 2 - 0.2, 0, id / 2, -Math.PI / 2), 0.9);
        break;
      case 'cocina': {
        K.rbox('wood', iw - 0.1, 0.86, 0.6, 0.01, 0, 0.43, 0.3);
        K.rbox('porcelain', iw - 0.08, 0.04, 0.62, 0.008, 0, 0.88, 0.31);
        K.box('steel', 0.55, 0.02, 0.4, -0.4, 0.9, 0.3);
        K.box('black', 0.6, 0.02, 0.5, 0.6, 0.9, 0.3);
        K.rbox('steel', 0.72, 1.82, 0.68, 0.02, -iw / 2 + 0.4, 0.91, id - 0.4);
        K.rbox('wood', 1.0, 0.04, 0.7, 0.01, 0.3, 0.76, id / 2 + 0.4);
        for (const sx of [-0.4, 0.4]) K.box('wood', 0.04, 0.74, 0.04, 0.3 + sx, 0.37, id / 2 + 0.4);
        break;
      }
      case 'bano': {
        // toilet, vanity with basin, shower tray with a glass screen
        K.rbox('porcelain', 0.42, 0.42, 0.55, 0.06, -iw / 2 + 0.4, 0.21, 0.42);
        K.rbox('porcelain', 0.4, 0.38, 0.18, 0.03, -iw / 2 + 0.4, 0.62, 0.1);
        K.rbox('wood', 0.7, 0.8, 0.45, 0.01, iw / 2 - 0.45, 0.4, 0.25);
        K.rbox('porcelain', 0.5, 0.06, 0.36, 0.03, iw / 2 - 0.45, 0.83, 0.25);
        K.box('steel', 0.03, 0.2, 0.03, iw / 2 - 0.45, 0.95, 0.08);
        K.rbox('porcelain', iw - 0.1, 0.05, 0.85, 0.01, 0, 0.025, id - 0.45);
        K.box('steel', iw - 0.1, 1.9, 0.01, 0, 1.0, id - 0.88);
        break;
      }
      case 'lavado':
        K.rbox('porcelain', 0.6, 0.86, 0.6, 0.03, -0.35, 0.43, 0.32);
        K.cyl('black', 0.2, 0.2, 0.02, -0.35, 0.5, 0.63, 20, Math.PI / 2);
        K.rbox('porcelain', 0.6, 0.86, 0.6, 0.03, 0.35, 0.43, 0.32);
        break;
      default: break;
    }
    const g = B.build();
    g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    group.add(g);
  }

  // ---- ghost ----
  const cache = new Map();   // key -> Group (child of root)
  let roofKey = null;
  const markers = [];
  const markGeo = new RingGeometry(0.09, 0.16, 20);
  const markDot = new CircleGeometry(0.05, 12);
  const markMat = new MeshBasicMaterial({ color: OK.clone(), depthTest: false, transparent: true });
  function marker(i) {
    if (!markers[i]) {
      const m = new Group();
      for (const geo of [markGeo, markDot]) { const ms = new Mesh(geo, markMat); ms.rotation.x = -Math.PI / 2; ms.renderOrder = 7; ms.raycast = () => {}; m.add(ms); }
      root.add(m);
      markers[i] = m;
    }
    return markers[i];
  }

  function pieceGhost(pieceId, pl) {
    const pc = pieceById(pieceId);
    if (!pc || !pl) {
      if (root.visible) { root.visible = false; invalidate(); }
      return;
    }
    const s = store.get();
    const level = Math.max(0, pl.level | 0);
    let key = `${pc.id}|${pc.kind === 'opening' || pc.kind === 'stairs' || pc.kind === 'room' || pc.kind === 'wall' || pc.kind === 'column' || pc.kind === 'slab' || pc.kind === 'porch' || pc.kind === 'carport' || pc.kind === 'balcony' ? level : 0}`;
    if (pc.kind === 'opening') key += `|${pl.t ?? 0.15}`;
    if (pc.kind === 'gate') key += `|${pl.fenceType}|${pl.h}`;
    if (pc.kind === 'frontFence') key += `|${pl.w}|${JSON.stringify(pl.gates ?? [])}`;
    if (pc.kind === 'roof' || pc.kind === 'extra') {
      key += '|roof';
      // The roof ghost depends on the house: rebuild it only when the build changed.
      if (roofKey !== s.build) { for (const [k, g] of cache) if (k.endsWith('|roof')) { dispose(g); cache.delete(k); } roofKey = s.build; }
    }
    let g = cache.get(key);
    if (!g) {
      g = pieceObject(pc, { level, wallT: pl.t ?? 0.15, fenceType: pl.fenceType, fenceH: pl.h, len: pl.w, gates: pl.gates });
      cache.set(key, g);
      root.add(g);
      if (cache.size > 16) { const [k0, g0] = cache.entries().next().value; if (g0 !== g) { dispose(g0); cache.delete(k0); } }
    }
    for (const c of cache.values()) c.visible = c === g;
    setTint(!!pl.ok);
    g.traverse((o) => { if (o.userData.edge) o.material = pl.ok ? lineOk : lineBad; });
    const lot = pl.frame === 'lot';
    root.position.set(lot ? 0 : s.house.offsetX, 0, lot ? 0 : s.house.offsetZ);
    if (pc.kind === 'roof' || pc.kind === 'extra') { g.position.set(0, 0, 0); g.rotation.y = 0; }
    else {
      g.position.set(pl.x, 0, pl.z);
      g.rotation.y = pc.kind === 'opening' || pc.kind === 'gate' ? -(pl.ang ?? 0) : ((pl.rot ?? 0) * Math.PI) / 180;
    }
    const FH = s.build?.floorHeight ?? s.house.floorHeight ?? 3;
    const y = lot ? 0.05 : P + level * FH + 0.06;
    const snaps = pl.snaps ?? [];
    for (let i = 0; i < Math.max(snaps.length, markers.length); i++) {
      if (i >= snaps.length) { markers[i].visible = false; continue; }
      const m = marker(i);
      m.visible = true;
      m.position.set(snaps[i].x, y, snaps[i].z);
    }
    root.visible = true;
    invalidate();
  }

  // ---- thumbnails: rendered into a corner of the main canvas right before the main frame draws over it ----
  const thumbs = new Map();   // id -> { promise, resolve, url }
  const queue = [];
  const tScene = new Scene();
  const BG = new Color('#eef1f4'), BG_LOT = new Color('#cddbc2');
  tScene.background = BG;
  tScene.add(new HemisphereLight('#ffffff', '#b9b2a6', 1.15));
  const sun = new DirectionalLight('#fff4e0', 2.9);
  sun.position.set(6, 10, 7);
  tScene.add(sun);
  const tCam = new PerspectiveCamera(30, TW / TH, 0.05, 200);
  const cvs = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (cvs) { cvs.width = TW; cvs.height = TH; }
  const vp = new Vector4(), sc = new Vector4(), cc = new Color(), cutPlane = new Plane();
  const ssKey = (id) => `casa3d.thumb.v4.${id}.${store.get().house.colors?.walls ?? ''}`;

  function pieceThumb(id) {
    const pc = pieceById(id);
    if (!pc) return Promise.reject(new Error('unknown piece'));
    const k = ssKey(id);
    const t = thumbs.get(k);
    if (t) return t.promise;
    let hit = null;
    try { hit = sessionStorage.getItem(k); } catch { /* storage blocked */ }
    if (hit) { const p = Promise.resolve(hit); thumbs.set(k, { promise: p, url: hit }); return p; }
    const job = { id, k };
    job.promise = new Promise((res, rej) => { job.resolve = res; job.reject = rej; });
    thumbs.set(k, job);
    queue.push(job);
    invalidate();
    return job.promise;
  }

  function renderThumb(job) {
    const pc = pieceById(job.id);
    // Rooms: furnished and cut open at 1.2 m, seen from above, so a Baño reads as a bathroom.
    const room = pc.kind === 'room';
    const obj = pieceObject(pc, { ghost: false, sample: true });
    if (room) furnishThumb(obj, pc.room, pc.w, pc.d, store.get().interior);
    tScene.add(obj);
    tScene.environment = getEnv?.() ?? null;
    // Lot pieces (fences, gates, yard) sit on a soft grass tone so white walls still read.
    tScene.background = ['fence', 'gate', 'frontFence', 'yard'].includes(pc.kind) ? BG_LOT : BG;
    const cutY = P + 1.2;
    const box = new Box3().setFromObject(obj);
    if (box.isEmpty()) box.set(new Vector3(-1, 0, -1), new Vector3(1, 1, 1));
    if (room) box.max.y = Math.min(box.max.y, cutY);
    const c = box.getCenter(new Vector3()), sz = box.getSize(new Vector3());
    const r = Math.max(0.3, sz.length() / 2);
    const dir = (room ? new Vector3(0.55, 1.25, 0.9) : new Vector3(0.75, 0.72, 1)).normalize();
    // Fit the projected box (not the bounding sphere), so thin pieces (a 1 m wall, a column) fill the card.
    const corners = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new Vector3(x, y, z));
    let dist = r / Math.sin((tCam.fov * Math.PI) / 360);
    for (let it = 0; it < 4; it++) {
      tCam.position.copy(c).addScaledVector(dir, dist);
      tCam.lookAt(c);
      tCam.near = Math.max(0.02, dist - r * 3);
      tCam.far = dist + r * 3;
      tCam.updateProjectionMatrix();
      tCam.updateMatrixWorld();
      let m = 0;
      for (const p of corners) { const q = p.clone().project(tCam); m = Math.max(m, Math.abs(q.x), Math.abs(q.y)); }
      if (!(m > 0)) break;
      dist *= m / 0.86;
    }
    tCam.position.copy(c).addScaledVector(dir, dist);
    tCam.lookAt(c);
    tCam.near = Math.max(0.02, dist - r * 3);
    tCam.far = dist + r * 3;
    tCam.updateProjectionMatrix();
    const clipBefore = renderer.clippingPlanes;
    if (room) renderer.clippingPlanes = [cutPlane.set(new Vector3(0, -1, 0), cutY)];
    const pr = renderer.getPixelRatio();
    renderer.getViewport(vp);
    renderer.getScissor(sc);
    const scTest = renderer.getScissorTest();
    renderer.getClearColor(cc);
    const ca = renderer.getClearAlpha();
    const target = renderer.getRenderTarget();
    const shadows = renderer.shadowMap.enabled;
    renderer.shadowMap.enabled = false;
    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, TW / pr, TH / pr);
    renderer.setScissor(0, 0, TW / pr, TH / pr);
    renderer.setScissorTest(true);
    renderer.render(tScene, tCam);
    const el = renderer.domElement;
    let url = null;
    try {
      const g2 = cvs.getContext('2d');
      g2.clearRect(0, 0, TW, TH);
      g2.drawImage(el, 0, el.height - TH, TW, TH, 0, 0, TW, TH);
      url = cvs.toDataURL('image/png');
    } catch (e) { job.reject(e); }
    renderer.shadowMap.enabled = shadows;
    renderer.clippingPlanes = clipBefore;
    renderer.setViewport(vp);
    renderer.setScissor(sc);
    renderer.setScissorTest(scTest);
    renderer.setClearColor(cc, ca);
    renderer.setRenderTarget(target);
    dispose(obj);
    if (url) {
      job.url = url;
      try { sessionStorage.setItem(job.k, url); } catch { /* full */ }
      job.resolve(url);
    }
  }
  // Called by the render loop before the main frame; true when the canvas must be redrawn.
  function runThumbs(n = 2) {
    if (!queue.length || !cvs) return false;
    const el = renderer.domElement;
    if (el.width < TW || el.height < TH) return false;
    for (let i = 0; i < n && queue.length; i++) {
      const job = queue.shift();
      try { renderThumb(job); } catch (e) { console.warn('piece thumb', e); job.reject(e); thumbs.delete(job.k); }
    }
    if (queue.length) invalidate();
    return true;
  }

  // ---- drop animation: the new elements are left out of the house and fall in as their own mesh ----
  let anim = null;
  function dropAnim(ids, { onHide, onDone }) {
    if (reduced || !Array.isArray(ids) || !ids.length) return false;
    const s = store.get();
    if (s.mode !== 'build' || !s.build) return false;
    const set = new Set(ids);
    const b = structuredClone(s.build);
    let any = false;
    b.levels = b.levels.map((L) => {
      const out = emptyLevel();
      out.walls = L.walls.filter((w) => set.has(w.id));
      out.slabs = L.slabs.filter((q) => set.has(q.id));
      out.stairs = L.stairs.filter((q) => set.has(q.id));
      out.columns = (L.columns ?? []).filter((q) => set.has(q.id));
      any ||= out.walls.length + out.slabs.length + out.stairs.length + out.columns.length > 0;
      return out;
    });
    if (!any) return false;
    b.extras = {};
    const g = finish(buildBuildHouse({ ...s, build: b }, mats, 'es', { interiors: false }).group, { ghost: false });
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.raycast = () => {}; } });
    if (anim) endAnim();
    g.position.set(s.house.offsetX, 0.4, s.house.offsetZ);
    world.add(g);
    anim = { g, t0: performance.now(), ms: 250, onDone };
    onHide(set);
    invalidate();
    return true;
  }
  function endAnim() {
    const a = anim;
    anim = null;
    dispose(a.g);
    a.onDone?.();
  }
  // Called every frame; true while animating.
  function stepAnim(now) {
    if (!anim) return false;
    const k = Math.min(1, (now - anim.t0) / anim.ms);
    const e = 1 - (1 - k) ** 3;
    anim.g.position.y = 0.4 * (1 - e);
    if (k >= 1) endAnim();
    return true;
  }

  return {
    pieceGhost, pieceThumb, runThumbs, dropAnim, stepAnim, setAccent,
    dispose() { for (const g of cache.values()) dispose(g); root.removeFromParent(); mats.dispose(); },
  };
}
