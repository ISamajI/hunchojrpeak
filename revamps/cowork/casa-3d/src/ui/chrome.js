// Top bar, view switch (3D | Plano | Caminar), the "Más" sheet (sun, theme, language, guide...), level bar and the hint chip.
import { LIMITS } from '../state.js';
import { t, applyI18n, onLang } from '../i18n.js';
import { h, nid } from './dom.js';
import { icon } from './icons.js';
import { langToggle } from './widgets.js';
import { radioKeys } from './controls.js';

const VIEWS = [
  { id: '3d', ico: 'box', key: 'view.orbit', tip: 'tip.orbit' },
  { id: 'plan', ico: 'layout-grid', key: 'view.top', tip: 'tip.top' },
  { id: 'walk', ico: 'footprints', key: 'view.walk', tip: 'tip.walk' },
];
const THEMES = ['auto', 'light', 'dark'];
const THEME_KEY = 'casa3d.theme';
const DUSK = 18.5; // hour after which the chrome goes dark in auto mode

const slug = (s) => (s || 'casa').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'casa';
const hhmm = (v) => {
  const m = Math.round(v * 24 * 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};

export function createChrome(ctx) {
  const { store, engine, ui, toast } = ctx;

  // ---------- top bar ----------
  const tb = (key, ico, onclick, dk) => h('button', {
    type: 'button', class: 'tb-btn', 'data-key': dk ?? key, onclick,
  }, icon(ico, 22), h('span', { 'data-i18n': key }, t(key)));

  const nameInput = h('input', {
    type: 'text', class: 'name-input', maxlength: '60', 'data-key': 'name', 'data-i18n-aria': 'top.name', 'aria-label': t('top.name'),
    onchange: (e) => {
      const v = e.target.value.trim() || 'Mi Casa';
      e.target.value = v;
      store.set('name', v);
    },
    onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
  });
  const savedChip = h('span', { class: 'saved-chip', 'aria-live': 'polite' });
  const undoBtn = tb('top.undo', 'undo-2', () => ctx.undo());
  const redoBtn = tb('top.redo', 'redo-2', () => ctx.redo());
  const housesBtn = tb('top.myHouses', 'folder-open', () => { closePops(); ctx.openHouses(); });
  const saveBtn = tb('top.save', 'save', () => { closePops(); ctx.save(); });
  const lang = langToggle();
  const menuBtn = h('button', { type: 'button', class: 'tb-btn menu-btn', 'aria-expanded': 'false', 'aria-controls': 'more-sheet', 'data-key': 'menu' },
    icon('ellipsis', 22), h('span', { 'data-i18n': 'view.more' }, t('view.more')));

  // ---------- Más sheet ----------
  const sunId = nid('sun');
  const sunIcon = h('span', { class: 'sun-ico' }, icon('sun', 22));
  const sunLabel = h('span', { class: 'sun-label' });
  const sunInput = h('input', {
    type: 'range', class: 'range sun-range', id: sunId, min: LIMITS.time[0], max: LIMITS.time[1], step: '0.01', 'data-key': 'sun',
    oninput: () => {
      if (engine.isRevealing?.()) engine.reveal?.({ skip: true }); // the reveal would overwrite his time at its end
      dragging = true; store.patch('env.time', +sunInput.value); paintSun();
    },
  });
  let dragging = false;
  const endSun = () => { if (!dragging) return; dragging = false; store.commit(); };
  for (const ev of ['change', 'pointerup', 'pointercancel', 'keyup', 'blur']) sunInput.addEventListener(ev, endSun);
  const ticks = h('div', { class: 'sun-ticks', 'aria-hidden': 'true' }, [6, 12, 18].map((hr) => h('span', {
    style: { left: `${((hr / 24 - LIMITS.time[0]) / (LIMITS.time[1] - LIMITS.time[0])) * 100}%` },
  }, String(hr))));
  // Luces: auto (lights glow at dusk), always on, always off.
  const lightBtns = ['auto', 'on', 'off'].map((v) => h('button', {
    type: 'button', role: 'radio', class: 'seg-btn', 'data-key': `lights:${v}`, 'data-v': v,
    onclick: () => store.set('env.lightsOn', v),
  }, h('span', { 'data-i18n': `lights.${v}` }, t(`lights.${v}`))));
  const lightsRow = h('div', { class: 'lights-row' },
    h('span', { class: 'lights-lbl', id: 'lights-lbl' }, icon('lamp', 20), h('span', { 'data-i18n': 'lights.title' }, t('lights.title'))),
    h('div', { class: 'seg lights-seg', role: 'radiogroup', 'aria-labelledby': 'lights-lbl' }, lightBtns));
  radioKeys(lightsRow.querySelector('.lights-seg'));
  const sunGroup = h('div', { class: 'sun-group' },
    h('label', { class: 'sun-top', for: sunId }, sunIcon, h('span', { 'data-i18n': 'view.sun' }, t('view.sun')), sunLabel), sunInput, ticks, lightsRow);

  const resetBtn = h('button', {
    type: 'button', class: 'tb-btn', 'data-key': 'reset', 'data-i18n-title': 'tip.reset', title: t('tip.reset'),
    onclick: () => { engine.resetCamera?.(); closePops(); },
  }, icon('locate-fixed', 22), h('span', { 'data-i18n': 'view.reset' }, t('view.reset')));
  const photoBtn = h('button', {
    type: 'button', class: 'tb-btn', 'data-key': 'photo', 'data-i18n-title': 'tip.photo', title: t('tip.photo'),
    onclick: () => { closePops(); takePhoto(); },
  }, icon('camera', 22), h('span', { 'data-i18n': 'view.photo' }, t('view.photo')));
  const guideBtn = h('button', { type: 'button', class: 'tb-btn', 'data-key': 'guide', onclick: () => ctx.openGuide() },
    icon('help-circle', 22), h('span', { 'data-i18n': 'more.guide' }, t('more.guide')));
  const bigBtn = h('button', { type: 'button', class: 'tb-btn', role: 'switch', 'aria-checked': 'false', 'data-key': 'bigtext', onclick: () => ctx.toggleBigText() },
    icon('type', 22), h('span', { 'data-i18n': 'more.bigText' }, t('more.bigText')));

  // Tema: auto (dark when the sun is low or the phone asks), light, dark.
  const readTheme = () => { try { const v = localStorage.getItem(THEME_KEY); return THEMES.includes(v) ? v : 'auto'; } catch { return 'auto'; } };
  let themePref = readTheme();
  const themeBtns = THEMES.map((v) => h('button', {
    type: 'button', role: 'radio', class: 'seg-btn', 'data-key': `theme:${v}`, 'data-v': v,
    onclick: () => { themePref = v; try { localStorage.setItem(THEME_KEY, v); } catch { /* ignore */ } applyTheme(); paintTheme(); },
  }, h('span', { 'data-i18n': `theme.${v}` }, t(`theme.${v}`))));
  const themeSeg = h('div', { class: 'theme-seg', role: 'radiogroup', 'aria-labelledby': 'theme-lbl' }, themeBtns);
  radioKeys(themeSeg);
  const themeRow = h('div', { class: 'group' },
    h('span', { class: 'lights-lbl', id: 'theme-lbl' }, icon('sun-moon', 20), h('span', { 'data-i18n': 'more.theme' }, t('more.theme'))), themeSeg);
  const darkMq = matchMedia('(prefers-color-scheme: dark)');
  function resolveTheme() {
    if (themePref !== 'auto') return themePref;
    return store.get().env.time * 24 >= DUSK || darkMq.matches ? 'dark' : 'light';
  }
  function applyTheme() {
    const th = resolveTheme();
    if (document.documentElement.dataset.theme === th) return;
    document.documentElement.dataset.theme = th;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', th === 'dark' ? '#12181A' : '#F3F1EC');
    try { engine.setTheme?.(th); } catch { /* engine without themes */ }
  }
  function paintTheme() {
    for (const b of themeBtns) { b.setAttribute('aria-checked', String(b.dataset.v === themePref)); b.tabIndex = b.dataset.v === themePref ? 0 : -1; }
  }
  darkMq.addEventListener?.('change', applyTheme);

  // Slots: on a wide screen Rehacer, Mis casas and the language switch sit in the bar; otherwise they live in Más.
  const slot = (cls) => h('div', { class: `slot ${cls}`, style: { display: 'contents' } });
  const sheetRedo = slot('s-redo');
  const sheetHouses = slot('s-houses');
  const sheetLang = slot('s-lang');
  const barA = slot('b-a');
  const barB = slot('b-b');
  const sunHome = slot('s-sun');
  const moreSheet = h('div', { class: 'more-sheet', id: 'more-sheet', role: 'group', 'aria-label': t('more.title') },
    sheetRedo, saveBtn, sheetHouses, sunHome, resetBtn, photoBtn, sheetLang, themeRow, bigBtn, guideBtn,
    h('button', { type: 'button', class: 'btn btn-primary', 'data-key': 'more-done', onclick: () => { closePops(); menuBtn.focus(); } }, icon('check', 22), h('span', { 'data-i18n': 'step.done' }, t('step.done'))));
  sunHome.append(sunGroup);

  const modeSlot = h('div', { class: 'mode-slot' });
  const brand = h('div', { class: 'brand' }, icon('home', 26), h('span', null, t('app.name')));
  const topbar = h('header', { class: 'topbar' },
    brand, undoBtn,
    h('label', { class: 'name-field' }, icon('pencil', 20), nameInput, savedChip),
    modeSlot,
    h('div', { class: 'tb-right' }, barA, menuBtn, barB));

  const wide = matchMedia('(min-width: 1280px)');
  function layout() {
    const w = wide.matches;
    (w ? barA : sheetRedo).append(redoBtn);
    (w ? barA : sheetHouses).append(housesBtn);
    (w ? barB : sheetLang).append(lang.el);
  }
  wide.addEventListener('change', layout);
  layout();

  // ---------- view switch ----------
  const viewBtns = VIEWS.map((v) => h('button', {
    type: 'button', role: 'radio', class: 'view-btn', 'data-key': `view:${v.id}`, 'data-view': v.id,
    'data-i18n-title': v.tip, title: t(v.tip), onclick: () => ctx.setViewMode(v.id),
  }, icon(v.ico, 22), h('span', { 'data-i18n': v.key }, t(v.key))));
  const views = h('div', { class: 'viewsw', role: 'radiogroup', 'aria-label': t('view.group'), 'data-i18n-aria': 'view.group' }, viewBtns);
  views.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const i = viewBtns.indexOf(document.activeElement);
    if (i < 0) return;
    const next = viewBtns[(i + (e.key === 'ArrowRight' ? 1 : viewBtns.length - 1)) % viewBtns.length];
    next.focus();
    next.click();
  });

  const levelHost = h('div', { class: 'levelbar', hidden: true });
  const revealCap = h('div', { class: 'reveal-cap', role: 'status' });
  const hint = h('div', { class: 'hint', role: 'status', 'aria-live': 'polite' });
  let hintKey = null;
  let hintTimer = 0;
  function setHint(key, sticky) {
    clearTimeout(hintTimer);
    hintKey = key;
    hint.textContent = key ? t(key) : '';
    hint.classList.toggle('show', !!key);
    if (key && !sticky) hintTimer = setTimeout(() => setHint(null), 4500);
  }
  let capTimer = 0;
  function showReveal() {
    revealCap.textContent = t('see.reveal');
    revealCap.classList.add('show');
    clearTimeout(capTimer);
    capTimer = setTimeout(() => revealCap.classList.remove('show'), 2500);
  }

  // ---------- Más open/close ----------
  function closePops() {
    moreSheet.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }
  menuBtn.addEventListener('click', () => {
    const open = !moreSheet.classList.contains('open');
    moreSheet.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('pointerdown', (e) => {
    if (moreSheet.classList.contains('open') && !moreSheet.contains(e.target) && !menuBtn.contains(e.target)) closePops();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !moreSheet.classList.contains('open')) return;
    closePops();
    menuBtn.focus();
  });

  // ---------- behaviour ----------
  function sunName(v) {
    return v < 0.42 ? t('time.morning') : v < 0.6 ? t('time.noon') : t('time.afternoon');
  }
  function paintSun() {
    const v = +sunInput.value;
    const pct = ((v - LIMITS.time[0]) / (LIMITS.time[1] - LIMITS.time[0])) * 100;
    sunInput.style.setProperty('--pct', `${pct}%`);
    sunLabel.textContent = hhmm(v);
    sunInput.setAttribute('aria-valuetext', `${hhmm(v)} ${sunName(v)}`);
    const name = v < 0.42 ? 'sunrise' : v < 0.6 ? 'sun' : 'sunset';
    if (sunIcon.dataset.n !== name) {
      sunIcon.dataset.n = name;
      sunIcon.replaceChildren(icon(name, 22));
    }
    // Stage-edge vignette warms toward dawn/dusk.
    document.documentElement.style.setProperty('--tint', Math.min(1, Math.abs(v - 0.5) / 0.3).toFixed(2));
    applyTheme();
  }

  async function takePhoto() {
    try {
      const url = await engine.screenshot();
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], `casa-${slug(store.get().name)}.png`, { type: 'image/png' });
      if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: store.get().name });
          return;
        } catch (e) {
          if (e?.name === 'AbortError') return;
        }
      }
      const a = h('a', { href: URL.createObjectURL(blob), download: file.name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(t('toast.photoSaved'));
    } catch {
      toast(t('err.generic'), { kind: 'bad', ms: 4500 });
    }
  }

  function paintViews() {
    // The cutaway ("Por dentro") is still a 3D view, so 3D stays lit.
    const cur = ui.view === 'inside' ? '3d' : ui.view;
    for (const b of viewBtns) {
      const on = b.dataset.view === cur;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
  }

  function update() {
    const s = store.get();
    if (document.activeElement !== nameInput && nameInput.value !== s.name) nameInput.value = s.name;
    nameInput.title = s.name; // full name on hover / long-press when it still has to truncate
    for (const [btn, ok] of [[undoBtn, store.canUndo()], [redoBtn, store.canRedo()]]) btn.setAttribute('aria-disabled', String(!ok));
    if (!dragging && +sunInput.value !== s.env.time) sunInput.value = s.env.time;
    paintSun();
    paintViews();
    paintTheme();
    bigBtn.setAttribute('aria-checked', String(!!ctx.bigText?.()));
    const lo = s.env.lightsOn ?? 'auto';
    for (const b of lightBtns) { b.setAttribute('aria-checked', String(b.dataset.v === lo)); b.tabIndex = b.dataset.v === lo ? 0 : -1; }
  }

  function flashSaved() {
    savedChip.replaceChildren(icon('check', 18), h('span', { class: 'sc-t' }, t('top.saved')));
    savedChip.classList.add('show');
    clearTimeout(flashSaved.t);
    flashSaved.t = setTimeout(() => savedChip.classList.remove('show'), 2600);
  }

  // The sun group moves into "Ver" while that tab is open (one slider, one data-key) and goes home otherwise.
  const homeSun = () => { if (sunGroup.parentNode !== sunHome) sunHome.append(sunGroup); };

  const applyLang = () => {
    applyI18n(topbar);
    applyI18n(views);
    applyI18n(moreSheet);
    brand.querySelector('span:last-child').textContent = t('app.name');
    moreSheet.setAttribute('aria-label', t('more.title'));
    lang.sync();
    savedChip.classList.remove('show');
    if (hintKey) hint.textContent = t(hintKey);
    update();
  };
  onLang(applyLang);

  update();
  return {
    nodes: [topbar, views, moreSheet, levelHost, hint, revealCap],
    update, setHint, paintViews, flashSaved, closePops, takePhoto, langSync: lang.sync,
    levelHost, modeSlot, sunGroup, homeSun, showReveal, applyTheme,
  };
}
