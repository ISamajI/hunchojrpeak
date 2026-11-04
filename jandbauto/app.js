/* J&B Automotive — interactions */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var JB = (window.JB = window.JB || {});

  /* ------------------------------------------------------------
     Toast
  ------------------------------------------------------------ */
  var toastEl = $('.toast');
  var toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2400);
  }

  /* ------------------------------------------------------------
     Opening animation (garage door + tach sweep)
  ------------------------------------------------------------ */
  function buildTach() {
    var g = $('.tach__ticks');
    if (!g) return;
    var ns = 'http://www.w3.org/2000/svg';
    var cx = 110, cy = 110;
    for (var i = 0; i <= 40; i++) {
      var deg = -135 + (270 * i) / 40;
      var rad = (deg - 90) * Math.PI / 180;
      var major = i % 5 === 0;
      var r1 = major ? 78 : 84, r2 = 92;
      var l = document.createElementNS(ns, 'line');
      l.setAttribute('x1', (cx + r1 * Math.cos(rad)).toFixed(2));
      l.setAttribute('y1', (cy + r1 * Math.sin(rad)).toFixed(2));
      l.setAttribute('x2', (cx + r2 * Math.cos(rad)).toFixed(2));
      l.setAttribute('y2', (cy + r2 * Math.sin(rad)).toFixed(2));
      var cls = [];
      if (major) cls.push('major');
      if (i >= 30) cls.push('red');
      if (cls.length) l.setAttribute('class', cls.join(' '));
      g.appendChild(l);
      if (major) {
        var t = document.createElementNS(ns, 'text');
        t.setAttribute('x', (cx + 64 * Math.cos(rad)).toFixed(2));
        t.setAttribute('y', (cy + 64 * Math.sin(rad)).toFixed(2));
        t.textContent = String(i / 5);
        g.appendChild(t);
      }
    }
  }

  function startSite() {
    if (root.classList.contains('is-ready')) return;
    root.classList.add('is-ready');
    JB.ready = true;
  }

  function runIntro() {
    var intro = $('#intro');
    if (!intro) { startSite(); return; }

    var forced = /[?&]intro\b/.test(location.search);
    var seen = false;
    try { seen = sessionStorage.getItem('jb-intro') === '1'; } catch (e) { /* storage blocked */ }

    if (reduceMotion || (seen && !forced)) {
      intro.classList.add('is-done');
      startSite();
      return;
    }

    buildTach();
    document.body.classList.add('is-locked');
    var finished = false;
    var liftTimer, doneTimer;

    var lift = function () {
      if (finished) return;
      finished = true;
      clearTimeout(liftTimer);
      try { sessionStorage.setItem('jb-intro', '1'); } catch (e) { /* ignore */ }
      intro.classList.add('is-lifting');
      document.body.classList.remove('is-locked');
      setTimeout(startSite, 250);
      doneTimer = setTimeout(function () { intro.classList.add('is-done'); }, 1150);
      document.removeEventListener('keydown', onKey);
    };
    function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ' || e.key === 'Tab') { e.preventDefault(); lift(); }
    }
    var behind = $$('.header, main, .footer, .actionbar, .skip-link');
    behind.forEach(function (el) { el.setAttribute('inert', ''); });
    var liftCore = lift;
    lift = function () {
      behind.forEach(function (el) { el.removeAttribute('inert'); });
      liftCore();
    };

    requestAnimationFrame(function () { intro.classList.add('is-running'); });
    liftTimer = setTimeout(lift, 2500);
    intro.addEventListener('click', lift);
    document.addEventListener('keydown', onKey);
    JB.skipIntro = lift;
  }

  try { runIntro(); } catch (e) { root.classList.add('is-ready'); var intro0 = $('#intro'); if (intro0) intro0.classList.add('is-done'); }

  /* ------------------------------------------------------------
     Header: scrolled state, progress bar, active link, mobile menu
  ------------------------------------------------------------ */
  var header = $('.header');
  var bar = $('.progress span');
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY || window.pageYOffset;
      header.classList.toggle('is-scrolled', y > 20);
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var nav = $('#nav');
  var burger = $('.burger');
  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  burger.addEventListener('click', function () { setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
  $$('a', nav).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); burger.focus(); } });
  document.addEventListener('click', function (e) {
    if (nav.classList.contains('is-open') && !nav.contains(e.target) && !burger.contains(e.target)) setMenu(false);
  });
  window.addEventListener('resize', function () { if (window.innerWidth > 860) setMenu(false); });

  if ('IntersectionObserver' in window) {
    var links = {};
    $$('a', nav).forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && links[en.target.id]) {
          Object.keys(links).forEach(function (k) { links[k].classList.remove('is-active'); });
          links[en.target.id].classList.add('is-active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(links).forEach(function (id) { var s = document.getElementById(id); if (s) navIO.observe(s); });
  }

  /* ------------------------------------------------------------
     Live open / closed status (shop time = America/New_York)
  ------------------------------------------------------------ */
  var OPEN = 8 * 60, CLOSE = 18 * 60; // minutes after midnight
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function shopTime(date) {
    var day, mins;
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
      }).formatToParts(date);
      var p = {};
      parts.forEach(function (x) { p[x.type] = x.value; });
      day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
      var h = parseInt(p.hour, 10) % 24;
      mins = h * 60 + parseInt(p.minute, 10);
    } catch (e) {
      day = date.getDay();
      mins = date.getHours() * 60 + date.getMinutes();
    }
    return { day: day, mins: mins };
  }

  function statusAt(date) {
    var t = shopTime(date);
    var weekday = t.day >= 1 && t.day <= 5;
    if (weekday && t.mins >= OPEN && t.mins < CLOSE) {
      var left = CLOSE - t.mins;
      if (left <= 60) return { state: 'soon', day: t.day, text: 'Closing soon · ' + left + ' min left' };
      return { state: 'open', day: t.day, text: 'Open now · until 6 PM' };
    }
    var nextText;
    if (weekday && t.mins < OPEN) nextText = 'Opens today 8 AM';
    else if (t.day >= 1 && t.day <= 4) nextText = 'Opens tomorrow 8 AM';
    else nextText = 'Opens Monday 8 AM';
    return { state: 'closed', day: t.day, text: 'Closed · ' + nextText };
  }
  JB.statusAt = statusAt;

  function paintStatus() {
    var s = statusAt(new Date());
    $$('[data-status]').forEach(function (el) {
      el.classList.remove('is-open', 'is-soon', 'is-closed');
      el.classList.add('is-' + s.state);
      var tx = $('[data-status-text]', el);
      if (tx) tx.textContent = s.text;
    });
    $$('[data-hours] li').forEach(function (li) {
      li.classList.toggle('is-today', Number(li.getAttribute('data-day')) === s.day);
    });
  }
  paintStatus();
  setInterval(paintStatus, 30000);

  /* ------------------------------------------------------------
     Reveal on scroll + counters
  ------------------------------------------------------------ */
  function countUp(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (isNaN(target)) return;
    var noComma = el.hasAttribute('data-nocomma');
    var fmt = function (n) { return noComma ? String(n) : n.toLocaleString('en-US'); };
    if (reduceMotion) { el.textContent = fmt(target); return; }
    var start = target > 1000 ? target - 60 : 0;
    var dur = 1400, t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(Math.round(start + (target - start) * e));
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var revealEls = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        $$('[data-count]', en.target).concat(en.target.hasAttribute('data-count') ? [en.target] : []).forEach(countUp);
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ------------------------------------------------------------
     Form prefill helpers (used by explorer, decoder, planner)
  ------------------------------------------------------------ */
  var form = $('#form');
  var msg = $('#f-msg');
  function prefill(serviceValue, note) {
    if (serviceValue) {
      $$('[name="service"]', form).forEach(function (cb) { if (cb.value === serviceValue) cb.checked = true; });
    }
    if (note && msg && msg.value.indexOf(note) === -1) {
      var next = (msg.value ? msg.value.replace(/\s+$/, '') + '\n' : '') + note;
      msg.value = msg.maxLength > 0 ? next.slice(0, msg.maxLength) : next;
      msg.dispatchEvent(new Event('input'));
    }
  }

  /* ------------------------------------------------------------
     Repair explorer tabs + hero hotspots
  ------------------------------------------------------------ */
  var CAT_TO_SERVICE = {
    engines: 'Engine', drivetrain: 'Drive train / transmission', climate: 'Climate control / A/C', brakes: 'Brakes',
    electric: 'Electrical', exhaust: 'Exhaust / emissions', steering: 'Steering & suspension'
  };
  var tabs = $$('.explorer__tabs [role="tab"]');
  var currentCat = 'engines';
  function selectCat(cat, focus) {
    var tab = $('.explorer__tabs [data-cat="' + cat + '"]');
    if (!tab) return;
    currentCat = cat;
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    $$('[data-panel]').forEach(function (p) {
      var on = p.getAttribute('data-panel') === cat;
      p.hidden = !on;
      p.classList.remove('is-entering');
      if (on) {
        void p.offsetWidth; // restart animation
        p.classList.add('is-entering');
        $$('.tags li', p).forEach(function (li, i) { li.style.animationDelay = (i * 0.035) + 's'; });
      }
    });
    if (focus) tab.focus();
    // keep the active tab visible in the horizontal (mobile) strip without moving the page
    var strip = tab.parentElement;
    if (strip.scrollWidth > strip.clientWidth) {
      strip.scrollTo({ left: tab.offsetLeft - 16, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }
  JB.selectCat = selectCat;
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectCat(t.getAttribute('data-cat')); });
    t.addEventListener('keydown', function (e) {
      var k = e.key, n = null;
      if (k === 'ArrowDown' || k === 'ArrowRight') n = (i + 1) % tabs.length;
      else if (k === 'ArrowUp' || k === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
      else if (k === 'Home') n = 0;
      else if (k === 'End') n = tabs.length - 1;
      if (n !== null) { e.preventDefault(); selectCat(tabs[n].getAttribute('data-cat'), true); }
    });
  });

  $$('[data-goto]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      selectCat(el.getAttribute('data-goto'));
      var target = document.getElementById('services');
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
  });

  var readout = $('[data-hud-readout]');
  $$('.hotspot').forEach(function (h) {
    var label = $('.sr-only', h).textContent;
    h.setAttribute('data-label', label);
    h.setAttribute('aria-label', label + ' — view details');
    var show = function () { readout.textContent = 'SCAN › ' + label.toUpperCase(); readout.classList.add('is-hot'); };
    var hide = function () { readout.textContent = 'SYSTEMS NOMINAL'; readout.classList.remove('is-hot'); };
    h.addEventListener('mouseenter', show); h.addEventListener('focus', show);
    h.addEventListener('mouseleave', hide); h.addEventListener('blur', hide);
  });

  // car stroke draw setup
  $$('.car__draw').forEach(function (p) { p.setAttribute('pathLength', '1'); });

  var tabCta = $('[data-prefill-from-tab]');
  if (tabCta) tabCta.addEventListener('click', function () {
    var name = $('.explorer__tabs [data-cat="' + currentCat + '"]').textContent.replace(/^\d+/, '').trim();
    prefill(CAT_TO_SERVICE[currentCat], 'Repair needed: ' + name);
  });

  /* ------------------------------------------------------------
     Dashboard warning-light decoder
  ------------------------------------------------------------ */
  var LIGHTS = [
    { id: 'cel', name: 'Check Engine', sev: 'mid', u: .55, level: 'Moderate', action: 'Get it scanned soon',
      icon: '<path d="M4 10h2V8h3V6h6v2h2l2 2h2v6h-2l-2 2H9l-2-2H6v-2H4z"/><path d="M9 6V4h6v2"/>',
      means: 'Your engine computer has logged a fault somewhere in the engine, ignition, fuel, or emissions system. It can be anything from a loose gas cap to a failing sensor or misfire.',
      todo: 'If it\'s steady, schedule a diagnostic soon. If it\'s flashing, that usually means an active misfire — ease off and get it in right away to protect the catalytic converter.',
      tip: 'J&B tip: one of the most common triggers is a loose gas cap. Make sure it\'s clicked tight before you bring it in.' },
    { id: 'oil', name: 'Oil Pressure', sev: 'high', u: .95, level: 'Critical', action: 'Stop driving',
      icon: '<path d="M3 11h4l2-2h6l5-2-3 7H9l-2-2H3z"/><path d="M20 14c0 1.2-.9 2-1 3"/><path d="M5 9V7h3"/>',
      means: 'Oil pressure has dropped below a safe level. Without pressure, metal parts grind against each other and serious engine damage can happen within minutes.',
      todo: 'Pull over safely and shut the engine off. Check the oil level once it\'s cooled. Don\'t keep driving — call us and we\'ll arrange to get it here.' },
    { id: 'batt', name: 'Battery / Charging', sev: 'mid', u: .7, level: 'Serious', action: 'Head to the shop',
      icon: '<rect x="3" y="7" width="18" height="12" rx="1.5"/><path d="M7 7V5h3v2M14 7V5h3v2M7 13h3M15.5 11.5v3M14 13h3"/>',
      means: 'The charging system isn\'t keeping up — often the alternator, a worn belt, a bad connection, or the battery itself. The car is running on battery power alone.',
      todo: 'Turn off non-essential electronics (A/C, heated seats, radio) and drive straight to us or home. Avoid shutting the car off until you\'re somewhere safe.' },
    { id: 'temp', name: 'Engine Temp', sev: 'high', u: .9, level: 'Critical', action: 'Pull over & cool down',
      icon: '<path d="M12 3v10"/><path d="M12 3h3M12 6h3M12 9h3"/><circle cx="12" cy="16" r="2.5"/><path d="M4 20c1.3 0 1.3-1 2.7-1s1.3 1 2.6 1M14.7 20c1.3 0 1.3-1 2.6-1s1.4 1 2.7 1"/>',
      means: 'Your engine is overheating. Common causes include low coolant, a leaking hose, a stuck thermostat, a failed fan, or a water pump problem.',
      todo: 'Pull over and turn the engine off. Never open a hot radiator cap. Once cool, check coolant — then call us. We handle radiators, thermostats, fans, and hoses.' },
    { id: 'brake', name: 'Brake System', sev: 'high', u: .85, level: 'Urgent', action: 'Check before driving',
      icon: '<circle cx="12" cy="12" r="6"/><path d="M12 9v3.5M12 15h.01"/><path d="M4.5 6.5a9 9 0 0 0 0 11M19.5 6.5a9 9 0 0 1 0 11"/>',
      means: 'Either the parking brake is still engaged, brake fluid is low, or there\'s a problem in the hydraulic system. Low fluid often means worn pads or a leak.',
      todo: 'First make sure the parking brake is fully released. If the light stays on — or the pedal feels soft — don\'t risk it. Call us for a brake inspection.' },
    { id: 'abs', name: 'ABS', sev: 'mid', u: .5, level: 'Moderate', action: 'Drive carefully, book soon',
      icon: '<circle cx="12" cy="12" r="6.5"/><path d="M4.5 6.5a9 9 0 0 0 0 11M19.5 6.5a9 9 0 0 1 0 11"/><path d="M8.6 14.2l1.1-4.4 1.1 4.4M9 13h1.4M12.2 9.8h1.2a1 1 0 0 1 0 2.2h-1.2zm0 2.2h1.4a1.1 1.1 0 0 1 0 2.2h-1.4zM17 10.3a1.3 1.3 0 0 0-2.2.4c0 1.4 2.4.8 2.4 2.3a1.3 1.3 0 0 1-2.4.5" stroke-width="1.2"/>',
      means: 'The anti-lock braking system has detected a fault — often a wheel speed sensor. Your regular brakes still work, but wheels can lock in a hard stop.',
      todo: 'Leave extra following distance, especially on wet roads, and schedule a diagnostic. If the red brake light is on too, treat it as urgent.' },
    { id: 'tpms', name: 'Tire Pressure', sev: 'low', u: .3, level: 'Low', action: 'Check your tires',
      icon: '<path d="M7 5c-2 2-3 4.5-3 7s1 5 3 7M17 5c2 2 3 4.5 3 7s-1 5-3 7"/><path d="M7 19h10M5.5 21.5l1-2M18.5 21.5l-1-2"/><path d="M12 8v5M12 16h.01"/>',
      means: 'One or more tires is significantly under-inflated. Cold weather can trigger it, but so can a slow leak or nail.',
      todo: 'Check all four tires (and the door-jamb sticker for the right PSI) and inflate. If it keeps coming back, stop by — we sell, repair, and rotate tires.' },
    { id: 'eps', name: 'Power Steering', sev: 'mid', u: .6, level: 'Serious', action: 'Book an inspection',
      icon: '<circle cx="11" cy="12" r="7"/><circle cx="11" cy="12" r="2"/><path d="M4 12h5M13 12h5M11 14v5"/><path d="M20.5 7v4M20.5 14h.01"/>',
      means: 'The power steering system has a fault — low fluid, a failing pump, a leaking hose, or an electric steering sensor. Steering may suddenly feel heavy.',
      todo: 'Drive gently and avoid tight, slow-speed maneuvers if steering is stiff. Bring it in — racks, pumps, hoses, and flushes are all in-house.' }
  ];

  var dash = $('.dash');
  var out = $('.decoder__out');
  var SEV_COLOR = { high: 'var(--red)', mid: 'var(--amber)', low: 'var(--amber)' };
  var selectedLight = LIGHTS[0];

  LIGHTS.forEach(function (L, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'light';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', 'false');
    b.setAttribute('data-sev', L.sev);
    b.setAttribute('data-light', L.id);
    b.tabIndex = i === 0 ? 0 : -1;
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + L.icon + '</svg><span>' + L.name + '</span>';
    dash.appendChild(b);
  });
  var lightBtns = $$('.light', dash);

  function selectLight(id, focus) {
    var L = LIGHTS.filter(function (x) { return x.id === id; })[0];
    if (!L) return;
    selectedLight = L;
    lightBtns.forEach(function (b) {
      var on = b.getAttribute('data-light') === id;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on) {
        b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
        if (focus) b.focus();
      }
    });
    out.style.setProperty('--c', SEV_COLOR[L.sev]);
    $('[data-dec-icon]').innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + L.icon + '</svg>';
    $('[data-dec-title]').textContent = L.name;
    $('[data-dec-level]').textContent = L.level;
    $('[data-dec-action]').textContent = L.action;
    $('[data-dec-means]').textContent = L.means;
    $('[data-dec-do]').textContent = L.todo;
    var tip = $('[data-dec-tip]');
    tip.hidden = !L.tip;
    tip.textContent = L.tip || '';
    $('.urgency__bar span').style.setProperty('--u', L.u);
    out.classList.remove('is-swap'); void out.offsetWidth; out.classList.add('is-swap');
  }
  JB.selectLight = selectLight;
  lightBtns.forEach(function (b, i) {
    b.addEventListener('click', function () { selectLight(b.getAttribute('data-light')); });
    b.addEventListener('keydown', function (e) {
      var n = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % lightBtns.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + lightBtns.length) % lightBtns.length;
      if (n !== null) { e.preventDefault(); selectLight(lightBtns[n].getAttribute('data-light'), true); }
    });
  });
  selectLight('cel');
  out.classList.remove('is-swap');
  $('[data-dec-cta]').addEventListener('click', function () {
    prefill('Diagnostics / check engine', 'Warning light on: ' + selectedLight.name);
  });

  /* ------------------------------------------------------------
     Mileage maintenance planner
  ------------------------------------------------------------ */
  var MAINT = [
    { name: 'Oil & filter change', every: 5000 },
    { name: 'Tire rotation', every: 5000 },
    { name: 'Fluid levels topped off', every: 5000 },
    { name: 'Wiper blades', every: 15000 },
    { name: 'Engine air filter', every: 15000 },
    { name: 'Cabin air filter', every: 15000 },
    { name: 'Brake pad & rotor check', every: 15000 },
    { name: 'Hoses & belts inspection', every: 30000, major: true },
    { name: 'Exhaust inspection', every: 30000, major: true },
    { name: 'Engine tune-up', every: 30000, major: true },
    { name: 'Spark plugs & wires', every: 60000, major: true },
    { name: 'Transmission fluid change', every: 60000, major: true },
    { name: 'Radiator fluid change', every: 60000, major: true },
    { name: 'Timing belt replacement', every: 90000, major: true }
  ];
  function dueAt(m) { return MAINT.filter(function (x) { return m % x.every === 0; }); }
  JB.dueAt = function (m) { return dueAt(m).map(function (x) { return x.name; }); };

  var range = $('#miles');
  var odo = $('[data-odo]');
  var odoWrap = $('#odo');
  var dueList = $('[data-due-list]');
  var lastMiles = null;
  function fmt(n) { return n.toLocaleString('en-US'); }
  function updatePlanner() {
    var m = parseInt(range.value, 10);
    var min = parseInt(range.min, 10), max = parseInt(range.max, 10);
    range.style.setProperty('--p', ((m - min) / (max - min) * 100) + '%');
    range.setAttribute('aria-valuetext', fmt(m) + ' miles');
    if (m === lastMiles) return;
    lastMiles = m;
    odo.textContent = ('000000' + m).slice(-6).replace(/(\d{3})(\d{3})$/, '$1,$2');
    odoWrap.classList.remove('tick'); void odoWrap.offsetWidth; odoWrap.classList.add('tick');
    $('[data-due-at]').textContent = fmt(m);
    var items = dueAt(m);
    dueList.innerHTML = '';
    items.forEach(function (x, i) {
      var li = document.createElement('li');
      li.textContent = x.name;
      if (x.major) li.className = 'is-major';
      li.style.animationDelay = (i * 0.04) + 's';
      dueList.appendChild(li);
    });
    // what's new at the next milestone that isn't routine
    var next = m + 5000;
    var nextItems = dueAt(next).filter(function (x) { return x.every > 5000; });
    var search = next;
    while (!nextItems.length && search < m + 60000) {
      search += 5000;
      nextItems = dueAt(search).filter(function (x) { return x.every > 5000; });
    }
    $('[data-next-at]').textContent = fmt(search);
    $('[data-next-list]').textContent = nextItems.length
      ? 'Routine oil service, plus ' + nextItems.map(function (x) { return x.name.toLowerCase(); }).join(', ') + '.'
      : 'Routine oil service and rotation.';
  }
  range.addEventListener('input', updatePlanner);
  updatePlanner();
  $('[data-planner-cta]').addEventListener('click', function () {
    prefill('Scheduled maintenance', 'Maintenance at ~' + fmt(parseInt(range.value, 10)) + ' miles');
  });

  /* ------------------------------------------------------------
     Reviews carousel
  ------------------------------------------------------------ */
  var track = $('.carousel__track');
  var cards = $$('.review', track);
  var dotsWrap = $('.carousel__dots');
  var dots = cards.map(function (c, i) {
    var d = document.createElement('button');
    d.type = 'button';
    d.setAttribute('role', 'tab');
    d.setAttribute('aria-label', 'Review ' + (i + 1));
    d.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    d.addEventListener('click', function () { userTouched(); goTo(i); });
    dotsWrap.appendChild(d);
    return d;
  });
  function maxIndex() {
    // last index whose card can still align to the start of the track
    var maxScroll = track.scrollWidth - track.clientWidth;
    for (var i = 0; i < cards.length; i++) { if (cards[i].offsetLeft - cards[0].offsetLeft >= maxScroll - 2) return i; }
    return cards.length - 1;
  }
  function currentIndex() {
    var x = track.scrollLeft, best = 0, bestD = Infinity;
    cards.forEach(function (c, i) { var d = Math.abs(c.offsetLeft - cards[0].offsetLeft - x); if (d < bestD) { bestD = d; best = i; } });
    return best;
  }
  var target = 0;
  function goTo(i) {
    var mi = maxIndex();
    if (i > mi) i = 0;
    if (i < 0) i = mi;
    target = i;
    track.scrollTo({ left: cards[i].offsetLeft - cards[0].offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
    paintDots(i);
  }
  function paintDots(i) {
    var mi = maxIndex();
    dots.forEach(function (d, k) {
      d.setAttribute('aria-selected', String(k === i));
      d.hidden = k > mi;
    });
  }
  JB.carouselGoTo = goTo;
  var scrollT;
  track.addEventListener('scroll', function () {
    clearTimeout(scrollT);
    scrollT = setTimeout(function () { target = currentIndex(); paintDots(target); }, 120);
  }, { passive: true });
  $('[data-prev]').addEventListener('click', function () { userTouched(); goTo(target - 1); });
  $('[data-next]').addEventListener('click', function () { userTouched(); goTo(target + 1); });
  window.addEventListener('resize', function () { paintDots(currentIndex()); });
  paintDots(0);

  var autoTimer = null, paused = false, inView = false, touched = false;
  function userTouched() { touched = true; stopAuto(); }
  function startAuto() {
    if (reduceMotion || touched || autoTimer) return;
    autoTimer = setInterval(function () { if (!paused && inView) goTo(target + 1); }, 6000);
  }
  function stopAuto() { clearInterval(autoTimer); autoTimer = null; }
  var carousel = $('.carousel');
  carousel.addEventListener('mouseenter', function () { paused = true; });
  carousel.addEventListener('mouseleave', function () { paused = false; });
  carousel.addEventListener('focusin', function () { paused = true; });
  carousel.addEventListener('focusout', function () { paused = false; });
  track.addEventListener('touchstart', userTouched, { passive: true });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { inView = en[0].isIntersecting; if (inView) startAuto(); }, { threshold: 0.3 }).observe(carousel);
  }

  /* ------------------------------------------------------------
     Copy address
  ------------------------------------------------------------ */
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy');
      var done = function () { toast('Address copied ✓'); b.textContent = 'Copied'; clearTimeout(b._t); b._t = setTimeout(function () { b.textContent = 'Copy'; }, 1800); };
      var fallback = function () {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { toast(text); }
        document.body.removeChild(ta);
      };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    });
  });

  /* ------------------------------------------------------------
     Appointment form → pre-filled email
  ------------------------------------------------------------ */
  var phone = $('#f-phone');
  var counter = $('[data-counter]');
  function digits(v) { return v.replace(/\D/g, ''); }
  function normPhone(v) {
    var d = digits(v);
    if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
    return d;
  }
  var lastPhoneDigits = '';
  phone.addEventListener('input', function (e) {
    var raw = phone.value;
    var all = digits(raw);
    var deleting = !!(e && e.inputType && e.inputType.indexOf('delete') === 0);
    clearErr(phone);
    // backspacing over "(", ")", " " or "-" removes no digit: leave the field alone
    if (deleting && all === lastPhoneDigits) return;
    lastPhoneDigits = all;
    var d = (all.length === 11 && all.charAt(0) === '1') ? all.slice(1) : all;
    // too many digits: show them raw so the mistake is visible and validation catches it
    if (d.length > 10) { phone.value = all; return; }
    var f = d;
    if (d.length > 6) f = '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
    else if (d.length > 3) f = '(' + d.slice(0, 3) + ') ' + d.slice(3);
    else if (d.length > 0) f = '(' + d;
    if (f === raw) return;
    // keep the caret after the same digit it was after
    var caret = phone.selectionStart == null ? raw.length : phone.selectionStart;
    var before = digits(raw.slice(0, caret)).length - (all.length - d.length);
    phone.value = f;
    var pos = f.length;
    if (before <= 0) pos = f.charAt(0) === '(' ? 1 : 0;
    else for (var i = 0, n = 0; i < f.length; i++) { if (/\d/.test(f.charAt(i)) && ++n === before) { pos = i + 1; break; } }
    if (document.activeElement === phone) { try { phone.setSelectionRange(pos, pos); } catch (err) { /* not focusable yet */ } }
  });
  msg.addEventListener('input', function () { counter.textContent = msg.value.length + ' / ' + msg.maxLength; });
  $('#f-name').addEventListener('input', function () { clearErr(this); });

  function fieldOf(input) { return input.closest('.field'); }
  function setErr(input) { var f = fieldOf(input); f.classList.remove('invalid'); void f.offsetWidth; f.classList.add('invalid'); input.setAttribute('aria-invalid', 'true'); }
  function clearErr(input) { fieldOf(input).classList.remove('invalid'); input.removeAttribute('aria-invalid'); }

  function buildMailto(data) {
    var lines = [
      'Name: ' + data.name,
      'Phone: ' + data.phone,
      'Vehicle: ' + (data.vehicle || '—'),
      'Service: ' + (data.services.length ? data.services.join(', ') : '—'),
      'Free pick-up & delivery: ' + (data.pickup ? 'Yes, please' : 'No'),
      '',
      data.message || '',
      '',
      '— Sent from jandbauto.com'
    ];
    var subject = 'Appointment request — ' + data.name + (data.vehicle ? ' (' + data.vehicle + ')' : '');
    return 'mailto:jandbautonj@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
  }

  var success = $('.form__success');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('#f-name');
    var ok = true;
    if (!name.value.trim()) { setErr(name); ok = false; }
    if (normPhone(phone.value).length !== 10) { setErr(phone); ok = false; }
    if (!ok) { var first = $('.field.invalid input', form); if (first) first.focus(); return; }
    var p = normPhone(phone.value);
    var data = {
      name: name.value.trim(),
      phone: '(' + p.slice(0, 3) + ') ' + p.slice(3, 6) + '-' + p.slice(6),
      vehicle: $('#f-vehicle').value.trim(),
      services: $$('[name="service"]:checked', form).map(function (c) { return c.value; }),
      message: msg.value.trim(),
      pickup: $('#f-pickup').checked
    };
    var href = buildMailto(data);
    JB.lastMailto = href;
    success.hidden = false;
    success.focus();
    if (!JB.noNavigate) window.location.href = href;
  });
  $('[data-form-reset]').addEventListener('click', function () {
    form.reset();
    counter.textContent = '0 / ' + msg.maxLength;
    success.hidden = true;
    $('#f-name').focus();
  });

  /* ------------------------------------------------------------
     Lazy map
  ------------------------------------------------------------ */
  var mapBtn = $('[data-load-map]');
  if (mapBtn) mapBtn.addEventListener('click', function () {
    var holder = $('[data-map]');
    var f = document.createElement('iframe');
    f.title = 'Map to J&B Automotive, 301 Edinburg Rd, Mercerville NJ';
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer-when-downgrade';
    f.src = 'https://www.google.com/maps?q=' + encodeURIComponent('J & B Automotive, 301 Edinburg Rd, Mercerville, NJ 08619') + '&output=embed';
    holder.replaceWith(f);
  });

  /* ------------------------------------------------------------
     Micro-interactions: magnetic buttons, tilt cards
  ------------------------------------------------------------ */
  if (finePointer && !reduceMotion) {
    $$('.magnetic').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) / r.width;
        var y = (e.clientY - r.top - r.height / 2) / r.height;
        b.style.transform = 'translate(' + (x * 10).toFixed(1) + 'px,' + (y * 8).toFixed(1) + 'px)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });
    $$('.tilt').forEach(function (c) {
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        c.style.transform = 'perspective(800px) rotateY(' + (x * 10).toFixed(2) + 'deg) rotateX(' + (-y * 10).toFixed(2) + 'deg)';
      });
      c.addEventListener('pointerleave', function () { c.style.transform = ''; });
    });
  }

  /* ------------------------------------------------------------
     Misc
  ------------------------------------------------------------ */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

})();
