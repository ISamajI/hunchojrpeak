// UI entry. initUI({ store, engine }) builds the welcome screen, panel, top bar and dock.
import { t, onLang } from '../i18n.js';
import { h, isTextTarget, reducedMotion } from './dom.js';
import { createToaster, alertDialog } from './widgets.js';
import { createPanel } from './panel.js';
import { createChrome } from './chrome.js';
import { createWelcome } from './welcome.js';
import { openHouses } from './houses.js';
import { createTapSheet } from './tapsheet.js';
import { openGuide, wasGuided } from './guide.js';

const WELCOMED = 'casa3d.welcomed';
const BIGTEXT = 'casa3d.bigtext';

export function initUI({ store, engine }) {
  const html = document.documentElement;
  html.dataset.brand = 'casa';

  // The 3D labels use Archivo: redraw once it has loaded.
  document.fonts?.load?.('600 16px Archivo').then(() => engine.invalidate?.()).catch(() => {});
  document.fonts?.ready?.then(() => engine.invalidate?.());

  const stage = document.getElementById('stage');
  stage?.setAttribute('role', 'region');
  stage?.setAttribute('aria-label', t('a11y.stage'));
  const vignette = h('div', { id: 'vignette', 'aria-hidden': 'true' });
  stage?.after(vignette);

  const { host: toastHost, toast } = createToaster();
  const ui = { step: 2, sub: null, more: {}, msg: null, openPart: null, hiItem: null, view: '3d', sheet: 'half', stepChanged: false, reveal: null, level: 0, room: 'all', hiIndoor: null, prevView: '3d' };
  const ctx = { store, engine, ui, toast, welcomeOpen: false };

  // ---------- saving ----------
  let dirty = false;
  let saving = false;
  let suppress = false;
  let timer = 0;
  let storageWarned = false;

  async function thumb() {
    try { return await engine.screenshot({ width: 320, height: 200, type: 'jpeg', quality: 0.7 }); } catch { return undefined; }
  }
  function persist(name, thumbUrl) {
    saving = true;
    const id = store.projects.save(name, thumbUrl);
    saving = false;
    if (id) storageWarned = false;
    else if (!storageWarned) {
      storageWarned = true;
      alertDialog({ body: t('err.storage') });
    }
    return id;
  }
  async function flushSave() {
    clearTimeout(timer);
    if (!dirty) return;
    dirty = false;
    persist(undefined, await thumb());
  }
  async function autosave() {
    if (!dirty || ctx.welcomeOpen) return;
    dirty = false;
    const entry = store.projects.list().find((p) => p.id === store.projects.currentId());
    const id = persist(undefined, entry?.thumb ? undefined : await thumb());
    if (id) chrome.flashSaved();
  }
  store.subscribe(() => {
    if (saving || suppress) return;
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(autosave, 800);
  });

  // ---------- actions ----------
  ctx.undo = () => { if (store.canUndo()) { store.undo(); toast(t('toast.undo')); } };
  ctx.redo = () => { if (store.canRedo()) { store.redo(); toast(t('toast.redo')); } };
  ctx.save = async () => {
    clearTimeout(timer);
    const id = persist(store.get().name, await thumb());
    if (id) { dirty = false; toast(t('toast.saved')); } else toast(t('err.storage'), { kind: 'bad', ms: 4500 });
  };
  ctx.finish = async () => {
    await ctx.save();
    openHouses(ctx);
  };
  ctx.openHouses = () => openHouses(ctx);
  ctx.openProject = async (id) => {
    await flushSave();
    suppress = true;
    const ok = store.projects.open(id);
    suppress = false;
    dirty = false;
    if (ok) {
      ui.openPart = null;
      ui.hiItem = null;
      ui.room = 'all';
      ui.level = 0;
      ui.sub = null;
      ctx.tap?.close();
      panel.render();
      toast(t('toast.opened'));
      ctx.reveal();
    } else toast(t('err.generic'), { kind: 'bad' });
  };
  ctx.removeProject = (id) => {
    suppress = true;
    store.projects.remove(id);
    suppress = false;
    welcome.refresh();
  };
  ctx.newHouse = async () => {
    await flushSave();
    ui.fresh = true;
    ui.step = 2;
    ui.sub = null;
    ui.openPart = null;
    ui.hiItem = null;
    ui.room = 'all';
    ui.level = 0;
    ui.stepChanged = true;
    ctx.tap?.close();
    store.newDesign();
    panel.render();
  };
  ctx.startNew = () => {
    ui.fresh = true;
    ui.step = 2;
    ui.sub = null;
    ui.stepChanged = true;
    store.newDesign();
    try { localStorage.setItem(WELCOMED, '1'); } catch { /* ignore */ }
    closeWelcome();
    panel.render();
    if (!wasGuided()) openGuide({ onClose: () => chrome.setHint(ctx.sectionTip()) });
    else document.querySelector('.mode-btn[aria-checked="true"]')?.focus();
  };
  ctx.openGuide = () => { chrome.closePops(); openGuide({ onClose: () => chrome.setHint(ctx.sectionTip()) }); };

  // Optional bigger text (A+), remembered on this device.
  const applyBig = (on) => { html.classList.toggle('big-text', on); };
  try { applyBig(localStorage.getItem(BIGTEXT) === '1'); } catch { /* storage blocked */ }
  ctx.bigText = () => html.classList.contains('big-text');
  ctx.toggleBigText = () => {
    const on = !ctx.bigText();
    applyBig(on);
    try { localStorage.setItem(BIGTEXT, on ? '1' : '0'); } catch { /* ignore */ }
    chrome.update();
  };

  // The golden-hour reveal (engine decides how; reduced motion shows the final state at once). Called defensively.
  ctx.reveal = ({ keepTime = true } = {}) => {
    if (typeof engine.reveal !== 'function') return;
    try { Promise.resolve(engine.reveal({ skip: reducedMotion(), keepTime })).catch(() => {}); } catch { /* engine without reveal */ }
  };
  engine.on?.('reveal', ({ phase } = {}) => { if (phase === 'sun' && !reducedMotion()) chrome.showReveal(); });

  // The hint that fits the section he is in.
  ctx.sectionTip = () => (ui.step === 4 ? 'tip.orbit' : store.get().mode === 'build' || ui.sub === 'modestart' ? 'pz.hint' : ui.step === 3 ? 'tip.planEdit' : 'tip.tap');

  ctx.applySheet = () => {
    document.body.classList.toggle('sheet-min', ui.sheet === 'min');
    document.body.classList.toggle('sheet-tall', ui.sheet === 'tall');
  };

  ctx.setViewMode = (id) => {
    const v = { '3d': ['orbit', false], plan: ['top', false], walk: ['walk', false], inside: ['orbit', true] }[id];
    if (!v) return;
    ui.view = id;
    if (v[1]) { engine.setView(v[0]); engine.setCutaway(true); } else { engine.setCutaway(false); engine.setView(v[0]); }
    chrome.paintViews();
    chrome.closePops();
    ctx.afterView?.();
    if (id === 'walk') chrome.setHint(matchMedia('(pointer: coarse)').matches ? 'walk.helpTouch' : 'walk.help', true);
    else if (id === 'plan') chrome.setHint(ui.step === 3 ? 'tip.planEdit' : 'tip.top');
    else if (id === 'inside') chrome.setHint('tip.cutaway');
    else chrome.setHint(null);
  };

  // ---------- build ----------
  const chrome = createChrome(ctx);
  ctx.chrome = chrome;
  ctx.takePhoto = chrome.takePhoto;
  ctx.clearHint = () => chrome.setHint(null);
  ctx.tap = createTapSheet(ctx);
  const panel = createPanel(ctx);
  const welcome = createWelcome(ctx);
  const appUi = h('div', { class: 'app-ui' }, ...chrome.nodes, panel.el, ctx.tap.el, ...(ctx.build?.els ?? []));
  ctx.appEl = appUi;
  document.body.append(appUi, toastHost, welcome.el);
  ctx.applySheet();

  function closeWelcome() {
    ctx.welcomeOpen = false;
    welcome.el.hidden = true;
    appUi.inert = false;
    document.body.classList.remove('welcome-open');
  }
  const first = (() => { try { return !localStorage.getItem(WELCOMED); } catch { return false; } })();
  if (first && store.projects.list().length === 0) {
    ctx.welcomeOpen = true;
    appUi.inert = true;
    document.body.classList.add('welcome-open');
  } else {
    welcome.el.hidden = true;
  }

  store.subscribe(() => chrome.update());
  onLang(() => { welcome.refresh(); });

  // Undo/redo shortcuts (ignored while typing or when a dialog is open).
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || isTextTarget(e.target) || document.querySelector('dialog[open]')) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); ctx.undo(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); ctx.redo(); }
  });

  return { ctx };
}
