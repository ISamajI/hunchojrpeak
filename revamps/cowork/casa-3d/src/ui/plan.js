// Step 3, "Por dentro": the plan editor. The Plano view is on (engine.setPlanEdit), he taps a room,
// a half sheet opens with its exact size, type, width, move, floor and wall color. Furniture and
// whole-house finishes live one level down. The engine's plan API may land after this file, so
// every store/engine call is feature-detected and every failed action says why in words.
import * as S from '../state.js';
import { t, pick } from '../i18n.js';
import { h } from './dom.js';
import { icon, INDOOR_ICONS, ROOM_ICONS } from './icons.js';
import { confirmDialog } from './widgets.js';
import { createFloors } from './floors.js';
import { addRoom as dryAddRoom } from '../engine/plan.js';

const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

const WOODS = S.WOODS ?? [];
const COUNTERS = S.COUNTERS ?? [];
const INDOOR_TYPES = S.INDOOR_TYPES ?? [];
const CEILINGS = S.CEILINGS ?? [{ id: 'liso' }, { id: 'vigas' }];

const WALL_SWATCHES = [{ hex: '#f5f2ec', es: 'Blanco cálido', en: 'Warm white' }, ...S.PALETTES];
const sw = (hex, key) => ({ hex, key });
const SOFA = [sw('#b9b1a4', 'sand'), sw('#f4f1ea', 'bone'), sw('#9aa3a8', 'gray'), sw('#3b3d40', 'charcoal'),
  sw('#b8573a', 'terracotta'), sw('#1f4e79', 'navy'), sw('#2a7d4f', 'green'), sw('#d9a441', 'mustard')]
  .map((o) => ({ hex: o.hex, name: `sofa.${o.key}` }));
const CABINETS = [sw('#f4f1ea', 'white'), sw('#9aa3a8', 'gray'), sw('#3b3d40', 'charcoal'), sw('#b88a5e', 'oak'),
  sw('#6f5a48', 'walnut'), sw('#6b3b26', 'mahogany'), sw('#4f6f55', 'green'), sw('#1f4e79', 'navy')]
  .map((o) => ({ hex: o.hex, name: `cab.${o.key}` }));

const DEF = { wallColor: '#f5f2ec', sofa: '#b9b1a4', wood: 'medio', cabinets: '#6f5a48', counter: 'granito', ceiling: 'liso' };
const ADD_TYPES = ['dormitorio', 'bano', 'cocina', 'sala', 'comedor', 'estudio', 'lavado', 'closet'];
const round2 = (n) => Math.round(n * 100) / 100;
const f2 = (n) => (+n).toFixed(2);

export function createInterior({ store, engine, ctx, ui, toast, C, sync, render }) {
  const floors = createFloors({ store, toast, C });
  const I = () => ({ ...DEF, ...(store.get().interior ?? {}) });
  const isBuild = () => store.get().mode === 'build';
  // Hand-built houses have their own levels and no automatic plan to edit.
  const floorsCount = () => (isBuild() ? Math.max(1, store.get().build?.levels?.length ?? 1) : store.get().house.floors);
  const has = (fn) => typeof store[fn] === 'function';
  let editOn = false;
  let msgTimer = 0;

  // ---------- plan data ----------
  function planInfo(level) {
    if (isBuild()) return null;
    try { return store.planInfo?.(level) ?? null; } catch { return null; }
  }
  const roomsOf = (info) => (info ? [...(info.bands?.front ?? []), ...(info.bands?.back ?? [])] : []);

  function labelOf(r, list) {
    const eng = r.label ?? (engine.getRooms?.() ?? []).find((x) => x.key === r.id)?.label;
    if (eng) return eng;
    const peers = list.filter((x) => x.type === r.type);
    const base = r.type === 'pasillo' ? t('rt.pasillo') : t(`rt.${r.type}`);
    return peers.length > 1 ? `${base} ${peers.findIndex((x) => x.id === r.id) + 1}` : base;
  }

  // The selected room as one flat object, from the plan API when it exists, else from the engine list.
  function curRoom() {
    if (ui.room === 'all') return null;
    const list = roomsOf(planInfo(ui.level));
    const r = list.find((x) => x.id === ui.room);
    if (r) return { ...r, w: r.x1 - r.x0, d: r.z1 - r.z0, name: labelOf(r, list) };
    const er = (engine.getRooms?.() ?? []).find((x) => x.key === ui.room);
    if (er) return { id: er.key, type: er.type, area: er.area, name: er.type === 'pasillo' ? t('rt.pasillo') : (er.label ?? er.name), basic: true };
    ui.room = 'all';
    return null;
  }
  const hasSelection = () => ui.step === 3 && !ui.sub && !!curRoom();

  const overrides = (key) => store.get().interior?.rooms?.[key] ?? {};

  // ---------- messages + actions ----------
  function say(text) {
    ui.msg = text;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { ui.msg = null; if (ui.step === 3) render(); }, 5500);
    render();
  }
  const msgNode = () => (ui.msg ? h('p', { class: 'inline-msg', role: 'alert', 'data-key': 'plan-msg' }, icon('help-circle', 22), ui.msg) : null);

  // Run a store action; a `false` answer means "can't" and we tell him in plain words.
  function act(fn, failKey) {
    let ok = false;
    try { ok = fn(); } catch { ok = false; }
    if (ok === false || ok == null) say(t(failKey));
    else { ui.msg = null; render(); }
    return !!ok;
  }

  // ---------- engine bridge ----------
  const highlight = () => engine.highlightRoom?.(ui.room === 'all' ? null : ui.room);

  function showLevel() {
    if (ui.view === 'plan') {
      if (engine.setLevel) engine.setLevel(ui.level); else engine.setCutaway?.(ui.level);
      engine.resetCamera?.();
    } else engine.viewInterior?.(ui.level);
    highlight();
  }
  // Plan editing is on only while this step shows the Plano view.
  function syncEdit() {
    const on = ui.step === 3 && ui.view === 'plan' && !isBuild();
    if (on !== editOn) { editOn = on; engine.setPlanEdit?.(on); }
  }
  function enter() {
    ui.prevView = ui.view;
    ctx.setViewMode('plan');
    showLevel();
    syncEdit();
  }
  function leave() {
    clearTimeout(msgTimer);
    ui.room = 'all';
    ui.sub = null;
    ui.msg = null;
    engine.highlightRoom?.(null);
    editOn = false;
    engine.setPlanEdit?.(false);
    if ((ui.view === 'plan' || ui.view === 'inside') && ui.prevView !== 'plan' && ui.prevView !== 'inside') ctx.setViewMode(ui.prevView ?? '3d');
  }
  function clampLevel() {
    const max = floorsCount() - 1;
    if (ui.level > max) { ui.level = max; ui.room = 'all'; showLevel(); }
  }
  // Picks from the 3D/plan view: jump to a level, a room or a loose piece of furniture.
  function focus({ level, room, indoor }) {
    const moved = level != null && Math.min(level, floorsCount() - 1) !== ui.level;
    if (level != null) ui.level = Math.min(level, floorsCount() - 1);
    if (room !== undefined) { ui.room = room; ui.msg = null; }
    if (indoor !== undefined) ui.hiIndoor = indoor;
    if (ui.step === 3) { if (moved) showLevel(); else highlight(); }
  }
  function deselect() {
    ui.room = 'all';
    ui.msg = null;
    highlight();
    ui.stepChanged = true;
    render();
  }
  function zoom(dir) {
    if (engine.zoomPlan) { engine.zoomPlan(dir > 0 ? 1.3 : 1 / 1.3); return; }
    const c = document.querySelector('#stage canvas');
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.dispatchEvent(new WheelEvent('wheel', { deltaY: dir > 0 ? -600 : 600, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true }));
  }
  const zoomBtns = () => h('div', { class: 'zoom-btns' },
    h('button', { type: 'button', class: 'btn btn-secondary zoom-btn', 'data-key': 'zoom-out', 'aria-label': t('plan.zoomOut'), onclick: () => zoom(-1) }, icon('zoom-out', 24)),
    h('button', { type: 'button', class: 'btn btn-secondary zoom-btn', 'data-key': 'zoom-in', 'aria-label': t('plan.zoomIn'), onclick: () => zoom(1) }, icon('zoom-in', 24)));

  // ---------- writers ----------
  const roomPath = (key, f) => `interior.rooms.${key}.${f}`;
  function setWall(key, hex) {
    if (key === 'all') { store.set('interior.wallColor', hex); return; }
    store.setRoom?.(key, 'wall', hex);
    if (!same(overrides(key).wall ?? '', hex)) store.set(roomPath(key, 'wall'), hex);
  }

  // ---------- room sheet ----------
  const sizeLine = (r) => (r.w != null
    ? `${f2(r.w)} × ${f2(r.d)} ${t('unit.m')} · ${(+r.area).toFixed(1)} m²`
    : `${(+r.area).toFixed(1)} m²`);

  function typePicker(r) {
    if (r.type === 'pasillo' || r.basic) return null;
    if (r.type === 'escalera') return h('p', { class: 'muted-p' }, t('plan.stairsFixed'));
    if (!has('setRoomType') || r.canRetype === false) return null;
    const types = ADD_TYPES.includes(r.type) ? ADD_TYPES : [...ADD_TYPES, r.type];
    return C.choice({
      key: 'roomType', label: t('plan.type'), cards: true, cls: 'cols-3 type-cards', value: r.type,
      options: types.map((type) => ({ value: type, body: [icon(ROOM_ICONS[type] ?? 'home', 30), h('span', { class: 'oc-name' }, t(`rt.${type}`))] })),
      onSet: (v) => act(() => store.setRoomType(r.id, v), r.type === 'bano' ? 'plan.needBath' : 'plan.noType'),
    });
  }

  // Changing the room type is rare, so it hides behind one button.
  function typeMore(r) {
    const picker = typePicker(r);
    return picker ? C.more({ key: 'roomTypeMore', label: t('plan.changeType'), kids: [picker] }) : null;
  }

  function widthRow(r) {
    if (!has('setRoomWidth') || r.w == null) return null;
    const set = (v) => act(() => store.setRoomWidth(r.id, round2(v)), 'plan.noWidth');
    const fine = (d) => h('button', {
      type: 'button', class: 'btn btn-secondary move-btn', 'data-key': d < 0 ? 'roomWf-' : 'roomWf+', 'aria-label': `${t('plan.fine')} ${d > 0 ? '+' : '−'}0.1`,
      onclick: () => set(r.w + d / 10),
    }, icon(d > 0 ? 'plus' : 'minus', 20), d > 0 ? '+0.1' : '−0.1');
    return h('div', { class: 'group' },
      C.stepper({
        key: 'roomW', label: t('plan.width'), value: r.w, min: 0, max: 99, step: 0.5,
        fmt: (v) => `${f2(v)} ${t('unit.m')}`, minusText: '−0.5', plusText: '+0.5', onSet: set,
      }),
      h('div', { class: 'lbl small-lbl' }, t('plan.fine')),
      h('div', { class: 'move-row' }, fine(-1), fine(1)));
  }

  function moveRow(r) {
    if (!has('moveRoom') || r.basic || r.type === 'pasillo') return null;
    const b = (dir, ico, key) => h('button', {
      type: 'button', class: 'btn btn-secondary move-btn', 'data-key': dir < 0 ? 'room-left' : 'room-right',
      onclick: () => act(() => store.moveRoom(r.id, dir), 'plan.noMove'),
    }, dir < 0 ? icon(ico, 22) : null, t(key), dir > 0 ? icon(ico, 22) : null);
    return h('div', { class: 'group', role: 'group', 'aria-label': t('plan.move') },
      h('div', { class: 'lbl' }, t('plan.move')),
      h('div', { class: 'move-row' }, b(-1, 'arrow-left', 'move.left'), b(1, 'arrow-right', 'move.right')));
  }

  function removeBtn(r) {
    if (!has('removeRoom') || r.basic || r.type === 'pasillo') return null;
    if (r.canDelete === false) return h('p', { class: 'muted-p' }, t(r.type === 'bano' ? 'plan.needBath' : 'plan.cantRemove'));
    return h('button', {
      type: 'button', class: 'btn btn-secondary btn-danger-outline', 'data-key': 'room-remove',
      onclick: () => {
        const name = r.name;
        let ok = false;
        try { ok = store.removeRoom(r.id); } catch { ok = false; }
        if (!ok) { say(t(r.type === 'bano' ? 'plan.needBath' : 'plan.noRemove')); return; }
        ui.room = 'all';
        ui.msg = null;
        engine.highlightRoom?.(null);
        toast(t('plan.removed', { name }), { action: { label: t('top.undo'), onClick: () => ctx.undo() } });
        ui.stepChanged = true;
        render();
      },
    }, icon('trash-2', 22), t('plan.remove'));
  }

  function wallSection(r) {
    const i = I();
    return C.colorGroup({
      key: 'wall', label: t('int.wall'), list: WALL_SWATCHES, value: overrides(r.id).wall || i.wallColor,
      customPath: roomPath(r.id, 'wall'),
      onPick: (p) => { setWall(r.id, p.hex); toast(t('toast.painted', { name: pick(p) })); },
    });
  }

  function roomView(r) {
    return [
      h('div', { class: 'room-head' },
        h('div', { class: 'room-title', 'aria-live': 'polite' },
          h('h2', { class: 'step-title', 'data-key': 'room-name' }, r.name),
          h('p', { class: 'room-size num', 'data-key': 'room-size' }, sizeLine(r))),
        zoomBtns()),
      msgNode(),
      floors.section(r.id),
      widthRow(r),
      wallSection(r),
      typeMore(r),
      moveRow(r),
      removeBtn(r),
    ].filter(Boolean);
  }

  // ---------- plan overview ----------
  function viewToggle() {
    return C.choice({
      key: 'planView', label: null, value: ui.view === 'plan' || ui.view === 'inside' ? ui.view : '', cls: 'view-toggle',
      options: [{ value: 'plan', body: [icon('layout-grid', 22), t('view.top')] }, { value: 'inside', body: [icon('box', 22), t('plan.in3d')] }],
      onSet: (v) => { ctx.setViewMode(v); showLevel(); render(); },
    });
  }

  function levelRow() {
    const n = floorsCount();
    return h('div', { class: 'level-row' },
      n > 1
        ? C.choice({
          key: 'int.level', value: ui.level, cls: 'level-pills',
          options: Array.from({ length: n }, (_, i) => ({ value: i, label: t('int.levelN', { n: i + 1 }) })),
          onSet: (v) => { ui.level = v; ui.room = 'all'; ui.hiIndoor = null; showLevel(); render(); },
        })
        : h('span', { class: 'lbl' }, t('int.levelN', { n: 1 })),
      zoomBtns());
  }

  function roomList(info) {
    const list = roomsOf(info);
    const items = list.length ? list.map((r) => ({ id: r.id, type: r.type, name: labelOf(r, list), size: `${f2(r.x1 - r.x0)} × ${f2(r.z1 - r.z0)}` }))
      : (engine.getRooms?.() ?? []).filter((r) => r.level === ui.level && !r.hidden && r.type !== 'pasillo').map((r) => ({ id: r.key, type: r.type, name: r.name, size: `${(+r.area).toFixed(1)} m²` }));
    if (!items.length) return h('p', { class: 'muted-p' }, t(isBuild() ? 'bt.inside.none' : 'int.noRooms'));
    return h('div', { class: 'group' },
      h('div', { class: 'lbl' }, t('plan.roomsHere')),
      h('div', { class: 'room-list' }, items.map((r) => h('button', {
        type: 'button', class: 'btn btn-secondary room-chip', 'data-key': `room:${r.id}`,
        onclick: () => { ctx.clearHint?.(); focus({ room: r.id }); ctx.setSheet?.('half'); ui.stepChanged = true; render(); },
      }, icon(ROOM_ICONS[r.type] ?? 'home', 24), h('span', { class: 'rc-text' }, h('strong', null, r.name), h('span', { class: 'num' }, r.size))))));
  }

  const navCard = (key, ico, title, desc, sub) => h('button', {
    type: 'button', class: 'nav-card', 'data-key': key, onclick: () => { ui.sub = sub; ui.stepChanged = true; render(); },
  }, h('span', { class: 'nc-ico' }, icon(ico, 28)),
  h('span', { class: 'nc-text' }, h('strong', null, title), h('span', null, desc)),
  h('span', { class: 'chev' }, icon('chevron-right', 22)));

  function moreOptions(info) {
    const kids = [];
    if (has('setFrontDepth') && info?.frontDepth != null) {
      kids.push(h('div', { class: 'group' },
        C.stepper({
          key: 'frontDepth', label: t('plan.frontDepth'), value: info.frontDepth, min: info.frontRange?.[0] ?? 0, max: info.frontRange?.[1] ?? 99, step: 0.25,
          fmt: (v) => `${f2(v)} ${t('unit.m')}`, minusText: '−0.25', plusText: '+0.25',
          onSet: (v) => act(() => store.setFrontDepth(round2(v)), 'plan.noDepth'),
        }),
        h('p', { class: 'muted-p' }, t('plan.frontDepthHint'))));
    }
    if (has('resetPlan') && info?.custom) {
      kids.push(h('button', {
        type: 'button', class: 'btn btn-secondary', 'data-key': 'plan-reset',
        onclick: async () => {
          if (!(await confirmDialog({ title: t('plan.reset.title'), body: t('plan.reset.body'), ok: t('plan.reset.ok') }))) return;
          ui.room = 'all';
          if (act(() => store.resetPlan(), 'plan.noReset')) toast(t('plan.reset.done'));
        },
      }, icon('rotate-cw', 22), t('plan.reset')));
    }
    return kids.length ? C.more({ key: 'planMore', kids }) : null;
  }

  function planView() {
    const info = planInfo(ui.level);
    return [
      viewToggle(),
      levelRow(),
      h('p', { class: 'hint-bar' }, icon('layout-grid', 20), isBuild() ? t('bt.inside.hint') : ui.view === 'plan' ? t('plan.hint') : ui.view === 'inside' ? t('plan.hint3d') : t('plan.hintOther')),
      msgNode(),
      has('addRoom') && !isBuild() ? h('button', {
        type: 'button', class: 'btn btn-primary btn-xl', 'data-key': 'room-add',
        onclick: () => { ui.sub = 'addroom'; ui.addBand = null; ui.msg = null; ui.stepChanged = true; render(); },
      }, icon('plus', 24), t('plan.add')) : null,
      roomList(info),
      isBuild() ? null : navCard('nav-home', 'paintbrush', t('plan.home'), t('plan.homeD'), 'home'),
      navCard('nav-furnish', 'sofa', t('plan.furnish'), t('plan.furnishD'), 'furnish'),
      moreOptions(info),
    ].filter(Boolean);
  }

  // ---------- sub-screens ----------
  const bandPic = (band) => h('span', { class: `band-pic ${band}`, 'aria-hidden': 'true' }, h('span'), h('span'));

  // Would this room fit? Asks the plan code directly (read-only), so the cards can say "No cabe" up front.
  function fits(type, band) {
    try { return !!dryAddRoom(store.get().house, ui.level, band, type); } catch { return true; }
  }

  function addRoomView() {
    ui.addType ??= 'dormitorio';
    const ok = { front: fits(ui.addType, 'front'), back: fits(ui.addType, 'back') };
    if (!ui.addBand || !ok[ui.addBand]) ui.addBand = ok.front || !ok.back ? 'front' : 'back';
    if (!ok.front && ok.back) ui.addBand = 'back';
    return [
      msgNode(),
      !ok.front && !ok.back ? h('p', { class: 'inline-msg', role: 'alert' }, icon('help-circle', 22), t('plan.noFit')) : null,
      C.choice({
        key: 'addType', label: t('plan.addWhat'), cards: true, cls: 'cols-3 type-cards', value: ui.addType,
        options: ADD_TYPES.map((type) => ({ value: type, body: [icon(ROOM_ICONS[type], 30), h('span', { class: 'oc-name' }, t(`rt.${type}`))] })),
        onSet: (v) => { ui.addType = v; render(); },
      }),
      C.choice({
        key: 'addBand', label: t('plan.addWhere'), cards: true, cls: 'cols-2 band-cards', value: ui.addBand,
        options: ['front', 'back'].map((band) => ({
          value: band, disabled: !ok[band],
          body: [bandPic(band), h('span', { class: 'oc-name' }, t(`plan.${band}`)), h('span', { class: 'oc-desc' }, ok[band] ? t(`plan.${band}D`) : t('plan.noFitShort'))],
        })),
        onSet: (v) => { ui.addBand = v; render(); },
      }),
    ].filter(Boolean);
  }

  // "Agregar este cuarto" (the panel foot button on the add-room screen).
  function confirmAdd() {
    const before = new Set(roomsOf(planInfo(ui.level)).map((r) => r.id));
    let ok = false;
    try { ok = store.addRoom(ui.level, ui.addBand, ui.addType); } catch { ok = false; }
    if (!ok) { say(t('plan.noFit')); return; }
    const added = roomsOf(planInfo(ui.level)).find((r) => !before.has(r.id));
    ui.sub = null;
    ui.msg = null;
    ui.room = added?.id ?? 'all';
    highlight();
    ctx.setSheet?.('half');
    ui.stepChanged = true;
    toast(t('plan.added', { name: t(`rt.${ui.addType}`) }));
    render();
  }

  function homeView() {
    const i = I();
    return [
      h('p', { class: 'hint-bar' }, icon('home', 20), t('plan.homeHint')),
      C.colorGroup({
        key: 'wall', label: t('int.wallAll'), list: WALL_SWATCHES, value: i.wallColor, customPath: 'interior.wallColor',
        onPick: (p) => { setWall('all', p.hex); toast(t('toast.painted', { name: pick(p) })); },
      }),
      floors.section(null),
    ];
  }

  // ---------- furniture + finishes ----------
  function chipsOf(key, label, list, value, onSet, withDot) {
    return C.choice({
      key, label, value, cls: 'int-chips',
      options: list.map((o) => ({
        value: o.id,
        body: [withDot ? h('span', { class: 'chip-dot', 'data-c': o.id, style: o.hex ? { background: o.hex } : null }) : null,
          h('span', null, o.name ? t(o.name) : pick(o))],
      })),
      onSet,
    });
  }

  const typeName = (type) => pick(INDOOR_TYPES.find((x) => x.id === type)) || type;

  function addItem(type) {
    let id;
    if (store.addIndoorItem) id = store.addIndoorItem(type, ui.level);
    else {
      id = Math.random().toString(36).slice(2, 9);
      const list = store.get().interior?.items ?? [];
      store.set('interior.items', [...list, { id, type, level: ui.level, x: 0, z: 0, rot: 0 }]);
    }
    ui.hiIndoor = id;
    ui.reveal = { type: 'indoor', id };
    toast(t('toast.indoorAdded', { item: typeName(type) }));
    render();
  }
  function rotateItem(it) {
    if (store.rotateIndoorItem) store.rotateIndoorItem(it.id);
    else {
      const idx = (store.get().interior?.items ?? []).findIndex((x) => x.id === it.id);
      if (idx >= 0) store.set(`interior.items.${idx}.rot`, ((it.rot ?? 0) + Math.PI / 2) % (Math.PI * 2));
    }
  }
  function removeItem(it) {
    toast(t('toast.itemRemoved', { item: typeName(it.type) }));
    if (ui.hiIndoor === it.id) ui.hiIndoor = null;
    if (store.removeIndoorItem) store.removeIndoorItem(it.id);
    else store.set('interior.items', (store.get().interior?.items ?? []).filter((x) => x.id !== it.id));
  }

  function itemRow(it, n) {
    return h('li', { class: `item-row${ui.hiIndoor === it.id ? ' hi' : ''}`, 'data-indoor': it.id },
      h('span', { class: 'ir-name' }, icon(INDOOR_ICONS[it.type] ?? 'armchair', 24), `${typeName(it.type)} ${n}`),
      h('span', { class: 'ir-actions' },
        h('button', { type: 'button', class: 'btn btn-secondary', 'data-key': `irot:${it.id}`, onclick: () => rotateItem(it) }, icon('rotate-cw', 20), t('item.rotate')),
        h('button', { type: 'button', class: 'btn btn-secondary btn-danger-outline', 'data-key': `irm:${it.id}`, onclick: () => removeItem(it) }, icon('trash-2', 20), t('item.remove'))));
  }

  function furnishView() {
    const i = I();
    const items = (store.get().interior?.items ?? []).filter((x) => (x.level ?? 0) === ui.level);
    const seen = {};
    return [
      h('div', { class: 'int-sec', 'data-sec': 'furn' },
        C.colorGroup({ key: 'sofa', label: t('int.sofa'), list: SOFA, value: i.sofa, customPath: 'interior.sofa', onPick: (p) => store.set('interior.sofa', p.hex) }),
        chipsOf('wood', t('int.wood'), WOODS, i.wood, (v) => store.set('interior.wood', v), true),
        C.colorGroup({ key: 'cabinets', label: t('int.cabinets'), list: CABINETS, value: i.cabinets, customPath: 'interior.cabinets', onPick: (p) => store.set('interior.cabinets', p.hex) }),
        chipsOf('counter', t('int.counter'), COUNTERS, i.counter, (v) => store.set('interior.counter', v), true),
        chipsOf('ceiling', t('int.ceiling'), CEILINGS.map((c) => ({ id: c.id, name: `ceil.${c.id}` })), i.ceiling, (v) => store.set('interior.ceiling', v))),
      h('div', { class: 'int-sec', 'data-sec': 'add' },
        h('h3', { class: 'sec' }, t('int.add')),
        h('div', { class: 'catalog' }, INDOOR_TYPES.map((it) => h('button', {
          type: 'button', class: 'btn btn-secondary cat-btn', 'data-key': `iadd:${it.id}`, onclick: () => addItem(it.id),
        }, icon(INDOOR_ICONS[it.id] ?? 'armchair', 26), h('span', null, pick(it))))),
        h('p', { class: 'hint-bar' }, icon('footprints', 20), t('int.addHint')),
        h('h3', { class: 'sec' }, `${t('int.placed')} (${t('int.levelN', { n: ui.level + 1 })})`),
        items.length
          ? h('ul', { class: 'item-list' }, items.map((it) => { seen[it.type] = (seen[it.type] ?? 0) + 1; return itemRow(it, seen[it.type]); }))
          : h('p', { class: 'muted-p' }, t('int.empty'))),
    ];
  }

  // ---------- entry points for the panel ----------
  function build() {
    clampLevel();
    syncEdit();
    const r = curRoom();
    return r ? roomView(r) : planView();
  }
  function buildSub(sub) {
    clampLevel();
    if (sub === 'addroom') return addRoomView();
    if (sub === 'home') return homeView();
    return furnishView();
  }

  return { build, buildSub, confirmAdd, enter, leave, focus, hasSelection, syncEdit, showLevel, deselect, curRoom };
}
