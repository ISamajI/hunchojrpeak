// Renders a complete art-directed demo site into outDir:
//   index.html · css/site.css · css/theme.css · js/motion.js · js/gsap.min.js · js/ScrollTrigger.min.js · fonts/* · img/*
// Sections appear only when there is real data to fill them (no fake reviews, stats or galleries).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from '../../config.js';
import { installFonts, stack } from './fonts.js';
import { INDUSTRIES, parseHours, voiceOf } from './industry.js';

const KIT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'kit');
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const PHONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>';

const hashPick = (arr, seed) => arr[[...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % arr.length];

/** Template copy built only from real facts + generic, category-typical phrasing. */
export function templateCopy(business, direction, industryKey) {
  const ind = INDUSTRIES[industryKey];
  const voice = voiceOf(direction);
  const headline = hashPick(ind.headlines[voice] || ind.headlines.warm, business.slug);
  const where = business.city ? ` in ${business.city}` : '';
  const leads = {
    luxe: `${business.name} is a ${ind.noun}${where} built around one idea: take the time to do it properly. Every visit is unhurried, considered and finished with care.`,
    bold: `${business.name} is the ${ind.noun}${where} for people who expect it done right. No shortcuts, no guesswork — just the work, done well.`,
    warm: `${business.name} is a neighbourhood ${ind.noun}${where}. Friendly, reliable and easy to visit — the kind of place you come back to.`,
  };
  return {
    headline,
    subheadline: ind.sub[voice] || ind.sub.warm,
    statement: leads[voice],
    services: ind.services.slice(0, direction.services === 'cards' ? 5 : 4).map(([name, description]) => ({ name, description })),
    cta_label: ind.cta,
    steps: [
      { k: 'Book', title: 'Reserve your time', text: `Call, message or book online — we’ll confirm quickly.` },
      { k: 'Arrive', title: 'Settle in', text: `Come as you are. We take a moment to understand exactly what you want.` },
      { k: 'Leave', title: 'Walk out happy', text: `Work you’ll be glad you trusted us with — and an easy way to book the next one.` },
    ],
  };
}

function splitHeadline(text, italic) {
  const words = esc(text).split(' ');
  if (!italic || words.length < 2) return words.join(' ');
  const last = words.pop();
  return `${words.join(' ')} <em>${last}</em>`;
}

export function renderSite({ business, direction, industryKey, copy, photos, agency, research, outDir }) {
  const d = direction;
  const ind = INDUSTRIES[industryKey];
  const p = d.palette;
  fs.mkdirSync(path.join(outDir, 'css'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'js'), { recursive: true });

  // ---------- assets ----------
  const fontCss = installFonts([d.fonts.display, d.fonts.body], outDir);
  fs.copyFileSync(path.join(KIT, 'site.css'), path.join(outDir, 'css', 'site.css'));
  fs.copyFileSync(path.join(KIT, 'motion.js'), path.join(outDir, 'js', 'motion.js'));
  for (const f of ['gsap.min.js', 'ScrollTrigger.min.js']) fs.copyFileSync(path.join(ROOT, 'node_modules', 'gsap', 'dist', f), path.join(outDir, 'js', f));
  const theme = `${fontCss}
:root{--bg:${p.bg};--surface:${p.surface};--ink:${p.ink};--muted:${p.muted};--accent:${p.accent};--on-accent:${p.onAccent};--line:${p.line};--line-strong:color-mix(in srgb,${p.ink} 26%,transparent);
--display:${stack(d.fonts.display)};--body:${stack(d.fonts.body)};--display-weight:${d.displayWeight || 400};--display-case:${d.displayCase === 'upper' ? 'uppercase' : 'none'};--display-tracking:${d.displayCase === 'upper' ? '0.01em' : '-0.02em'};
--hero-size:${d.displayCase === 'upper' ? 'clamp(3.2rem,1.2rem + 8.4vw,10.5rem)' : 'clamp(3.1rem,1rem + 8vw,9.6rem)'};--hero-size-ed:clamp(3rem,1rem + 6.6vw,8.2rem);--h2-size:clamp(2.4rem,1.3rem + 4vw,5.6rem);
--frame-radius:${d.light ? '28px' : '18px'};--card-radius:${d.light ? '22px' : '14px'};--grain:${d.light ? '.045' : '.07'};--shader-fallback:radial-gradient(80% 70% at 70% 40%,${d.shader.a}55,${d.shader.c})}
`;
  fs.writeFileSync(path.join(outDir, 'css', 'theme.css'), theme);

  // ---------- data ----------
  const tel = business.phone ? business.phone.replace(/[^\d+]/g, '') : null;
  const raw = business.raw || {};
  const hours = parseHours(raw.tags?.opening_hours || raw.opening_hours);
  const googleHours = Array.isArray(raw.hours) ? raw.hours : null;
  const bookingUrl = research?.site?.booking_url || null;
  const orderUrl = research?.site?.ordering_url || null;
  const mapUrl = business.lat != null && business.lon != null
    ? `https://www.google.com/maps/search/?api=1&query=${business.lat},${business.lon}`
    : business.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.name} ${business.address}`)}` : null;
  const primaryHref = bookingUrl || orderUrl || '#book';
  const primaryLabel = bookingUrl ? copy.cta_label : orderUrl ? 'Order Online' : copy.cta_label;
  const ext = (u) => (u.startsWith('#') ? '' : ' target="_blank" rel="noopener"');
  const real = photos.filter((x) => x.source !== 'ai');
  const heroPhoto = photos.find((x) => x.slot === 'hero') || real[0] || null;
  const storyPhoto = photos.find((x) => x.slot === 'story') || real[1] || null;
  const servicePhotos = [...photos.filter((x) => x.slot?.startsWith('service')), ...real.slice(2)];
  const gallery = real.length >= 3 ? real : [];
  const reviews = (raw.reviews || []).filter((r) => r.text && r.rating >= 4).slice(0, 3);
  const verifiedRating = raw.rating && raw.review_count ? { rating: raw.rating, count: raw.review_count, url: raw.maps_url } : null;
  const stats = [
    verifiedRating && { value: verifiedRating.rating.toFixed(1), label: `Google rating · ${verifiedRating.count} reviews`, verified: true },
    verifiedRating && { value: String(verifiedRating.count), label: 'Google reviews', verified: true },
    hours?.daysOpen && { value: String(hours.daysOpen), label: 'Days open each week' },
  ].filter(Boolean);
  const imgTag = (ph, cls = '', attrs = '', decorative = false) => `<img src="${esc(ph.file)}" alt="${decorative ? '' : esc(ph.alt)}" width="${ph.width}" height="${ph.height}" ${cls ? `class="${cls}"` : ''} ${attrs} decoding="async">`;
  const aiNote = (ph) => (ph?.source === 'ai' ? '<p class="credit">Concept imagery — to be replaced with your own photography.</p>' : '');
  const shaderCanvas = `<canvas data-shader="${d.shader.kind}" data-a="${d.shader.a}" data-b="${d.shader.b}" data-c="${d.shader.c}" data-speed="${d.shader.speed}" aria-hidden="true"></canvas>`;
  const heroLede = `<p class="lede" data-reveal>${esc(copy.subheadline)}</p>`;
  const initials = business.name.replace(/&|’|'/g, ' ').split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !/^(the|and|of|co|inc|ltd)$/i.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const monogram = `<div class="monogram" aria-hidden="true"><span class="ring"></span><b>${esc(initials)}</b><small>${esc(ind.noun)} · ${esc(business.city || '')}</small></div>`;
  const ctas = `<div class="cta-row" data-reveal>
        <a class="btn btn-primary" href="${esc(primaryHref)}"${ext(primaryHref)} data-magnetic>${esc(primaryLabel)} ${ARROW}</a>
        ${tel ? `<a class="btn btn-ghost" href="tel:${esc(tel)}">${PHONE} ${esc(business.phone)}</a>` : mapUrl ? `<a class="btn btn-ghost" href="${esc(mapUrl)}" target="_blank" rel="noopener">Get directions</a>` : ''}
      </div>`;
  const metaRow = `<div class="hero-meta" data-reveal>
        ${business.address || business.city ? `<div><span>Find us</span>${esc(business.address || business.city)}</div>` : ''}
        ${hours?.rows ? `<div><span>Hours</span>${esc(hours.rows.map((r) => `${r.days} ${r.hours}`).slice(0, 2).join(' · '))}</div>` : ''}
        ${verifiedRating ? `<div data-verified="google"><span>On Google</span>${verifiedRating.rating.toFixed(1)} ★ from ${verifiedRating.count} reviews</div>` : ''}
      </div>`;
  const eyebrow = `<span class="eyebrow" data-reveal>${esc([ind.noun.replace(/^\w/, (c) => c.toUpperCase()), business.city].filter(Boolean).join(' · '))}</span>`;

  // ---------- hero ----------
  let hero;
  if (d.hero === 'stacked') {
    const name = esc(business.name);
    const row = (outline) => `<div class="row${outline ? ' outline' : ''}">${Array(4).fill(`<span>${name} <i>✦</i></span>`).join('')}</div>`;
    hero = `<header class="hero hero-stacked" id="top">
    <div class="hero-media">${heroPhoto ? imgTag(heroPhoto, '', 'fetchpriority="high"') : shaderCanvas}</div><div class="hero-shade"></div>
    <div class="marquee" aria-hidden="true">${row(false)}${row(true)}</div>
    <div class="wrap">
      <div>${eyebrow}<h1 class="display" data-split>${splitHeadline(copy.headline, d.displayItalic)}</h1></div>
      <div>${heroLede}${ctas}</div>
    </div>
  </header>`;
  } else if (d.hero === 'editorial') {
    const chip = hours?.rows ? `<b>${esc(hours.rows[0].hours)}</b>${esc(hours.rows[0].days)}` : verifiedRating ? `<b>${verifiedRating.rating.toFixed(1)} ★</b>${verifiedRating.count} Google reviews` : business.city ? `<b>${esc(business.city)}</b>${esc(business.address || 'Visit us')}` : '';
    hero = `<header class="hero hero-editorial" id="top">
    <div class="wrap">
      <div>${eyebrow}<h1 class="display" data-split>${splitHeadline(copy.headline, d.displayItalic)}</h1>${heroLede}${ctas}</div>
      <div class="frame-wrap"><div class="frame" data-clip>${heroPhoto ? imgTag(heroPhoto, '', 'fetchpriority="high"') : `${shaderCanvas}${monogram}`}</div>${chip ? `<div class="frame-chip" data-reveal${verifiedRating && !hours?.rows ? ' data-verified="google"' : ''}>${chip}</div>` : ''}</div>
    </div>
  </header>`;
  } else {
    hero = `<header class="hero hero-cinematic" id="top">
    <div class="hero-media">${heroPhoto ? imgTag(heroPhoto, '', 'fetchpriority="high"') : shaderCanvas}</div><div class="hero-shade"></div>
    <div class="wrap">${eyebrow}<h1 class="display" data-split>${splitHeadline(copy.headline, d.displayItalic)}</h1>${heroLede}${ctas}${metaRow}</div>
    <span class="scroll-cue" aria-hidden="true">Scroll</span>
  </header>`;
  }

  // ---------- intro ----------
  const facts = [
    business.address && ['Address', esc(business.address)],
    tel && ['Call', `<a href="tel:${esc(tel)}">${esc(business.phone)}</a>`],
    business.email && ['Email', `<a href="mailto:${esc(business.email)}">${esc(business.email)}</a>`],
  ].filter(Boolean);
  const intro = `<section class="section intro" id="about">
    <div class="wrap intro-grid">
      <div><span class="eyebrow" data-reveal>01 — About</span><p class="statement" style="margin-top:2rem">${esc(copy.statement)}</p></div>
      <aside class="intro-aside">
        ${storyPhoto ? `<div class="intro-photo" data-clip>${imgTag(storyPhoto, '', 'data-parallax="0.12" loading="lazy"')}</div>${aiNote(storyPhoto)}` : ''}
        ${facts.length ? `<div class="facts" data-reveal>${facts.map(([k, v]) => `<div><span>${k}</span>${v}</div>`).join('')}</div>` : ''}
      </aside>
    </div>
  </section>`;

  // ---------- marquee band ----------
  const band = `<div class="marquee band" aria-hidden="true"><div class="row">${Array(2).fill(copy.services.map((s) => `<span>${esc(s.name)} <i>✦</i></span>`).join('')).join('')}</div></div>`;

  // ---------- services ----------
  const svcHead = `<div class="section-head"><div><span class="eyebrow" data-reveal>02 — Services</span></div><div><h2 class="display" data-split>${d.services === 'menu' ? 'From the Kitchen' : d.services === 'spec' ? 'What We Fix' : 'What We Do'}</h2><p data-reveal style="margin-top:1.2rem">${esc(`Every service at ${business.name}, explained simply. Ask us about anything you don’t see here.`)}</p></div></div>`;
  let services = '';
  const list = copy.services;
  if (d.services === 'index') {
    services = `<div class="svc-index">${list.map((s, i) => `<div class="svc-row" data-reveal><span class="n">${String(i + 1).padStart(2, '0')}</span><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p><span class="arrow" aria-hidden="true">${ARROW}</span></div>`).join('')}</div>
      <div class="svc-preview" aria-hidden="true">${list.map((s, i) => (servicePhotos[i] ? imgTag(servicePhotos[i], '', 'loading="lazy"') : `<div class="swatch">${String(i + 1).padStart(2, '0')}</div>`)).join('')}</div>`;
  } else if (d.services === 'cards') {
    services = `<div class="svc-cards">${list.map((s, i) => `<article class="svc-card" data-reveal>${servicePhotos[i] ? imgTag(servicePhotos[i], '', 'loading="lazy"', true) : ''}<span class="n">${String(i + 1).padStart(2, '0')}</span><div><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p></div></article>`).join('')}</div>`;
  } else if (d.services === 'menu') {
    services = `<div class="svc-menu">${list.map((s, i) => `<div class="menu-item" data-reveal><div class="top"><h3>${esc(s.name)}</h3><span class="leader"></span><span class="tag">${String(i + 1).padStart(2, '0')}</span></div><p>${esc(s.description)}</p></div>`).join('')}</div>`;
  } else if (d.services === 'spec') {
    services = `<div class="svc-spec">${list.map((s, i) => `<div class="spec-row" data-reveal><span class="code">Service ${String(i + 1).padStart(2, '0')}</span><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p><a href="${esc(primaryHref)}"${ext(primaryHref)}>Book this →</a></div>`).join('')}</div>`;
  } else {
    services = `<div class="svc-acc">${list.map((s, i) => `<details${i === 0 ? ' open' : ''} data-reveal><summary><h3>${esc(s.name)}</h3><span class="plus" aria-hidden="true">+</span></summary><div class="body">${esc(s.description)}</div></details>`).join('')}</div>`;
  }
  const servicesSection = `<section class="section" id="services"><div class="wrap">${svcHead}${services}</div></section>`;

  // ---------- experience (sticky storytelling) ----------
  const stepVisuals = copy.steps.map((s, i) => (servicePhotos[i] ? imgTag(servicePhotos[i], i === 0 ? 'on' : '', 'loading="lazy"', true) : `<div class="num${i === 0 ? ' on' : ''}">${i + 1}</div>`)).join('');
  const experience = `<section class="section" id="experience" style="padding-top:0"><div class="wrap">
    <div class="section-head"><div><span class="eyebrow" data-reveal>03 — The Experience</span></div><div><h2 class="display" data-split>How It Works</h2></div></div>
    <div class="steps"><div class="steps-visual" aria-hidden="true">${stepVisuals}</div>
      <div>${copy.steps.map((s, i) => `<div class="step"><span class="k">${String(i + 1).padStart(2, '0')} · ${esc(s.k)}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`).join('')}</div></div>
  </div></section>`;

  // ---------- stats (real numbers only) ----------
  const statsSection = stats.length >= 2 ? `<section class="section" style="padding-top:0"><div class="wrap"><div class="stats">${stats.map((s) => `<div class="stat"${s.verified ? ' data-verified="google"' : ''} data-reveal><b data-count="${esc(s.value)}">${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join('')}</div></div></section>` : '';

  // ---------- gallery (real photos only) ----------
  const gallerySection = gallery.length ? `<section class="section pin-gallery" id="gallery" style="padding-block:clamp(3rem,8vw,6rem)"><div class="wrap" style="margin-bottom:2rem"><span class="eyebrow">Gallery</span></div>
    <div class="gallery-track" style="padding-inline:max(1.25rem,calc((100vw - 1320px)/2))">${gallery.map((g) => `<button class="gallery-item" type="button" data-lightbox aria-label="View photo">${imgTag(g, '', 'loading="lazy"')}</button>`).join('')}</div>
    <div class="wrap"><p class="credit">Photos: ${esc([...new Set(gallery.map((g) => (g.source === 'google' ? `Google Maps (${g.credit})` : `${business.name}`)))].join(' · '))}</p></div></section>` : '';

  // ---------- verified social proof ----------
  const proofSection = verifiedRating && reviews.length ? `<section class="section" id="reviews" data-verified="google"><div class="wrap proof-grid">
    <div class="rating" data-reveal><span class="eyebrow">Google reviews</span><div style="margin-top:1.5rem"><b>${verifiedRating.rating.toFixed(1)}</b><div class="stars" aria-label="${verifiedRating.rating} out of 5">${'★'.repeat(Math.round(verifiedRating.rating))}</div><p class="muted">Based on ${verifiedRating.count} reviews on Google${verifiedRating.url ? ` · <a href="${esc(verifiedRating.url)}" target="_blank" rel="noopener">Read them all</a>` : ''}</p></div></div>
    <div class="quotes">${reviews.map((r) => `<blockquote class="quote" data-reveal><p>“${esc(r.text)}”</p><footer>${'★'.repeat(r.rating)} · ${r.authorUri ? `<a href="${esc(r.authorUri)}" target="_blank" rel="noopener">${esc(r.author)}</a>` : esc(r.author)}${r.when ? ` · ${esc(r.when)}` : ''} · via Google</footer></blockquote>`).join('')}</div>
  </div></section>` : '';

  // ---------- visit & book ----------
  const hourRows = hours?.rows ? hours.rows.map((r) => `<tr data-days="${esc(r.days)}"><td>${esc(r.days)}</td><td>${esc(r.hours)}</td></tr>`).join('')
    : googleHours ? googleHours.map((line) => { const [day, ...rest] = String(line).split(': '); return `<tr data-days="${esc(day.slice(0, 3))}"><td>${esc(day)}</td><td>${esc(rest.join(': '))}</td></tr>`; }).join('') : '';
  const canMessage = tel || business.email;
  const form = canMessage ? `<form class="book" data-business="${esc(business.name)}" ${tel ? `data-sms="${esc(tel)}"` : `data-email="${esc(business.email)}"`} novalidate>
      <div class="row2"><label class="field">Your name<input name="name" required autocomplete="name"></label><label class="field">Phone or email<input name="contact" autocomplete="tel"></label></div>
      <label class="field">Service<select name="service">${copy.services.map((s) => `<option>${esc(s.name)}</option>`).join('')}<option>Something else</option></select></label>
      <div class="row2"><label class="field">Preferred day<input type="date" name="date"></label><label class="field">Preferred time<input type="time" name="time"></label></div>
      <label class="field">Anything we should know?<textarea name="note"></textarea></label>
      <button class="btn btn-primary" type="submit" data-magnetic>Send request ${ARROW}</button>
      <p class="form-note">${tel ? 'Opens your messages app with the request ready to send to' : 'Opens your email app with the request ready to send to'} ${esc(business.name)}.</p>
      <p class="form-status" role="status" aria-live="polite"></p>
    </form>` : '';
  const visit = `<section class="section" id="book" style="padding-top:0"><div class="wrap"><div class="visit">
    <div>
      <span class="eyebrow" data-reveal>04 — Visit</span>
      <h2 class="display" data-split style="margin:1.5rem 0">${bookingUrl ? 'Book Your Visit' : 'Come See Us'}</h2>
      <div class="cta-row" data-reveal>
        ${bookingUrl ? `<a class="btn btn-primary" href="${esc(bookingUrl)}" target="_blank" rel="noopener" data-magnetic>Book online ${ARROW}</a>` : ''}
        ${orderUrl ? `<a class="btn btn-primary" href="${esc(orderUrl)}" target="_blank" rel="noopener">Order online ${ARROW}</a>` : ''}
        ${tel ? `<a class="btn ${bookingUrl || orderUrl ? 'btn-ghost' : 'btn-primary'}" href="tel:${esc(tel)}">${PHONE} Call ${esc(business.phone)}</a>` : ''}
        ${mapUrl ? `<a class="btn btn-ghost" href="${esc(mapUrl)}" target="_blank" rel="noopener">Directions</a>` : ''}
      </div>
      ${business.address ? `<p style="margin-top:2rem">${esc(business.address)}</p>` : ''}
      ${hourRows ? `<table class="hours"><caption class="sr-only">Opening hours</caption><tbody>${hourRows}</tbody></table>` : ''}
    </div>
    <div>${form || `<p class="muted">Reach out using the options on the left.</p>`}</div>
  </div></div></section>`;

  // ---------- footer ----------
  const credits = [...new Set(photos.map((x) => x.source === 'google' ? `Photos via Google Maps: ${x.credit}` : x.source === 'website' ? `Photos: ${business.name}` : `Concept imagery: ${x.credit}`))];
  const footer = `<footer class="footer"><div class="wrap">
    <p class="giant" aria-hidden="true" style="font-size:min(15rem, calc((100vw - 3rem) / ${Math.max(4, business.name.length) * (d.displayCase === 'upper' ? (d.fonts.display === 'bebas' ? 0.42 : 0.8) : 0.5)}))">${esc(business.name)}</p>
    <div class="footer-grid">
      <div><span>Visit</span>${esc(business.address || business.city || '—')}</div>
      <div><span>Contact</span>${tel ? `<a href="tel:${esc(tel)}">${esc(business.phone)}</a><br>` : ''}${business.email ? `<a href="mailto:${esc(business.email)}">${esc(business.email)}</a>` : ''}</div>
      <div><span>Explore</span><a href="#services">Services</a><br><a href="#about">About</a><br><a href="#book">Visit</a></div>
    </div>
    <div class="footer-legal"><span>© ${new Date().getFullYear()} ${esc(business.name)}</span><span>Concept by ${agency.site ? `<a href="${esc(agency.site)}" target="_blank" rel="noopener">${esc(agency.name)}</a>` : esc(agency.name)}${credits.length ? ' · ' + esc(credits.join(' · ')) : ''}</span></div>
  </div></footer>`;

  // ---------- SEO ----------
  const ld = { '@context': 'https://schema.org', '@type': ind.schema, name: business.name, ...(business.address ? { address: business.address } : {}), ...(business.phone ? { telephone: business.phone } : {}), ...(business.email ? { email: business.email } : {}), ...(business.lat != null ? { geo: { '@type': 'GeoCoordinates', latitude: business.lat, longitude: business.lon } } : {}), ...(raw.tags?.opening_hours ? { openingHours: raw.tags.opening_hours } : {}) };
  const title = `${business.name}${business.city ? ` — ${ind.noun.replace(/^\w/, (c) => c.toUpperCase())} in ${business.city}` : ''}`;
  const desc = `${copy.subheadline} ${business.name}${business.city ? `, ${business.city}` : ''}.`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${heroPhoto ? `<meta property="og:image" content="${esc(heroPhoto.file)}">` : ''}
<meta name="theme-color" content="${p.bg}">
<link rel="preload" href="fonts/${esc(fontFile(d.fonts.display))}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="css/theme.css">
<link rel="stylesheet" href="css/site.css">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head>
<body>
<div class="curtain" aria-hidden="true"></div>
<div class="grain" aria-hidden="true"></div>
<div class="cursor" aria-hidden="true"></div>
<div class="concept-bar">Concept preview<span class="long"> designed by ${esc(agency.name)} for ${esc(business.name)}</span><span class="short"> by ${esc(agency.name)}</span> — not the official site.</div>
<nav class="nav with-bar" aria-label="Main">
  <div class="wrap nav-inner">
    <a class="brand" href="#top">${esc(business.name)}</a>
    <div class="nav-links"><a href="#services">Services</a><a href="#about">About</a>${gallery.length ? '<a href="#gallery">Gallery</a>' : ''}<a href="#book">Visit</a><a class="btn btn-primary" href="${esc(primaryHref)}"${ext(primaryHref)} data-magnetic>${esc(primaryLabel)}</a></div>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" aria-label="Menu"><span></span><span></span></button>
  </div>
</nav>
<div class="mobile-menu" id="mobile-menu" aria-hidden="true">
  <a href="#services">Services</a><a href="#about">About</a>${gallery.length ? '<a href="#gallery">Gallery</a>' : ''}<a href="#book">Visit</a>
  <div class="meta">${tel ? `<a href="tel:${esc(tel)}" style="font:inherit">${esc(business.phone)}</a>` : ''}${business.address ? `<span>${esc(business.address)}</span>` : ''}</div>
</div>
<main>
  ${hero}
  ${intro}
  ${band}
  ${servicesSection}
  ${experience}
  ${statsSection}
  ${gallerySection}
  ${proofSection}
  ${visit}
</main>
${footer}
<script src="js/gsap.min.js" defer></script>
<script src="js/ScrollTrigger.min.js" defer></script>
<script src="js/motion.js" defer></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  fs.writeFileSync(path.join(outDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  return html;
}

function fontFile(key) {
  const f = { fraunces: 'fraunces-latin-wght-normal.woff2', instrument: 'instrument-serif-latin-400-normal.woff2', cormorant: 'cormorant-garamond-latin-500-normal.woff2', dmserif: 'dm-serif-display-latin-400-normal.woff2', bricolage: 'bricolage-grotesque-latin-wght-normal.woff2', intertight: 'inter-tight-latin-wght-normal.woff2', manrope: 'manrope-latin-wght-normal.woff2', spacegrotesk: 'space-grotesk-latin-wght-normal.woff2', syne: 'syne-latin-800-normal.woff2', bebas: 'bebas-neue-latin-400-normal.woff2', archivo: 'archivo-latin-wght-normal.woff2', unbounded: 'unbounded-latin-wght-normal.woff2' };
  return f[key];
}
