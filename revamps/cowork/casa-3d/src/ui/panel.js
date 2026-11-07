// The panel (left card on desktop, bottom sheet on phones) and the three modes: Diseñar | Construir | Ver.
// Diseñar is a tile menu (Terreno, Estilo, Tamaño, Colores, Techo y ventanas, Detalles y patio, Por dentro), each tile opens
// one sub-screen with a big Volver. Construir is Piezas | Dibujar | Por dentro. Never deeper than that.
// Internally the old step numbers stay: 2 = Diseñar menu / Construir, 3 = Por dentro, 4 = Ver (1 = Terreno is now a sub-screen of 2).
import * as S from '../state.js';
import { LIMITS, STYLES, PALETTES, ITEM_TYPES, LOT_PRESETS, offsetLimits } from '../state.js';
import { poolRect } from '../engine/site.js';
import { t, pick, applyI18n, onLang } from '../i18n.js';
import { h, getPath, reducedMotion } from './dom.js';
import { icon, ITEM_ICONS } from './icons.js';
import { createControls, radioKeys } from './controls.js';
import { confirmDialog } from './widgets.js';
import { createInterior } from './plan.js';
import { createBuild } from './build.js';

const MODES = [
  { id: 'design', ico: 'layout-dashboard', key: 'mode.design', n: '01' },
  { id: 'build', ico: 'hammer', key: 'mode.build', n: '02' },
  { id: 'see', ico: 'eye', key: 'mode.see', n: '03' },
];

// The tiles of the Diseñar menu (the numbers are section marks, not progress).
const TILES = [
  { id: 'land', ico: 'map', key: 'design.land', n: '01', wide: true },
  { id: 'style', ico: 'sparkles', key: 'casa.style', n: '02' },
  { id: 'size', ico: 'ruler', key: 'casa.size', n: '03' },
  { id: 'colors', ico: 'paintbrush', key: 'casa.colors', n: '04' },
  { id: 'roof', ico: 'window', key: 'casa.roof', n: '05' },
  { id: 'extras', ico: 'trees', key: 'casa.extras', n: '06' },
  { id: 'inside', ico: 'layout-grid', key: 'design.inside', n: '07' },
];

const PARTS = [
  { id: 'walls', path: 'house.colors.walls' },
  { id: 'roof', path: 'house.roof.color' },
  { id: 'trim', path: 'house.colors.trim' },
  { id: 'door', path: 'house.colors.door' },
  { id: 'windows', path: 'house.colors.windows' },
  { id: 'base', path: 'house.colors.base' },
  { id: 'accent', path: 'house.colors.accent' },
  { id: 'fence', path: 'yard.fenceColor' },
];

const SCENERY = [
  { value: 'mountains', ico: 'mountain' },
  { value: 'sea', ico: 'waves' },
  { value: 'countryside', ico: 'wheat' },
];

const DETAIL_TOGGLES = [
  { path: 'house.porch', key: 'det.porch', ico: 'columns-3' },
  { path: 'house.balcony', key: 'det.balcony', ico: 'door-open', needs: 'floors' },
  { path: 'house.carport', key: 'det.carport', ico: 'car', extra: 'carportSide' },
  { path: 'house.roofTerrace', key: 'det.roofTerrace', ico: 'building-2', needs: 'flat' },
  { path: 'house.waterTank', key: 'det.waterTank', ico: 'container' },
  { path: 'house.solar', key: 'det.solar', ico: 'solar' },
  { path: 'house.windowBars', key: 'det.windowBars', ico: 'grid-3x3' },
];
const YARD_TOGGLES = [
  { path: 'yard.pool', key: 'det.pool', ico: 'droplets' },
  { path: 'yard.driveway', key: 'det.driveway', ico: 'route' },
  { path: 'yard.garden', key: 'det.garden', ico: 'flower-2' },
];

// New detail settings (core exports them; local copies keep the UI alive until it lands).
const COLUMN_STYLES = S.COLUMN_STYLES ?? ['square', 'round', 'classic'].map((id) => ({ id }));
const RAILINGS = S.RAILINGS ?? ['iron', 'balusters', 'glass', 'concrete'].map((id) => ({ id }));
const DOOR_STYLES = S.DOOR_STYLES ?? ['panel', 'double', 'glass'].map((id) => ({ id }));
const OUT_FLOORS = S.OUT_FLOORS ?? ['tile', 'terracotta', 'concrete'].map((id) => ({ id }));
const LIM_HEIGHT = LIMITS.floorHeight ?? [2.7, 3.6];
const LIM_EAVES = LIMITS.eaves ?? [0.2, 1.2];
const OUT_PREVIEW = { tile: 'ceramica', terracotta: 'terracota', concrete: 'cemento' };
const RAIL_ICONS = { iron: 'grid-3x3', balusters: 'columns-3', glass: 'image', concrete: 'brick-wall' };

const round2 = (n) => Math.round(n * 100) / 100;
const fmtM = (v) => `${+(+v).toFixed(2)} ${t('unit.m')}`;
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

export function createPanel(ctx) {
  const { store, engine, ui, toast } = ctx;
  // A custom plan may have no width left for another room: say so instead of doing nothing.
  const setCount = (k, v) => {
    const before = store.get().house[k];
    store.set(`house.${k}`, v);
    if (v > before && store.get().house[k] <= before) toast(t('size.noFit'), { kind: 'bad', ms: 4500 });
  };
  const sync = { busy: false, list: [] };
  const C = createControls({ store, sync, ui, render: () => render() });
  let stats = null;
  let lastSig = '';
  let shown = null;
  let roomsSig = '';

  // ---------- helpers ----------
  const setMany = (pairs) => {
    for (const [p, v] of pairs) store.patch(p, v);
    store.commit();
  };

  const colorName = (hex) => {
    const p = PALETTES.find((x) => same(x.hex, hex));
    return p ? pick(p) : t('color.custom');
  };

  const itemLabel = (type) => pick(ITEM_TYPES.find((i) => i.id === type)) || type;

  const stylePristine = (s) => {
    const st = STYLES.find((x) => x.id === s.house.style);
    if (!st) return true;
    const c = st.house.colors;
    return Object.keys(c).every((k) => same(c[k], s.house.colors[k]))
      && same(st.house.roof.color, s.house.roof.color)
      && same(st.yard.fenceColor, s.yard.fenceColor);
  };

  const areaOf = (s) => {
    const fp = s.house.width * s.house.depth;
    return { area: Math.round(fp * s.house.floors), footprint: Math.round(fp) };
  };

  // ---------- steps ----------
  function stepLand(s) {
    const L = s.land;
    const hasPhoto = !!L.photo;
    const fileInput = h('input', {
      type: 'file', accept: 'image/*', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true', id: 'photo-input',
      onchange: async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        photoBtnBusy(true);
        try {
          const url = await engine.loadPhoto(file);
          store.set('land.photo', url);
          store.set('land.mode', 'photo');
          toast(t('toast.photoLoaded'));
        } catch {
          toast(t('err.photo'), { kind: 'bad', ms: 4500 });
        } finally {
          photoBtnBusy(false);
        }
      },
    });
    let uploadBtn;
    const photoBtnBusy = (on) => {
      if (!uploadBtn?.isConnected) return;
      uploadBtn.disabled = on;
      uploadBtn.querySelector('.btn-txt').textContent = on ? t('photo.loading') : hasPhoto ? t('land.changePhoto') : t('land.upload');
    };
    uploadBtn = h('button', { type: 'button', class: 'btn btn-secondary', 'data-key': 'photo-upload', onclick: () => fileInput.click() },
      icon(hasPhoto ? 'image' : 'upload', 22), h('span', { class: 'btn-txt' }, hasPhoto ? t('land.changePhoto') : t('land.upload')));

    const modeGroup = C.choice({
      key: 'land.mode', label: t('land.mode'), cards: true, cls: 'cols-2',
      value: L.mode,
      options: [
        { value: 'generated', body: [icon('mountain', 30), h('span', { class: 'oc-name' }, t('land.generated'))] },
        { value: 'photo', body: [icon('image', 30), h('span', { class: 'oc-name' }, t('land.photo'))] },
      ],
      onSet: (v) => {
        if (v === 'photo' && !hasPhoto) { fileInput.click(); return; }
        store.set('land.mode', v);
      },
    });

    const presets = h('div', { class: 'preset-row' }, LOT_PRESETS.map((p) => h('button', {
      type: 'button', class: 'btn btn-secondary preset', 'data-key': `preset-${p.id}`,
      'aria-pressed': L.width === p.w && L.depth === p.d,
      onclick: () => setMany([['land.width', p.w], ['land.depth', p.d]]),
    }, h('span', { class: 'preset-name' }, pick(p)), h('span', { class: 'preset-dim num' }, `${p.w}×${p.d} ${t('unit.m')}`))));

    const showSeed = L.mode === 'generated' || L.photoMode === 'backdrop';

    return [
      modeGroup,
      fileInput,
      h('div', { class: 'btn-row' },
        showSeed ? h('button', { type: 'button', class: 'btn btn-secondary', 'data-key': 'seed', onclick: () => store.set('land.seed', Math.floor(Math.random() * 1e6)) }, icon('dices', 22), t('land.another')) : null,
        uploadBtn,
        hasPhoto ? h('button', {
          type: 'button', class: 'btn btn-secondary', 'data-key': 'photo-remove',
          onclick: async () => {
            if (!(await confirmDialog({ title: t('confirm.photo.title'), ok: t('confirm.photo.ok') }))) return;
            store.patch('land.photo', null);
            store.patch('land.mode', 'generated');
            store.commit();
          },
        }, icon('trash-2', 22), t('land.removePhoto')) : null),
      hasPhoto ? h('div', { class: 'photo-card' },
        h('img', { src: L.photo, alt: t('photo.alt'), width: 160, height: 100 }),
        C.choice({
          key: 'land.photoMode', label: t('land.photoMode'), value: L.photoMode,
          options: [{ value: 'ground', label: t('photo.ground') }, { value: 'backdrop', label: t('photo.backdrop') }],
          onSet: (v) => store.set('land.photoMode', v),
        })) : null,
      C.choice({
        key: 'land.scenery', label: t('land.scenery'), cards: true, cls: 'cols-3', value: L.scenery,
        options: SCENERY.map((o) => ({ value: o.value, body: [icon(o.ico, 28), h('span', { class: 'oc-name' }, t(`scenery.${o.value}`))] })),
        onSet: (v) => store.set('land.scenery', v),
      }),
      h('div', { class: 'group' }, h('div', { class: 'lbl' }, t('land.size')), presets),
      C.more({
        key: 'landMore',
        kids: [
          C.stepper({ key: 'land.width', label: t('land.width'), value: L.width, min: LIMITS.landWidth[0], max: LIMITS.landWidth[1], fmt: fmtM, onSet: (v) => store.set('land.width', v) }),
          C.stepper({ key: 'land.depth', label: t('land.depth'), value: L.depth, min: LIMITS.landDepth[0], max: LIMITS.landDepth[1], fmt: fmtM, onSet: (v) => store.set('land.depth', v) }),
        ],
      }),
    ];
  }

  function styleThumb(st) {
    const c = st.house.colors;
    return h('span', {
      class: 'style-thumb', 'aria-hidden': 'true',
      style: { '--roof': st.house.roof.color, '--wall': c.walls, '--door': c.door, '--trim': c.trim },
    }, h('span', { class: 'st-door' }));
  }

  function stepStyle(s) {
    return [
      radioKeys(h('div', { class: 'choice choice-cards cols-2 style-grid', role: 'radiogroup', 'aria-label': t('style.title') },
        STYLES.map((st) => {
          const on = s.house.style === st.id;
          return h('button', {
            type: 'button', role: 'radio', class: 'opt-card style-card', 'aria-checked': on, tabindex: on ? 0 : -1, 'data-key': `style:${st.id}`,
            onclick: async () => {
              const cur = store.get();
              if (cur.house.style === st.id && stylePristine(cur)) return;
              if (!stylePristine(cur) && !(await confirmDialog({ title: t('confirm.style.title'), body: t('confirm.style.body'), ok: t('confirm.style.ok') }))) return;
              store.applyStyle(st.id);
              toast(t('toast.styleApplied'));
            },
          },
          styleThumb(st),
          h('span', { class: 'oc-name' }, pick(st)),
          h('span', { class: 'oc-desc' }, t(`style.${st.id}.d`)),
          on ? h('span', { class: 'tick' }, icon('check', 18)) : null);
        }))),
    ];
  }

  function roofShape(type) {
    return h('span', { class: 'roof-shape', 'data-type': type, 'aria-hidden': 'true' });
  }

  function movePad(s) {
    const { house } = s;
    const lim = offsetLimits(s);
    const minX = lim.minX, maxX = lim.maxX, minZ = lim.minZ, maxZ = lim.maxZ;
    const x = house.offsetX;
    const z = house.offsetZ;
    const clampTo = (v, lo, hi) => round2(Math.min(hi, Math.max(lo, v)));
    const move = (dx, dz) => setMany([['house.offsetX', clampTo(x + dx, minX, maxX)], ['house.offsetZ', clampTo(z + dz, minZ, maxZ)]]);
    const b = (key, ico, dx, dz, off) => h('button', {
      type: 'button', class: 'btn btn-secondary pad-btn', 'data-key': `move-${key}`, disabled: off, onclick: () => move(dx, dz),
    }, icon(ico, 22), h('span', null, t(`move.${key}`)));
    const eps = 0.01;
    return h('div', { class: 'group', role: 'group', 'aria-labelledby': 'move-lbl' },
      h('div', { class: 'lbl', id: 'move-lbl' }, t('size.move')),
      h('div', { class: 'pad' },
        h('span'), b('up', 'arrow-up', 0, -1, z <= minZ + eps), h('span'),
        b('left', 'arrow-left', -1, 0, x <= minX + eps),
        h('button', {
          type: 'button', class: 'btn btn-ghost pad-btn', 'data-key': 'move-center',
          disabled: x === 0 && z === 0, onclick: () => setMany([['house.offsetX', 0], ['house.offsetZ', 0]]),
        }, icon('locate-fixed', 22), h('span', null, t('move.center'))),
        b('right', 'arrow-right', 1, 0, x >= maxX - eps),
        h('span'), b('down', 'arrow-down', 0, 1, z >= maxZ - eps), h('span')));
  }

  const SIZE_PRESETS = [
    { id: 'small', w: 9, d: 8 },
    { id: 'medium', w: 12, d: 10 },
    { id: 'large', w: 15, d: 12 },
  ];

  function subSize(s) {
    const H = s.house;
    const { area, footprint } = stats ?? areaOf(s);
    const [areaPre, areaPost] = t('size.area', { n: '\u0000' }).split('\u0000');
    const st = (key, label, value, lim, onSet, extra = {}) => C.stepper({ key, label, value, min: lim[0], max: lim[1], onSet, ...extra });
    return [
      h('div', { class: 'area-card', 'aria-live': 'polite' },
        h('div', { class: 'area-main' }, icon('home', 28), h('span', { class: 'area-text' }, areaPre, h('strong', { class: 'area-val num' }, String(Math.round(area))), areaPost),
          h('span', { class: 'area-sub num' }, t('size.perFloor', { n: String(Math.round(footprint)) }))),
        h('p', { class: 'area-warn', hidden: !(stats?.missingBedrooms || stats?.missingBathrooms) }, t('size.noFit'))),
      h('div', { class: 'group', role: 'group', 'aria-labelledby': 'preset-lbl' },
        h('div', { class: 'lbl', id: 'preset-lbl' }, t('size.preset')),
        h('div', { class: 'preset-row' }, SIZE_PRESETS.map((p) => h('button', {
          type: 'button', class: 'btn btn-secondary preset', 'data-key': `size-${p.id}`, 'aria-pressed': H.width === p.w && H.depth === p.d,
          onclick: () => setMany([['house.width', p.w], ['house.depth', p.d]]),
        }, h('span', { class: 'preset-name' }, t(`size.${p.id}`)), h('span', { class: 'preset-dim num' }, `${p.w}×${p.d} ${t('unit.m')}`))))),
      st('floors', t('size.floors'), H.floors, LIMITS.floors, (v) => store.set('house.floors', v)),
      st('house.width', t('size.width'), H.width, LIMITS.width, (v) => store.set('house.width', v), { step: 0.5, fmt: fmtM, minusText: '−0.5', plusText: '+0.5' }),
      st('house.depth', t('size.depth'), H.depth, LIMITS.depth, (v) => store.set('house.depth', v), { step: 0.5, fmt: fmtM, minusText: '−0.5', plusText: '+0.5' }),
      st('bedrooms', t('size.bedrooms'), H.bedrooms, LIMITS.bedrooms, (v) => setCount('bedrooms', v)),
      st('bathrooms', t('size.bathrooms'), H.bathrooms, LIMITS.bathrooms, (v) => setCount('bathrooms', v)),
      C.more({
        key: 'sizeMore',
        kids: [
          st('house.floorHeight', t('size.ceiling'), H.floorHeight ?? 3, LIM_HEIGHT, (v) => store.set('house.floorHeight', v), { step: 0.1, fmt: fmtM, minusText: '−0.1', plusText: '+0.1' }),
          movePad(s),
        ],
      }),
    ];
  }

  function subRoof(s) {
    const H = s.house;
    return [
      C.choice({
        key: 'roof.type', label: t('size.roof'), cards: true, cls: 'cols-4 roof-cards', value: H.roof.type,
        options: ['flat', 'hip', 'gable', 'shed'].map((v) => ({ value: v, body: [roofShape(v), h('span', { class: 'oc-name' }, t(`roof.${v}`))] })),
        onSet: (v) => store.set('house.roof.type', v),
      }),
      C.choice({
        key: 'roof.material', label: t('size.roofMat'), value: H.roof.material,
        options: ['concrete', 'tile', 'metal'].map((v) => ({ value: v, label: t(`mat.${v}`) })),
        onSet: (v) => store.set('house.roof.material', v),
      }),
      C.choice({
        key: 'windowStyle', label: t('size.windows'), value: H.windowStyle, cls: 'seg-wrap',
        options: ['standard', 'tall', 'arched', 'louvered'].map((v) => ({ value: v, label: t(`win.${v}`) })),
        onSet: (v) => store.set('house.windowStyle', v),
      }),
      C.more({
        key: 'roofMore',
        kids: [
          C.stepper({ key: 'house.eaves', label: t('size.eaves'), value: H.eaves ?? 0.6, min: LIM_EAVES[0], max: LIM_EAVES[1], step: 0.1, fmt: fmtM, minusText: '−0.1', plusText: '+0.1', onSet: (v) => store.set('house.eaves', v) }),
          C.choice({
            key: 'wallFinish', label: t('size.finish'), value: H.wallFinish,
            options: ['smooth', 'stone-base', 'block'].map((v) => ({ value: v, label: t(`finish.${v}`) })),
            onSet: (v) => store.set('house.wallFinish', v),
          }),
        ],
      }),
    ];
  }

  function colorRow(s, part) {
    const hex = getPath(s, part.path);
    const open = ui.openPart === part.id;
    const pid = `pal-${part.id}`;
    const row = h('div', { class: `part${open ? ' open' : ''}`, 'data-part': part.id },
      h('button', {
        type: 'button', class: 'part-row', 'aria-expanded': open, 'aria-controls': pid, 'data-key': `part:${part.id}`,
        onclick: () => { ui.openPart = open ? null : part.id; render(); },
      },
      h('span', { class: 'dot', style: { background: hex } }),
      h('span', { class: 'part-name' }, t(`part.${part.id}`)),
      h('span', { class: 'part-val' }, colorName(hex)),
      h('span', { class: 'chev' }, icon('chevron-right', 22))));
    const dot = row.querySelector('.dot');
    const val = row.querySelector('.part-val');
    if (open) {
      const pal = h('div', { class: 'palette', id: pid, role: 'group', 'aria-label': t(`part.${part.id}`) },
        h('div', { class: 'swatches' }, PALETTES.map((p) => {
          const on = same(p.hex, hex);
          return h('button', {
            type: 'button', class: `swatch${on ? ' on' : ''}`, 'aria-pressed': on, 'data-key': `sw:${part.id}:${p.hex}`,
            onclick: () => store.set(part.path, p.hex),
          },
          h('span', { class: 'sw-dot', style: { background: p.hex } }, on ? icon('check', 24) : null),
          h('span', { class: 'sw-name' }, pick(p)));
        })),
        h('label', { class: 'btn btn-secondary more-colors' },
          h('span', { class: 'mc-dot', style: { background: hex } }),
          t('color.more'),
          h('input', {
            type: 'color', value: /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : '#ffffff', 'data-key': `custom:${part.id}`,
            'aria-label': `${t('color.more')}: ${t(`part.${part.id}`)}`,
            oninput: (e) => { sync.busy = true; store.patch(part.path, e.target.value); },
            onchange: () => { sync.busy = false; store.commit(); },
            onblur: () => { if (sync.busy) { sync.busy = false; store.commit(); } },
          })));
      const custom = pal.querySelector('input[type="color"]');
      const mc = pal.querySelector('.mc-dot');
      row.append(pal);
      sync.list.push(() => {
        const v = getPath(store.get(), part.path);
        dot.style.background = v;
        mc.style.background = v;
        val.textContent = colorName(v);
        if (document.activeElement !== custom && /^#[0-9a-f]{6}$/i.test(v)) custom.value = v.toLowerCase();
      });
    } else {
      sync.list.push(() => { dot.style.background = getPath(store.get(), part.path); });
    }
    return row;
  }

  function subColors(s) {
    const parts = PARTS.filter((p) => p.id !== 'fence' || s.yard.fence !== 'none');
    return [
      h('p', { class: 'hint-bar' }, icon('paintbrush', 20), t('color.hint')),
      h('div', { class: 'parts' }, parts.map((p) => colorRow(s, p))),
    ];
  }

  function itemRow(it, idx, type) {
    const n = store.get().yard.items.filter((x) => x.type === it.type).findIndex((x) => x.id === it.id) + 1;
    return h('li', { class: `item-row${ui.hiItem === it.id ? ' hi' : ''}`, 'data-item': it.id },
      h('span', { class: 'ir-name' }, icon(ITEM_ICONS[it.type] ?? 'trees', 24), `${itemLabel(it.type)} ${n}`),
      h('span', { class: 'ir-actions' },
        h('button', {
          type: 'button', class: 'btn btn-secondary', 'data-key': `rot:${it.id}`,
          onclick: () => store.set(`yard.items.${idx}.rot`, round2(((it.rot ?? 0) + Math.PI / 4) % (Math.PI * 2))),
        }, icon('rotate-cw', 20), t('item.rotate')),
        h('button', {
          type: 'button', class: 'btn btn-secondary btn-danger-outline', 'data-key': `rm:${it.id}`,
          onclick: () => {
            toast(t('toast.itemRemoved', { item: itemLabel(it.type) }));
            if (ui.hiItem === it.id) ui.hiItem = null;
            store.removeItem(it.id);
          },
        }, icon('trash-2', 20), t('item.remove'))));
  }

  function subExtras(s) {
    const H = s.house;
    const tog = (d) => {
      let disabled = false;
      let hint;
      if (d.needs === 'floors' && H.floors < 2) { disabled = true; hint = t('det.needFloors'); }
      if (d.needs === 'flat' && H.roof.type !== 'flat') { disabled = true; hint = t('det.needFlat'); }
      if (d.path === 'yard.pool' && !poolRect({ ...s, yard: { ...s.yard, pool: true } })) { disabled = true; hint = t('det.noPoolRoom'); }
      const on = !!getPath(s, d.path) && !disabled;
      return [
        C.toggleCard({ key: d.path, label: t(d.key), ico: d.ico, on, disabled, hint, onToggle: (v) => store.set(d.path, v) }),
        d.extra && on ? h('div', { class: 'span-all' }, C.choice({
          key: 'carportSide', label: t('det.carportSide'), value: H.carportSide,
          options: [{ value: 'left', label: t('side.left') }, { value: 'right', label: t('side.right') }],
          onSet: (v) => store.set('house.carportSide', v),
        })) : null,
      ];
    };
    const items = s.yard.items;
    const fin = (key, path, label, list, cls, body, def) => C.choice({
      key, label, cards: true, cls, value: getPath(s, path) ?? def,
      options: list.map((o) => ({ value: o.id, body: body(o) })),
      onSet: (v) => store.set(path, v),
    });
    const nm = (prefix) => (o) => (o.es ? pick(o) : t(`${prefix}.${o.id}`));
    const inBuild = s.mode === 'build';
    return [
      inBuild ? null : h('h3', { class: 'sec' }, t('det.house')),
      inBuild ? null : h('div', { class: 'toggle-grid' }, DETAIL_TOGGLES.map(tog)),
      h('h3', { class: 'sec' }, t('det.yard')),
      h('div', { class: 'toggle-grid' }, YARD_TOGGLES.map(tog)),
      inBuild ? null : C.choice({
        key: 'fence', label: t('det.fence'), value: s.yard.fence, cls: 'seg-wrap',
        options: ['none', 'wall', 'rejas', ...(s.yard.fence === 'custom' ? ['custom'] : [])].map((v) => ({ value: v, label: v === 'custom' ? t('bt.fence.mine') : t(`fence.${v}`) })),
        onSet: (v) => store.set('yard.fence', v),
      }),
      inBuild ? null : build.fenceCard(),
      h('h3', { class: 'sec' }, t('yard.title')),
      h('div', { class: 'catalog' }, ITEM_TYPES.map((it) => h('button', {
        type: 'button', class: 'btn btn-secondary cat-btn', 'data-key': `add:${it.id}`,
        onclick: () => {
          store.addItem(it.id);
          toast(t('toast.itemAdded', { item: pick(it) }));
        },
      }, icon(ITEM_ICONS[it.id] ?? 'trees', 26), h('span', null, pick(it))))),
      h('p', { class: 'hint-bar' }, icon('footprints', 20), t('item.dragHint')),
      items.length
        ? [h('h3', { class: 'sec' }, t('item.placed')), h('ul', { class: 'item-list' }, items.map((it, i) => itemRow(it, i)))]
        : null,
      inBuild ? null : C.more({
        key: 'extrasMore', label: t('det.finishes'),
        kids: [
          fin('columnStyle', 'house.columnStyle', t('fin.columns'), COLUMN_STYLES, 'cols-3 fin-cards',
            (o) => [h('span', { class: 'col-shape', 'data-type': o.id, 'aria-hidden': 'true' }), h('span', { class: 'oc-name' }, nm('col')(o))], 'square'),
          fin('railing', 'house.railing', t('fin.railing'), RAILINGS, 'cols-2 fin-cards',
            (o) => [icon(RAIL_ICONS[o.id] ?? 'grid-3x3', 28), h('span', { class: 'oc-name' }, nm('rail')(o))], 'iron'),
          fin('doorStyle', 'house.doorStyle', t('fin.door'), DOOR_STYLES, 'cols-3 fin-cards',
            (o) => [h('span', { class: 'door-shape', 'data-type': o.id, 'aria-hidden': 'true' }), h('span', { class: 'oc-name' }, nm('door')(o))], 'panel'),
          fin('floorFinishOut', 'house.floorFinishOut', t('fin.outFloor'), OUT_FLOORS, 'cols-3 fin-cards floor-cards',
            (o) => [h('span', { class: 'fl-prev', 'data-f': OUT_PREVIEW[o.id] ?? 'cemento', 'aria-hidden': 'true' }), h('span', { class: 'oc-name' }, nm('out')(o))], 'tile'),
        ],
      }),
    ];
  }

  // ---------- "Casa" menu + "Ver" step ----------
  function casaSummary(id, s) {
    const H = s.house;
    if (id === 'style') return pick(STYLES.find((x) => x.id === H.style)) || '';
    if (id === 'size') {
      const { area } = stats ?? areaOf(s);
      return `${Math.round(area)} m² · ${t(H.floors === 1 ? 'casa.floor1' : 'casa.floorN', { n: H.floors })}`;
    }
    if (id === 'colors') return null;
    if (id === 'roof') return `${t(`roof.${H.roof.type}`)} · ${t(`win.${H.windowStyle}`)}`;
    const on = [...DETAIL_TOGGLES, ...YARD_TOGGLES].filter((d) => getPath(s, d.path)).map((d) => t(d.key));
    return on.length ? on.slice(0, 3).join(', ') + (on.length > 3 ? '…' : '') : t('casa.none');
  }

  function tileSummary(id, s) {
    if (id === 'land') return t('design.landD', { w: s.land.width, d: s.land.depth });
    if (id === 'inside') return t('design.insideD');
    return casaSummary(id, s);
  }

  function stepDesign(s) {
    return [
      h('div', { class: 'menu-grid', role: 'group', 'aria-label': t('design.hint') }, TILES.map((c) => h('button', {
        type: 'button', class: `tile-card${c.wide ? ' wide' : ''}`, 'data-key': c.id === 'land' ? 'tile:land' : c.id === 'inside' ? 'nav-inside' : `casa:${c.id}`,
        onclick: () => (c.id === 'inside' ? goStep(3) : openSub(c.id)),
      },
      h('span', { class: 'tc-top' }, h('span', { class: 'mark' }, c.n), icon(c.ico, 28)),
      h('span', { class: 'tc-body' },
        h('strong', null, t(c.key)),
        c.id === 'colors'
          ? h('span', { class: 'nc-dots', 'aria-hidden': 'true' }, ['walls', 'roof', 'door', 'trim'].map((id) => h('i', { style: { background: getPath(s, PARTS.find((p) => p.id === id).path) } })))
          : h('span', null, tileSummary(c.id, s))),
      h('span', { class: 'tc-chev' }, icon('chevron-right', 22))))),
    ];
  }

  const VIEW_CARDS = [
    { id: '3d', ico: 'box', key: 'view.orbit', d: 'see.orbitD' },
    { id: 'walk', ico: 'footprints', key: 'view.walk', d: 'see.walkD' },
    { id: 'inside', ico: 'layers', key: 'view.cutaway', d: 'see.insideD' },
  ];

  function stepSee(s) {
    const { area } = stats ?? areaOf(s);
    const sum = s.mode === 'build'
      ? build.totalsLine()
      : t('see.sum', { n: Math.round(area), f: t(s.house.floors === 1 ? 'casa.floor1' : 'casa.floorN', { n: s.house.floors }), b: s.house.bedrooms, c: s.house.bathrooms });
    return [
      build.rmOn() ? build.remodelToggle() : null,
      h('div', { class: 'area-card' },
        h('div', { class: 'area-main' }, icon('home', 28), h('span', { class: 'area-text' }, sum))),
      h('label', { class: 'group' }, h('span', { class: 'lbl' }, t('top.name')),
        h('input', {
          type: 'text', class: 'text-input', maxlength: '60', value: s.name, 'data-key': 'name-ver',
          onchange: (e) => { const v = e.target.value.trim() || 'Mi Casa'; e.target.value = v; store.set('name', v); },
          onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
        })),
      C.choice({
        key: 'see', label: t('see.how'), cards: true, cls: 'cols-3 view-cards', value: ui.view,
        options: VIEW_CARDS.map((v) => ({ value: v.id, body: [icon(v.ico, 30), h('span', { class: 'oc-name' }, t(v.key)), h('span', { class: 'oc-desc' }, t(v.d))] })),
        onSet: (v) => ctx.setViewMode(v),
      }),
      ctx.chrome.sunGroup,
      h('div', { class: 'group' },
        typeof engine.reveal === 'function'
          ? h('button', { type: 'button', class: 'btn btn-secondary btn-xl', 'data-key': 'see-reveal', onclick: () => ctx.reveal({ keepTime: true }) }, icon('home', 26), t('see.again'))
          : null,
        h('button', { type: 'button', class: 'btn btn-secondary btn-xl', 'data-key': 'see-photo', onclick: () => ctx.takePhoto() }, icon('camera', 26), t('see.photo')),
        h('button', { type: 'button', class: 'btn btn-secondary btn-xl', 'data-key': 'see-save', onclick: () => ctx.save() }, icon('save', 26), t('top.save')),
        h('button', { type: 'button', class: 'btn btn-secondary btn-xl', 'data-key': 'see-houses', onclick: () => ctx.openHouses() }, icon('folder-open', 26), t('top.myHouses'))),
    ];
  }

  const interior = createInterior({ store, engine, ctx, ui, toast, C, sync, render: () => render() });
  const build = createBuild({ store, engine, ctx, ui, toast, C, sync, render: () => render() });
  ctx.build = build;
  engine.on?.('remodelView', () => { if (ui.sub === 'remodel' || ui.step === 4) render(); });
  const isBuild = () => store.get().mode === 'build';
  const steps = { 2: (s) => (isBuild() && ui.sub !== 'modestart' ? build.buildStep() : stepDesign(s)), 3: () => interior.build(), 4: stepSee };
  const SUBS = {
    land: { step: 2, title: 'design.land', build: stepLand, n: '01' },
    style: { step: 2, title: 'casa.style', build: stepStyle, n: '02' },
    size: { step: 2, title: 'casa.size', build: subSize, n: '03' },
    colors: { step: 2, title: 'casa.colors', build: subColors, n: '04' },
    roof: { step: 2, title: 'casa.roof', build: subRoof, n: '05' },
    extras: { step: 2, title: 'casa.extras', build: subExtras, n: '06' },
    broof: { step: 2, title: 'bt.roof', build: () => build.roofSub() },
    remodel: { step: 2, title: 'rm.title', build: () => build.remodelSub() },
    modestart: { step: 2, title: 'bt.start.title', build: () => build.startSub() },
    addroom: { step: 3, title: 'plan.add', build: () => interior.buildSub('addroom') },
    home: { step: 3, title: 'plan.home', build: () => interior.buildSub('home') },
    furnish: { step: 3, title: 'plan.furnish', build: () => interior.buildSub('furnish') },
  };

  // The mode on show. Construir also covers the start-choice screen that is shown before the first hand-built house.
  const tabOf = () => (ui.step === 4 ? 'see' : ui.sub === 'modestart' || isBuild() ? 'build' : 'design');

  // ---------- shell ----------
  const scroll = h('div', { class: 'panel-scroll', id: 'panel-scroll', role: 'region' });
  const foot = h('div', { class: 'panel-foot' });
  const handle = h('button', { type: 'button', class: 'sheet-handle', 'aria-expanded': 'true' }, h('span', { class: 'grip' }));
  const railBtn = h('button', { type: 'button', class: 'rail-toggle', 'data-key': 'rail', 'aria-expanded': 'true' }, icon('panel-left', 22), h('span', null, t('panel.hide')));

  // Diseñar | Construir | Ver. On a phone it sits at the top of the sheet (thumb reach); on a desktop it moves into the top bar.
  const modeBtns = MODES.map((m) => h('button', {
    type: 'button', role: 'radio', class: 'mode-btn', 'data-key': `mode:${m.id}`, 'data-mode': m.id,
    onclick: () => goTab(m.id),
  }, h('span', { class: 'mark' }, m.n), h('span', { class: 'ml' }, icon(m.ico, 20), h('span', { 'data-i18n': m.key }, t(m.key)))));
  const modeseg = h('div', { class: 'modeseg', role: 'radiogroup', 'aria-label': t('a11y.modes') }, modeBtns);
  radioKeys(modeseg);
  const subtabs = h('div', { class: 'subtabs', role: 'group', 'aria-label': t('pz.tabs'), hidden: true });
  const el = h('aside', { class: 'panel', 'aria-label': t('a11y.sheet') }, handle, railBtn, modeseg, subtabs, scroll, foot);
  const desk = matchMedia('(min-width: 1000px)');
  function placeMode() {
    if (desk.matches) ctx.chrome.modeSlot.append(modeseg);
    else el.insertBefore(modeseg, subtabs);
  }
  desk.addEventListener('change', () => { placeMode(); syncInset(); });
  placeMode();

  // Sheet snaps: peek 120 / half 44dvh / tall 78dvh. A drag follows the finger, then settles on the nearest snap.
  const SHEET = ['min', 'half', 'tall'];
  const setSheet = (state) => {
    ui.sheet = state;
    el.style.removeProperty('height');
    ctx.applySheet();
    handle.setAttribute('aria-expanded', String(state !== 'min'));
    syncInset();
  };
  ctx.setSheet = setSheet;
  const snapPx = () => {
    const vh = innerHeight;
    const half = document.body.classList.contains('pz-tray') ? Math.max(0.47 * vh, 404) : document.body.classList.contains('room-open') ? 0.62 * vh : 0.44 * vh;
    return { min: 120, half, tall: 0.78 * vh };
  };
  let drag = null;
  handle.addEventListener('pointerdown', (e) => {
    drag = { y0: e.clientY, h0: el.getBoundingClientRect().height, moved: false };
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) < 8) return;
    drag.moved = true;
    el.classList.add('dragging');
    el.style.height = `${Math.max(96, Math.min(innerHeight * 0.88, drag.h0 - dy))}px`;
  });
  const endDrag = (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    el.classList.remove('dragging');
    if (!d.moved) { el.style.removeProperty('height'); setSheet(ui.sheet === 'min' ? 'half' : 'min'); return; }
    const cur = el.getBoundingClientRect().height;
    const px = snapPx();
    const dir = e.clientY - d.y0 < 0 ? 1 : -1;
    // Nearest snap, nudged in the direction of the flick.
    let best = 'half';
    let bd = Infinity;
    for (const k of SHEET) {
      const dist = Math.abs(px[k] - (cur + dir * 40));
      if (dist < bd) { bd = dist; best = k; }
    }
    setSheet(best);
  };
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', () => { drag = null; el.classList.remove('dragging'); el.style.removeProperty('height'); });
  handle.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); setSheet(SHEET[Math.min(2, SHEET.indexOf(ui.sheet) + 1)]); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSheet(SHEET[Math.max(0, SHEET.indexOf(ui.sheet) - 1)]); }
  });
  handle.setAttribute('aria-label', t('a11y.sheetToggle'));

  // Desktop rail: hide the panel down to a 64px strip.
  railBtn.addEventListener('click', () => {
    const on = document.body.classList.toggle('rail-collapsed');
    railBtn.setAttribute('aria-expanded', String(!on));
    railBtn.lastChild.textContent = t(on ? 'panel.show' : 'panel.hide');
    railBtn.setAttribute('aria-label', t(on ? 'panel.show' : 'panel.hide'));
    setTimeout(() => engine.setViewInset?.({ bottom: Math.max(0, lastInset) }), 320);
  });

  function paintModes() {
    const cur = tabOf();
    for (const b of modeBtns) {
      const on = b.dataset.mode === cur;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    modeseg.setAttribute('aria-label', t('a11y.modes'));
  }

  // Construir sub-tabs: Piezas | Dibujar | Por dentro (same data-keys as before, plus the new Interior one).
  function paintSubtabs(show) {
    subtabs.hidden = !show;
    if (!show) { subtabs.replaceChildren(); return; }
    const cur = ui.step === 3 ? 'interior' : ui.sub === 'remodel' ? 'remodel' : build.state.tab;
    const tab = (id, ico, label) => h('button', {
      type: 'button', class: `pz-tab${cur === id ? ' on' : ''}`, 'aria-pressed': cur === id, 'data-key': `pz-tab:${id}`,
      onclick: () => {
        if (id === 'interior') { goStep(3); return; }
        if (id === 'remodel') {
          if (ui.step !== 2) goStep(2); // leaves Por dentro properly first
          ui.sub = 'remodel'; ui.stepChanged = true; render(); return;
        }
        if (ui.step !== 2 || ui.sub) { ui.sub = null; goStep(2); }
        build.openTab(id);
      },
    }, icon(ico, 22), h('span', null, label));
    subtabs.replaceChildren(tab('pieces', 'layout-grid', t('pz.tab.pieces')), tab('draw', 'wall-draw', t('pz.tab.draw')), tab('interior', 'home', t('pz.tab.interior')), tab('remodel', 'remodel', t('pz.tab.remodel')));
    subtabs.classList.toggle('rm-live', build.rmOn());
    subtabs.setAttribute('aria-label', t('pz.tabs'));
  }

  let lastMarks = false;
  let seenSee = false;
  async function goTab(tab) {
    ctx.tap?.close();
    ctx.chrome.closePops();
    if (ui.sheet === 'min') setSheet('half');
    if (tab === 'see') {
      ui.step = 4;
      ui.sub = null;
      ui.stepChanged = true;
      render();
      if (!seenSee) { seenSee = true; ctx.reveal?.({ keepTime: !ui.fresh }); ui.fresh = false; }
      return;
    }
    if (tab === 'design') {
      if (isBuild() && !(await build.backToAuto())) return;
      ui.step = 2;
      ui.sub = null;
    } else {
      ui.step = 2;
      ui.sub = isBuild() ? null : 'modestart';
    }
    ui.stepChanged = true;
    render();
    modeBtns.find((b) => b.dataset.mode === tab)?.focus({ preventScroll: true });
  }

  function closeSub() {
    ui.sub = null;
    ui.msg = null;
    ui.stepChanged = true;
    render();
  }
  function openSub(id) {
    ui.sub = id;
    ui.stepChanged = true;
    render();
  }

  function buildFoot() {
    const btn = (cls, key, onclick, ...kids) => h('button', { type: 'button', class: `btn ${cls}`, 'data-key': key, onclick }, ...kids);
    if (build.hasSelection()) {
      foot.replaceChildren(btn('btn-primary next-btn', 'sel-done', () => build.deselect(), icon('check', 22), t('step.done')));
    } else if (interior.hasSelection()) {
      foot.replaceChildren(btn('btn-primary next-btn', 'room-done', () => interior.deselect(), icon('check', 22), t('step.done')));
    } else if (ui.sub) {
      if (ui.sub === 'addroom') {
        foot.replaceChildren(
          btn('btn-secondary back-btn', 'sub-done', closeSub, t('confirm.cancelAdd')),
          btn('btn-primary next-btn', 'add-confirm', () => interior.confirmAdd(), icon('plus', 22), t('plan.addGo')));
      } else foot.replaceChildren(btn('btn-primary next-btn', 'sub-done', closeSub, icon('check', 22), t('step.done')));
    } else foot.replaceChildren();
  }

  // goStep keeps the old numbers working for callers: 1 is the Terreno sub-screen, 2 the menu / Construir, 3 Por dentro, 4 Ver.
  function goStep(n) {
    ctx.tap?.close();
    if (n === 1) { ui.step = 2; ui.sub = 'land'; ui.stepChanged = true; render(); return; }
    if (n === ui.step && !ui.sub) return;
    if (n === 3 && ui.step !== 3) ui.room = 'all';
    ui.step = n;
    ui.sub = null;
    ui.stepChanged = true;
    render();
  }

  function signature(s) {
    return JSON.stringify({
      land: { ...s.land, photo: !!s.land.photo, seed: 0 },
      mode: s.mode ?? 'auto',
      build: s.build ?? null,
      house: s.house,
      yard: { ...s.yard, items: s.yard.items.map(({ id, type, rot }) => [id, type, rot]) },
      interior: { ...s.interior, items: (s.interior?.items ?? []).map(({ id, type, level, rot }) => [id, type, level, rot]) },
      lights: s.env?.lightsOn,
      seed: s.land.seed,
      name: s.name,
    });
  }

  // ---------- render ----------
  function render() {
    const s = store.get();
    if (shown !== ui.step) {
      const prev = shown;
      shown = ui.step;
      if (prev === 3) interior.leave();
      if (ui.step === 3) interior.enter();
    }
    const sub = ui.sub && SUBS[ui.sub]?.step === ui.step ? SUBS[ui.sub] : null;
    if (!sub) ui.sub = null;
    const active = document.activeElement;
    const appEl = ctx.appEl ?? el;
    const focusKey = appEl.contains(active) && active?.dataset?.key ? active.dataset.key : null;
    const top = ui.stepChanged ? 0 : scroll.scrollTop;
    sync.list = [];
    sync.busy = false;
    lastSig = signature(s);
    build.syncStep();
    // "Hoy" (the house before the remodel) is only on screen in Remodelar and Ver; building always shows the plan.
    if (engine.getRemodelView?.() === 'before' && !(ui.sub === 'remodel' || ui.step === 4)) engine.setRemodelView('after');
    document.body.classList.toggle('remodel-on', build.rmOn());
    document.body.dataset.mode = isBuild() ? 'build' : 'auto';

    const tab = tabOf();
    if (tab !== 'see') ctx.chrome.homeSun();
    paintModes();
    const lotMarks = tab === 'design' && ui.sub === 'land';
    if (lotMarks !== lastMarks) { lastMarks = lotMarks; engine.setLotMarks?.(lotMarks); }
    buildFoot();
    const body = sub ? sub.build(s) : steps[ui.step](s);
    const selected = !sub && ((ui.step === 3 && interior.hasSelection()) || build.hasSelection());
    paintSubtabs(tab === 'build' && (!sub || ui.sub === 'remodel') && !selected && (ui.step === 3 || ui.step === 2));
    const inBuildHome = ui.step === 2 && isBuild() && !sub;
    const back = (to) => h('button', { type: 'button', class: 'btn btn-ghost back-link', 'data-key': 'sub-back', onclick: to }, icon('chevron-left', 22), t('sub.back'));
    let head = null;
    if (selected || inBuildHome || (ui.step === 3 && tab === 'build' && !sub)) head = null;
    else if (sub) {
      head = h('header', { class: 'step-head sub-head' }, back(closeSub),
        h('div', { class: 'title-col' }, sub.n ? h('span', { class: 'mark' }, sub.n) : null, h('h2', { class: 'step-title' }, t(sub.title))));
    } else if (ui.step === 3) {
      head = h('header', { class: 'step-head sub-head' }, back(() => goStep(2)),
        h('div', { class: 'title-col' }, h('span', { class: 'mark' }, '07'), h('h2', { class: 'step-title' }, t('int.title'))));
    } else {
      head = h('header', { class: 'step-head' }, h('h2', { class: 'step-title' }, t(ui.step === 4 ? 'see.title' : 'casa.title')),
        ui.step === 2 ? h('p', { class: 'muted-p' }, t('design.hint')) : null);
    }
    const view = h('div', { class: `step-view${ui.stepChanged && !reducedMotion() ? ' enter' : ''}`, 'data-step': ui.step, 'data-sub': ui.sub ?? '' }, head, body);
    // Level pills (and the Por dentro zoom buttons) float over the stage, not inside the sheet.
    const lr = view.querySelector('.level-row');
    if (lr) { ctx.chrome.levelHost.replaceChildren(lr); }
    else ctx.chrome.levelHost.replaceChildren();
    for (const e of view.querySelectorAll('.pz-top')) if (!e.children.length) e.remove();
    ctx.chrome.levelHost.hidden = !lr;
    document.body.classList.toggle('has-levels', !!lr);
    scroll.setAttribute('aria-label', t(sub?.title ?? (ui.step === 4 ? 'see.title' : ui.step === 3 ? 'int.title' : 'casa.title')));
    scroll.replaceChildren(view);
    scroll.scrollTop = top;
    document.body.dataset.step = String(ui.step);
    document.body.dataset.tab = tab;
    syncInset();
    document.body.classList.toggle('room-open', selected);

    if (focusKey) {
      const target = [...appEl.querySelectorAll('[data-key]')].find((n) => n.dataset.key === focusKey);
      target?.focus({ preventScroll: true });
    }
    ui.stepChanged = false;

    // Tap-to-paint feedback: bring the row into view and pulse it once.
    if (ui.reveal) {
      const { type, id } = ui.reveal;
      const sel = type === 'part' ? `[data-part="${id}"]` : type === 'indoor' ? `[data-indoor="${id}"]` : type === 'sec' ? `[data-sec="${id}"]` : `[data-item="${id}"]`;
      const target = scroll.querySelector(sel);
      if (target) {
        target.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
        if (!reducedMotion()) {
          target.classList.add('pulse');
          setTimeout(() => target.classList.remove('pulse'), 650);
        }
      }
      ui.reveal = null;
    }
  }

  store.subscribe((s) => {
    if (sync.busy) {
      for (const fn of sync.list) fn();
      return;
    }
    if (signature(s) === lastSig) return;
    render();
  });

  engine.on?.('stats', (st) => {
    stats = st;
    const v = scroll.querySelector('.area-val');
    if (v && st) {
      v.textContent = String(Math.round(st.area));
      const sub = scroll.querySelector('.area-sub');
      if (sub) sub.textContent = t('size.perFloor', { n: String(Math.round(st.footprint)) });
      const warn = scroll.querySelector('.area-warn');
      if (warn) warn.hidden = !(st.missingBedrooms || st.missingBathrooms);
    }
  });

  engine.on?.('rooms', (list) => {
    const sig = JSON.stringify((list ?? []).map((r) => [r.key, r.name, r.hidden]));
    if (sig === roomsSig) return;
    roomsSig = sig;
    if (ui.step === 3 && !sync.busy) render();
  });

  // A room was tapped in the plan or the cutaway: open its sheet.
  let lastOpen = { key: null, at: 0 };
  function openRoom(key, level) {
    // The engine reports one tap as both roomTap and pick: open the sheet once.
    const now = performance.now();
    if (lastOpen.key === key && now - lastOpen.at < 400) return;
    lastOpen = { key, at: now };
    ctx.clearHint?.();
    ctx.tap?.close();
    ui.step = 3;
    ui.sub = null;
    interior.focus({ level: level ?? (+key.split(':')[0] || 0), room: key });
    ui.stepChanged = true;
    if (ui.sheet === 'min') setSheet('half');
    render();
  }
  engine.on?.('roomTap', ({ id, level } = {}) => { if (id) openRoom(id, level); });
  // While a wall is dragged the sheet only fades. Resizing it would refit the plan under his finger.
  engine.on?.('planDrag', ({ active } = {}) => {
    document.body.classList.toggle('plan-dragging', !!active);
  });

  // Tell the engine how much of the stage the floating buttons cover, so the plan fits above them.
  let lastInset = -1;
  const phone = matchMedia('(max-width: 999px)');
  function syncInset() {
    const bottom = phone.matches && (ui.step === 3 || build.barOn()) ? 76 : 0;
    if (bottom === lastInset) return;
    lastInset = bottom;
    engine.setViewInset?.({ bottom });
  }

  // "Más colores" from the tap sheet: Casa > Colores with that part open.
  ctx.openColors = (part) => {
    ctx.tap?.close();
    ui.step = 2;
    ui.sub = 'colors';
    ui.openPart = part;
    ui.reveal = { type: 'part', id: part };
    ui.stepChanged = true;
    if (ui.sheet === 'min') setSheet('half');
    render();
  };

  engine.on?.('pick', ({ part } = {}) => {
    if (!part) {
      ctx.tap?.close();
      if (ui.step === 2 && ui.sub === 'colors' && ui.openPart) { ui.openPart = null; render(); }
      return;
    }
    if (build.state.on || build.state.autoFence) return;
    if (part.startsWith('room:')) {
      openRoom(part.slice(5));
      return;
    }
    if (isBuild() && !part.startsWith('furn:') && !part.startsWith('indoor:') && !part.startsWith('item:')) return;
    if (part.startsWith('furn:') || part.startsWith('indoor:')) {
      ctx.tap?.close();
      const id = part.startsWith('indoor:') ? part.slice(7) : null;
      const it = id ? (store.get().interior?.items ?? []).find((x) => x.id === id) : null;
      ui.step = 3;
      ui.sub = 'furnish';
      interior.focus({ level: it?.level ?? ui.level, indoor: id ?? undefined });
      ui.reveal = id ? { type: 'indoor', id } : { type: 'sec', id: 'furn' };
    } else {
      if (part === 'fence' && store.get().yard.fence === 'none') return;
      ctx.tap?.open(part);
      return;
    }
    ui.stepChanged = true;
    if (ui.sheet === 'min') setSheet('half');
    render();
  });

  ctx.syncInset = syncInset;
  ctx.afterView = () => {
    build.onView();
    interior.syncEdit();
    if (ui.step === 3 || ui.step === 4) render();
  };
  ctx.goStep = goStep;

  onLang(() => {
    render();
    applyI18n(modeseg);
    handle.setAttribute('aria-label', t('a11y.sheetToggle'));
    el.setAttribute('aria-label', t('a11y.sheet'));
    const on = document.body.classList.contains('rail-collapsed');
    railBtn.lastChild.textContent = t(on ? 'panel.show' : 'panel.hide');
    railBtn.setAttribute('aria-label', t(on ? 'panel.show' : 'panel.hide'));
  });

  render();
  return { el, render, goStep };
}
