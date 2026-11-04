// Full test suite for the J&B site. Usage: node test.js <passLabel>
const { chromium, devices } = require('playwright');
const path = require('path');
const URL = 'http://localhost:8765/';
const OUT = path.join(__dirname, 'shots');
require('fs').mkdirSync(OUT, { recursive: true });
const label = process.argv[2] || 'run';

const results = [];
function check(name, cond, extra) {
  results.push({ name, ok: !!cond, extra });
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined && !cond ? '  -> ' + JSON.stringify(extra) : ''));
}

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext(opts);
  // block external network (fonts / maps) so tests are deterministic
  await ctx.route(/^https?:\/\/(?!localhost|fonts\.googleapis\.com|fonts\.gstatic\.com)/, r => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  return { ctx, page, errors };
}

async function overflowX(page) {
  return page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const bad = [];
    document.querySelectorAll('body *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > w + 1) && getComputedStyle(el).position !== 'fixed') {
        // ignore things inside horizontally-scrolling containers / marquee
        if (el.closest('.marquee, .carousel__track, .explorer__tabs')) return;
        bad.push(el.tagName + '.' + el.className + ' right=' + Math.round(r.right));
      }
    });
    return { scrollW: document.documentElement.scrollWidth, w, bad: bad.slice(0, 8) };
  });
}

(async () => {
  const browser = await chromium.launch();

  /* ---------------- Desktop ---------------- */
  {
    const { ctx, page, errors } = await newPage(browser, { viewport: { width: 1440, height: 900 } });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    const introVisible = await page.isVisible('#intro');
    check('intro shows on first load', introVisible);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${label}-intro.png` });
    check('body scroll locked during intro', await page.evaluate(() => document.body.classList.contains('is-locked')));
    await page.waitForFunction(() => document.getElementById('intro').classList.contains('is-done'), null, { timeout: 6000 });
    check('intro finishes & is removed', true);
    check('html.is-ready set', await page.evaluate(() => document.documentElement.classList.contains('is-ready')));
    check('scroll unlocked after intro', await page.evaluate(() => !document.body.classList.contains('is-locked')));
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${OUT}/${label}-hero.png` });

    const heroOpacity = await page.evaluate(() => getComputedStyle(document.querySelector('.hero__lede')).opacity);
    check('hero content visible after intro', heroOpacity === '1', heroOpacity);
    const ticks = await page.$$eval('.tach__ticks line', l => l.length);
    check('tach ticks built (41)', ticks === 41, ticks);

    // hotspot -> explorer
    await page.hover('.hotspot[data-goto="brakes"]');
    const ro = await page.textContent('[data-hud-readout]');
    check('HUD readout reacts to hotspot hover', /BRAKE/.test(ro), ro);
    await page.click('.hotspot[data-goto="brakes"]');
    await page.waitForTimeout(900);
    check('hotspot selects Brakes tab', await page.getAttribute('#tab-brakes', 'aria-selected') === 'true');
    check('brakes panel visible, engines hidden', await page.isVisible('#panel-brakes') && !(await page.isVisible('#panel-engines')));
    const servicesTop = await page.evaluate(() => document.getElementById('services').getBoundingClientRect().top);
    check('page scrolled to services', Math.abs(servicesTop) < 140, servicesTop);

    // keyboard on tabs
    await page.focus('#tab-brakes');
    await page.keyboard.press('ArrowDown');
    check('ArrowDown moves to Auto Electric', await page.getAttribute('#tab-electric', 'aria-selected') === 'true');
    await page.keyboard.press('End');
    check('End jumps to Steering', await page.getAttribute('#tab-steering', 'aria-selected') === 'true');
    await page.keyboard.press('ArrowDown');
    check('ArrowDown wraps to Engines', await page.getAttribute('#tab-engines', 'aria-selected') === 'true');
    const visiblePanels = await page.$$eval('[data-panel]', ps => ps.filter(p => !p.hidden).length);
    check('exactly one panel visible', visiblePanels === 1, visiblePanels);
    await page.screenshot({ path: `${OUT}/${label}-services.png` });

    // decoder
    await page.locator('#diagnostics').scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    const lights = await page.$$eval('.light', l => l.length);
    check('8 dashboard lights rendered', lights === 8, lights);
    check('check engine selected by default', await page.getAttribute('.light[data-light="cel"]', 'aria-checked') === 'true');
    check('gas cap tip shows for check engine', await page.isVisible('[data-dec-tip]'));
    await page.click('.light[data-light="oil"]');
    check('oil light selects', (await page.textContent('[data-dec-title]')) === 'Oil Pressure');
    check('oil marked critical', (await page.textContent('[data-dec-level]')) === 'Critical');
    check('tip hidden for oil', !(await page.isVisible('[data-dec-tip]')));
    const uWidth = await page.evaluate(() => document.querySelector('.urgency__bar span').style.getPropertyValue('--u'));
    check('urgency meter updated', uWidth === '0.95', uWidth);
    await page.focus('.light[data-light="oil"]');
    await page.keyboard.press('ArrowRight');
    check('arrow key moves to battery light', (await page.textContent('[data-dec-title]')) === 'Battery / Charging');
    await page.click('.light[data-light="temp"]');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${label}-decoder.png` });
    await page.click('[data-dec-cta]');
    await page.waitForTimeout(900);
    check('decoder CTA pre-checks Diagnostics pill', await page.isChecked('input[value="Diagnostics / check engine"]'));
    check('decoder CTA writes note', (await page.inputValue('#f-msg')).includes('Warning light on: Engine Temp'));

    // planner
    await page.locator('#maintenance').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    const setRange = async v => page.$eval('#miles', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
    await setRange(60000);
    const due60 = await page.$$eval('[data-due-list] li', l => l.map(x => x.textContent));
    check('60k shows transmission fluid', due60.includes('Transmission fluid change'), due60);
    check('60k shows oil change', due60.includes('Oil & filter change'));
    check('odometer shows 060,000', (await page.textContent('[data-odo]')) === '060,000', await page.textContent('[data-odo]'));
    await setRange(90000);
    const due90 = await page.$$eval('[data-due-list] li', l => l.map(x => x.textContent));
    check('90k shows timing belt', due90.includes('Timing belt replacement'), due90);
    check('90k does not show 60k items', !due90.includes('Transmission fluid change'));
    await setRange(150000);
    check('150k odometer', (await page.textContent('[data-odo]')) === '150,000');
    const next150 = await page.textContent('[data-next-at]');
    check('next milestone beyond max still sensible', /\d/.test(next150), next150);
    await setRange(5000);
    const due5 = await page.$$eval('[data-due-list] li', l => l.length);
    check('5k shows 3 routine items', due5 === 3, due5);
    check('5k next is 15,000', (await page.textContent('[data-next-at]')) === '15,000', await page.textContent('[data-next-at]'));
    await setRange(30000);
    await page.screenshot({ path: `${OUT}/${label}-planner.png` });

    // carousel
    await page.locator('#reviews').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const s0 = await page.$eval('.carousel__track', t => t.scrollLeft);
    await page.click('[data-next]');
    await page.waitForTimeout(900);
    const s1 = await page.$eval('.carousel__track', t => t.scrollLeft);
    check('carousel next scrolls', s1 > s0, [s0, s1]);
    const visDots = await page.$$eval('.carousel__dots button', d => d.filter(x => !x.hidden).length);
    check('desktop shows 4 reachable dots (6 cards, 3 per view)', visDots === 4, visDots);
    // go to the end and wrap
    for (let i = 0; i < 3; i++) { await page.click('[data-next]'); await page.waitForTimeout(800); }
    const sWrap = await page.$eval('.carousel__track', t => t.scrollLeft);
    check('carousel wraps back to start', sWrap < 5, sWrap);
    await page.click('[data-prev]');
    await page.waitForTimeout(900);
    const sPrev = await page.$eval('.carousel__track', t => t.scrollLeft);
    check('prev from start wraps to end', sPrev > 100, sPrev);
    await page.screenshot({ path: `${OUT}/${label}-reviews.png` });

    // contact: status, copy, form
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const today = await page.$$eval('[data-hours] li.is-today', l => l.length);
    check('exactly one "today" row in hours', today === 1, today);
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.click('[data-copy]');
    await page.waitForTimeout(300);
    check('copy shows toast', (await page.textContent('.toast')).includes('copied'));

    await page.evaluate(() => { window.JB.noNavigate = true; });
    await page.fill('#f-name', '');
    await page.fill('#f-phone', '');
    await page.click('#form button[type="submit"]');
    check('empty submit flags name', await page.$eval('#f-name', e => e.closest('.field').classList.contains('invalid')));
    check('empty submit flags phone', await page.$eval('#f-phone', e => e.closest('.field').classList.contains('invalid')));
    check('success not shown on invalid', !(await page.isVisible('.form__success')));
    await page.fill('#f-name', 'Pat Tester');
    check('typing clears name error', !(await page.$eval('#f-name', e => e.closest('.field').classList.contains('invalid'))));
    await page.type('#f-phone', '16095550123');
    check('phone auto-formats', (await page.inputValue('#f-phone')) === '(609) 555-0123', await page.inputValue('#f-phone'));
    // regression: plain 10-digit typing formats as you go
    await page.fill('#f-phone', '');
    await page.type('#f-phone', '6095550123');
    check('phone formats 10 typed digits', (await page.inputValue('#f-phone')) === '(609) 555-0123', await page.inputValue('#f-phone'));
    // regression: backspace keeps working through the formatting characters
    for (let i = 0; i < 6; i++) await page.keyboard.press('Backspace');
    const afterBs = await page.inputValue('#f-phone');
    check('backspace removes digits through formatting', afterBs.replace(/\D/g, '') === '6095', afterBs);
    // regression: caret stays put when editing mid-number
    await page.fill('#f-phone', '');
    await page.type('#f-phone', '609555012');
    await page.$eval('#f-phone', el => el.setSelectionRange(1, 1));
    await page.keyboard.type('7');
    check('mid-number edit keeps caret after typed digit', (await page.$eval('#f-phone', el => el.selectionStart)) === 2, await page.$eval('#f-phone', el => [el.value, el.selectionStart]));
    // regression: 11 digits not starting with 1 are rejected, not truncated
    await page.fill('#f-phone', '');
    await page.type('#f-phone', '26095550123');
    await page.click('#form button[type="submit"]');
    check('11-digit non-US number flagged invalid', await page.$eval('#f-phone', e => e.closest('.field').classList.contains('invalid')), await page.inputValue('#f-phone'));
    check('invalid phone does not show success', !(await page.isVisible('.form__success')));
    await page.fill('#f-phone', '');
    await page.type('#f-phone', '+1 (609) 555-0123');
    check('pasted +1 number normalizes', (await page.inputValue('#f-phone')) === '(609) 555-0123', await page.inputValue('#f-phone'));
    await page.fill('#f-vehicle', '2017 Honda Accord');
    await page.click('.pills label:has(input[value="Brakes"])');
    check('pill toggles on click', await page.isChecked('input[value="Brakes"]'));
    await page.click('.toggle');
    check('pickup toggle checks', await page.isChecked('#f-pickup'));
    await page.screenshot({ path: `${OUT}/${label}-form.png` });
    await page.click('#form button[type="submit"]');
    const mailto = await page.evaluate(() => window.JB.lastMailto);
    check('mailto generated', mailto && mailto.startsWith('mailto:jandbautonj@gmail.com?subject='), mailto);
    const body = decodeURIComponent((mailto || '').split('&body=')[1] || '');
    check('mailto body has name/phone/vehicle', body.includes('Pat Tester') && body.includes('(609) 555-0123') && body.includes('2017 Honda Accord'), body);
    check('mailto body has services', body.includes('Diagnostics / check engine') && body.includes('Brakes'), body);
    check('mailto body has pickup yes', body.includes('Free pick-up & delivery: Yes'));
    check('mailto body has decoder note', body.includes('Warning light on: Engine Temp'));
    check('success panel shown', await page.isVisible('.form__success'));
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${label}-form-success.png` });
    await page.click('[data-form-reset]');
    check('reset hides success & clears', !(await page.isVisible('.form__success')) && (await page.inputValue('#f-name')) === '');

    // map lazy load
    await page.click('[data-load-map]');
    check('map iframe injected', await page.$('.map iframe') !== null);

    // status logic
    const st = await page.evaluate(() => {
      const S = window.JB.statusAt;
      // all times in Eastern: use explicit offsets (Nov 2026 = EST -05:00, Jul = EDT -04:00)
      return {
        wedNoon: S(new Date('2026-11-04T12:00:00-05:00')).state,
        wed1730: S(new Date('2026-11-04T17:30:00-05:00')),
        wed18: S(new Date('2026-11-04T18:00:00-05:00')).text,
        wed7: S(new Date('2026-11-04T07:59:00-05:00')).text,
        fri19: S(new Date('2026-11-06T19:00:00-05:00')).text,
        sat: S(new Date('2026-11-07T10:00:00-05:00')).text,
        sunNight: S(new Date('2026-11-08T23:00:00-05:00')).text,
        mon8: S(new Date('2026-11-09T08:00:00-05:00')).state,
        julyThu: S(new Date('2026-07-09T09:00:00-04:00')).state,
        midnight: S(new Date('2026-11-05T00:30:00-05:00')).text,
      };
    });
    check('status: Wed noon open', st.wedNoon === 'open', st);
    check('status: Wed 5:30 closing soon w/ 30 min', st.wed1730.state === 'soon' && /30 min/.test(st.wed1730.text), st.wed1730);
    check('status: Wed 6pm closed, opens tomorrow', /Closed · Opens tomorrow/.test(st.wed18), st.wed18);
    check('status: Wed 7:59 opens today', /Opens today/.test(st.wed7), st.wed7);
    check('status: Fri 7pm opens Monday', /Opens Monday/.test(st.fri19), st.fri19);
    check('status: Sat opens Monday', /Opens Monday/.test(st.sat), st.sat);
    check('status: Sun 11pm opens Monday (tomorrow)', /Opens Monday/.test(st.sunNight), st.sunNight);
    check('status: Mon 8:00 open', st.mon8 === 'open', st.mon8);
    check('status: DST summer works', st.julyThu === 'open');
    check('status: Thu 12:30am opens today', /Opens today/.test(st.midnight), st.midnight);

    // header
    check('header gets scrolled style', await page.evaluate(() => document.querySelector('.header').classList.contains('is-scrolled')));
    const prog = await page.evaluate(() => document.querySelector('.progress span').style.transform);
    check('progress bar advances', /scaleX\(0\.[1-9]|scaleX\(1/.test(prog), prog);

    // all reveal elements become visible when scrolled through
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 60)); } });
    await page.waitForTimeout(1200);
    const hiddenReveals = await page.$$eval('[data-reveal]', els => els.filter(e => !e.classList.contains('in')).length);
    check('all reveal elements revealed after full scroll', hiddenReveals === 0, hiddenReveals);
    const counts = await page.$$eval('[data-count]', els => els.map(e => e.textContent));
    check('counters land on final values', JSON.stringify(counts) === JSON.stringify(['1978', '130', '8']), counts);

    const ov = await overflowX(page);
    check('desktop: no horizontal overflow', ov.scrollW <= ov.w && ov.bad.length === 0, ov);

    // footer goto link
    await page.click('.footer a[data-goto="exhaust"]');
    await page.waitForTimeout(900);
    check('footer Emissions link opens Exhaust tab', await page.getAttribute('#tab-exhaust', 'aria-selected') === 'true');

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${label}-desktop-full.png`, fullPage: true });

    // second load in same session -> intro skipped
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    check('intro skipped on repeat visit in session', await page.evaluate(() => document.getElementById('intro').classList.contains('is-done')));
    // forced intro + skip by click
    await page.goto(URL + '?intro', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    await page.click('[data-skip-intro]');
    await page.waitForTimeout(1400);
    check('skip button dismisses intro', await page.evaluate(() => document.getElementById('intro').classList.contains('is-done')));
    // keyboard skip
    await page.goto(URL + '?intro', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1400);
    check('Escape dismisses intro', await page.evaluate(() => document.getElementById('intro').classList.contains('is-done')));
    // regression: Space skips the intro without scrolling the page
    await page.evaluate(() => sessionStorage.clear());
    await page.goto(URL + '?intro', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    check('page behind intro is inert', await page.evaluate(() => document.querySelector('main').hasAttribute('inert')));
    await page.keyboard.press('Space');
    await page.waitForTimeout(1400);
    check('Space skips intro', await page.evaluate(() => document.getElementById('intro').classList.contains('is-done')));
    check('Space skip does not scroll page', (await page.evaluate(() => window.scrollY)) < 5, await page.evaluate(() => window.scrollY));
    check('inert removed after intro', await page.evaluate(() => !document.querySelector('main').hasAttribute('inert')));
    // regression: prefill respects the 1200-char limit
    await page.evaluate(() => { const m = document.getElementById('f-msg'); m.value = 'x'.repeat(1195); m.dispatchEvent(new Event('input')); });
    await page.evaluate(() => document.querySelector('[data-dec-cta]').click());
    check('prefill never exceeds maxlength', (await page.$eval('#f-msg', m => m.value.length)) <= 1200, await page.$eval('#f-msg', m => m.value.length));

    check('desktop: no JS errors', errors.length === 0, errors);
    await ctx.close();
  }

  /* ---------------- Mobile ---------------- */
  {
    const { ctx, page, errors } = await newPage(browser, { ...devices['iPhone 13'] });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${label}-m-intro.png` });
    await page.waitForFunction(() => document.getElementById('intro').classList.contains('is-done'), null, { timeout: 6000 });
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${OUT}/${label}-m-hero.png` });
    check('mobile: action bar visible', await page.isVisible('.actionbar'));
    check('mobile: nav hidden by default', !(await page.isVisible('#nav a')));
    await page.tap('.burger');
    await page.waitForTimeout(450);
    check('mobile: burger opens nav', await page.isVisible('#nav a[href="#about"]'));
    check('mobile: burger aria-expanded', await page.getAttribute('.burger', 'aria-expanded') === 'true');
    await page.screenshot({ path: `${OUT}/${label}-m-menu.png` });
    await page.tap('#nav a[href="#about"]');
    await page.waitForTimeout(2200);
    check('mobile: nav closes after link tap', await page.getAttribute('.burger', 'aria-expanded') === 'false');
    const aboutTop = await page.evaluate(() => document.getElementById('about').getBoundingClientRect().top);
    check('mobile: scrolled to About (below header)', aboutTop > 30 && aboutTop < 140, aboutTop);

    // tabs strip on mobile
    await page.locator('#services').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.tap('#tab-steering');
    await page.waitForTimeout(500);
    check('mobile: tapping tab switches panel', await page.isVisible('#panel-steering'));
    await page.screenshot({ path: `${OUT}/${label}-m-services.png` });

    await page.locator('#diagnostics').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.tap('.light[data-light="tpms"]');
    check('mobile: light tap works', (await page.textContent('[data-dec-title]')) === 'Tire Pressure');
    await page.screenshot({ path: `${OUT}/${label}-m-decoder.png` });

    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 300) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 50)); } });
    await page.waitForTimeout(1200);
    const ov = await overflowX(page);
    check('mobile: no horizontal overflow', ov.scrollW <= ov.w && ov.bad.length === 0, ov);
    const visDots = await page.$$eval('.carousel__dots button', d => d.filter(x => !x.hidden).length);
    check('mobile: 6 reachable review dots', visDots === 6, visDots);
    // action bar should not hide the footer's last line
    const footerBottomVisible = await page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
      const fb = document.querySelector('.footer__bottom').getBoundingClientRect();
      const ab = document.querySelector('.actionbar').getBoundingClientRect();
      return fb.bottom <= ab.top + 1;
    });
    check('mobile: action bar does not cover footer', footerBottomVisible);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${label}-m-full.png`, fullPage: true });
    check('mobile: no JS errors', errors.length === 0, errors);
    await ctx.close();
  }

  /* ---------------- Tablet ---------------- */
  {
    const { ctx, page, errors } = await newPage(browser, { viewport: { width: 820, height: 1180 } });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('intro').classList.contains('is-done'), null, { timeout: 6000 });
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 50)); } });
    await page.waitForTimeout(1000);
    const ov = await overflowX(page);
    check('tablet: no horizontal overflow', ov.scrollW <= ov.w && ov.bad.length === 0, ov);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${label}-t-full.png`, fullPage: true });
    check('tablet: no JS errors', errors.length === 0, errors);
    await ctx.close();
  }

  /* ---------------- Layout sweep (QA round 2) ---------------- */
  for (const w of [320, 360, 390, 768, 900, 1024, 1280, 1920]) {
    const { ctx, page, errors } = await newPage(browser, { viewport: { width: w, height: 900 } });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.JB.skipIntro && window.JB.skipIntro());
    await page.waitForFunction(() => document.getElementById('intro').classList.contains('is-done'), null, { timeout: 6000 });
    const head = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      return [...document.querySelectorAll('.header__inner > *, .header__actions > *')]
        .filter(el => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width)
        .filter(el => !el.closest('.nav') || getComputedStyle(document.getElementById('nav')).position !== 'fixed')
        .map(el => ({ c: el.className, r: Math.round(el.getBoundingClientRect().right) }))
        .filter(x => x.r > vw + 1);
    });
    check(`${w}px: header fits`, head.length === 0, head);
    await page.locator('#about').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1100);
    const overlap = await page.evaluate(() => {
      const b = document.querySelector('.ase-badge').getBoundingClientRect();
      return [...document.querySelectorAll('.owner figcaption')].some(f => {
        const r = f.getBoundingClientRect();
        return !(r.bottom <= b.top || r.top >= b.bottom || r.right <= b.left || r.left >= b.right);
      });
    });
    check(`${w}px: ASE badge clear of owner captions`, !overlap);
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 40)); } });
    await page.waitForTimeout(900);
    const ov = await overflowX(page);
    check(`${w}px: no horizontal overflow`, ov.scrollW <= ov.w && ov.bad.length === 0, ov);
    if (w <= 400) {
      const todayLines = await page.evaluate(() => { const el = document.querySelector('.hours li.is-today span:last-child'); return el ? Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight || 20)) : 1; });
      check(`${w}px: today's hours on one line`, todayLines <= 1, todayLines);
    }
    check(`${w}px: no JS errors`, errors.length === 0, errors);
    await ctx.close();
  }
  {
    // burger menu moves focus into the menu
    const { ctx, page } = await newPage(browser, { viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.JB.skipIntro && window.JB.skipIntro());
    await page.waitForTimeout(1300);
    await page.click('.burger');
    await page.waitForTimeout(200);
    check('menu open focuses first link', await page.evaluate(() => document.activeElement && document.activeElement.closest('#nav') !== null));
    await ctx.close();
  }

  /* ---------------- Reduced motion ---------------- */
  {
    const { ctx, page, errors } = await newPage(browser, { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    check('reduced motion: intro skipped instantly', await page.evaluate(() => document.getElementById('intro').classList.contains('is-done')));
    const vis = await page.evaluate(() => getComputedStyle(document.querySelector('.hero__lede')).opacity);
    check('reduced motion: hero visible', vis === '1', vis);
    const rev = await page.$$eval('[data-reveal]', els => els.every(e => e.classList.contains('in')));
    check('reduced motion: all content revealed', rev);
    check('reduced motion: no JS errors', errors.length === 0, errors);
    await ctx.close();
  }

  /* ---------------- No JS ---------------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, javaScriptEnabled: false });
    await ctx.route(/^https?:\/\/(?!localhost|fonts\.googleapis\.com|fonts\.gstatic\.com)/, r => r.abort());
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    check('no-JS: intro not blocking', !(await page.isVisible('#intro')));
    check('no-JS: hero visible', await page.isVisible('.hero__title'));
    check('no-JS: phone link present', await page.isVisible('a[href="tel:+16098901441"]'));
    await ctx.close();
  }

  await browser.close();
  const fails = results.filter(r => !r.ok);
  console.log(`\n${label}: ${results.length - fails.length}/${results.length} passed`);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
