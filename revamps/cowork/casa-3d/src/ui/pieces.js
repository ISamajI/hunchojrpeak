// "Piezas" (v5): the tray of ready-made pieces in the Construir step, the floating Girar / Poner aquí bar
// and the small sheet of a placed piece. The pointer work (ghost, fitting, grabbing placed pieces) lives in
// src/engine/buildtool.js (`tools.pieces`); this file is the panel around it.
// The store/engine side (fitPiece, placePiece, groupAt, moveGroup, pieceThumb...) is feature-detected.
import * as S from '../state.js';
import { t, pick, onLang } from '../i18n.js';
import { h } from './dom.js';
import { icon, hasIcon } from './icons.js';

const CATS = ['cuartos', 'paredes', 'aberturas', 'pisos', 'techo', 'exterior'];
const CAT_ICO = { cuartos: 'home', paredes: 'brick-wall', aberturas: 'door-open', pisos: 'slab', techo: 'window', exterior: 'fence' };
const KIND_ICO = { room: 'home', porch: 'columns-3', carport: 'car', balcony: 'slab', wall: 'brick-wall', column: 'columns-3', fence: 'fence', gate: 'gate', opening: 'door-open', slab: 'slab', stairs: 'stairs', roof: 'window', extra: 'container', yard: 'trees' };
const HINT_KEY = 'casa3d.pzHint';
const REASON_KEYS = ['outsideLot', 'overlap', 'noWall', 'noFence', 'noRoom', 'noSupport', 'maxLevels', 'maxItems', 'upperOnly', 'noHouse', 'stairsNowhere'];
const r2 = (n) => Math.round(n * 100) / 100;
const num = (n) => `${+(+n).toFixed(2)}`;

export function createPieces({ store, engine, ctx, ui, toast, b, act, render, getTools, setLevel, levelRow, openDraw, previewHouse }) {
  const pz = (b.pz = b.pz ?? { cat: 'cuartos', armed: null, sel: null, sl: 0, drag: false, state: { mode: 'idle' } });
  const tools = () => getTools();
  const phone = matchMedia('(max-width: 999px)');
  const catalog = () => S.PIECES ?? store.pieces ?? [];
  const byId = (id) => catalog().find((p) => p.id === id) ?? null;
  const catOf = (c) => catalog().filter((p) => p.cat === c);
  const nameOf = (p) => pick(p?.name).replace(/^Dormitorio/, 'Habitación'); // one word for a bedroom everywhere
  const sizeOf = (p) => {
    if (!p?.w) return '';
    return p.d && p.d >= 0.4 ? `${num(p.w)} × ${num(p.d)} ${t('unit.m')}` : `${num(p.w)} ${t('unit.m')}`;
  };
  const seen = () => { try { return localStorage.getItem(HINT_KEY) === '1'; } catch { return true; } };
  const markSeen = () => { try { localStorage.setItem(HINT_KEY, '1'); } catch { /* ignore */ } };
  let suppressClick = false;

  // ---------- thumbnails: asked once, a few at a time by the engine; icons until they arrive ----------
  const thumbs = new Map();
  const asked = new Set();
  const thumbImg = (id) => h('img', { src: thumbs.get(id), alt: '', width: 160, height: 120, draggable: 'false' });
  function wantThumb(id) {
    if (thumbs.has(id) || asked.has(id) || typeof engine.pieceThumb !== 'function') return;
    asked.add(id);
    Promise.resolve(engine.pieceThumb(id)).then((url) => {
      if (!url) { asked.delete(id); return; }
      thumbs.set(id, url);
      for (const el of document.querySelectorAll(`.pz-thumb[data-piece="${id}"]`)) { el.classList.remove('wait'); el.replaceChildren(thumbImg(id)); }
    }).catch(() => asked.delete(id));
  }
  const iconOf = (p) => icon(hasIcon(p.ico) ? p.ico : KIND_ICO[p.kind] ?? CAT_ICO[p.cat] ?? 'box', 34);

  // ---------- mode tabs ----------
  function tabs() {
    const tab = (id, ico, label) => h('button', {
      type: 'button', class: `pz-tab${b.tab === id ? ' on' : ''}`, 'aria-pressed': b.tab === id, 'data-key': `pz-tab:${id}`, onclick: () => openDraw(id),
    }, icon(ico, 24), h('span', null, label));
    return h('div', { class: 'pz-tabs', role: 'group', 'aria-label': t('pz.tabs') }, tab('pieces', 'layout-grid', t('pz.tab.pieces')), tab('draw', 'wall-draw', t('pz.tab.draw')));
  }

  // ---------- tray ----------
  function chips() {
    const row = h('div', { class: 'pz-chips', role: 'group', 'aria-label': t('pz.cats') });
    for (const c of CATS) {
      if (!catOf(c).length) continue;
      row.append(h('button', {
        type: 'button', class: `pz-chip${pz.cat === c ? ' on' : ''}`, 'aria-pressed': pz.cat === c, 'data-key': `pz-cat:${c}`,
        onclick: () => { pz.cat = c; pz.sl = 0; render(); },
      }, icon(CAT_ICO[c], 20), h('span', null, t(`pz.cat.${c}`))));
    }
    return row;
  }

  function card(p) {
    wantThumb(p.id);
    const on = pz.armed === p.id;
    const el = h('button', {
      type: 'button', class: `pz-card${on ? ' on' : ''}`, 'data-key': `pz:${p.id}`, 'data-piece': p.id, 'aria-pressed': on,
      'aria-label': `${nameOf(p)} ${sizeOf(p)}`,
      onclick: () => {
        if (suppressClick) return;
        if (pz.armed === p.id) { cancelArmed(); return; }
        markSeen();
        arm(p.id);
      },
    },
    h('span', { class: `pz-thumb${thumbs.has(p.id) ? '' : ' wait'}`, 'data-piece': p.id }, thumbs.has(p.id) ? thumbImg(p.id) : iconOf(p)),
    h('span', { class: 'pz-name' }, nameOf(p)),
    h('span', { class: 'pz-size num' }, sizeOf(p)));
    el.addEventListener('pointerdown', (e) => cardDown(e, p.id));
    return el;
  }

  // Press a card and pull it toward the house: phones go up (sideways scrolls the tray), desktop goes right; a mouse can go any way.
  function cardDown(e, id) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!e.isPrimary) return;
    const st = { x: e.clientX, y: e.clientY, pid: e.pointerId, touch: e.pointerType !== 'mouse', start: false };
    const stop = () => { window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', stop, true); window.removeEventListener('pointercancel', stop, true); };
    function move(ev) {
      if (ev.pointerId !== st.pid || st.start) return;
      const dx = ev.clientX - st.x, dy = ev.clientY - st.y;
      let go = false;
      if (!st.touch) go = Math.hypot(dx, dy) > 6;
      else if (phone.matches) go = dy < -14 && Math.abs(dy) >= Math.abs(dx) * 0.8;
      else go = dx > 14 && Math.abs(dx) >= Math.abs(dy) * 0.8;
      if (!go) return;
      st.start = true;
      stop();
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 400);
      markSeen();
      pz.armed = null;
      if (tools().pieces.grab(ev, id)) { pz.drag = true; paintBar(); }
    }
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', stop, true);
    window.addEventListener('pointercancel', stop, true);
  }

  function arm(id) {
    if (pz.sel) tools().pieces.select(null);
    if (!tools().pieces.arm(id)) { toast(t('bt.notReady'), { kind: 'bad', ms: 3000 }); return; }
    pz.armed = id;
    if (ui.sheet === 'tall') ctx.setSheet?.('half');
    render();
  }
  function cancelArmed() {
    tools().pieces.disarm();
    pz.armed = null;
    render();
  }

  const upEmpty = () => {
    const l = store.get().build?.levels?.[b.level];
    return b.level > 0 && !!l && !(l.walls?.length || l.slabs?.length);
  };
  function tray() {
    const list = catOf(pz.cat);
    const cards = h('div', { class: 'pz-cards', role: 'list', 'data-key': 'pz-cards' }, list.map(card));
    cards.addEventListener('scroll', () => { pz.sl = cards.scrollLeft; }, { passive: true });
    queueMicrotask(() => { cards.scrollLeft = pz.sl; });
    if (!list.length) cards.append(h('p', { class: 'muted-p' }, t('pz.none')));
    return [
      !seen() ? h('p', { class: 'pz-hint', role: 'note' }, icon('move', 20), t('pz.hint')) : null,
      upEmpty() ? h('p', { class: 'pz-hint', role: 'note', 'data-key': 'pz-up-hint' }, icon('layers', 20), t('pz.up')) : null,
      chips(),
      cards,
    ];
  }

  function piecesView() {
    if (pz.sel) return selectionView();
    return [levelRow(), tray()].flat().filter(Boolean);
  }

  // ---------- floating bar: label / reason + Girar, Poner aquí, Cancelar ----------
  const barText = h('span', { class: 'pz-text', 'data-key': 'pz-text' });
  const mk = (key, cls, fn, ...kids) => h('button', { type: 'button', class: `btn ${cls}`, 'data-key': key, onclick: fn }, ...kids);
  const rotBtn = mk('pz-rotate', 'btn-secondary', () => { if (rotDown) { rotDown = false; return; } tools().pieces.rotate(); }, icon('rotate-cw', 22), t('pz.rotate'));
  // While a finger holds the piece, Girar must react to a second finger at once and must not end that drag.
  let rotDown = false;
  rotBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (tools().pieces.state().mode === 'drag' && e.pointerType !== 'mouse') { e.preventDefault(); rotDown = true; tools().pieces.rotate(); setTimeout(() => { rotDown = false; }, 500); }
  });
  const putBtn = mk('pz-put', 'btn-primary', () => tools().pieces.place(), icon('check', 22), t('pz.put'));
  const cancelBtn = mk('pz-cancel', 'btn-secondary', cancelArmed, t('bt.cancel'));
  const bar = h('div', { class: 'pz-bar', role: 'status', 'aria-live': 'polite', hidden: true }, barText, h('span', { class: 'pz-acts' }, rotBtn, putBtn, cancelBtn));
  const reasonText = (r) => t(`pz.r.${REASON_KEYS.includes(r) ? r : 'unknown'}`);
  function paintBar() {
    const st = tools().pieces.state();
    pz.state = st;
    const p = byId(st.id);
    const live = b.on && b.tab === 'pieces' && st.mode !== 'idle' && !!p;
    bar.hidden = !live;
    document.body.classList.toggle('pz-bar-on', live);
    document.body.classList.toggle('pz-dragging', live && st.mode === 'drag');
    if (live) {
      const swap = st.rot % 180 !== 0;
      const size = p.w ? (p.d && p.d >= 0.4 ? `${num(swap ? p.d : p.w)} × ${num(swap ? p.w : p.d)} ${t('unit.m')}` : `${num(p.w)} ${t('unit.m')}`) : '';
      const bad = st.hasFit && !st.ok;
      barText.textContent = st.over ? t('pz.over') : bad ? reasonText(st.reason) : (/\d\s*m\b/.test(nameOf(p)) ? nameOf(p) : `${nameOf(p)} ${size}`).trim();
      bar.classList.toggle('bad', bad && !st.over);
      putBtn.hidden = st.mode !== 'armed';
      cancelBtn.hidden = st.mode !== 'armed';
      putBtn.disabled = !st.ok;
    }
    ctx.syncInset?.();
  }
  onLang(() => {
    rotBtn.lastChild.textContent = t('pz.rotate');
    putBtn.lastChild.textContent = t('pz.put');
    cancelBtn.textContent = t('bt.cancel');
    paintBar();
  });

  // ---------- callbacks from the tool ----------
  function onPiece(st) {
    pz.state = st;
    if (st.mode === 'idle') pz.drag = false;
    if (st.mode === 'armed' && !pz.armed && st.id) { pz.armed = st.id; queueMicrotask(render); }
    if (st.mode === 'idle' && pz.armed) { pz.armed = null; queueMicrotask(render); }
    paintBar();
  }
  function onPlaced({ level, pieceId }) {
    markSeen();
    clearBad();
    const kind = byId(pieceId)?.kind;
    // A roof lands on the top floor: show the whole house for a moment, but stay on the level he is building.
    if (kind === 'roof' || kind === 'extra') previewHouse();
    else if (level != null && level !== b.level) setLevel(level);
    paintBar();
  }
  function onPieceSelect(grp) {
    if (!grp && !pz.sel) return;
    pz.sel = grp ?? null;
    if (grp) { pz.armed = null; if (ui.sheet === 'min') ctx.setSheet?.('half'); }
    ui.stepChanged = true;
    render();
  }

  // ---------- placed piece: the small sheet ----------
  const groupName = (g) => (g?.label && typeof g.label === 'object' ? pick(g.label) : g?.label) || t(`pz.k.${g?.kind}`);
  function groupSize(g) {
    const bx = tools().pieces.bounds(g.ids);
    if (!bx) return '';
    const w = bx.x1 - bx.x0, d = bx.z1 - bx.z0;
    return d < 0.4 || w < 0.4 ? `${num(r2(Math.max(w, d)))} ${t('unit.m')}` : `${num(r2(w))} × ${num(r2(d))} ${t('unit.m')}`;
  }
  // Which v4 element opens for "Editar medidas": the room's floor, else the first wall / fence / stairs.
  function editTarget(g) {
    const B = store.get().build;
    if (!B) return null;
    const ids = new Set(g.ids);
    for (const l of B.levels ?? []) for (const s of l.slabs ?? []) if (ids.has(s.id)) return { kind: 'slab', id: s.id };
    for (const l of B.levels ?? []) for (const w of l.walls ?? []) if (ids.has(w.id)) return { kind: 'wall', id: w.id };
    for (const f of B.fences ?? []) if (ids.has(f.id)) return { kind: 'fence', id: f.id };
    for (const l of B.levels ?? []) for (const s of l.stairs ?? []) if (ids.has(s.id)) return { kind: 'stairs', id: s.id };
    return null;
  }
  function pieceOfGroup(g) {
    if (g.pieceId && byId(g.pieceId)) return byId(g.pieceId);
    const nm = String(groupName(g)).toLowerCase();
    return catalog().find((p) => p.name && (p.name.es.toLowerCase() === nm || p.name.en.toLowerCase() === nm)) ?? null;
  }
  function selectionView() {
    const g = pz.sel;
    const edit = editTarget(g);
    const dup = typeof store.duplicateGroup === 'function' || !!pieceOfGroup(g);
    const big = (key, ico, label, fn, cls = 'btn-secondary') => h('button', { type: 'button', class: `btn ${cls} pz-act`, 'data-key': key, onclick: fn }, icon(ico, 24), label);
    const lv = (tools().pieces.bounds(g.ids)?.level ?? b.level) + 1;
    return [
      h('div', { class: 'room-head sel-head' },
        h('button', { type: 'button', class: 'btn btn-secondary back-link', 'data-key': 'sel-back', onclick: () => tools().pieces.select(null) }, icon('chevron-left', 22), t('pz.tab.pieces')),
        h('div', { class: 'room-title', 'aria-live': 'polite' },
          h('h2', { class: 'step-title', 'data-key': 'sel-title' }, groupName(g)),
          h('p', { class: 'room-size num', 'data-key': 'sel-sub' }, `${groupSize(g)} · ${t('int.levelN', { n: lv })}`))),
      h('div', { class: 'pz-acts-grid' },
        big('pz-s-rotate', 'rotate-cw', t('pz.rotate'), () => rotateSel(g)),
        dup ? big('pz-s-dup', 'layers', t('pz.dup'), () => dupSel(g)) : null,
        edit ? big('pz-s-edit', 'pencil', t('pz.edit'), () => editSel(edit)) : null,
        big('pz-s-del', 'trash-2', t('pz.del'), () => delSel(g), 'btn-secondary btn-danger-outline')),
    ].filter(Boolean);
  }
  // A refused action says why in plain words (the engine returns false + buildReason, or { ok: false, reason }).
  function failToast(r) {
    const rs = (r && typeof r === 'object' ? r.reason : null) ?? store.buildReason?.();
    toast(t(`pz.r.${REASON_KEYS.includes(rs) ? rs : 'moveFail'}`), { kind: 'bad', ms: 3500 });
  }
  const clearBad = () => { for (const el of document.querySelectorAll('.toast-bad')) el.remove(); };
  const good = (r) => { const ok = r !== false && r != null && r.ok !== false; if (ok) clearBad(); return ok; };
  function rotateSel(g) {
    let r = false;
    try { r = typeof store.rotateGroup === 'function' ? store.rotateGroup(g.ids, 90) : false; } catch (err) { console.warn(err); }
    if (!good(r)) { failToast(r); return; }
    try { engine.dropAnim?.(g.ids); } catch { /* ignore */ }
    render();
  }
  function dupSel(g) {
    if (typeof store.duplicateGroup === 'function') {
      let r = false;
      try { r = store.duplicateGroup(g.ids); } catch (err) { console.warn(err); }
      if (!good(r)) { failToast(r); return; }
      if (r?.ids) { try { engine.dropAnim?.(r.ids); } catch { /* ignore */ } }
      return;
    }
    const p = pieceOfGroup(g);
    if (!p) return;
    tools().pieces.select(null);
    arm(p.id);
  }
  function editSel(target) {
    tools().pieces.select(null);
    openDraw('draw', target);
  }
  function delSel(g) {
    const name = groupName(g);
    const r = act(() => (typeof store.removeGroup === 'function' ? store.removeGroup(g.ids) : false), 'bt.removeFail');
    if (r === false) return;
    tools().pieces.select(null);
    toast(t('bt.s.removed', { what: name }), { action: { label: t('top.undo'), onClick: () => ctx.undo() } });
  }
  function deselect() {
    if (pz.sel) tools().pieces.select(null);
    pz.sel = null;
  }

  return { piecesView, tabs, bar, onPiece, onPlaced, onPieceSelect, getPiece: byId, deselect, paintBar, hasSelection: () => !!pz.sel, state: pz, catalog };
}
