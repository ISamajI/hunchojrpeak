// Detailed floor picker: photo-like tiles (drawn by the engine from the real 3D textures), then
// "Más detalles": tone, tile size, pattern, baseboard. Works for one room or the whole house.
// The engine lists/helpers may land after this file, so every name is feature-detected.
import * as S from '../state.js';
import { t, pick } from '../i18n.js';
import { h } from './dom.js';
import { icon } from './icons.js';
import { radioKeys } from './controls.js';

export const kindOf = (f) => f?.kind ?? 'tile';

const TONES = S.FLOOR_TONES;
const PATTERNS = S.FLOOR_PATTERNS;
// 60 x 60 first (the most common), then the rest.
const SIZES = ['60', '80', '120x60', '30'].map((id) => S.TILE_SIZES.find((z) => z.id === id)).filter(Boolean);
const patternsFor = (kind) => PATTERNS.filter((p) => p.kinds.includes(kind));

const BASEBOARDS = [
  { hex: '#ffffff', es: 'Blanco', en: 'White' },
  { hex: '#f5f2ec', es: 'Blanco cálido', en: 'Warm white' },
  { hex: '#d9d3c7', es: 'Hueso', en: 'Bone' },
  { hex: '#9aa3a8', es: 'Gris', en: 'Gray' },
  { hex: '#5e3b26', es: 'Madera oscura', en: 'Dark wood' },
  { hex: '#3b3d40', es: 'Gris oscuro', en: 'Charcoal' },
];

const swatchFn = S.floorSwatch;
const cache = new Map();

export function createFloors({ store, toast, C }) {
  const interiorOf = () => store.get().interior ?? {};

  // The look a room really has: its own pick, else the whole-house default (the engine resolves it).
  function specOf(roomKey) {
    const f = S.floorSpec(interiorOf(), roomKey);
    return { floor: f.id, kind: f.kind, tone: f.tone, pattern: f.pattern, tileSize: f.size, baseboard: f.baseboard };
  }

  const hasOwnFloor = (roomKey) => {
    const o = interiorOf().rooms?.[roomKey] ?? {};
    return ['floor', 'floorTone', 'floorPattern', 'tileSize', 'baseboard'].some((k) => o[k] != null);
  };

  // Write one field for a room (or the whole house when roomKey is null).
  function setField(roomKey, field, value) {
    const globalPath = `interior.${field}`;
    if (!roomKey) { store.set(globalPath, value); return; }
    store.setRoom?.(roomKey, field, value);
    if (String(interiorOf().rooms?.[roomKey]?.[field]) !== String(value)) store.set(`interior.rooms.${roomKey}.${field}`, value);
  }

  function swatchUrl(floorId, sp) {
    if (!swatchFn) return null;
    const spec = { floor: floorId, tone: sp.tone, pattern: sp.pattern, tileSize: sp.tileSize };
    const k = JSON.stringify(spec);
    if (!cache.has(k)) {
      let url = null;
      try { url = swatchFn(spec, 160); } catch { url = null; }
      cache.set(k, url);
      if (cache.size > 160) cache.delete(cache.keys().next().value);
    }
    return cache.get(k);
  }

  function tile(f, sp, roomKey, on, onPick) {
    const url = swatchUrl(f.id, sp);
    return h('button', {
      type: 'button', role: 'radio', class: `floor-tile${on ? ' on' : ''}`, 'aria-checked': on, tabindex: on ? 0 : -1, 'data-key': `int.floor:${f.id}`,
      onclick: onPick ?? (() => {
        setField(roomKey, 'floor', f.id);
        toast(t('toast.floorSet', { name: pick(f) }));
      }),
    },
    h('span', { class: 'ft-img' }, url
      ? h('img', { src: url, alt: '', width: 112, height: 112 })
      : h('span', { class: 'fl-prev', 'data-f': f.id, 'aria-hidden': 'true' })),
    h('span', { class: 'ft-name' }, pick(f)),
    on ? h('span', { class: 'tick' }, icon('check', 18)) : null);
  }

  function applyAll(roomKey) {
    const sp = specOf(roomKey);
    const own = (roomKey && interiorOf().rooms?.[roomKey]) || {};
    const pairs = [['interior.floor', sp.floor], ['interior.floorTone', sp.tone], ['interior.floorPattern', sp.pattern], ['interior.tileSize', own.tileSize ?? interiorOf().tileSize ?? null]];
    if (sp.baseboard) pairs.push(['interior.baseboard', sp.baseboard]);
    for (const [p, v] of pairs) store.patch(p, v);
    // Every room follows the house again (walls keep their own color).
    const rooms = {};
    for (const [k, o] of Object.entries(interiorOf().rooms ?? {})) {
      const rest = Object.fromEntries(Object.entries(o).filter(([f]) => !['floor', 'floorTone', 'floorPattern', 'tileSize', 'baseboard'].includes(f)));
      if (Object.keys(rest).length) rooms[k] = rest;
    }
    store.patch('interior.rooms', rooms);
    store.commit();
    toast(t('toast.floorAll'));
  }

  function useHouse(roomKey) {
    const o = interiorOf().rooms?.[roomKey] ?? {};
    const rest = Object.fromEntries(Object.entries(o).filter(([f]) => !['floor', 'floorTone', 'floorPattern', 'tileSize', 'baseboard'].includes(f)));
    if (Object.keys(rest).length) store.set(`interior.rooms.${roomKey}`, rest);
    else store.clearRoom ? store.clearRoom(roomKey) : store.set(`interior.rooms.${roomKey}`, {});
    toast(t('toast.roomReset'));
  }

  // One floor section. roomKey = null edits the whole-house default.
  function section(roomKey) {
    const sp = specOf(roomKey);
    const grid = radioKeys(h('div', { class: 'floor-grid', role: 'radiogroup', 'aria-label': t('int.floor') },
      S.FLOORS.map((f) => tile(f, sp, roomKey, f.id === sp.floor))));

    const kids = [];
    kids.push(C.choice({
      key: 'floorTone', label: t('floor.tone'), value: sp.tone, cls: 'int-chips',
      options: TONES.map((o) => ({ value: o.id, label: pick(o) })),
      onSet: (v) => setField(roomKey, 'floorTone', v),
    }));
    if (sp.kind === 'tile') {
      kids.push(C.choice({
        key: 'tileSize', label: t('floor.size'), cards: true, cls: 'cols-2 mini-cards', value: sp.tileSize,
        options: SIZES.map((z) => ({
          value: z.id,
          body: [h('span', { class: 'oc-name num' }, pick(z)), z.id === '60' ? h('span', { class: 'oc-desc' }, t('floor.common')) : null],
        })),
        onSet: (v) => setField(roomKey, 'tileSize', v),
      }));
    }
    const pats = patternsFor(sp.kind);
    if (pats.length > 1) {
      kids.push(C.choice({
        key: 'floorPattern', label: t('floor.pattern'), cards: true, cls: `cols-${pats.length === 3 ? 3 : 2} mini-cards`, value: sp.pattern,
        options: pats.map((p) => ({ value: p.id, body: [h('span', { class: 'pat-ico' }, icon(`pat-${p.id}`, 36)), h('span', { class: 'oc-name' }, t(`pat.${p.id}`))] })),
        onSet: (v) => setField(roomKey, 'floorPattern', v),
      }));
    }
    kids.push(C.colorGroup({
      key: 'baseboard', label: t('floor.base'), list: BASEBOARDS, value: sp.baseboard ?? '#ffffff',
      customPath: roomKey ? `interior.rooms.${roomKey}.baseboard` : 'interior.baseboard',
      onPick: (p) => setField(roomKey, 'baseboard', p.hex),
    }));

    return h('div', { class: 'floor-sec', 'data-sec': 'floor' },
      h('div', { class: 'lbl' }, t('int.floor')),
      grid,
      h('div', { class: 'btn-row floor-actions' },
        h('button', { type: 'button', class: 'btn btn-secondary', 'data-key': 'floor-all', onclick: () => applyAll(roomKey) }, icon('layout-grid', 22), t('floor.applyAll')),
        roomKey && hasOwnFloor(roomKey)
          ? h('button', { type: 'button', class: 'btn btn-secondary', 'data-key': 'floor-house', onclick: () => useHouse(roomKey) }, icon('rotate-cw', 22), t('floor.useHouse'))
          : null),
      C.more({ key: 'floorMore', label: t('floor.more'), kids }));
  }

  // The same tiles + tone / size / pattern, writing through `set(field, value)` instead of the interior
  // (used by Construir for slabs and for the "floor to paint"). `spec` = { floor, tone, pattern, tileSize }.
  function picker({ spec, set, detailsKey = 'slabMore', moreLabel }) {
    const norm = S.normalizeFloor ? S.normalizeFloor({ floor: spec.floor, floorTone: spec.tone, floorPattern: spec.pattern, tileSize: spec.tileSize }) : null;
    const sp = norm
      ? { floor: norm.id, kind: norm.kind, tone: norm.tone, pattern: norm.pattern, tileSize: norm.size }
      : { floor: spec.floor ?? 'porcelanato', kind: kindOf(S.FLOORS.find((f) => f.id === spec.floor)), tone: spec.tone ?? 'medio', pattern: spec.pattern ?? 'recto', tileSize: spec.tileSize ?? '60' };
    const grid = radioKeys(h('div', { class: 'floor-grid', role: 'radiogroup', 'aria-label': t('int.floor') },
      S.FLOORS.map((f) => tile(f, sp, null, f.id === sp.floor, () => set('floor', f.id)))));
    const kids = [C.choice({
      key: `${detailsKey}Tone`, label: t('floor.tone'), value: sp.tone, cls: 'int-chips',
      options: TONES.map((o) => ({ value: o.id, label: pick(o) })),
      onSet: (v) => set('tone', v),
    })];
    if (sp.kind === 'tile') {
      kids.push(C.choice({
        key: `${detailsKey}Size`, label: t('floor.size'), cards: true, cls: 'cols-2 mini-cards', value: sp.tileSize,
        options: SIZES.map((z) => ({ value: z.id, body: [h('span', { class: 'oc-name num' }, pick(z)), z.id === '60' ? h('span', { class: 'oc-desc' }, t('floor.common')) : null] })),
        onSet: (v) => set('tileSize', v),
      }));
    }
    const pats = patternsFor(sp.kind);
    if (pats.length > 1) {
      kids.push(C.choice({
        key: `${detailsKey}Pat`, label: t('floor.pattern'), cards: true, cls: `cols-${pats.length === 3 ? 3 : 2} mini-cards`, value: sp.pattern,
        options: pats.map((p) => ({ value: p.id, body: [h('span', { class: 'pat-ico' }, icon(`pat-${p.id}`, 36)), h('span', { class: 'oc-name' }, t(`pat.${p.id}`))] })),
        onSet: (v) => set('pattern', v),
      }));
    }
    return h('div', { class: 'floor-sec' }, grid, C.more({ key: detailsKey, label: moreLabel ?? t('floor.more'), kids }));
  }

  return { section, specOf, picker };
}
