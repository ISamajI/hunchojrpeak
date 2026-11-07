// "Construir" (v4): the build-mode step. Big tool bar, level pills, one-line instructions, the
// selection sheet with exact numbers (+/- buttons), roof, grid, totals and camera buttons.
// The pointer tools themselves live in src/engine/buildtool.js; this file is the panel around them.
// Every store/engine call is feature-detected: the engine side may land after this file.
import * as S from '../state.js';
import { PALETTES } from '../state.js';
import { createBuildTools } from '../engine/buildtool.js';
import { t, pick, onLang, getLang } from '../i18n.js';
import { h } from './dom.js';
import { icon } from './icons.js';
import { confirmDialog } from './widgets.js';
import { createFloors } from './floors.js';
import { createPieces } from './pieces.js';

const TOOLS = [
  { id: 'wall', ico: 'wall-draw' },
  { id: 'door', ico: 'door-open' },
  { id: 'window', ico: 'win-pane' },
  { id: 'slab', ico: 'slab' },
  { id: 'stairs', ico: 'stairs' },
  { id: 'fence', ico: 'fence' },
];
const MORE_TOOLS = [
  { id: 'move', ico: 'move' },
  { id: 'delete', ico: 'trash-2' },
  { id: 'paint', ico: 'paintbrush' },
];
const ALL = [...TOOLS, ...MORE_TOOLS, { id: 'gate', ico: 'gate' }];
const GRIDS = [0.1, 0.25, 0.5, 1];
const OPEN_KINDS = { door: ['door', 'arch', 'slider', 'garage'], window: ['window', 'slider'] };
const FENCE_TYPES = ['block', 'rejas', 'madera', 'malla', 'piedra'];
const WALL_FINISH = ['smooth', 'block', 'stone', 'brick'];
const WIN_STYLES = ['standard', 'tall', 'arched', 'louvered'];
const DOOR_STYLES = ['panel', 'double', 'glass'];
const WARM = { hex: '#f5f2ec', es: 'Blanco cálido', en: 'Warm white' };
const WALL_COLORS = [WARM, ...PALETTES];
const FENCE_COLORS = ['#f4f1ea', '#ffffff', '#9aa3a8', '#3b3d40', '#6b3b26', '#1f4e79'];
const ROOF_COLORS = ['#b8573a', '#9aa3a8', '#3b3d40', '#6b3b26', '#1f4e79', '#2a7d4f'];
const TAU = Math.PI * 2;
const r2 = (n) => Math.round(n * 100) / 100;
const fmtM = (v) => `${(+v).toFixed(2)} ${t('unit.m')}`;
const same = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
const swatchOf = (hex) => PALETTES.find((p) => same(p.hex, hex)) ?? WALL_COLORS.find((p) => same(p.hex, hex)) ?? { hex, es: hex, en: hex };

export function createBuild({ store, engine, ctx, ui, toast, C, sync, render }) {
  const floors = createFloors({ store, toast, C });
  const b = (ui.b = ui.b ?? {
    level: 0, tool: null, tab: 'pieces', lastDraw: null, more: false, sel: null, on: false, autoFence: false,
    o: {
      wall: { t: 0.2, ext: true },
      door: { kind: 'door' },
      window: { kind: 'window' },
      floor: { finish: 'porcelanato', tone: 'medio', pattern: 'recto', tileSize: null },
      stairs: { w: 1.0, rot: 0 },
      fence: { type: 'block', h: 1.8, color: '#f4f1ea' },
      gate: { kind: 'peatonal' },
      paint: { color: '#f2d8a7', finish: null },
      slabKind: '',
      straight: true,
    },
  });

  const isBuild = () => store.get().mode === 'build';
  const bd = () => store.get().build ?? null;
  const levels = () => bd()?.levels ?? [];
  const lvl = () => levels()[b.level] ?? null;
  const fh = () => bd()?.floorHeight ?? 3;
  const lenOf = (w) => Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
  const has = (fn) => typeof store[fn] === 'function';

  // Run a store action; anything that says no (or is missing) is told to him in plain words.
  function act(fn, failKey = 'bt.s.noChange') {
    let r = false;
    try { r = fn(); } catch (e) { console.warn('build action', e); r = false; }
    if (r === false || r == null) { toast(t(failKey), { kind: 'bad', ms: 3500 }); return false; }
    return r;
  }

  // Saying the same value again is not an error: stay silent.
  const noop = (obj, patch) => Object.entries(patch).every(([k, v]) => (obj?.[k] ?? null) === (v ?? null));
  const patcher = (get, fn) => (patch) => (noop(get(), patch) ? true : act(() => fn(patch)));

  // ---------- tools ----------
  function notify(key, kind = 'bad', after = null, withUndo = false, vars) {
    // Quick confirmations stay short so repeated placing never piles toasts over the stage; only Borrar offers Deshacer.
    const opts = { kind: kind === 'good' ? 'good' : 'bad', ms: kind === 'good' ? 1700 : 3200 };
    if (withUndo) opts.action = { label: t('top.undo'), onClick: () => ctx.undo() };
    toast(t(key, vars), opts);
  }
  // Piezas panel (tray, floating bar, placed-piece sheet). The tool and the panel call each other, so it is bound late.
  let pzm = null;
  const tools = createBuildTools({
    store, engine,
    getOpts: () => b.o,
    notify,
    getPiece: (id) => pzm?.getPiece(id) ?? null,
    onPiece: (st) => pzm?.onPiece(st),
    onPieceSelect: (g) => pzm?.onPieceSelect(g),
    onPlaced: (r) => pzm?.onPlaced(r),
    overTray: (x, y) => {
      const r = document.querySelector('.panel')?.getBoundingClientRect();
      return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    },
    confirm: (key, vars) => confirmDialog({ title: t(`${key}.title`, vars), body: t(`${key}.body`, vars), ok: t(`${key}.ok`), danger: false }),
    onState: (st) => paintBar(st),
    onSelect: (s) => {
      if ((b.sel?.id ?? null) === (s?.id ?? null) && (b.sel?.kind ?? null) === (s?.kind ?? null)) return;
      b.sel = s;
      ui.stepChanged = true;
      if (s && ui.sheet === 'min') ctx.setSheet?.('half');
      render();
    },
  });
  ctx.tools = tools;

  // The camera for building: tilted top view of the active level.
  function aim() {
    if (engine.setBuildLevel) engine.setBuildLevel(b.level);
    else engine.viewInterior?.(b.level);
  }

  function selectTool(id) {
    if (id) { b.tab = id === 'pieces' ? 'pieces' : 'draw'; if (id !== 'pieces') b.lastDraw = id; }
    if (!id) { tools.deactivate(); b.tool = null; b.sel = null; paintBar({ tool: null }); render(); return; }
    b.free = false;
    if (ui.view === 'walk' || ui.view === 'inside') ctx.setViewMode('3d');
    if (!b.on && !b.autoFence) aim();
    // Coming back from the whole-lot view of the fence: look at the house again.
    else if (b.on && (b.tool === 'fence' || b.tool === 'gate') && id !== 'fence' && id !== 'gate') aim();
    if (!tools.activate(id)) { toast(t('bt.notReady'), { kind: 'bad', ms: 4000 }); b.tool = null; render(); return; }
    b.tool = id;
    if (MORE_TOOLS.some((x) => x.id === id)) b.more = true;
    if (id !== 'move') b.sel = null;
    if (id !== 'pieces') pzm?.deselect();
    ctx.clearHint?.();
    render();
  }

  // After a roof: show the whole house for a moment, then back to the cut-open floor he is building on.
  let previewTimer = 0;
  function previewHouse() {
    engine.setBuildLevel?.(null);
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => { if (b.on && b.tab === 'pieces' && !ui.sub) engine.setBuildLevel?.(b.level); }, 2200);
  }

  // Piezas / Dibujar. `target` opens that v4 element's sheet (Editar medidas).
  function openTab(id, target) {
    if (target) {
      selectTool('move');
      tools.select(target);
      return;
    }
    if (id === 'pieces') selectTool('pieces');
    else selectTool(b.lastDraw ?? 'wall');
  }

  function setLevel(i) {
    b.level = Math.max(0, Math.min(Math.max(0, levels().length - 1), i));
    b.sel = null;
    tools.setLevel(b.level);
    aim();
    ui.stepChanged = false;
    render();
  }
  function addLevel() {
    const n = levels().length;
    if (n >= 3 || !act(() => (b.tab === 'pieces' ? store.addLevel({ shell: false }) : store.addLevel()), 'bt.levelFail')) return;
    toast(t('bt.levelAdded', { n: n + 1 }));
    setLevel(levels().length - 1);
  }
  async function removeLevel() {
    if (levels().length < 2) return;
    if (!(await confirmDialog({ title: t('bt.removeLevel.title'), body: t('bt.removeLevel.body'), ok: t('bt.removeLevel.ok') }))) return;
    if (!act(() => store.removeLevel())) return;
    setLevel(Math.min(b.level, levels().length - 1));
  }

  // ---------- lifecycle (called by the panel) ----------
  function enter() {
    b.on = true;
    b.level = Math.min(b.level, Math.max(0, levels().length - 1));
    tools.setLevel(b.level);
    ctx.setViewMode('3d');
    aim();
    const empty = !levels().some((l) => l.walls?.length);
    if (b.tool && tools.activate(b.tool)) { /* resumed */ } else if (b.tab === 'pieces' && tools.ready()) { b.tool = 'pieces'; tools.activate('pieces'); }
    else if (empty && tools.ready()) { b.tool = 'wall'; tools.activate('wall'); }
    else b.tool = tools.active();
    paintBar({ tool: b.tool });
  }
  function leave() {
    b.on = false;
    tools.deactivate();
    b.tool = null;
    b.sel = null;
    engine.setBuildLevel?.(null);
    paintBar({ tool: null });
  }
  // Fence drawing in automatic mode (Casa > Detalles y patio > Dibujar mi cerca).
  function startFenceDraw() {
    if (ui.view === 'walk') ctx.setViewMode('3d');
    if (!tools.activate('fence')) { toast(t('bt.notReady'), { kind: 'bad', ms: 4000 }); return; }
    b.autoFence = true;
    b.tool = 'fence';
    ctx.setSheet?.('min');
    paintBar({ tool: 'fence' });
    render();
  }
  function stopAuto() {
    if (!b.autoFence) return;
    b.autoFence = false;
    tools.deactivate();
    b.tool = null;
    if (ui.sheet === 'min') ctx.setSheet?.('half');
    paintBar({ tool: null });
  }
  // Called on every panel render: start/stop the tools to match the step.
  function syncStep() {
    const want = isBuild() && ui.step === 2;
    if (b.sel && !selExists(b.sel)) { b.sel = null; tools.select(null); }
    if (b.autoFence && (ui.step !== 2 || isBuild())) stopAuto();
    if (want && !b.on) enter();
    else if (!want && b.on) leave();
    // The roof screen shows the whole house so the new roof can be seen; everything else builds on the cut-open floor.
    const roofView = b.on && ui.sub === 'broof';
    if (roofView !== !!b.roofView) { b.roofView = roofView; if (b.on || !roofView) { if (roofView) engine.setBuildLevel?.(null); else aim(); } }
    // Sub-screens (roof, yard) pause the pointer tools so the camera is free; they resume on return.
    if (b.on) {
      if (ui.sub && tools.active()) tools.deactivate();
      else if (!ui.sub && b.tool && !tools.active()) tools.activate(b.tool);
    }
    document.body.dataset.build = want ? '1' : '0';
    document.body.classList.toggle('pz-tray', want && b.tab === 'pieces' && !ui.sub && !b.sel && !pzm?.hasSelection());
    document.body.classList.toggle('bt-live', want || b.autoFence);
    paintBar({ tool: tools.active() });
  }
  // The view changed (dock buttons): walking cannot draw.
  function onView() {
    if ((b.on || b.autoFence) && ui.view === 'walk') {
      tools.deactivate();
      b.tool = null;
      paintBar({ tool: null });
      render();
    }
  }
  store.subscribe(() => { if (b.on || b.autoFence) tools.sync(); });

  // ---------- floating bar: instruction + Cancelar / Listo, camera buttons ----------
  const barText = h('span', { class: 'bt-text', 'data-key': 'bt-text' });
  const mkBtn = (key, cls, onclick, ...kids) => h('button', { type: 'button', class: `btn ${cls}`, 'data-key': key, onclick }, ...kids);
  const cancelBtn = mkBtn('bt-cancel', 'btn-secondary', () => tools.cancel(), t('bt.cancel'));
  const doneBtn = mkBtn('bt-done', 'btn-primary', () => tools.finish(), icon('check', 22), t('bt.done'));
  const rotBtn = mkBtn('bt-rotate', 'btn-secondary', () => { b.o.stairs.rot = r2((b.o.stairs.rot + Math.PI / 2) % TAU); render(); }, icon('rotate-cw', 22), t('bt.rotate'));
  const stopBtn = mkBtn('bt-stop', 'btn-primary', () => { stopAuto(); render(); }, icon('check', 22), t('bt.stop'));
  const barActs = h('span', { class: 'bt-acts' }, cancelBtn, doneBtn, rotBtn, stopBtn);
  const bar = h('div', { class: 'bt-bar', role: 'status', 'aria-live': 'polite', hidden: true }, barText, barActs);

  const camBtn = (key, ico, label, fn) => h('button', { type: 'button', class: 'bt-cam-btn', 'data-key': key, 'aria-label': label, title: label, onclick: fn }, icon(ico, 26));
  const cam = h('div', { class: 'bt-cam', role: 'group', 'aria-label': t('a11y.camera'), hidden: true },
    camBtn('cam-in', 'zoom-in', t('plan.zoomIn'), () => tools.zoom(1.3)),
    camBtn('cam-out', 'zoom-out', t('plan.zoomOut'), () => tools.zoom(1 / 1.3)),
    camBtn('cam-left', 'rotate-ccw', t('bt.rotL'), () => tools.rotate(45)),
    camBtn('cam-right', 'rotate-cw', t('bt.rotR'), () => tools.rotate(-45)));

  const HINT = { wall: ['bt.h.wall0', 'bt.h.wall1'], door: ['bt.h.door'], window: ['bt.h.window'], slab: ['bt.h.slab0', 'bt.h.slab1'], stairs: ['bt.h.stairs'], fence: ['bt.h.fence0', 'bt.h.fence1'], gate: ['bt.h.gate'], move: ['bt.h.move'], delete: ['bt.h.delete'], paint: ['bt.h.paint'] };
  let lastSt = { tool: null };
  function paintBar(st = lastSt) {
    lastSt = st;
    const tool = st.tool ?? tools.active();
    const live = (b.on || b.autoFence) && ui.step === 2 && !b.sel && !(b.on && ui.sub) && tool !== 'pieces';
    bar.hidden = !live || (!tool && b.free);
    cam.hidden = !(b.on || b.autoFence) || ui.step !== 2;
    const k = HINT[tool]?.[st.phase ?? 0] ?? HINT[tool]?.[0] ?? 'bt.h.none';
    barText.textContent = t(k);
    cancelBtn.hidden = !st.canCancel;
    doneBtn.hidden = !st.canFinish;
    rotBtn.hidden = tool !== 'stairs';
    stopBtn.hidden = !b.autoFence;
    document.body.dataset.tool = tool ?? '';
    document.body.classList.toggle('bt-bar-on', !bar.hidden);
    pzm?.paintBar();
    ctx.syncInset?.();
  }
  onLang(() => {
    cancelBtn.lastChild.textContent = t('bt.cancel');
    doneBtn.lastChild.textContent = t('bt.done');
    rotBtn.lastChild.textContent = t('bt.rotate');
    stopBtn.lastChild.textContent = t('bt.stop');
    cam.setAttribute('aria-label', t('a11y.camera'));
    const labels = [['cam-in', t('plan.zoomIn')], ['cam-out', t('plan.zoomOut')], ['cam-left', t('bt.rotL')], ['cam-right', t('bt.rotR')]];
    for (const [k, l] of labels) { const el = cam.querySelector(`[data-key="${k}"]`); el.setAttribute('aria-label', l); el.title = l; }
    paintBar();
  });

  // ---------- numbers: big +/- with an optional fine row ----------
  function num({ key, label, value, min, max, step = 0.1, coarse, onSet, fmt = fmtM }) {
    const main = coarse ?? step;
    const set = (v) => onSet(r2(Math.min(max, Math.max(min, v))));
    const kids = [C.stepper({ key, label, value, min, max, step: main, fmt, minusText: `−${main}`, plusText: `+${main}`, onSet: set })];
    if (coarse) {
      const fine = (d) => h('button', {
        type: 'button', class: 'btn btn-secondary move-btn', 'data-key': `${key}f${d < 0 ? '-' : '+'}`, 'aria-label': `${t('plan.fine')} ${d > 0 ? '+' : '−'}${step}`,
        disabled: d > 0 ? value >= max - 1e-6 : value <= min + 1e-6,
        onclick: () => set(value + d * step),
      }, icon(d > 0 ? 'plus' : 'minus', 20), `${d > 0 ? '+' : '−'}${step}`);
      kids.push(h('div', { class: 'lbl small-lbl' }, t('plan.fine')), h('div', { class: 'move-row' }, fine(-1), fine(1)));
    }
    return h('div', { class: 'group' }, kids);
  }
  const seg = (key, label, options, value, onSet, cls = '') => C.choice({ key, label, options, value, onSet, cls });
  const pickColors = (key, label, list, value, onPick) => C.colorGroup({ key, label, list, value, onPick });
  const hexList = (hexes) => hexes.map(swatchOf);

  // ---------- totals ----------
  function totals() {
    const bb = bd();
    if (!bb) return { areas: [], walls: 0, fence: 0 };
    const areas = (bb.levels ?? []).map((l) => (l.slabs ?? []).filter((sl) => sl.kind !== 'carport' && sl.kind !== 'balcony').reduce((s, sl) => s + Math.abs((sl.x1 - sl.x0) * (sl.z1 - sl.z0)), 0));
    const walls = (bb.levels ?? []).reduce((s, l) => s + (l.walls ?? []).reduce((q, w) => q + lenOf(w), 0), 0);
    const fence = (bb.fences ?? []).reduce((s, f) => s + Math.hypot(f.x1 - f.x0, f.z1 - f.z0), 0);
    return { areas, walls, fence };
  }
  const totalsLine = () => {
    const tt = totals();
    return t('bt.see.sum', { n: tt.areas.reduce((a, c) => a + c, 0).toFixed(0), w: tt.walls.toFixed(0), f: tt.fence.toFixed(0) });
  };
  function totalsCard() {
    const tt = totals();
    const empty = !tt.walls && !tt.fence && !tt.areas.some((a) => a > 0);
    return h('div', { class: 'area-card bt-totals', 'data-key': 'bt-totals' },
      h('div', { class: 'lbl bt-tot-h' }, t('bt.totals')),
      empty ? h('p', { class: 'bt-tot-empty' }, t('bt.tot.none'))
        : h('ul', { class: 'bt-tot' },
          tt.areas.map((a, i) => h('li', null, h('span', null, t('bt.tot.area', { n: i + 1 })), h('strong', { class: 'num' }, `${a.toFixed(1)} m²`))),
          h('li', null, h('span', null, t('bt.tot.walls')), h('strong', { class: 'num' }, `${tt.walls.toFixed(1)} ${t('unit.m')}`)),
          tt.fence > 0 ? h('li', null, h('span', null, t('bt.tot.fence')), h('strong', { class: 'num' }, `${tt.fence.toFixed(1)} ${t('unit.m')}`)) : null));
  }

  // ---------- main view ----------
  function levelRow() {
    const n = levels().length || 1;
    return h('div', { class: 'level-row bt-levels' },
      n > 1 || levels().length
        ? C.choice({
          key: 'bt.level', value: b.level, cls: 'level-pills',
          options: Array.from({ length: n }, (_, i) => ({ value: i, label: t('int.levelN', { n: i + 1 }) })),
          onSet: setLevel,
        }) : null,
      n < 3 ? h('button', { type: 'button', class: 'btn btn-secondary add-level', 'data-key': 'bt-addlevel', onclick: addLevel }, t('bt.addLevel')) : null);
  }

  function toolBtn(tl) {
    const on = b.tool === tl.id || (tl.id === 'fence' && b.tool === 'gate');
    return h('button', {
      type: 'button', class: `bt-tool${on ? ' on' : ''}`, 'aria-pressed': on, 'data-key': `tool:${tl.id}`, onclick: () => selectTool(tl.id),
    }, icon(tl.ico, 30), h('span', null, t(`bt.t.${tl.id}`)));
  }
  function toolBar() {
    const showMore = b.more || MORE_TOOLS.some((x) => x.id === b.tool);
    return h('div', { class: 'group', role: 'group', 'aria-label': t('a11y.tools') },
      h('div', { class: 'bt-tools' }, TOOLS.map(toolBtn)),
      showMore ? h('div', { class: 'bt-tools' }, MORE_TOOLS.map(toolBtn)) : null,
      h('button', {
        type: 'button', class: 'btn btn-ghost more-btn-row', 'aria-expanded': showMore, 'data-key': 'bt-more',
        onclick: () => { b.more = !showMore; render(); },
      }, h('span', null, showMore ? t('bt.lessTools') : t('bt.moreTools')), h('span', { class: 'chev' }, icon('chevron-down', 22))));
  }

  const FLOOR_NAME = () => pick(S.FLOORS.find((f) => f.id === b.o.floor.finish)) || '';
  function floorPicker(key) {
    const f = b.o.floor;
    return floors.picker({
      spec: { floor: f.finish, tone: f.tone, pattern: f.pattern, tileSize: f.tileSize },
      detailsKey: key,
      set: (field, v) => { b.o.floor = { ...b.o.floor, [field === 'floor' ? 'finish' : field]: v }; render(); },
    });
  }

  function toolOptions() {
    const o = b.o;
    switch (b.tool) {
      case 'wall':
        return [seg('wallType', t('bt.o.wallType'), [
          { value: 'ext', body: [h('span', null, t('bt.o.ext')), h('small', null, '20 cm')] },
          { value: 'int', body: [h('span', null, t('bt.o.int')), h('small', null, '15 cm')] },
        ], o.wall.ext ? 'ext' : 'int', (v) => { o.wall = v === 'ext' ? { ext: true, t: 0.2 } : { ext: false, t: 0.15 }; render(); }, 'two-line'),
          seg('wallStraight', t('bt.o.straight'), [{ value: 'on', label: t('bt.o.straightOn') }, { value: 'off', label: t('bt.o.straightOff') }],
            o.straight === false ? 'off' : 'on', (v) => { o.straight = v === 'on'; render(); })];
      case 'door':
      case 'window':
        return seg(`${b.tool}Kind`, t('bt.o.kind'), OPEN_KINDS[b.tool].map((k) => ({ value: k, label: t(`bt.k.${k}`) })), o[b.tool].kind,
          (v) => { o[b.tool] = { kind: v }; render(); }, 'seg-wrap');
      case 'slab':
        return [
          seg('slabKind', t('bt.k2.title'), [['', 'normal'], ['porch', 'porch'], ['carport', 'carport'], ['balcony', 'balcony']].map(([v, k]) => ({ value: v, label: t(`bt.k2.${k}`) })),
            o.slabKind ?? '', (v) => { o.slabKind = v; render(); }, 'seg-wrap'),
          h('div', { class: 'group' },
            h('div', { class: 'lbl' }, `${t('bt.o.floor')}: ${FLOOR_NAME()}`),
            C.more({ key: 'bSlabPick', label: t('bt.o.changeFloor'), kids: [floorPicker('bSlabD')] })),
        ];
      case 'stairs':
        return num({
          key: 'stairW', label: t('bt.o.width'), value: o.stairs.w, min: 0.8, max: 1.6, step: 0.1,
          onSet: (v) => { o.stairs.w = v; render(); },
        });
      case 'fence':
      case 'gate':
        return [
          seg('fenceMode', null, [{ value: 'fence', body: [icon('fence', 22), t('bt.t.fence')] }, { value: 'gate', body: [icon('gate', 22), t('bt.t.gate')] }],
            b.tool, (v) => selectTool(v), 'view-toggle'),
          b.tool === 'gate'
            ? seg('gateKind', t('bt.o.gate'), ['peatonal', 'vehicular'].map((k) => ({ value: k, label: t(`bt.gk.${k}`) })), o.gate.kind, (v) => { o.gate.kind = v; render(); })
            : [
              seg('fenceType', t('bt.o.ftype'), FENCE_TYPES.map((k) => ({ value: k, label: t(`bt.ft.${k}`) })), o.fence.type, (v) => { o.fence.type = v; render(); }, 'seg-wrap'),
              num({ key: 'fenceH', label: t('bt.o.fheight'), value: o.fence.h, min: 0.6, max: 3, step: 0.1, onSet: (v) => { o.fence.h = v; render(); } }),
              pickColors('fenceC', t('bt.o.fcolor'), hexList(FENCE_COLORS), o.fence.color, (p) => { o.fence.color = p.hex; render(); }),
            ],
        ];
      case 'paint':
        return [
          pickColors('paintC', t('bt.o.paintWall'), WALL_COLORS, o.paint.color, (p) => { o.paint.color = p.hex; render(); }),
          seg('paintFin', t('bt.o.paintFinish'), ['keep', ...WALL_FINISH].map((k) => ({ value: k, label: t(`bt.wf.${k}`) })), o.paint.finish ?? 'keep',
            (v) => { o.paint.finish = v === 'keep' ? null : v; render(); }, 'seg-wrap'),
          h('div', { class: 'group' },
            h('div', { class: 'lbl' }, `${t('bt.o.paintFloor')}: ${FLOOR_NAME()}`),
            C.more({ key: 'bPaintPick', label: t('bt.o.changeFloor'), kids: [floorPicker('bPaintD')] })),
        ];
      default:
        return null;
    }
  }

  const navCard = (key, ico, title, desc, onclick) => h('button', { type: 'button', class: 'nav-card', 'data-key': key, onclick },
    h('span', { class: 'nc-ico' }, icon(ico, 28)),
    h('span', { class: 'nc-text' }, h('strong', null, title), h('span', null, desc)),
    h('span', { class: 'chev' }, icon('chevron-right', 22)));

  function roofSummary() {
    const R = bd()?.roof;
    return R ? `${t(`roof.${R.type}`)} · ${t(`mat.${R.material}`)}` : t('bt.roofD');
  }

  function buildStep() {
    if (b.sel) return selectionView();
    if (b.tab === 'pieces') return pzm.piecesView();
    const sec = [
      levelRow(),
      toolBar(),
      toolOptions(),
      totalsCard(),
      navCard('bt-roof', 'window', t('bt.roof'), roofSummary(), () => { ui.sub = 'broof'; ui.stepChanged = true; render(); }),
      navCard('bt-yard', 'trees', t('bt.yard'), t('bt.yardD'), () => { ui.sub = 'extras'; ui.stepChanged = true; render(); }),
      h('button', { type: 'button', class: 'btn btn-secondary btn-xl', 'data-key': 'bt-view3d', onclick: view3d }, icon('box', 26), t('bt.view3d')),
      C.more({
        key: 'bMore', kids: [
          seg('bgrid', t('bt.grid'), GRIDS.map((g) => ({ value: g, label: g < 1 ? `${g * 100} cm` : '1 m' })), bd()?.grid ?? 0.5, (v) => (v === (bd()?.grid ?? 0.5) ? true : act(() => store.setGrid(v))), 'seg-wrap'),
          h('p', { class: 'muted-p' }, t('bt.grid.hint')),
          levels().length > 1 ? h('button', { type: 'button', class: 'btn btn-secondary btn-danger-outline', 'data-key': 'bt-rmlevel', onclick: removeLevel }, icon('trash-2', 22), t('bt.removeLevel')) : null,
          h('button', { type: 'button', class: 'btn btn-secondary', 'data-key': 'bt-auto', onclick: backToAuto }, icon('rotate-cw', 22), t('bt.auto.btn')),
        ],
      }),
    ];
    return sec.flat().filter(Boolean);
  }

  function view3d() {
    b.free = true;
    tools.deactivate();
    b.tool = null;
    b.sel = null;
    engine.setBuildLevel?.(null);
    ctx.setViewMode('3d');
    engine.resetCamera?.();
    render();
  }

  async function backToAuto() {
    if (!(await confirmDialog({ title: t('bt.auto.title'), body: t('bt.auto.body'), ok: t('bt.auto.ok'), danger: false }))) return false;
    if (!act(() => store.setMode('auto'), 'bt.start.fail')) return false;
    ui.sub = null;
    ui.step = 2;
    ui.stepChanged = true;
    toast(t('bt.mode.off'));
    render();
    return true;
  }

  // ---------- roof ----------
  const roofShape = (type) => h('span', { class: 'roof-shape', 'data-type': type, 'aria-hidden': 'true' });
  function roofSub() {
    const R = bd()?.roof ?? { type: 'flat', material: 'concrete', color: '#b8573a', overhang: 0.6, parapet: true };
    const set = patcher(() => bd()?.roof, (patch) => store.setBuildRoof(patch));
    const X = bd()?.extras ?? {};
    return [
      h('p', { class: 'hint-bar' }, icon('window', 20), t('bt.roof.hint')),
      C.choice({
        key: 'broof.type', label: t('size.roof'), cards: true, cls: 'cols-4 roof-cards', value: R.type,
        options: ['flat', 'hip', 'gable', 'shed'].map((v) => ({ value: v, body: [roofShape(v), h('span', { class: 'oc-name' }, t(`roof.${v}`))] })),
        onSet: (v) => set({ type: v }),
      }),
      C.choice({
        key: 'broof.material', label: t('size.roofMat'), value: R.material,
        options: ['concrete', 'tile', 'metal'].map((v) => ({ value: v, label: t(`mat.${v}`) })),
        onSet: (v) => set({ material: v }),
      }),
      pickColors('broofC', t('bt.roof.color'), hexList(ROOF_COLORS), R.color, (p) => set({ color: p.hex })),
      num({ key: 'broofOver', label: t('bt.roof.over'), value: R.overhang ?? 0.6, min: 0, max: 1.2, step: 0.1, onSet: (v) => set({ overhang: v }) }),
      R.type === 'flat'
        ? C.toggleCard({ key: 'broofParapet', label: t('bt.roof.parapet'), ico: 'brick-wall', on: !!R.parapet, onToggle: (v) => set({ parapet: v }) })
        : null,
      h('h3', { class: 'sec' }, t('bt.x.title')),
      h('div', { class: 'toggle-grid' }, [
        R.type === 'flat' ? ['roofTerrace', 'building-2'] : null,
        R.type === 'flat' && X.roofTerrace ? ['pergola', 'tent'] : null,
        ['waterTank', 'container'], ['solar', 'solar'], ['entryPortal', 'columns-3'],
      ].filter(Boolean).map(([k, ico]) => C.toggleCard({
        key: `bx:${k}`, label: t(`bt.x.${k}`), ico, on: !!X[k],
        onToggle: (v) => act(() => store.setBuildExtras({ [k]: v })),
      }))),
    ].filter(Boolean);
  }

  // ---------- selection sheet ----------
  const find = {
    wall: (id) => levels().flatMap((l, li) => (l.walls ?? []).map((w) => ({ w, li }))).find((x) => x.w.id === id),
    slab: (id) => levels().flatMap((l, li) => (l.slabs ?? []).map((s) => ({ s, li }))).find((x) => x.s.id === id),
    stairs: (id) => levels().flatMap((l, li) => (l.stairs ?? []).map((s) => ({ s, li }))).find((x) => x.s.id === id),
    fence: (id) => (bd()?.fences ?? []).find((f) => f.id === id),
  };

  function head(title, sub) {
    return h('div', { class: 'room-head sel-head' },
      h('button', { type: 'button', class: 'btn btn-secondary back-link', 'data-key': 'sel-back', onclick: deselect }, icon('chevron-left', 22), t('bt.tools')),
      h('div', { class: 'room-title', 'aria-live': 'polite' },
        h('h2', { class: 'step-title', 'data-key': 'sel-title' }, title),
        sub ? h('p', { class: 'room-size num', 'data-key': 'sel-sub' }, sub) : null));
  }
  function removeBtn(label, fn) {
    return h('button', { type: 'button', class: 'btn btn-secondary btn-danger-outline', 'data-key': 'sel-remove', onclick: fn }, icon('trash-2', 22), label);
  }
  function removeSel(what, fn) {
    if (!act(fn, 'bt.removeFail')) return;
    tools.select(null);
    toast(t('bt.s.removed', { what }), { action: { label: t('top.undo'), onClick: () => ctx.undo() } });
  }

  // A selection can vanish under him (undo, a merge): drop it before the foot/sheet are drawn.
  function selExists(s) {
    if (!s) return false;
    if (s.kind === 'wall') return !!find.wall(s.id);
    if (s.kind === 'opening') return levels().some((l) => (l.walls ?? []).some((w) => (w.openings ?? []).some((o) => o.id === s.id)));
    if (s.kind === 'slab') return !!find.slab(s.id);
    if (s.kind === 'stairs') return !!find.stairs(s.id);
    return !!find.fence(s.id);
  }

  function selectionView() {
    const s = b.sel;
    let out = null;
    if (s.kind === 'wall') out = wallView(s);
    else if (s.kind === 'opening') out = openingView(s);
    else if (s.kind === 'slab') out = slabView(s);
    else if (s.kind === 'fence') out = fenceView(s);
    else if (s.kind === 'stairs') out = stairsView(s);
    if (!out) { b.sel = null; return buildStep(); }
    return out;
  }

  function wallView(s) {
    const f = find.wall(s.id);
    if (!f) return null;
    const w = f.w, L = lenOf(w);
    const ux = (w.x1 - w.x0) / (L || 1), uz = (w.z1 - w.z0) / (L || 1);
    const inHex = w.inColor ?? WARM.hex;
    const outHex = w.outColor ?? store.get().house.colors.walls;
    const set = patcher(() => w, (patch) => store.setWall(w.id, patch));
    return [
      head(`${t('bt.s.wall')} · ${fmtM(L)}`, `${t('int.levelN', { n: f.li + 1 })} · ${w.ext ? t('bt.s.ext') : t('bt.s.int')}`),
      num({
        key: 'wLen', label: t('bt.s.length'), value: r2(L), min: 0.3, max: 40, step: 0.1, coarse: 0.5,
        // setWallLength keeps the house square (neighbouring walls follow); older stores only move the end.
        onSet: (v) => act(() => (has('setWallLength') ? store.setWallLength(w.id, v) : store.moveWallEnd(w.id, 1, r2(w.x0 + ux * v), r2(w.z0 + uz * v)))),
      }),
      num({ key: 'wH', label: t('bt.s.height'), value: w.h ?? fh(), min: 1, max: store.buildInfo?.(0)?.limits?.wallH?.[1] ?? fh(), step: 0.1, onSet: (v) => set({ h: v }) }),
      w.h != null ? h('button', { type: 'button', class: 'btn btn-ghost', 'data-key': 'wH-normal', onclick: () => set({ h: null }) }, icon('rotate-cw', 20), t('bt.s.normalH')) : null,
      seg('wThick', t('bt.s.thick'), [{ value: 0.15, label: '15 cm' }, { value: 0.2, label: '20 cm' }], w.t ?? 0.2, (v) => set({ t: v })),
      seg('wExt', t('bt.s.type'), [{ value: 'ext', label: t('bt.o.ext') }, { value: 'int', label: t('bt.o.int') }], w.ext ? 'ext' : 'int', (v) => set({ ext: v === 'ext' }), 'wall-type'),
      pickColors('wIn', t('bt.s.inColor'), WALL_COLORS, inHex, (p) => set({ inColor: p.hex })),
      pickColors('wOut', t('bt.s.outColor'), WALL_COLORS, outHex, (p) => set({ outColor: p.hex })),
      C.more({
        key: 'wMore', label: t('bt.s.more'), kids: [
          C.choice({
            key: 'wFin', label: t('bt.s.finish'), cards: true, cls: 'cols-2 mini-cards', value: w.finish ?? 'smooth',
            options: WALL_FINISH.map((v) => ({ value: v, body: [h('span', { class: 'oc-name' }, t(`bt.wf.${v}`))] })),
            onSet: (v) => set({ finish: v }),
          }),
        ],
      }),
      removeBtn(`${t('bt.s.remove')} ${t('bt.s.wall').toLowerCase()}`, () => removeSel(t('bt.s.wall'), () => store.removeWall(w.id))),
    ].filter(Boolean);
  }

  function openingView(s) {
    const w = levels().flatMap((l) => l.walls ?? []).find((x) => x.id === s.wallId) ?? levels().flatMap((l) => l.walls ?? []).find((x) => (x.openings ?? []).some((o) => o.id === s.id));
    const o = w?.openings?.find((x) => x.id === s.id);
    if (!w || !o) return null;
    const L = lenOf(w);
    const win = o.kind === 'window' || o.kind === 'slider';
    const name = t(`bt.k.${o.kind}`);
    const set = patcher(() => o, (patch) => store.setOpening(w.id, o.id, patch));
    const left = o.at - o.w / 2, right = L - o.at - o.w / 2;
    return [
      head(name, `${t('bt.s.leftC')} ${fmtM(left)} · ${t('bt.s.rightC')} ${fmtM(right)}`),
      num({ key: 'oW', label: t('bt.s.width'), value: o.w, min: 0.4, max: Math.max(0.5, Math.min(4, L - 0.2)), step: 0.1, onSet: (v) => set({ w: v }) }),
      num({ key: 'oH', label: t('bt.s.height'), value: o.h, min: 0.4, max: Math.max(0.5, fh() - (o.sill ?? 0) - 0.05), step: 0.1, onSet: (v) => set({ h: v }) }),
      win ? num({ key: 'oSill', label: t('bt.s.sill'), value: o.sill ?? 0, min: 0, max: Math.max(0.1, fh() - o.h - 0.05), step: 0.1, onSet: (v) => set({ sill: v }) }) : null,
      num({ key: 'oAt', label: t('bt.s.at'), value: o.at, min: r2(o.w / 2 + 0.05), max: r2(Math.max(o.w / 2 + 0.05, L - o.w / 2 - 0.05)), step: 0.1, coarse: 0.5, onSet: (v) => set({ at: v }) }),
      h('button', { type: 'button', class: 'btn btn-secondary', 'data-key': 'oCenter', onclick: () => set({ at: r2(L / 2) }) }, icon('locate-fixed', 22), t('bt.s.center')),
      seg('oKind', t('bt.o.kind'), OPEN_KINDS[win ? 'window' : 'door'].map((k) => ({ value: k, label: t(`bt.k.${k}`) })), o.kind, (v) => set({ kind: v }), 'seg-wrap'),
      C.more({
        key: 'oMore', label: t('bt.s.style'), kids: [
          C.choice({
            key: 'oStyle', label: t('bt.s.style'), cards: true, cls: 'cols-2 mini-cards', value: o.style ?? (win ? 'standard' : 'panel'),
            options: (win ? WIN_STYLES : DOOR_STYLES).map((v) => ({ value: v, body: [h('span', { class: 'oc-name' }, t(`${win ? 'win' : 'door'}.${v}`))] })),
            onSet: (v) => set({ style: v }),
          }),
        ],
      }),
      removeBtn(`${t('bt.s.remove')} ${name.toLowerCase()}`, () => removeSel(name, () => store.removeOpening(w.id, o.id))),
    ].filter(Boolean);
  }

  function slabView(s) {
    const f = find.slab(s.id);
    if (!f) return null;
    const sl = f.s;
    const wd = Math.abs(sl.x1 - sl.x0), dp = Math.abs(sl.z1 - sl.z0);
    const set = patcher(() => sl, (patch) => store.setSlab(sl.id, patch));
    return [
      head(`${t('bt.s.slab')} · ${(wd * dp).toFixed(1)} m²`, `${fmtM(wd)} × ${fmtM(dp)} · ${t('int.levelN', { n: f.li + 1 })}`),
      seg('sKind', t('bt.k2.title'), [['', 'normal'], ['porch', 'porch'], ['carport', 'carport'], ['balcony', 'balcony']].map(([v, k]) => ({ value: v, label: t(`bt.k2.${k}`) })),
        sl.kind ?? '', (v) => set(v === 'carport' ? { kind: v, raised: false, finish: 'cemento' } : { kind: v || null, raised: true }), 'seg-wrap'),
      floors.picker({
        spec: { floor: sl.finish, tone: sl.tone, pattern: sl.pattern, tileSize: sl.tileSize },
        detailsKey: 'sSlabD',
        set: (field, v) => set({ [field === 'floor' ? 'finish' : field]: v }),
      }),
      num({ key: 'sW', label: t('bt.s.width'), value: r2(wd), min: 0.5, max: 40, step: 0.1, coarse: 0.5, onSet: (v) => set({ x1: r2(Math.min(sl.x0, sl.x1) + v), x0: r2(Math.min(sl.x0, sl.x1)) }) }),
      num({ key: 'sD', label: t('bt.s.depth'), value: r2(dp), min: 0.5, max: 40, step: 0.1, coarse: 0.5, onSet: (v) => set({ z1: r2(Math.min(sl.z0, sl.z1) + v), z0: r2(Math.min(sl.z0, sl.z1)) }) }),
      removeBtn(`${t('bt.s.remove')} ${t('bt.s.slab').toLowerCase()}`, () => removeSel(t('bt.s.slab'), () => store.removeSlab(sl.id))),
    ];
  }

  function stairsView(s) {
    const f = find.stairs(s.id);
    if (!f) return null;
    const st = f.s;
    const redo = (patch) => act(() => {
      if (has('setStairs')) return store.setStairs(st.id, patch);
      // No edit action yet: replace the stairs (two undo steps).
      store.removeStairs(st.id);
      return store.addStairs(f.li, patch.x ?? st.x, patch.z ?? st.z, patch.rot ?? st.rot ?? 0, { w: patch.w ?? st.w });
    });
    return [
      head(t('bt.s.stairs'), `${t('int.levelN', { n: f.li + 1 })} → ${t('int.levelN', { n: f.li + 2 })}`),
      num({ key: 'stW', label: t('bt.s.width'), value: st.w, min: 0.8, max: 1.6, step: 0.1, onSet: (v) => redo({ w: v }) }),
      h('button', { type: 'button', class: 'btn btn-secondary', 'data-key': 'st-rotate', onclick: () => redo({ rot: r2(((st.rot ?? 0) + Math.PI / 2) % TAU) }) }, icon('rotate-cw', 22), t('bt.s.rotate')),
      removeBtn(`${t('bt.s.remove')} ${t('bt.s.stairs').toLowerCase()}`, () => removeSel(t('bt.s.stairs'), () => store.removeStairs(st.id))),
    ];
  }

  function fenceView(s) {
    const f = find.fence(s.id);
    if (!f) return null;
    const L = Math.hypot(f.x1 - f.x0, f.z1 - f.z0);
    const ux = (f.x1 - f.x0) / (L || 1), uz = (f.z1 - f.z0) / (L || 1);
    const set = patcher(() => f, (patch) => store.setFence(f.id, patch));
    const g = f.gate;
    return [
      head(`${t('bt.s.fence')} · ${fmtM(L)}`, t(`bt.ft.${f.type}`)),
      num({ key: 'fLen', label: t('bt.s.length'), value: r2(L), min: 0.3, max: 80, step: 0.1, coarse: 0.5, onSet: (v) => set({ x1: r2(f.x0 + ux * v), z1: r2(f.z0 + uz * v) }) }),
      num({ key: 'fH', label: t('bt.s.height'), value: f.h ?? 1.8, min: 0.6, max: 3, step: 0.1, onSet: (v) => set({ h: v }) }),
      seg('fType', t('bt.o.ftype'), FENCE_TYPES.map((k) => ({ value: k, label: t(`bt.ft.${k}`) })), f.type, (v) => set({ type: v }), 'seg-wrap'),
      pickColors('fColor', t('bt.o.fcolor'), hexList(FENCE_COLORS), f.color ?? FENCE_COLORS[0], (p) => set({ color: p.hex })),
      h('div', { class: 'group' }, h('div', { class: 'lbl' }, t('bt.s.gate')), gateRows(f, L, set)),
      removeBtn(`${t('bt.s.remove')} ${t('bt.s.fence').toLowerCase()}`, () => removeSel(t('bt.s.fence'), () => store.removeFence(f.id))),
    ];
  }

  // Gates of a fence piece: a list when the engine stores `gates`, one `gate` on older stores.
  function gateRows(f, L, set) {
    const multi = Array.isArray(f.gates);
    const list = multi ? f.gates : (f.gate ? [f.gate] : []);
    const write = (next) => set(multi ? { gates: next } : { gate: next[0] ?? null });
    const rows = list.map((g, i) => h('div', { class: 'gate-row', 'data-key': `gate-row:${i}` },
      seg(`gKind${i}`, list.length > 1 ? `${t('bt.s.gate')} ${i + 1}` : null, ['peatonal', 'vehicular'].map((k) => ({ value: k, label: t(`bt.gk.${k}`) })), g.kind,
        (v) => write(list.map((x, j) => (j === i ? { ...x, kind: v, w: v === 'vehicular' ? 3.2 : 1 } : x)))),
      num({
        key: `gAt${i}`, label: t('bt.s.gateAt'), value: g.at, min: r2((g.w ?? 1) / 2 + 0.1), max: r2(Math.max((g.w ?? 1) / 2 + 0.1, L - (g.w ?? 1) / 2 - 0.1)), step: 0.1, coarse: 0.5,
        onSet: (v) => write(list.map((x, j) => (j === i ? { ...x, at: v } : x))),
      }),
      h('button', { type: 'button', class: 'btn btn-secondary btn-danger-outline', 'data-key': `gate-remove${i ? `:${i}` : ''}`, onclick: () => write(list.filter((_, j) => j !== i)) }, icon('trash-2', 22), t('bt.s.removeGate'))));
    const free = (w) => [0.5, 0.25, 0.75, 0.15, 0.85].map((q) => r2(L * q)).find((at) => at >= w / 2 + 0.1 && at <= L - w / 2 - 0.1 && list.every((g) => Math.abs(g.at - at) >= (g.w + w) / 2 + 0.1));
    const adds = !list.length || multi
      ? ['peatonal', 'vehicular'].map((k) => {
        const at = free(k === 'vehicular' ? 3.2 : 1);
        return h('button', {
          type: 'button', class: 'btn btn-secondary', 'data-key': `gate-add:${k}`, disabled: at == null,
          onclick: () => act(() => store.addGate(f.id, at, k), 'bt.gateFail'),
        }, icon('gate', 22), `${t('bt.s.addGate')}: ${t(`bt.gk.${k}`)}`);
      }) : [];
    return [...rows, ...adds];
  }

  function deselect() {
    b.sel = null;
    pzm?.deselect();
    tools.select(null);
    ui.stepChanged = true;
    render();
  }
  const hasSelection = () => isBuild() && ui.step === 2 && !ui.sub && (!!b.sel || !!pzm?.hasSelection());

  // ---------- mode switch (Casa step) ----------
  function modeCard() {
    if (!has('setMode') || isBuild()) return null;
    return h('button', {
      type: 'button', class: 'nav-card mode-card', 'data-key': 'mode-build', onclick: () => { ui.sub = 'modestart'; ui.stepChanged = true; render(); },
    },
    h('span', { class: 'nc-ico' }, icon('hammer', 30)),
    h('span', { class: 'nc-text' }, h('strong', null, t('bt.card.t')), h('span', null, t('bt.card.d'))),
    h('span', { class: 'chev' }, icon('chevron-right', 22)));
  }
  const hasWork = () => (bd()?.levels ?? []).some((l) => (l.walls?.length ?? 0) > 0) || (bd()?.fences?.length ?? 0) > 0;
  // from = 'resume' keeps his hand-built house (setMode('build') with no `from`); the others start over.
  function startBuild(from) {
    if (!act(() => (from === 'resume' ? store.setMode('build') : store.setMode('build', { from })), 'bt.start.fail')) return;
    ui.sub = null;
    ui.step = 2;
    ui.stepChanged = true;
    b.level = 0;
    b.sel = null;
    toast(t('bt.mode.on'));
    render();
  }
  async function restart(from) {
    if (!(await confirmDialog({ title: t('bt.again.title'), body: t('bt.again.body'), ok: t('bt.again.ok') }))) return;
    startBuild(from);
  }
  function startSub() {
    const card = (key, ico, title, desc, onclick, cls = '') => h('button', { type: 'button', class: `start-card ${cls}`, 'data-key': key, onclick },
      h('span', { class: 'nc-ico' }, icon(ico, 32)),
      h('span', { class: 'nc-text' }, h('strong', null, title), h('span', null, desc)));
    const work = hasWork();
    const starts = work
      ? [C.more({
        key: 'startAgain', label: t('bt.again.btn'), kids: [
          card('start-house', 'home', t('bt.start.house'), t('bt.start.houseD'), () => restart('house')),
          card('start-blank', 'map', t('bt.start.blank'), t('bt.start.blankD'), () => restart('blank')),
        ],
      })]
      : [
        card('start-house', 'home', t('bt.start.house'), t('bt.start.houseD'), () => startBuild('house')),
        card('start-blank', 'map', t('bt.start.blank'), t('bt.start.blankD'), () => startBuild('blank')),
      ];
    return [
      h('p', { class: 'hint-bar' }, icon('hammer', 20), t('bt.card.d')),
      work ? card('start-resume', 'hammer', t('bt.resume'), t('bt.resumeD'), () => startBuild('resume'), 'primary-card') : null,
      ...starts,
      card('start-remodel', 'remodel', t('rm.card'), t('rm.cardD'), () => { startBuild(work ? 'resume' : 'house'); if (isBuild()) { ui.sub = 'remodel'; ui.stepChanged = true; render(); } }),
    ].filter(Boolean);
  }

  // ---------- Remodelar (remodel an existing house: today vs after + the builder's list) ----------
  const rmOn = () => has('isRemodel') && store.isRemodel();
  const fmt1 = (v) => (Math.round(v * 10) / 10).toLocaleString(getLang() === 'en' ? 'en-US' : 'es-DO', { maximumFractionDigits: 1 });
  function remodelRows() {
    const info = store.remodelInfo?.();
    if (!info) return [];
    const T = info.totals, rows = [];
    const row = (kind, label, value) => rows.push({ kind, label, value });
    if (T.demolishN) row('gone', t('rm.demolish'), t('rm.wallsN', { n: T.demolishN, m: fmt1(T.demolishM) }));
    if (T.addN) row('new', t('rm.addWalls'), t('rm.wallsN', { n: T.addN, m: fmt1(T.addM) }));
    if (T.doorsNew) row('new', t('rm.doors'), String(T.doorsNew));
    if (T.windowsNew) row('new', t('rm.windows'), String(T.windowsNew));
    if (T.closed) row('gone', t('rm.closed'), String(T.closed));
    if (T.slabsNew) row('new', t('rm.slabsNew'), String(T.slabsNew));
    if (T.slabsGone) row('gone', t('rm.slabsGone'), String(T.slabsGone));
    if (T.levelsAfter !== T.levelsBefore) row(T.levelsAfter > T.levelsBefore ? 'new' : 'gone', t('rm.levels'), `${T.levelsBefore} → ${T.levelsAfter}`);
    if (T.roofChanged) row('new', t('rm.roof'), `${t(`roof.${info.roofBefore.type}`)} → ${t(`roof.${info.roofAfter.type}`)} · ${t(`mat.${info.roofAfter.material}`)}`);
    if (rows.length && Math.abs(T.areaAfter - T.areaBefore) > 0.05) {
      const d = T.areaAfter - T.areaBefore;
      row('info', t('rm.area'), `${fmt1(T.areaBefore)} → ${fmt1(T.areaAfter)} m² (${d > 0 ? '+' : '−'}${fmt1(Math.abs(d))})`);
    }
    return rows;
  }
  async function shareRemodel() {
    const rows = remodelRows();
    const text = [t('rm.shareTitle', { name: store.get().name }), '', ...rows.map((r) => `${r.kind === 'gone' ? '🟥' : r.kind === 'new' ? '🟩' : '▫️'} ${r.label}: ${r.value}`)].join('\n');
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: t('rm.list'), text }); return; }
      await navigator.clipboard.writeText(text);
      toast(t('rm.copied'));
    } catch (e) {
      if (e?.name !== 'AbortError') toast(t('rm.shareFail'), { kind: 'bad' });
    }
  }
  async function startRemodel() {
    if (!hasWork()) { toast(t('rm.needHouse'), { kind: 'bad', ms: 4000 }); return; }
    if (!act(() => store.startRemodel(), 'bt.s.noChange')) return;
    toast(t('rm.started'));
    render();
  }
  async function resetRemodel() {
    if (!(await confirmDialog({ title: t('rm.reset.title'), body: t('rm.reset.body'), ok: t('rm.reset.ok') }))) return;
    if (act(() => store.resetRemodel())) render();
  }
  async function finishRemodel() {
    if (!(await confirmDialog({ title: t('rm.finish.title'), body: t('rm.finish.body'), ok: t('rm.finish.ok') }))) return;
    if (!act(() => store.finishRemodel())) return;
    engine.setRemodelView?.('after');
    toast(t('rm.done'));
    ui.sub = null;
    ui.stepChanged = true;
    render();
  }
  function keepChanging() {
    engine.setRemodelView?.('after');
    ui.sub = null;
    ui.stepChanged = true;
    openTab('pieces');
    render();
  }
  // Hoy | Después toggle + legend. Also used by the Ver step.
  function remodelToggle() {
    if (!rmOn()) return null;
    const cur = engine.getRemodelView?.() ?? 'after';
    const opt = (v, label, desc) => h('button', {
      type: 'button', role: 'radio', class: `rm-opt${cur === v ? ' on' : ''}`, 'aria-checked': String(cur === v), 'data-key': `rm-view:${v}`,
      onclick: () => { engine.setRemodelView?.(v); render(); },
    }, h('strong', null, label), h('span', null, desc));
    const marks = engine.getRemodelMarks?.() ?? true;
    return h('div', { class: 'rm-toggle-wrap' },
      h('div', { class: 'rm-toggle', role: 'radiogroup', 'aria-label': t('rm.viewing') },
        opt('before', t('rm.today'), t('rm.todayD')), opt('after', t('rm.after'), t('rm.afterD'))),
      h('div', { class: 'rm-legend' },
        h('span', { class: 'rm-key gone' }, h('i', { 'aria-hidden': 'true' }), t('rm.legend.gone')),
        h('span', { class: 'rm-key new' }, h('i', { 'aria-hidden': 'true' }), t('rm.legend.new'))),
      h('label', { class: 'rm-marks' },
        h('input', { type: 'checkbox', checked: marks, 'data-key': 'rm-marks', onchange: (e) => { engine.setRemodelMarks?.(e.target.checked); } }),
        h('span', null, t('rm.marks'))));
  }
  function remodelSub() {
    if (!rmOn()) {
      const step = (n, title, desc) => h('li', { class: 'rm-step' }, h('span', { class: 'mark' }, n), h('span', { class: 'nc-text' }, h('strong', null, title), h('span', null, desc)));
      const ready = hasWork();
      return [
        h('p', { class: 'hint-bar' }, icon('remodel', 20), t('rm.lede')),
        h('ol', { class: 'rm-steps' }, step('01', t('rm.s1'), t('rm.s1d')), step('02', t('rm.s2'), t('rm.s2d')), step('03', t('rm.s3'), t('rm.s3d'))),
        h('button', { type: 'button', class: 'btn btn-primary btn-xl', 'data-key': 'rm-start', 'aria-disabled': String(!ready), onclick: startRemodel }, icon('remodel', 26), t('rm.start')),
        ready ? null : h('p', { class: 'muted-p' }, t('rm.needHouse')),
      ].filter(Boolean);
    }
    const rows = remodelRows();
    return [
      remodelToggle(),
      h('div', { class: 'area-card rm-list', 'data-key': 'rm-list' },
        h('div', { class: 'lbl bt-tot-h' }, t('rm.list')),
        rows.length
          ? h('ul', { class: 'bt-tot' }, rows.map((r) => h('li', { class: `rm-row ${r.kind}` }, h('span', null, h('i', { 'aria-hidden': 'true' }), r.label), h('strong', { class: 'num' }, r.value))))
          : h('p', { class: 'bt-tot-empty' }, t('rm.none'))),
      h('button', { type: 'button', class: 'btn btn-primary btn-xl', 'data-key': 'rm-keep', onclick: keepChanging }, icon('layout-grid', 26), t('rm.keep')),
      rows.length ? h('button', { type: 'button', class: 'btn btn-secondary btn-xl', 'data-key': 'rm-share', onclick: shareRemodel }, icon('share-2', 24), t('rm.share')) : null,
      C.more({
        key: 'rmMore', kids: [
          h('button', { type: 'button', class: 'btn btn-secondary', 'data-key': 'rm-reset', onclick: resetRemodel }, icon('rotate-ccw', 22), t('rm.reset')),
          h('button', { type: 'button', class: 'btn btn-secondary', 'data-key': 'rm-finish', onclick: finishRemodel }, icon('check', 22), t('rm.finish')),
        ],
      }),
    ].filter(Boolean);
  }

  // ---------- fence drawing in automatic mode ----------
  function fenceCard() {
    if (!has('addFence')) return null;
    const fs = store.get().build?.fences ?? [];
    const metres = fs.reduce((s, f) => s + Math.hypot(f.x1 - f.x0, f.z1 - f.z0), 0);
    const custom = store.get().yard.fence === 'custom';
    return h('div', { class: 'group' },
      navCard('fence-draw', 'fence', t('bt.fence.draw'), t('bt.fence.drawD'), startFenceDraw),
      fs.length ? h('p', { class: 'muted-p' }, `${t('bt.fence.mine')}: ${t('bt.fence.sum', { m: metres.toFixed(1), n: fs.length })}`) : null,
      fs.length ? h('button', {
        type: 'button', class: 'btn btn-secondary', 'data-key': 'fence-toggle',
        onclick: () => store.set('yard.fence', custom ? 'none' : 'custom'),
      }, custom ? t('bt.fence.off') : t('bt.fence.on')) : null);
  }

  // ---------- Por dentro helper + Ver step ----------
  const levelCount = () => Math.max(1, levels().length);

  pzm = createPieces({ store, engine, ctx, ui, toast, b, act, render, getTools: () => tools, setLevel, levelRow, openDraw: openTab, previewHouse });
  paintBar({ tool: null });
  return {
    buildStep, roofSub, startSub, remodelSub, remodelToggle, rmOn, modeCard, fenceCard, deselect, hasSelection, syncStep, onView,
    enter, leave, startFenceDraw, stopAuto, totalsLine, levelCount, totals, isBuild, backToAuto, openTab,
    els: [bar, pzm.bar, cam], tools, state: b, barOn: () => !bar.hidden,
  };
}
