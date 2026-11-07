// Signature moment "La casa sale del plano" (REVAMP section 6): the lot outline draws in teal, wall footprints draw
// as ink lines, walls rise (staggered per floor), the roof drops in with a small settle, and the sun glides from
// 12:00 to 16:30 while the camera eases down from a high 3/4 view. ~3.5 s, skippable, reduced-motion aware.
import { Group, Mesh, PlaneGeometry, MeshBasicMaterial, MathUtils } from 'three';

export const REVEAL_TIME = 16.5 / 24;
const T = { lot: [0, 400], foot: [300, 600], walls: 600, wallMs: 700, stagger: 120, roof: [1300, 1800], sun: [1700, 3500] };
const KEEP_END = 2400;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeOut = (k) => 1 - (1 - k) ** 3;
// easeOutBack tuned so a 1.4 m drop overshoots ~12 cm before settling.
const C1 = 1.45, C3 = C1 + 1;
const settle = (k) => 1 + C3 * (k - 1) ** 3 + C1 * (k - 1) ** 2;

// ctx: { world, store, P, reduced, canvas, emit, invalidate, applyTime(t, opts), camHigh(), camRest(ms),
//        getHouse() -> { house, yard, items } , prepare() }
export function createReveal(ctx) {
  let run = null;
  const unit = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0);
  const tealMat = new MeshBasicMaterial({ color: 0x0b6e7f, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const inkMat = new MeshBasicMaterial({ color: 0x1b1f1e, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });

  // A flat ribbon from (ax, az) to (bx, bz) that grows from its start (scale.x = length * progress).
  function ribbon(group, mat, ax, az, bx, bz, y, w) {
    const m = new Mesh(unit, mat);
    const len = Math.hypot(bx - ax, bz - az);
    m.position.set(ax, y, az);
    m.rotation.y = Math.atan2(-(bz - az), bx - ax);
    m.scale.set(1e-4, 1, w);
    m.userData.len = len;
    m.renderOrder = 4;
    m.raycast = () => {};
    group.add(m);
    return m;
  }

  function start() {
    const { house, items } = ctx.getHouse();
    if (!house) return null;
    const s = ctx.store.get();
    const W = s.land.width, D = s.land.depth;
    const lines = new Group();
    lines.name = 'revealLines';
    ctx.world.add(lines);
    tealMat.opacity = 1; inkMat.opacity = 0.85;
    // Lot outline: one ribbon per side, drawn in perimeter order.
    const lot = [[-W / 2, D / 2, W / 2, D / 2], [W / 2, D / 2, W / 2, -D / 2], [W / 2, -D / 2, -W / 2, -D / 2], [-W / 2, -D / 2, -W / 2, D / 2]]
      .map(([ax, az, bx, bz]) => ribbon(lines, tealMat, ax, az, bx, bz, 0.02, 0.12));
    // Wall footprints (ground floor) as ink lines, in lot coordinates.
    const ox = s.house.offsetX, oz = s.house.offsetZ;
    const foot = (house.segments ?? []).filter((g) => (g.level ?? 0) === 0).slice(0, 160)
      .map((g) => ribbon(lines, inkMat, g.a[0] + ox, g.a[1] + oz, g.b[0] + ox, g.b[1] + oz, 0.02, 0.05));
    // What rises: floor layers (and their interiors / caps), yard props and items rise with the ground floor.
    const floors = [];
    for (const [name, g] of Object.entries(house.layers ?? {})) {
      if (name === 'roof') continue;
      const idx = +name.replace(/\D/g, '') || 0;
      floors.push({ g, idx, sy: g.scale.y });
    }
    // Yard items (trees, cars, furniture) rise with the ground floor; paths and fences stay put (flat props would z-fight).
    if (items) floors.push({ g: items, idx: 0, sy: items.scale.y });
    for (const f of floors) f.vis = f.g.visible;
    const roof = house.layers?.roof ?? null;
    const roofY = roof?.position.y ?? 0;
    const roofVis = roof?.visible ?? false;
    for (const f of floors) { f.g.scale.y = 0.05; f.g.visible = false; }
    if (roof) roof.visible = false;
    const r = {
      t0: performance.now(), house, lines, lot, foot, floors, roof, roofY, roofWasVisible: roofVis,
      phase: 'start', fired: new Set(['start']), lastEnv: 0, camRested: false, keepTime: false,
    };
    return r;
  }

  function restore(r) {
    for (const f of r.floors) { f.g.scale.y = f.sy; f.g.visible = f.vis; }
    if (r.roof) { r.roof.position.y = r.roofY; r.roof.visible = r.roofWasVisible; }
    r.lines.removeFromParent();
  }

  let resolveFn = null, promise = null;
  const onKey = () => skip();
  const onDown = () => skip();
  function listen(on) {
    const f = on ? 'addEventListener' : 'removeEventListener';
    ctx.canvas[f]('pointerdown', onDown, true);
    window[f]('keydown', onKey, true);
  }

  let keepTime = false;
  function finish(skipped) {
    const r = run;
    run = null;
    if (r) { restore(r); listen(false); }
    if (skipped || !r?.camRested) ctx.camRest(0);
    if (keepTime) ctx.applyTime(ctx.store.get().env?.time ?? REVEAL_TIME, { env: true });
    else {
      ctx.applyTime(REVEAL_TIME, { env: true });
      if (Math.abs((ctx.store.get().env?.time ?? 0) - REVEAL_TIME) > 1e-4) ctx.store.patch('env.time', REVEAL_TIME);
    }
    ctx.invalidate();
    ctx.emit('reveal', { phase: 'end', skipped: !!skipped });
    const res = resolveFn;
    resolveFn = null; promise = null;
    res?.();
  }

  function skip() { if (run) finish(true); }

  function play({ skip: doSkip = false, keepTime: keep = false } = {}) {
    if (doSkip) {
      if (!run) keepTime = !!keep;
      if (run) { const p = promise; finish(true); return p ?? Promise.resolve(); }
      finish(true);
      return Promise.resolve();
    }
    if (promise) return promise;
    keepTime = !!keep;
    promise = new Promise((res) => { resolveFn = res; });
    const p = promise;
    ctx.emit('reveal', { phase: 'start' });
    if (ctx.reduced) { requestAnimationFrame(() => finish(false)); return p; }
    ctx.prepare();
    run = start();
    if (!run) { requestAnimationFrame(() => finish(false)); return p; }
    run.keepTime = keepTime;
    if (!keepTime) ctx.applyTime(0.5, { env: true });
    ctx.camHigh();
    listen(true);
    ctx.invalidate();
    return p;
  }

  // Called every frame; true while running.
  function step(now) {
    const r = run;
    if (!r) return false;
    if (ctx.getHouse().house !== r.house) { finish(true); return false; }
    const t = now - r.t0;
    // Each phase is announced exactly once per reveal.
    const phase = (name) => { if (!r.fired.has(name)) { r.fired.add(name); r.phase = name; ctx.emit('reveal', { phase: name }); } };
    // Lot outline, in perimeter order.
    const perim = r.lot.reduce((a, m) => a + m.userData.len, 0);
    let along = perim * easeOut(clamp01((t - T.lot[0]) / (T.lot[1] - T.lot[0])));
    for (const m of r.lot) { const k = clamp01(along / m.userData.len); m.scale.x = Math.max(1e-4, k * m.userData.len); along -= m.userData.len; }
    // Footprints, all together.
    const kf = easeOut(clamp01((t - T.foot[0]) / (T.foot[1] - T.foot[0])));
    for (const m of r.foot) m.scale.x = Math.max(1e-4, kf * m.userData.len);
    // Walls rise per floor.
    if (t >= T.walls) phase('walls');
    for (const f of r.floors) {
      const k = (t - T.walls - f.idx * T.stagger) / T.wallMs;
      // Hidden until its rise starts: a squashed layer would z-fight with the ground.
      f.g.visible = f.vis && k > 0;
      f.g.scale.y = f.sy * (0.05 + 0.95 * easeOut(clamp01(k)));
    }
    // Lines fade once the walls stand (the teal outline lingers a little longer).
    inkMat.opacity = 0.85 * (1 - clamp01((t - 1300) / 400));
    tealMat.opacity = 1 - clamp01((t - 2600) / 600);
    // Roof drops in with a settle.
    if (r.roof && t >= T.roof[0]) {
      phase('roof');
      r.roof.visible = r.roofWasVisible;
      const k = clamp01((t - T.roof[0]) / (T.roof[1] - T.roof[0]));
      r.roof.position.y = r.roofY + 1.4 * (1 - settle(k));
    }
    // keepTime: no sun glide; the camera settles after the roof and the reveal ends sooner.
    if (r.keepTime) {
      if (t >= T.roof[0] && !r.camRested) { r.camRested = true; ctx.camRest(KEEP_END - T.roof[0]); }
      if (t >= KEEP_END) { finish(false); return true; }
      return true;
    }
    // Sun glides 12:00 -> 16:30 while the camera eases down to the resting 3/4 view.
    if (t >= T.sun[0]) {
      phase('sun');
      if (!r.camRested) { r.camRested = true; ctx.camRest(T.sun[1] - T.sun[0]); }
      const k = MathUtils.smoothstep(t, T.sun[0], T.sun[1]);
      const hour = 12 + 4.5 * k;
      const env = now - r.lastEnv > 350;
      if (env) r.lastEnv = now;
      ctx.applyTime(hour / 24, { env });
    }
    if (t >= T.sun[1]) { finish(false); return true; }
    return true;
  }

  return {
    play, step, skip,
    running: () => !!run,
    dispose() { if (run) { restore(run); listen(false); run = null; } unit.dispose(); tealMat.dispose(); inkMat.dispose(); },
  };
}
