// Reusable panel controls. Each is built from current store state; the panel rebuilds
// them on every store change, except while a slider/color picker is mid-drag (`sync.busy`),
// when only registered syncers run so the dragged control stays alive.
import { t, pick } from '../i18n.js';
import { h, nid, getPath } from './dom.js';
import { icon } from './icons.js';

const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

// Arrow keys move through radios in a group and select (native radio behaviour).
export function radioKeys(container) {
  container.addEventListener('keydown', (e) => {
    if (!ARROWS.includes(e.key)) return;
    const radios = [...container.querySelectorAll('[role="radio"]:not([disabled])')];
    const i = radios.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
    const next = radios[(i + dir + radios.length) % radios.length];
    next.focus();
    next.click();
  });
  return container;
}

// Hold a stepper button: after 400 ms it repeats every 120 ms. The buttons are rebuilt on every change, so each tick
// clicks whatever button with the same data-key is on screen now. The click that ends a hold is swallowed.
let holdWired = false;
function wireHold() {
  if (holdWired) return;
  holdWired = true;
  let timer = 0;
  let tick = 0;
  let held = false;
  const stop = () => { clearTimeout(timer); clearInterval(tick); };
  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest?.('.step-btn');
    if (!btn || btn.disabled) return;
    const key = btn.dataset.key;
    held = false;
    stop();
    timer = setTimeout(() => {
      held = true;
      tick = setInterval(() => {
        const cur = [...document.querySelectorAll('.step-btn')].find((b) => b.dataset.key === key);
        if (!cur || cur.disabled) { stop(); return; }
        cur.click();
      }, 120);
    }, 400);
  }, true);
  for (const ev of ['pointerup', 'pointercancel']) document.addEventListener(ev, stop, true);
  document.addEventListener('click', (e) => {
    if (held && e.isTrusted && e.target.closest?.('.step-btn')) { e.stopPropagation(); e.preventDefault(); }
    held = false;
  }, true);
}

export function createControls({ store, sync, ui, render }) {
  wireHold();
  const group = (label, ...kids) => {
    const id = nid('g');
    return h('div', { class: 'group', role: 'group', 'aria-labelledby': id }, h('div', { class: 'lbl', id }, label), ...kids);
  };

  const fmtM = (v, dec) => `${dec ? (+v).toFixed(dec) : +(+v).toFixed(1)} ${t('unit.m')}`;

  // `def` is used while the saved design has no value yet; `dec` forces decimals ("3.0 m").
  function slider({ key, path, label, min, max, step = 1, def = min, dec = 0 }) {
    const id = nid('rng');
    const read = () => getPath(store.get(), path) ?? def;
    const value = read();
    const input = h('input', { type: 'range', class: 'range', id, min, max, step, value, 'data-key': key });
    const out = h('output', { class: 'readout num', for: id }, fmtM(value, dec));
    const paint = (v) => {
      input.style.setProperty('--pct', `${((v - min) / (max - min)) * 100}%`);
      input.setAttribute('aria-valuetext', fmtM(v, dec));
      out.textContent = fmtM(v, dec);
    };
    paint(value);
    sync.list.push(() => {
      const v = read();
      if (+input.value !== v) input.value = v;
      paint(v);
    });
    input.addEventListener('input', () => {
      sync.busy = true;
      paint(+input.value);
      store.patch(path, +input.value);
    });
    const end = () => {
      if (!sync.busy) return;
      sync.busy = false;
      store.commit();
    };
    for (const ev of ['change', 'pointerup', 'pointercancel', 'keyup', 'blur']) input.addEventListener(ev, end);
    return h('div', { class: 'group' }, h('div', { class: 'lbl-row' }, h('label', { class: 'lbl', for: id }, label), out), input);
  }

  // Big minus / value / plus. `step` and `fmt` let it do 0.5 m or 0.1 m jumps; `onSet` gets the new number.
  function stepper({ key, label, value, min, max, step = 1, fmt = String, onSet, minusText, plusText }) {
    const id = nid('st');
    const next = (dir) => Math.round((value + dir * step) * 100) / 100;
    const btn = (dir) => {
      const word = dir > 0 ? (plusText ?? t('size.more')) : (minusText ?? t('size.less'));
      return h('button', {
        type: 'button', class: 'btn btn-secondary step-btn', 'data-key': `${key}${dir > 0 ? '+' : '-'}`, 'aria-label': `${word}: ${label}`,
        disabled: dir > 0 ? value >= max - 1e-6 : value <= min + 1e-6,
        onclick: () => onSet(next(dir)),
      }, icon(dir > 0 ? 'plus' : 'minus', 22), h('span', null, word));
    };
    return h('div', { class: 'group', role: 'group', 'aria-labelledby': id },
      h('div', { class: 'lbl', id }, label),
      h('div', { class: 'stepper' }, btn(-1), h('output', { class: 'step-val num', 'data-key': `${key}=`, 'aria-live': 'polite' }, fmt(value)), btn(1)));
  }

  // "Más opciones" button that reveals advanced controls. Open state lives in ui.more so it survives re-renders.
  function more({ key, label, kids }) {
    const open = !!ui.more[key];
    return h('div', { class: `more${open ? ' open' : ''}` },
      h('button', {
        type: 'button', class: 'btn btn-ghost more-btn-row', 'aria-expanded': open, 'data-key': `more:${key}`,
        onclick: () => { ui.more[key] = !open; render(); },
      }, h('span', null, label ?? t('more.options')), h('span', { class: 'chev' }, icon('chevron-down', 22))),
      open ? h('div', { class: 'more-body' }, kids) : null);
  }

  const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
  // Swatch grid + "more colors" picker. `onPick(p)` for a swatch; `customPath` is the store path the picker writes.
  function colorGroup({ key, label, list, value, onPick, customPath, onCustomDone }) {
    const lid = nid('cg');
    const swatches = h('div', { class: 'swatches' }, list.map((p) => {
      const on = same(p.hex, value);
      return h('button', {
        type: 'button', class: `swatch${on ? ' on' : ''}`, 'aria-pressed': on, 'data-key': `sw:${key}:${p.hex}`,
        onclick: () => onPick(p),
      }, h('span', { class: 'sw-dot', style: { background: p.hex } }, on ? icon('check', 24) : null),
      h('span', { class: 'sw-name' }, p.name ? t(p.name) : pick(p)));
    }));
    const kids = [h('div', { class: 'lbl', id: lid }, label), swatches];
    if (customPath) {
      const mc = h('span', { class: 'mc-dot', style: { background: value } });
      const input = h('input', {
        type: 'color', value: /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : '#ffffff', 'data-key': `custom:${key}`,
        'aria-label': `${t('color.more')}: ${label}`,
        oninput: (e) => { sync.busy = true; mc.style.background = e.target.value; store.patch(customPath, e.target.value); },
        onchange: () => { sync.busy = false; store.commit(); onCustomDone?.(); },
        onblur: () => { if (sync.busy) { sync.busy = false; store.commit(); } },
      });
      kids.push(h('label', { class: 'btn btn-secondary more-colors' }, mc, t('color.more'), input));
    }
    return h('div', { class: 'group', role: 'group', 'aria-labelledby': lid }, kids);
  }

  // Single-choice buttons. `cards: true` gives the large card look (children supplied by opt.body).
  function choice({ key, label, options, value, onSet, cls = '', cards = false }) {
    const id = nid('ch');
    const sel = options.some((o) => o.value === value) ? value : options[0]?.value;
    const box = h('div', { class: `choice ${cards ? 'choice-cards' : 'seg'} ${cls}`, role: 'radiogroup', 'aria-labelledby': label ? id : null },
      options.map((o) => h('button', {
        type: 'button', role: 'radio', class: cards ? 'opt-card' : 'seg-btn', 'aria-checked': o.value === value,
        tabindex: o.value === sel ? 0 : -1, 'data-key': `${key}:${o.value}`, disabled: o.disabled,
        onclick: () => onSet(o.value),
      }, o.body ?? o.label, o.value === value ? h('span', { class: 'tick' }, icon('check', 18)) : null)));
    radioKeys(box);
    return label ? h('div', { class: 'group' }, h('div', { class: 'lbl', id }, label), box) : box;
  }

  function toggleCard({ key, label, ico, on, onToggle, disabled, hint }) {
    return h('button', {
      type: 'button', role: 'switch', class: `toggle-card${on ? ' on' : ''}`, 'aria-checked': on, 'data-key': key,
      disabled, onclick: () => onToggle(!on),
    },
    icon(ico, 28),
    h('span', { class: 'tc-name' }, label),
    h('span', { class: 'tc-state' }, on ? icon('check', 16) : null, hint ?? (on ? t('det.on') : t('det.off'))));
  }

  return { group, slider, stepper, choice, toggleCard, more, colorGroup };
}
