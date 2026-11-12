/* TNL Performance / Elite Athlete Development Block. Yellow edition.
   Intro (spinning logo), light interactions, lane, dock, who rows, 3-step reserve form, countdown.
   Every feature is isolated: a missing element never throws. */
(() => {
  'use strict';

  const doc = document;
  const root = doc.documentElement;
  root.classList.add('js');

  /* ---------- config ---------- */
  const CONTACT_EMAIL = 'connor@tnl-performance.org';
  const POST_TIMEOUT_MS = 15000;
  const DOB_MIN_AGE = 5;
  const DOB_MAX_AGE = 25;
  const INTRO_MS = 3100; // time the logo intro holds before the curtain lifts

  /* ---------- helpers ---------- */
  const $ = (sel, ctx = doc) => (ctx ? ctx.querySelector(sel) : null);
  const $$ = (sel, ctx = doc) => (ctx ? Array.from(ctx.querySelectorAll(sel)) : []);
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const pad2 = (n) => String(n).padStart(2, '0');
  const raf = window.requestAnimationFrame || ((fn) => window.setTimeout(fn, 16));

  const motionQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reducedMotion = () => Boolean(motionQuery && motionQuery.matches);
  const finePointer = typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const safely = (name, fn) => {
    try { fn(); } catch (err) { if (window.console && console.warn) console.warn(`[app] ${name} skipped:`, err); }
  };

  const scrollToEl = (el) => {
    if (!el || typeof el.scrollIntoView !== 'function') return;
    try { el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }); }
    catch (_) { el.scrollIntoView(true); }
  };

  const focusQuietly = (el) => {
    if (!el || typeof el.focus !== 'function') return;
    try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); }
  };

  const goToReserve = () => {
    const target = $('#reserve') || $('#reserve-form');
    if (!target) return false;
    scrollToEl(target);
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    focusQuietly(target);
    return true;
  };

  /* ---------- 0. intro: logo spins in, lightning cracks, curtain lifts ---------- */
  const initIntro = () => {
    const intro = $('#intro');
    const ready = () => {
      root.classList.remove('intro-on');
      root.classList.add('is-ready');
    };
    if (!intro) { ready(); return; }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      intro.classList.add('is-out');
      // let the page start rising underneath the lifting curtain
      window.setTimeout(ready, 250);
      window.setTimeout(() => { if (intro.parentNode) intro.parentNode.removeChild(intro); }, 1100);
    };

    // a buzz on the lightning crack, for phones that support it
    window.setTimeout(() => {
      if (!done && navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) { try { navigator.vibrate([18, 40, 12]); } catch (_) { /* ignore */ } }
    }, 1950);

    window.setTimeout(finish, reducedMotion() ? 700 : INTRO_MS);
    intro.addEventListener('pointerdown', finish);
    doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish(); }, { once: true });
  };

  /* ---------- 1. click sparks: little yellow bolts burst from buttons ---------- */
  const initSparks = () => {
    if (reducedMotion()) return;
    doc.addEventListener('pointerdown', (e) => {
      const hit = e.target && e.target.closest ? e.target.closest('.btn, .who-row, .foot-logo, .hero__num') : null;
      if (!hit) return;
      const n = 8;
      for (let i = 0; i < n; i += 1) {
        const s = doc.createElement('span');
        s.className = 'spark';
        s.style.left = `${e.clientX}px`;
        s.style.top = `${e.clientY}px`;
        s.style.setProperty('--r', `${(360 / n) * i + Math.random() * 20}deg`);
        s.style.setProperty('--d', `${28 + Math.random() * 34}px`);
        doc.body.appendChild(s);
        window.setTimeout(() => s.remove(), 650);
      }
    });
  };

  /* ---------- 2. hero: yellow spotlight follows the pointer, the 13 tilts ---------- */
  const initHero = () => {
    const hero = $('#hero');
    if (!hero || reducedMotion()) return;
    let queued = false;
    let last = null;
    const apply = () => {
      queued = false;
      if (!last) return;
      const r = hero.getBoundingClientRect();
      const x = clamp((last.x - r.left) / r.width, 0, 1);
      const y = clamp((last.y - r.top) / r.height, 0, 1);
      hero.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      hero.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      hero.style.setProperty('--tx', ((x - 0.5) * 2).toFixed(3));
      hero.style.setProperty('--ty', ((y - 0.5) * 2).toFixed(3));
    };
    const onMove = (e) => {
      last = { x: e.clientX, y: e.clientY };
      if (!queued) { queued = true; raf(apply); }
    };
    hero.addEventListener('pointermove', onMove, { passive: true });
    hero.addEventListener('pointerleave', () => {
      hero.style.setProperty('--tx', '0');
      hero.style.setProperty('--ty', '0');
    });

    // phones: tilt with the device, gently
    if (!finePointer && 'DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission !== 'function') {
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma == null) return;
        hero.style.setProperty('--tx', clamp(e.gamma / 30, -1, 1).toFixed(3));
        hero.style.setProperty('--ty', clamp((e.beta - 45) / 40, -1, 1).toFixed(3));
      }, { passive: true });
    }
  };

  /* ---------- 3. scroll progress bar + reveals ---------- */
  const initScrollFx = () => {
    const bar = $('#progress-bar');
    if (bar) {
      let queued = false;
      const update = () => {
        queued = false;
        const max = root.scrollHeight - window.innerHeight;
        bar.style.setProperty('--sp', max > 0 ? clamp(window.scrollY / max, 0, 1).toFixed(4) : '0');
      };
      window.addEventListener('scroll', () => { if (!queued) { queued = true; raf(update); } }, { passive: true });
      update();
    }

    const items = $$('.reveal');
    if (typeof window.IntersectionObserver !== 'function' || reducedMotion()) {
      items.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        // stagger siblings that arrive together
        const sibs = el.parentNode ? $$(':scope > .reveal', el.parentNode) : [];
        const idx = Math.max(0, sibs.indexOf(el));
        el.style.transitionDelay = `${Math.min(idx, 5) * 70}ms`;
        el.classList.add('in');
        io.unobserve(el);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    items.forEach((el) => io.observe(el));
  };

  /* ---------- 4. why line: words light up as it scrolls through ---------- */
  const initWhy = () => {
    const line = $('#why-line');
    if (!line) return;
    const HOT = /^(varsity|all-state|scholarships|mlb)/i;
    const words = line.textContent.trim().split(/\s+/);
    line.setAttribute('aria-label', line.textContent.trim());
    line.textContent = '';
    const spans = words.map((w, i) => {
      const s = doc.createElement('span');
      s.className = `w${HOT.test(w) ? ' hot' : ''}`;
      s.setAttribute('aria-hidden', 'true');
      s.textContent = w;
      line.appendChild(s);
      if (i < words.length - 1) line.appendChild(doc.createTextNode(' '));
      return s;
    });
    if (reducedMotion()) { spans.forEach((s) => s.classList.add('lit')); return; }
    let queued = false;
    const update = () => {
      queued = false;
      const r = line.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35), 0, 1);
      const count = Math.round(p * spans.length);
      spans.forEach((s, i) => s.classList.toggle('lit', i < count));
    };
    window.addEventListener('scroll', () => { if (!queued) { queued = true; raf(update); } }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  };

  /* ---------- 5. footer logo spins on tap ---------- */
  const initFootLogo = () => {
    const btn = $('#foot-logo');
    if (!btn) return;
    btn.addEventListener('click', () => {
      btn.classList.remove('spin');
      void btn.offsetWidth; // restart the animation
      btn.classList.add('spin');
    });
    btn.addEventListener('animationend', () => btn.classList.remove('spin'));
  };

  /* ---------- 6. 13-week lane ---------- */
  const initLane = () => {
    const lane = $('#lane');
    if (!lane) return;
    const ticks = $$('.lane__tick', lane);
    const weekTicks = ticks.filter((t) => !t.classList.contains('lane__tick--final'));
    const track = $('.lane__ticks', lane) || lane;

    const reserve = $('#lane-reserve');
    if (reserve) reserve.addEventListener('click', (e) => { if (goToReserve()) e.preventDefault(); });

    const setAllPassed = () => {
      ticks.forEach((t) => t.classList.add('is-passed'));
      lane.style.setProperty('--p', '1');
    };
    if (reducedMotion() || typeof window.IntersectionObserver !== 'function') { setAllPassed(); return; }

    let queued = false;
    let listening = false;
    const measure = () => {
      queued = false;
      const mid = (window.innerHeight || root.clientHeight || 0) / 2;
      const rect = track.getBoundingClientRect();
      const p = rect.height > 0 ? clamp((mid - rect.top) / rect.height, 0, 1) : 0;
      lane.style.setProperty('--p', p.toFixed(4));
      let current = null;
      ticks.forEach((t) => {
        const passed = t.getBoundingClientRect().top <= mid;
        t.classList.toggle('is-passed', passed);
        if (passed && weekTicks.includes(t)) current = t;
      });
      weekTicks.forEach((t) => t.classList.toggle('is-current', t === current));
    };
    const onScroll = () => { if (!queued) { queued = true; raf(measure); } };
    const listen = (on) => {
      if (on === listening) return;
      listening = on;
      const method = on ? 'addEventListener' : 'removeEventListener';
      window[method]('scroll', onScroll, { passive: true });
      window[method]('resize', onScroll, { passive: true });
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { listen(entry.isIntersecting); measure(); });
    });
    io.observe(lane);
    measure();
  };

  /* ---------- 7. sticky dock ---------- */
  const initDock = () => {
    const dock = $('#dock');
    if (!dock) return;
    if (typeof window.IntersectionObserver !== 'function') { dock.setAttribute('data-state', 'shown'); return; }
    const targets = [$('#hero-cta'), $('#reserve') || $('#reserve-form')].filter(Boolean);
    if (!targets.length) { dock.setAttribute('data-state', 'shown'); return; }
    const visible = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      dock.setAttribute('data-state', visible.size ? 'hidden' : 'shown');
    });
    targets.forEach((t) => io.observe(t));
  };

  /* ---------- 8. athlete-type rows ---------- */
  const initWho = () => {
    const rows = $$('.who-row');
    if (!rows.length) return;
    const panelFor = (row) => {
      const id = row.getAttribute('aria-controls');
      return id ? doc.getElementById(id) : null;
    };
    const setOpen = (row, open) => {
      row.setAttribute('aria-expanded', open ? 'true' : 'false');
      const panel = panelFor(row);
      if (panel) panel.hidden = !open;
    };
    rows.forEach((row) => setOpen(row, false));
    rows.forEach((row) => {
      row.addEventListener('click', () => {
        const open = row.getAttribute('aria-expanded') !== 'true';
        rows.forEach((other) => { if (other !== row) setOpen(other, false); });
        setOpen(row, open);
        if (!open) return;
        const grade = row.getAttribute('data-grade');
        const form = $('#reserve-form');
        if (grade && form) {
          const radios = $$('input[name="grade"]', form);
          const radio = radios.find((r) => r.value === grade);
          if (radio && !radios.some((r) => r.checked)) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      });
    });
  };

  /* ---------- 9. reserve form ---------- */
  const normalizePhone = (raw) => {
    let digits = String(raw || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1);
    if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return null;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const parseDob = (raw) => {
    const value = String(raw || '').trim();
    let y; let m; let d;
    let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
    if (match) {
      [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    } else {
      match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);
      if (!match) return null;
      [m, d, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    }
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return date;
  };

  const ageOn = (dob, now) => {
    let age = now.getFullYear() - dob.getFullYear();
    const hadBirthday = now.getMonth() > dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
    if (!hadBirthday) age -= 1;
    return age;
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const VALIDATORS = {
    athlete_name: (v) => (v.length < 2 ? "Enter the athlete's full name." : ''),
    athlete_dob: (v) => {
      if (!v) return "Enter the athlete's date of birth.";
      const dob = parseDob(v);
      if (!dob) return 'Enter a real date, like 04/15/2011.';
      const now = new Date();
      if (dob > now) return "Date of birth can't be in the future.";
      const age = ageOn(dob, now);
      if (age < DOB_MIN_AGE || age > DOB_MAX_AGE) return 'Check the year. This block is for middle school and high school athletes.';
      return '';
    },
    sports: (v) => (v ? '' : 'Enter the sport or sports played.'),
    school: (v) => (v ? '' : "Enter the athlete's current school."),
    grade: (v) => (v ? '' : 'Choose a grade level.'),
    parent_name: (v) => (v.length < 2 ? "Enter the parent's full name." : ''),
    parent_phone: (v) => {
      if (!v) return 'Enter a phone number.';
      return normalizePhone(v) ? '' : 'Enter a 10-digit US number with area code, like 609-555-0100.';
    },
    parent_email: (v) => {
      if (!v) return 'Enter an email address.';
      return EMAIL_RE.test(v) ? '' : 'Enter a valid email, like name@example.com.';
    },
    enrolled_fall: (v) => (v ? '' : 'Choose yes or no.'),
  };

  const MAIL_LABELS = [
    ['athlete_name', 'Athlete full name'],
    ['athlete_dob', 'Date of birth'],
    ['sports', 'Sport(s) played'],
    ['school', 'Current school'],
    ['grade', 'Grade level'],
    ['parent_name', 'Parent full name'],
    ['parent_phone', 'Parent phone'],
    ['parent_email', 'Parent email'],
    ['enrolled_fall', 'Enrolled in the 2026 FALL block'],
    ['sms_consent', 'Agreed to receive text messages'],
  ];

  const initForm = () => {
    const form = $('#reserve-form');
    if (!form) return;
    form.noValidate = true;

    const steps = $$('.step[data-step]', form);
    const indicators = $$('[data-step-ind]');
    const status = $('#step-status');
    const submitBtn = $('#submit-btn');
    const successPanel = $('#form-success');
    const fallbackPanel = $('#form-fallback');
    let current = 0;
    let busy = false;

    const controls = (name) => Array.from(form.elements || []).filter((el) => el && el.name === name);
    const labelText = (el) => {
      const label = el.labels && el.labels[0];
      const text = label ? label.textContent.replace(/\s+/g, ' ').trim() : '';
      return text || el.value;
    };
    const rawValue = (name) => {
      const els = controls(name);
      if (!els.length) return '';
      const first = els[0];
      if (first.type === 'radio') { const c = els.find((el) => el.checked); return c ? c.value : ''; }
      if (first.type === 'checkbox') return first.checked ? first.value || 'yes' : '';
      return String(first.value || '').trim();
    };
    const displayValue = (name) => {
      const els = controls(name);
      if (!els.length) return '';
      const first = els[0];
      if (first.type === 'radio') { const c = els.find((el) => el.checked); return c ? labelText(c) : ''; }
      if (first.type === 'checkbox') return first.checked ? 'Yes' : 'No';
      const value = String(first.value || '').trim();
      if (name === 'parent_phone') return normalizePhone(value) || value;
      if (name === 'athlete_dob') {
        const dob = parseDob(value);
        return dob ? `${pad2(dob.getMonth() + 1)}/${pad2(dob.getDate())}/${dob.getFullYear()}` : value;
      }
      return value;
    };

    const errorEl = (name) => doc.getElementById(`${name}-error`);
    const setError = (name, message) => {
      const err = errorEl(name);
      controls(name).forEach((el) => {
        if (message) el.setAttribute('aria-invalid', 'true');
        else el.removeAttribute('aria-invalid');
        if (err) {
          if (message) el.setAttribute('aria-describedby', err.id);
          else el.removeAttribute('aria-describedby');
        }
      });
      if (err) err.textContent = message || '';
    };
    const validateField = (name) => {
      const validator = VALIDATORS[name];
      if (!validator || !controls(name).length) return true;
      const message = validator(rawValue(name));
      setError(name, message);
      return !message;
    };
    const namesIn = (stepEl) => Object.keys(VALIDATORS).filter((name) => controls(name).some((el) => stepEl.contains(el)));
    const validateStep = (index) => {
      const stepEl = steps[index];
      const names = stepEl ? namesIn(stepEl) : Object.keys(VALIDATORS);
      let firstInvalid = null;
      names.forEach((name) => {
        if (validateField(name) || firstInvalid) return;
        const els = controls(name);
        firstInvalid = els.find((el) => el.type !== 'radio' || el.checked) || els[0] || null;
      });
      return firstInvalid;
    };

    const setStatus = (text) => { if (status) status.textContent = text; };
    const fillSummary = () => {
      $$('[data-sum]', $('#summary') || form).forEach((node) => {
        node.textContent = displayValue(node.getAttribute('data-sum')) || '-';
      });
    };
    form.addEventListener('change', fillSummary);

    const showStep = (index, moveFocus) => {
      if (!steps.length) return;
      current = clamp(index, 0, steps.length - 1);
      steps.forEach((stepEl, i) => { stepEl.hidden = i !== current; });
      const stepNo = Number(steps[current].getAttribute('data-step') || current + 1);
      indicators.forEach((ind) => {
        const n = Number(ind.getAttribute('data-step-ind'));
        if (n === stepNo) ind.setAttribute('aria-current', 'step');
        else ind.removeAttribute('aria-current');
        ind.classList.toggle('done', n < stepNo);
      });
      setStatus(`Step ${current + 1} of ${steps.length}`);
      if (current === steps.length - 1) fillSummary();
      if (!moveFocus) return;
      focusQuietly($('input:not([type="hidden"]), select, textarea', steps[current]) || $('button', steps[current]));
      if (form.getBoundingClientRect().top < 0) scrollToEl(form);
    };

    const goNext = () => {
      const invalid = validateStep(current);
      if (invalid) {
        focusQuietly(invalid);
        try { invalid.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' }); } catch (_) { /* ok */ }
        return false;
      }
      showStep(current + 1, true);
      return true;
    };

    const endpoint = () => {
      const value = (form.getAttribute('data-endpoint') || '').trim();
      if (!value || /fill\s*in|[[\]{}]/i.test(value) || value === '#') return '';
      if (value.charAt(0) === '/' && value.charAt(1) !== '/') return value;
      try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch (_) { return ''; }
    };

    const buildMailto = () => {
      const lines = ['Reservation request: Elite Athlete Development Block', ''];
      MAIL_LABELS.forEach(([name, label]) => {
        if (!controls(name).length) return;
        lines.push(`${label}: ${displayValue(name) || '-'}`);
      });
      const athlete = displayValue('athlete_name');
      const subject = athlete ? `Reserve a spot: ${athlete}` : 'Reserve a spot';
      return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\r\n'))}`;
    };

    const showPanel = (panel, state) => {
      form.setAttribute('data-state', state);
      if (!panel) return;
      form.hidden = true;
      const other = panel === successPanel ? fallbackPanel : successPanel;
      if (other) other.hidden = true;
      panel.hidden = false;
      focusQuietly(panel);
      scrollToEl($('#reserve') || panel);
    };

    const showFallback = (openMail) => {
      const href = buildMailto();
      $$('a[href^="mailto:"]', fallbackPanel).forEach((link) => link.setAttribute('href', href));
      const msgMail = $('#fallback-msg', fallbackPanel);
      const msgFail = $('#fallback-msg-fail', fallbackPanel);
      if (msgMail) msgMail.hidden = !openMail;
      if (msgFail) msgFail.hidden = openMail;
      showPanel(fallbackPanel, 'fallback');
      if (openMail) { try { window.location.href = href; } catch (_) { /* panel link is the manual path */ } }
    };

    const setBusy = (on) => {
      busy = on;
      if (on) form.setAttribute('aria-busy', 'true');
      else form.removeAttribute('aria-busy');
      if (!submitBtn) return;
      submitBtn.disabled = on;
      if (on) { submitBtn.setAttribute('data-label', submitBtn.textContent); submitBtn.textContent = 'Sending...'; }
      else if (submitBtn.hasAttribute('data-label')) { submitBtn.textContent = submitBtn.getAttribute('data-label'); submitBtn.removeAttribute('data-label'); }
    };

    const post = (url) => {
      const data = new FormData(form);
      const phone = normalizePhone(rawValue('parent_phone'));
      if (phone) data.set('parent_phone', phone);
      const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = ctrl ? window.setTimeout(() => ctrl.abort(), POST_TIMEOUT_MS) : 0;
      setBusy(true);
      setStatus('Sending...');
      return fetch(url, { method: 'POST', body: data, headers: { Accept: 'application/json' }, signal: ctrl ? ctrl.signal : undefined })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setBusy(false);
          setStatus('Sent.');
          showPanel(successPanel, 'sent');
        })
        .catch(() => { setBusy(false); showFallback(false); })
        .then(() => { if (timer) window.clearTimeout(timer); });
    };

    const submit = () => {
      if (busy) return;
      for (let i = 0; i < Math.max(steps.length, 1); i += 1) {
        const invalid = validateStep(i);
        if (invalid) {
          if (steps.length && i !== current) showStep(i, false);
          focusQuietly(invalid);
          return;
        }
      }
      const url = endpoint();
      if (!url || typeof window.fetch !== 'function' || typeof window.FormData !== 'function') { showFallback(true); return; }
      post(url);
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (steps.length && current < steps.length - 1) goNext();
      else submit();
    });
    form.addEventListener('click', (e) => {
      const target = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!target || !form.contains(target)) return;
      if (target.hasAttribute('data-next')) { e.preventDefault(); goNext(); }
      else if (target.hasAttribute('data-back')) { e.preventDefault(); showStep(current - 1, true); }
    });
    const recheck = (e) => {
      const name = e.target && e.target.name;
      if (!name || !VALIDATORS[name]) return;
      if (controls(name).some((el) => el.getAttribute('aria-invalid') === 'true')) validateField(name);
    };
    form.addEventListener('input', recheck);
    form.addEventListener('change', recheck);
    form.addEventListener('focusout', (e) => {
      const el = e.target;
      if (!el || el.name !== 'parent_phone') return;
      const formatted = normalizePhone(el.value);
      if (formatted) el.value = formatted;
    });

    if (successPanel) successPanel.hidden = true;
    if (fallbackPanel) fallbackPanel.hidden = true;
    showStep(0, false);
  };

  /* ---------- 10. countdown (hidden until data-start is a real date) ---------- */
  const initCountdown = () => {
    const box = $('#countdown');
    if (!box) return;
    const raw = (box.getAttribute('data-start') || '').trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(raw);
    if (!match) return;
    const start = match[4] ? new Date(raw) : new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(start.getTime())) return;
    const slots = { d: $('[data-cd="d"]', box), h: $('[data-cd="h"]', box), m: $('[data-cd="m"]', box), s: $('[data-cd="s"]', box) };
    let timer = 0;
    const tick = () => {
      const left = start.getTime() - Date.now();
      if (left <= 0) { box.hidden = true; if (timer) window.clearInterval(timer); return false; }
      const total = Math.floor(left / 1000);
      const parts = { d: Math.floor(total / 86400), h: Math.floor((total % 86400) / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
      Object.keys(slots).forEach((k) => { if (slots[k]) slots[k].textContent = pad2(parts[k]); });
      return true;
    };
    if (!tick()) return;
    box.hidden = false;
    timer = window.setInterval(tick, 1000);
  };

  /* ---------- boot ---------- */
  const boot = () => {
    safely('intro', initIntro);
    safely('sparks', initSparks);
    safely('hero', initHero);
    safely('scroll', initScrollFx);
    safely('why', initWhy);
    safely('footLogo', initFootLogo);
    safely('lane', initLane);
    safely('dock', initDock);
    safely('who', initWho);
    safely('form', initForm);
    safely('countdown', initCountdown);
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
