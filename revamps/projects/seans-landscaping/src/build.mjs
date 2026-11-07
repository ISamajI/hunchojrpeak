// Static site generator for Sean's Landscaping, Inc.
// Usage: node src/build.mjs   → writes HTML into the repository root.
import { writeFileSync, mkdirSync, cpSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  U, company as C, services, projects, projectFilters, catLabels, videos, team, extraContacts,
  licenses, certifications, unions, surety, clients, collaborators, suppliers, equipment,
} from "./data.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
// Flags: --out <dir> writes a self-contained copy (HTML + assets) to <dir>;
//        --demo marks the build as a concept preview (noindex + "concept by HunchoPeak" credit).
const argv = process.argv.slice(2);
const outIdx = argv.indexOf("--out");
const ROOT = outIdx > -1 ? join(process.cwd(), argv[outIdx + 1]) : REPO;
const DEMO = argv.includes("--demo");
const SITE = C.url.replace(/\/$/, "");

/* ---------------- photos ---------------- */
// assets/photos/manifest.json is produced by scripts/photos.py (AI-upscaled WebP copies).
// Any photo listed there is served locally with a responsive srcset; others fall back to the
// original upload on seanslandscaping.com.
const PHOTO_MANIFEST = join(REPO, "assets", "photos", "manifest.json");
const photos = existsSync(PHOTO_MANIFEST) ? JSON.parse(readFileSync(PHOTO_MANIFEST, "utf8")) : {};
const U_RE = U.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function localizePhotos(html, base) {
  const pre = base + "assets/photos/";
  html = html.replace(new RegExp(`<img([^>]*?) src="${U_RE}([^"]+)"([^>]*)>`, "g"), (m, a, path, b) => {
    const ph = photos[path];
    if (!ph) return m.replace(" data-full", "");
    const attrs = (a + b);
    const full = attrs.includes(" data-full");
    const clean = (x) => x.replace(" data-full", "").replace(/ width="\d+"| height="\d+"/g, "");
    return `<img${clean(a)} src="${pre}${ph.name}-1200.webp" srcset="${pre}${ph.name}-1200.webp 1200w, ${pre}${ph.name}-2400.webp 2400w" sizes="${full ? "100vw" : "(min-width: 1024px) 50vw, 100vw"}" width="${ph.w}" height="${ph.h}"${clean(b)}>`;
  });
  html = html.replace(new RegExp(`data-media="${U_RE}([^"]+\\.(?:jpe?g|png))"`, "gi"), (m, path) =>
    photos[path] ? `data-media="${pre}${photos[path].name}-2400.webp"` : m);
  return html;
}

/* ---------------- helpers ---------------- */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const img = (p) => U + p;
const money = (n) => "$" + n.toLocaleString("en-US");
const moneyShort = (n) => (n >= 1e6 ? "$" + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M" : "$" + Math.round(n / 1000) + "K");
const totalValue = projects.reduce((a, p) => a + p.value, 0);
const year = new Date().getFullYear();
const addressLine = `${C.street}, ${C.city}, ${C.state} ${C.zip}`;

const icon = {
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  fax: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  fb: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8h3V4h-3a5 5 0 0 0-5 5v2H7v4h2v7h4v-7h3l1-4h-4V9a1 1 0 0 1 1-1z"/></svg>',
  leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z"/><path d="M2 21c0-3 1.9-5.4 5.1-6"/></svg>',
};

const brand = (base) => `<a class="brand" href="${base}index.html" aria-label="${esc(C.name)} — home">
  <span class="brand-mark">${icon.leaf}</span>
  <span><span class="brand-name">Sean's Landscaping</span><span class="brand-sub">Commercial Landscape · NJ</span></span>
</a>`;

/* ---------------- shell ---------------- */
function header(base, current, solid) {
  const nav = (href, label, key) =>
    `<li><a class="nav-link" href="${base}${href}"${current === key ? ' aria-current="page"' : ""}>${label}</a></li>`;
  const dd = services.map((s) => `<a href="${base}services.html#${s.id}"><strong>${s.name}</strong><span>${esc(s.short)}</span></a>`).join("");
  return `<a class="skip-link" href="#main">Skip to content</a>
<div class="scroll-progress" aria-hidden="true"></div>
<header class="site-header${solid ? " site-header--solid" : ""}">
  <div class="container header-inner">
    ${brand(base)}
    <nav class="nav" aria-label="Main">
      <ul class="nav-list">
        <li class="has-dropdown">
          <button class="nav-link" type="button" aria-expanded="false" aria-haspopup="true"${current === "services" ? ' aria-current="page"' : ""}>Services ${icon.chev}</button>
          <div class="dropdown">${dd}</div>
        </li>
        ${nav("projects.html", "Projects", "projects")}
        ${nav("about.html", "About", "about")}
        ${nav("about.html#qualifications", "Qualifications", "quals")}
        ${nav("contact.html", "Contact", "contact")}
      </ul>
    </nav>
    <div class="header-cta">
      <a class="header-phone" href="${C.phoneHref}">${icon.phone}<span>${C.phone}</span></a>
      <a class="btn btn--accent btn--sm" href="${base}contact.html#quote">Request a bid ${icon.arrow}</a>
    </div>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" aria-label="Open menu"><span></span></button>
  </div>
</header>
<div class="mobile-menu" id="mobile-menu" aria-hidden="true" inert>
  <nav aria-label="Mobile">
    <a href="${base}index.html">Home</a>
    <a href="${base}services.html">Services</a>
    <div class="mm-services">${services.map((s) => `<a href="${base}services.html#${s.id}">${s.name}</a>`).join("")}</div>
    <a href="${base}projects.html">Projects</a>
    <a href="${base}about.html">About &amp; qualifications</a>
    <a href="${base}contact.html">Contact</a>
  </nav>
  <div>
    <p class="mm-label">Office</p>
    <p>${esc(addressLine)}</p>
  </div>
  <div class="mm-actions">
    <a class="btn btn--accent" href="${C.phoneHref}">${icon.phone}${C.phone}</a>
    <a class="btn btn--ghost" href="${base}contact.html#quote">Request a bid</a>
  </div>
</div>`;
}

function footer(base) {
  return `<section class="section--tight" aria-label="Get in touch">
  <div class="container">
    <div class="cta-band reveal">
      <div>
        <h2>Have a project out to bid?</h2>
        <p>Send plans and specs and our estimating team will price every part of it — from green roofs to ground-level landscapes.</p>
      </div>
      <div class="cta-actions">
        <a class="btn btn--accent" href="${base}contact.html#quote">Request a bid ${icon.arrow}</a>
        <a class="btn btn--ghost" href="${C.phoneHref}">${icon.phone}${C.phone}</a>
      </div>
    </div>
  </div>
</section>
<footer class="site-footer">
  <div class="container">
    <div class="footer-top">
      <div>
        ${brand(base)}
        <p>A full-service commercial landscape contractor serving ${C.serviceArea.slice(0, -1).join(", ")} and ${C.serviceArea.at(-1)} for over 40 years.</p>
        <p><a href="${C.facebook}" target="_blank" rel="noopener" class="link-arrow">${icon.fb} Follow on Facebook</a></p>
      </div>
      <div>
        <h4>Services</h4>
        <ul>${services.map((s) => `<li><a href="${base}services.html#${s.id}">${s.name}</a></li>`).join("")}</ul>
      </div>
      <div>
        <h4>Company</h4>
        <ul>
          <li><a href="${base}projects.html">Projects</a></li>
          <li><a href="${base}projects.html#videos">Project videos</a></li>
          <li><a href="${base}about.html">About us</a></li>
          <li><a href="${base}about.html#team">Our team</a></li>
          <li><a href="${base}about.html#qualifications">Qualifications</a></li>
          <li><a href="${base}about.html#clients">Clients</a></li>
          <li><a href="${base}about.html#partners">Suppliers &amp; partners</a></li>
          <li><a href="${base}about.html#equipment">Equipment</a></li>
        </ul>
      </div>
      <div>
        <h4>Contact</h4>
        <ul>
          <li>${esc(C.street)}<br>${C.city}, ${C.state} ${C.zip}</li>
          <li>Phone <a href="${C.phoneHref}">${C.phone}</a></li>
          <li>Fax ${C.fax}</li>
          <li><a href="mailto:${C.email}">${C.email}</a></li>
        </ul>
      </div>
    </div>
    <p class="footer-big" aria-hidden="true">Sean's Landscaping</p>
    <div class="footer-bottom">
      <span>© <span data-year>${year}</span> ${esc(C.name)} All rights reserved.</span>
      <span>Licensed in NJ, PA, DE &amp; Philadelphia · Union signatory${DEMO ? ' · Concept redesign by <a href="https://hunchopeak.dev">HunchoPeak</a>' : ""}</span>
    </div>
  </div>
</footer>
<div class="action-bar" role="region" aria-label="Quick actions">
  <a class="btn btn--light" href="${C.phoneHref}">${icon.phone}Call</a>
  <a class="btn btn--accent" href="${base}contact.html#quote">Request a bid</a>
</div>
<button class="to-top" type="button" aria-label="Back to top">${icon.up}</button>
<dialog class="lightbox" id="lightbox" aria-label="Media viewer">
  <div class="lightbox-bar">
    <p class="lightbox-title"></p>
    <button class="lightbox-close" type="button" aria-label="Close">${icon.close}</button>
  </div>
  <div class="lightbox-stage"></div>
</dialog>
<script src="${base}assets/js/main.js" defer></script>`;
}

// Opening animation (home page, once per browser session; skipped for reduced motion / no JS).
const introMarkup = `<div class="intro" aria-hidden="true">
  <div class="intro-inner">
    <svg class="intro-leaf" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path pathLength="1" d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z"/><path pathLength="1" d="M2 21c0-3 1.9-5.4 5.1-6"/></svg>
    <p class="intro-word"><span class="intro-mask"><span>Sean's</span></span> <span class="intro-mask"><span>Landscaping</span></span></p>
    <span class="intro-line"></span>
    <p class="intro-sub">Commercial landscape construction · Hamilton, NJ</p>
  </div>
</div>`;

function page({ file, title, description, current, body, base = "", solidHeader = false, ogImage, jsonld }) {
  const canonical = SITE + "/" + file.replace(/index\.html$/, "");
  const og = ogImage || img("2018/10/SEANS0020_2560.jpg");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#0f2a1d">${DEMO ? '\n<meta name="robots" content="noindex, nofollow">' : ""}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(C.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${og}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${base}assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://www.seanslandscaping.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${base}assets/css/styles.css">
${current === "home" ? `<script>(function(){try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches&&!sessionStorage.getItem("sl-intro")){document.documentElement.classList.add("has-intro");sessionStorage.setItem("sl-intro","1")}}catch(e){}})();</script>` : ""}
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
</head>
<body>
${current === "home" ? introMarkup : ""}
${header(base, current, solidHeader)}
<main id="main">
${body}
</main>
${footer(base)}
</body>
</html>
`;
  const out = join(ROOT, file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, localizePhotos(html, base));
  return file;
}

const businessLd = {
  "@context": "https://schema.org",
  "@type": "LandscapingBusiness",
  name: C.name,
  url: C.url,
  telephone: "+1-609-586-2876",
  faxNumber: "+1-609-586-7981",
  email: C.email,
  image: img("2018/10/SEANS0020_2560.jpg"),
  address: { "@type": "PostalAddress", streetAddress: C.street, addressLocality: C.city, addressRegion: C.state, postalCode: C.zip, addressCountry: "US" },
  areaServed: C.serviceArea.map((a) => ({ "@type": "Place", name: a })),
  sameAs: [C.facebook],
};

/* ---------------- shared fragments ---------------- */
const projectCard = (p, base, i = 0) => `<article class="project-card reveal" style="--d:${(i % 3) * 0.08}s" data-category="${p.cats}">
  <div class="thumb"><img src="${img(p.thumb)}" alt="${esc(p.name)}" loading="lazy" decoding="async" width="640" height="400"></div>
  <div class="body">
    <span class="loc">${esc(p.loc)}</span>
    <h3>${esc(p.name)}</h3>
    <p>${esc(p.scope)}</p>
    <div class="tags">${p.cats.split(" ").slice(0, 3).map((c) => `<span class="tag">${catLabels[c]}</span>`).join("")}<span class="tag tag--value">${moneyShort(p.value)}</span></div>
  </div>
  <a class="stretched" href="${base}projects/${p.slug}.html" aria-label="View project: ${esc(p.name)}"></a>
</article>`;

const videoCard = (v) => `<li class="reel-item">
  <button class="reel-card" type="button" data-media="${img(v.src)}" data-title="${esc(v.title)}" data-sub="${esc(v.loc)}" aria-label="Play video: ${esc(v.title)}, ${esc(v.loc)}">
    <img src="${img(v.thumb)}" alt="" loading="lazy" decoding="async" width="360" height="480">
    <span class="play-btn">${icon.play}</span>
    <span class="reel-meta"><small>${esc(v.loc)}</small>${esc(v.title)}</span>
  </button>
</li>`;

/* ================= HOME ================= */
function home() {
  const heroSlides = [
    ["2018/10/SEANS0020_2560.jpg", "120-ft cascading water wall"],
    ["2018/11/Cira-garage-1_2560.jpg", "Cira South roof-top park · Philadelphia"],
    ["2018/11/Andlinger_2560.jpg", "Andlinger Center · Princeton University"],
    ["2018/10/SEANS0018_2560.jpg", "Meadow mixes in fall color"],
  ];
  const tileClass = { "green-roofs": "tile--lg" }; // 2×2 + 8 singles = a clean 4×3 grid
  const order = ["green-roofs", "hardscape", "landscaping", "site-prep", "structures", "water-features", "wetlands", "irrigation", "lighting"];
  const bento = order.map((id, i) => {
    const s = services.find((x) => x.id === id);
    return `<a class="tile ${tileClass[id] || ""} reveal" style="--d:${(i % 4) * 0.06}s" href="services.html#${s.id}">
      <img src="${img(s.images[0][0])}" alt="" loading="lazy" decoding="async">
      <span class="tile-num">${String(services.indexOf(s) + 1).padStart(2, "0")}</span>
      <span class="tile-arrow">${icon.arrow}</span>
      <div class="tile-body"><h3>${s.name}</h3><p>${esc(id === "green-roofs" ? s.lead : s.short)}</p></div>
    </a>`;
  }).join("");
  const featured = ["chop-buerger-center", "reading-hospital", "cira-garage", "villanova-hardscape", "andlinger-center", "novo-nordisk"]
    .map((s, i) => projectCard(projects.find((p) => p.slug === s), "", i)).join("");
  const marqueeNames = ["Princeton University", "Children's Hospital of Philadelphia", "Turner Construction", "L.F. Driscoll", "Skanska USA", "Philadelphia Museum of Art", "Gilbane", "Whiting-Turner", "Hunter Roberts", "Meridian Health", "Tishman", "Rutgers University", "Barr & Barr", "Brandywine Realty Trust"];
  const marquee = marqueeNames.map((n) => `<span>${esc(n)}</span>`).join("");

  const body = `
<section class="hero" aria-label="Introduction">
  <div class="hero-media">
    ${heroSlides.map(([src, cap], i) => `<div class="hero-slide${i === 0 ? " is-active" : ""}" data-caption="${esc(cap)}"><img data-full src="${img(src)}" alt="" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></div>`).join("")}
  </div>
  <p class="hero-caption" data-hero-caption aria-hidden="true">${esc(heroSlides[0][1])}</p>
  <div class="container hero-inner">
    <p class="eyebrow" style="color:var(--moss-400)">Commercial landscape contractor · Hamilton, NJ</p>
    <h1>Landscapes built <em>to spec</em>, on time and on budget.</h1>
    <p class="hero-lead">Green roofs, hardscape, water features and site work for hospitals, universities and general contractors across NJ, NY, DE and Eastern PA — for over 40 years.</p>
    <div class="hero-actions">
      <a class="btn btn--accent" href="contact.html#quote">Request a bid ${icon.arrow}</a>
      <a class="btn btn--ghost" href="projects.html">See our projects</a>
    </div>
    <dl class="hero-meta">
      <div><dt>Experience</dt><dd>40+ years</dd></div>
      <div><dt>Featured work</dt><dd>${moneyShort(totalValue)}+ across ${projects.length} projects</dd></div>
      <div><dt>Service area</dt><dd>NJ · NY · DE · PA</dd></div>
      <div><dt>Call the office</dt><dd><a href="${C.phoneHref}" style="text-decoration:none">${C.phone}</a></dd></div>
    </dl>
  </div>
</section>

<div class="marquee" role="region" aria-label="Some of the owners and contractors we've worked with">
  <div class="marquee-track">${marquee}${marquee.replace(/<span>/g, '<span aria-hidden="true">')}</div>
</div>

<section class="section">
  <div class="container split">
    <div class="reveal">
      <p class="eyebrow">Who we are</p>
      <h2>The landscape partner general contractors call back.</h2>
      <p class="lead">Sean's Landscaping is a full-service commercial landscape company. We work closely with owners, contractors, developers and landscape architects to turn drawings into finished, thriving landscapes.</p>
      <ul class="checklist">
        <li>${icon.check}<span><strong>Owner on site.</strong> Our president, Gerry Brady, works side-by-side with the crews on every job.</span></li>
        <li>${icon.check}<span><strong>Self-performed.</strong> In-house hardscape craftsmen, irrigation and green-roof crews — no hand-offs.</span></li>
        <li>${icon.check}<span><strong>Certified &amp; union.</strong> Roof Meadows, American Hydrotech and LiveRoof certified; signatory to six trade locals.</span></li>
      </ul>
      <a class="link-arrow" href="about.html">Meet the team ${icon.arrow}</a>
    </div>
    <div class="reveal" style="--d:.1s">
      <div class="media-frame">
        <img src="${img("2018/10/SEANS0063_2560.jpg")}" alt="Sean's Landscaping crew installing plantings" loading="lazy" decoding="async">
        <div class="media-badge"><b>1994</b><span>RWJ Hospital Hamilton has been a Sean's client continuously since 1994.</span></div>
      </div>
    </div>
  </div>
</section>

<section class="section section--sand" id="services">
  <div class="container">
    <div class="section-head reveal">
      <div><p class="eyebrow">What we build</p><h2>Nine disciplines. One accountable crew.</h2></div>
      <p>From the first cut of subgrade to the last light fixture, we self-perform the full landscape scope so you manage one sub, not five.</p>
    </div>
    <div class="bento">${bento}</div>
  </div>
</section>

<section class="section section--dark">
  <div class="container">
    <div class="section-head reveal">
      <div><p class="eyebrow">By the numbers</p><h2>Proven on complex, high-stakes sites.</h2></div>
      <p>Hospitals that can't close, campuses that never stop, roofs where every pound is engineered. That's where we do our best work.</p>
    </div>
    <div class="stats reveal">
      <div class="stat"><span class="stat-num"><span data-count="40" data-suffix="+">40+</span></span><p>Years building commercial landscapes</p></div>
      <div class="stat"><span class="stat-num">$<span data-count="${Math.floor(totalValue / 1e6)}" data-suffix="M">${Math.floor(totalValue / 1e6)}M</span></span><p>In featured project value across ${projects.length} portfolio jobs</p></div>
      <div class="stat"><span class="stat-num"><span data-count="80" data-suffix="K">80K</span><small> sq ft</small></span><p>Of intensive &amp; extensive green roof at Reading Hospital</p></div>
      <div class="stat"><span class="stat-num"><span data-count="80" data-suffix="+">80+</span></span><p>Owners, GCs &amp; designers we've worked for</p></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="section-head reveal">
      <div><p class="eyebrow">Selected work</p><h2>Recent projects</h2></div>
      <p>Children's hospitals, Ivy League campuses and roof-top public parks. <a class="link-arrow" href="projects.html">All ${projects.length} projects ${icon.arrow}</a></p>
    </div>
    <div class="project-grid">${featured}</div>
  </div>
</section>

<section class="section section--sand" id="videos">
  <div class="container">
    <div class="section-head reveal">
      <div><p class="eyebrow">On site</p><h2>Watch the work.</h2></div>
      <p>Short clips from roof-top gardens, water walls and tree installs. Tap any video to play.</p>
    </div>
  </div>
  <div class="reel-wrap">
    <ul class="reel">${videos.map(videoCard).join("")}</ul>
  </div>
</section>

<section class="section section--dark">
  <div class="container">
    <div class="section-head reveal">
      <div><p class="eyebrow">How we work</p><h2>From bid invitation to close-out.</h2></div>
      <p>A simple, predictable process that keeps general contractors and owners informed at every step.</p>
    </div>
    <ol class="process">
      <li class="reveal"><h3>Bid &amp; estimate</h3><p>Our lead estimator prices every part of the scope from your plans and specs — green roofs, hardscape, planting and irrigation.</p></li>
      <li class="reveal" style="--d:.08s"><h3>Plan &amp; procure</h3><p>We line up plant material, soils and stone from long-standing suppliers, including contract growing when needed.</p></li>
      <li class="reveal" style="--d:.16s"><h3>Build to spec</h3><p>A senior project manager and our in-house crews install the work exactly per the drawings, with the owner on site.</p></li>
      <li class="reveal" style="--d:.24s"><h3>Close-out &amp; aftercare</h3><p>Punch lists, warranties and a dedicated aftercare lead so the landscape keeps flourishing after hand-over.</p></li>
    </ol>
  </div>
</section>

<section class="section">
  <div class="container split">
    <div class="reveal">
      <p class="eyebrow">Qualified &amp; compliant</p>
      <h2>Licensed, bonded and ready to pre-qualify.</h2>
      <p class="lead">Registered NJ public-works contractor, licensed in New Jersey, Pennsylvania, Delaware and the City of Philadelphia, with surety through ${esc(surety)}.</p>
      <ul class="pill-list">${certifications.slice(0, 6).map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
      <p style="margin-top:24px"><a class="link-arrow" href="about.html#qualifications">View all licenses &amp; union affiliations ${icon.arrow}</a></p>
    </div>
    <div class="reveal" style="--d:.1s">
      <div class="media-frame media-frame--wide">
        <img src="${img("2018/10/SEANS0033_2560.jpg")}" alt="Green roof with meandering walk and bench wall" loading="lazy" decoding="async">
      </div>
    </div>
  </div>
</section>`;

  return page({
    file: "index.html",
    title: "Sean's Landscaping, Inc. | Commercial Landscape Contractor in Hamilton, NJ",
    description: "Commercial landscape contractor in Hamilton, NJ. Green roofs, hardscape, water features, wetlands, irrigation and lighting for hospitals, universities and GCs across NJ, NY, DE and PA.",
    current: "home",
    body,
    jsonld: businessLd,
  });
}

/* ================= SERVICES ================= */
function servicesPage() {
  const blocks = services.map((s, i) => `
<section class="service-block" id="${s.id}" aria-labelledby="${s.id}-title">
  <div class="container split${i % 2 ? " split--reverse" : ""}">
    <div class="reveal">
      <span class="service-num">${String(i + 1).padStart(2, "0")} / ${String(services.length).padStart(2, "0")}</span>
      <h2 id="${s.id}-title">${s.name}</h2>
      <p class="lead">${esc(s.lead)}</p>
      <p>${esc(s.body)}</p>
      <ul class="pill-list">${s.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
      <p style="margin-top:26px"><a class="link-arrow" href="contact.html?service=${s.id}#quote">Price a ${s.name.toLowerCase()} scope ${icon.arrow}</a></p>
    </div>
    <div class="service-gallery reveal" style="--d:.1s">
      ${s.images.slice(0, 3).map(([src, cap]) => `<button class="media-frame" type="button" data-media="${img(src)}" data-title="${esc(cap)}" data-sub="${s.name}" aria-label="Enlarge photo: ${esc(cap)}"><img src="${img(src)}" alt="${esc(cap)}" loading="lazy" decoding="async"></button>`).join("")}
    </div>
  </div>
</section>`).join("");

  const body = `
<section class="page-hero has-image">
  <div class="page-hero-bg"><img data-full src="${img("2018/10/SEANS0050_2560.jpg")}" alt="" fetchpriority="high"></div>
  <div class="container">
    <ol class="breadcrumb"><li><a href="index.html">Home</a></li><li aria-current="page">Services</li></ol>
    <p class="eyebrow" style="color:var(--moss-400)">Services</p>
    <h1>Every landscape discipline, self-performed.</h1>
    <p>Nine in-house specialties — from site prep to lighting — delivered by one accountable team that follows the plans to the letter.</p>
  </div>
</section>
<nav class="service-nav" aria-label="Services on this page">
  <div class="container"><ul>${services.map((s) => `<li><a href="#${s.id}">${s.name}</a></li>`).join("")}</ul></div>
</nav>
${blocks}`;

  return page({
    file: "services.html",
    title: "Services | Green Roofs, Hardscape, Water Features & More | Sean's Landscaping",
    description: "Site prep, landscaping, hardscape, structures, water features, green roofs, wetlands, irrigation and lighting — self-performed by Sean's Landscaping across NJ, NY, DE and PA.",
    current: "services",
    body,
    ogImage: img("2018/10/SEANS0050_2560.jpg"),
  });
}

/* ================= PROJECTS ================= */
function projectsPage() {
  const body = `
<section class="page-hero has-image">
  <div class="page-hero-bg"><img data-full src="${img("2018/11/Buerger-plaza-6.1_2560.jpg")}" alt="" fetchpriority="high"></div>
  <div class="container">
    <ol class="breadcrumb"><li><a href="index.html">Home</a></li><li aria-current="page">Projects</li></ol>
    <p class="eyebrow" style="color:var(--moss-400)">Portfolio</p>
    <h1>${projects.length} projects. ${moneyShort(totalValue)} of finished landscape.</h1>
    <p>A selection of our work for hospitals, universities, museums and corporate campuses — with the general contractor, scope and contract value for each.</p>
  </div>
</section>
<section class="section">
  <div class="container">
    <div class="filters" data-filters role="group" aria-label="Filter projects">
      ${projectFilters.map(([k, l], i) => `<button class="filter-btn" type="button" data-filter="${k}" aria-pressed="${i === 0}">${esc(l)}</button>`).join("")}
    </div>
    <p class="visually-hidden" aria-live="polite" data-filter-status></p>
    <div class="project-grid">${projects.map((p, i) => projectCard(p, "", i)).join("")}</div>
    <p class="empty-state">No projects match that filter.</p>
  </div>
</section>
<section class="section section--sand" id="videos">
  <div class="container">
    <div class="section-head reveal">
      <div><p class="eyebrow">Video</p><h2>Project videos</h2></div>
      <p>Short clips from the field — tap to play.</p>
    </div>
  </div>
  <div class="reel-wrap"><ul class="reel">${videos.map(videoCard).join("")}</ul></div>
</section>`;
  return page({
    file: "projects.html",
    title: "Projects | Commercial Landscape Portfolio | Sean's Landscaping",
    description: `${projects.length} commercial landscape projects including CHOP, Princeton University, Reading Hospital, Villanova and the Philadelphia Museum of Art — scopes, contractors and values.`,
    current: "projects",
    body,
    ogImage: img("2018/11/Buerger-plaza-6.1_2560.jpg"),
  });
}

function projectDetail(p, i) {
  const base = "../";
  const prev = projects[(i - 1 + projects.length) % projects.length];
  const next = projects[(i + 1) % projects.length];
  const firstCat = p.cats.split(" ")[0];
  const related = projects.filter((x) => x !== p && x.cats.includes(firstCat)).slice(0, 3);
  const vid = p.video ? videos.find((v) => v.slug === p.video) : null;
  const hero = p.images[0];
  const body = `
<section class="page-hero has-image">
  <div class="page-hero-bg"><img data-full src="${img(hero)}" alt="" fetchpriority="high"></div>
  <div class="container">
    <ol class="breadcrumb"><li><a href="${base}index.html">Home</a></li><li><a href="${base}projects.html">Projects</a></li><li aria-current="page">${esc(p.name)}</li></ol>
    <p class="eyebrow" style="color:var(--moss-400)">${esc(p.loc)}</p>
    <h1>${esc(p.full || p.name)}</h1>
    <p>${esc(p.scope)}</p>
  </div>
</section>
<section class="section--tight">
  <div class="container">
    <dl class="facts reveal">
      <div><dt>Contract value</dt><dd>${money(p.value)}</dd></div>
      <div><dt>General contractor</dt><dd>${esc(p.gc)}</dd></div>
      <div><dt>Completed</dt><dd>${esc(p.done)}</dd></div>
      <div><dt>Project manager</dt><dd>${esc(p.pm)}</dd></div>
    </dl>
    <div class="detail-grid">
      <div class="reveal">
        <h2 class="h3">Scope of work</h2>
        <p class="lead">${esc(p.scope)}</p>
        <ul class="pill-list">${p.cats.split(" ").map((c) => `<li>${catLabels[c]}</li>`).join("")}</ul>
        ${vid ? `<p style="margin-top:24px"><button class="btn" type="button" data-media="${img(vid.src)}" data-title="${esc(vid.title)}" data-sub="${esc(vid.loc)}">${icon.play} Watch the project video</button></p>` : ""}
      </div>
      <div class="gallery reveal" style="--d:.1s">
        ${p.images.map((src, k) => `<button class="media-frame" type="button" data-media="${img(src)}" data-title="${esc(p.name)} — photo ${k + 1} of ${p.images.length}" data-sub="${esc(p.loc)}" aria-label="Enlarge photo ${k + 1} of ${p.images.length}"><img src="${img(src)}" alt="${esc(p.name)}, photo ${k + 1}" ${k === 0 ? "" : 'loading="lazy"'} decoding="async"></button>`).join("")}
      </div>
    </div>
    <nav class="pager" aria-label="More projects">
      <a href="${prev.slug}.html"><small>← Previous</small>${esc(prev.name)}</a>
      <a href="${next.slug}.html" class="next"><small>Next →</small>${esc(next.name)}</a>
    </nav>
  </div>
</section>
${related.length ? `<section class="section section--sand">
  <div class="container">
    <div class="section-head reveal"><div><p class="eyebrow">Related</p><h2>More ${catLabels[firstCat].toLowerCase()} work</h2></div><p><a class="link-arrow" href="${base}projects.html">All projects ${icon.arrow}</a></p></div>
    <div class="project-grid">${related.map((r, k) => projectCard(r, base, k)).join("")}</div>
  </div>
</section>` : ""}`;
  return page({
    file: `projects/${p.slug}.html`,
    base,
    title: `${p.name} — ${p.loc} | Sean's Landscaping`,
    description: `${p.full || p.name} in ${p.loc}: ${p.scope} General contractor ${p.gc}, ${p.done}.`.slice(0, 300),
    current: "projects",
    body,
    ogImage: img(hero),
  });
}

/* ================= ABOUT ================= */
function about() {
  const initials = (n) => n.split(" ").map((w) => w[0]).join("");
  const body = `
<section class="page-hero has-image">
  <div class="page-hero-bg"><img data-full src="${img("2018/10/128_2560.jpg")}" alt="" fetchpriority="high"></div>
  <div class="container">
    <ol class="breadcrumb"><li><a href="index.html">Home</a></li><li aria-current="page">About</li></ol>
    <p class="eyebrow" style="color:var(--moss-400)">About us</p>
    <h1>100% dedicated to the success of your project.</h1>
    <p>For over 40 years we've worked closely with landscape owners, contractors and developers across New Jersey, New York, Delaware and Eastern Pennsylvania to help them realize their visions.</p>
  </div>
</section>

<section class="section">
  <div class="container split">
    <div class="reveal">
      <p class="eyebrow">Our story</p>
      <h2>A family-run company that still shows up on site.</h2>
      <p class="lead">Sean's Landscaping is a full-service commercial landscaping company based in Hamilton, New Jersey.</p>
      <p>Our leadership has grown up inside the business. President Gerry Brady joined in 1985 and worked his way up through every role; today he leads the team and is on site with the crews on every job. Our senior project managers have each been with us for more than two decades.</p>
      <p>That continuity is why general contractors, hospitals and universities keep calling us back — RWJ Hospital Hamilton has been a client since 1994.</p>
    </div>
    <div class="reveal" style="--d:.1s">
      <div class="media-frame"><img src="${img("2018/10/SEANS0063_2560.jpg")}" alt="Sean's Landscaping crew at work" loading="lazy" decoding="async">
        <div class="media-badge"><b>40+</b><span>years serving NJ, NY, DE &amp; Eastern PA</span></div>
      </div>
    </div>
  </div>
</section>

<section class="section section--sand" id="team">
  <div class="container">
    <div class="section-head reveal">
      <div><p class="eyebrow">Leadership</p><h2>The team behind every project.</h2></div>
      <p>Decades of tenure, direct lines and real accountability. Reach any of us at the office: <a href="${C.phoneHref}">${C.phone}</a>.</p>
    </div>
    <div class="team-grid">
      ${team.map((t, i) => `<article class="team-card reveal" style="--d:${(i % 3) * 0.08}s">
        <div class="team-top"><span class="avatar" aria-hidden="true">${initials(t.name)}</span><div><h3>${t.name}</h3><p class="role">${t.role}</p></div><span class="since">Since ${t.since}</span></div>
        <p>${esc(t.bio)}</p>
        <a class="link-arrow" href="mailto:${t.email}">${icon.mail} ${t.email}</a>
      </article>`).join("")}
    </div>
  </div>
</section>

<section class="section" id="qualifications">
  <div class="container">
    <div class="section-head reveal">
      <div><p class="eyebrow">Qualifications</p><h2>Licensed, certified, bonded &amp; union.</h2></div>
      <p>Everything your pre-qualification package needs. Surety: ${esc(surety)}.</p>
    </div>
    <div class="qual-grid">
      <div class="qual-card reveal">
        <h3>Licenses &amp; registrations</h3>
        <ul class="qual-list">${licenses.map(([a, b]) => `<li><span>${esc(a)}</span><b>${esc(b)}</b></li>`).join("")}</ul>
      </div>
      <div class="qual-stack">
        <div class="qual-card reveal" style="--d:.08s">
          <h3>Certifications &amp; memberships</h3>
          <ul class="checklist checklist--tight">${certifications.map((c) => `<li>${icon.check}<span>${esc(c)}</span></li>`).join("")}</ul>
        </div>
        <div class="qual-card qual-card--dark reveal" style="--d:.16s">
          <h3>Union signatory</h3>
          <ul class="checklist checklist--tight">${unions.map((c) => `<li>${icon.check}<span>${esc(c)}</span></li>`).join("")}</ul>
          <p class="note">Members of irrigation and landscape trade associations.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section section--sand" id="clients">
  <div class="container">
    <div class="section-head reveal">
      <div><p class="eyebrow">Clients</p><h2>Trusted by the region's builders.</h2></div>
      <p>We've had the privilege of working with leaders in the construction industry. Feel free to contact any of them to ask about us.</p>
    </div>
    <ul class="name-grid reveal">${clients.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
  </div>
</section>

<section class="section" id="partners">
  <div class="container">
    <div class="section-head reveal">
      <div><p class="eyebrow">Partners</p><h2>Collaborators &amp; suppliers.</h2></div>
      <p>The specialists and suppliers we rely on — ask any of them what it's like to work with Sean's.</p>
    </div>
    <ul class="name-grid reveal">${collaborators.map(([n, d]) => `<li><span>${esc(n)}<small>${esc(d)}</small></span></li>`).join("")}</ul>
    <details class="supplier-list reveal">
      <summary>View ${suppliers.length} suppliers we work with</summary>
      <ul>${suppliers.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
    </details>
  </div>
</section>

<section class="section section--dark" id="equipment">
  <div class="container">
    <div class="section-head reveal">
      <div><p class="eyebrow">Equipment</p><h2>Our own fleet, on your schedule.</h2></div>
      <p>Owning our equipment means we mobilize when the GC needs us — not when a rental is free.</p>
    </div>
    <div class="equip-grid">
      ${equipment.map((src, i) => `<button class="media-frame reveal" style="--d:${(i % 4) * 0.05}s" type="button" data-media="${img(src)}" data-title="Sean's Landscaping equipment" aria-label="Enlarge equipment photo ${i + 1}"><img src="${img(src)}" alt="Sean's Landscaping equipment, photo ${i + 1}" loading="lazy" decoding="async"></button>`).join("")}
    </div>
  </div>
</section>`;
  return page({
    file: "about.html",
    title: "About, Team & Qualifications | Sean's Landscaping, Inc.",
    description: "Meet the Sean's Landscaping team and review our NJ, PA, DE and Philadelphia licenses, green-roof certifications, union affiliations, clients and partners.",
    current: "about",
    body,
    ogImage: img("2018/10/128_2560.jpg"),
  });
}

/* ================= CONTACT ================= */
function contact() {
  const mapQ = encodeURIComponent(addressLine);
  const scopes = services.map((s) => `<label class="chip"><input type="checkbox" name="services" value="${s.name}" data-service="${s.id}"><span>${s.name}</span></label>`).join("");
  const body = `
<section class="page-hero">
  <div class="container">
    <ol class="breadcrumb"><li><a href="index.html">Home</a></li><li aria-current="page">Contact</li></ol>
    <p class="eyebrow" style="color:var(--moss-400)">Contact</p>
    <h1>Let's talk about your project.</h1>
    <p>Bid invitations, plans and specs, or a quick question — our office directs every inquiry to the right person.</p>
  </div>
</section>
<section class="section" id="quote">
  <div class="container contact-grid">
    <div class="reveal">
      <div class="contact-cards">
        <a class="contact-card" href="${C.phoneHref}"><span class="icon">${icon.phone}</span><div><h3>Phone</h3><p>${C.phone}</p></div></a>
        <a class="contact-card" href="mailto:${C.email}"><span class="icon">${icon.mail}</span><div><h3>Email</h3><p>${C.email}</p></div></a>
        <a class="contact-card" href="https://www.google.com/maps/search/?api=1&amp;query=${mapQ}" target="_blank" rel="noopener"><span class="icon">${icon.pin}</span><div><h3>Office</h3><p>${esc(C.street)}<br>${C.city}, ${C.state} ${C.zip}</p></div></a>
        <div class="contact-card"><span class="icon">${icon.fax}</span><div><h3>Fax</h3><p>${C.fax}</p></div></div>
      </div>
      <h2 class="h3" style="margin-top:44px">Direct contacts</h2>
      <ul class="directory">
        ${[...team, ...extraContacts.slice(0, 1)].map((t) => `<li><div><strong>${t.name}</strong><span>${t.role}</span></div><a href="mailto:${t.email}">${t.email}</a></li>`).join("")}
      </ul>
    </div>
    <div class="reveal" style="--d:.1s">
      <form class="form-card" id="quote-form" data-mailto="${C.email}" novalidate>
        <h2 class="h3">Request a bid</h2>
        <p class="muted">Tell us about the project and we'll get back to you. Fields marked * are required.</p>
        <div class="form-grid">
          <div class="field"><label for="f-name">Name *</label><input id="f-name" type="text" name="name" autocomplete="name" required><span class="error" role="alert"></span></div>
          <div class="field"><label for="f-company">Company <span class="opt">(optional)</span></label><input id="f-company" type="text" name="company" autocomplete="organization"></div>
          <div class="field"><label for="f-email">Email *</label><input id="f-email" name="email" type="email" autocomplete="email" required><span class="error" role="alert"></span></div>
          <div class="field"><label for="f-phone">Phone <span class="opt">(optional)</span></label><input id="f-phone" name="phone" type="tel" autocomplete="tel"><span class="error" role="alert"></span></div>
          <div class="field"><label for="f-location">Project location <span class="opt">(optional)</span></label><input id="f-location" type="text" name="location" placeholder="City, State"></div>
          <div class="field"><label for="f-type">I am a… <span class="opt">(optional)</span></label>
            <select id="f-type" name="type"><option value="">Select one</option><option>General contractor</option><option>Owner / developer</option><option>Landscape architect / designer</option><option>Facility manager</option><option>Other</option></select></div>
          <fieldset class="chip-group full"><legend>Scope <span class="opt">(select any)</span></legend>${scopes}</fieldset>
          <div class="field full"><label for="f-timeline">Timeline <span class="opt">(optional)</span></label>
            <select id="f-timeline" name="timeline"><option value="">Select one</option><option>Bidding now</option><option>Starting within 3 months</option><option>3–12 months out</option><option>Just exploring</option></select></div>
          <div class="field full"><label for="f-message">Project details *</label><textarea id="f-message" name="message" required placeholder="Bid date, scope, square footage, plan links…"></textarea><span class="error" role="alert"></span></div>
          <div class="hp" aria-hidden="true"><label for="f-hp">Leave blank</label><input id="f-hp" type="text" name="company_site" tabindex="-1" autocomplete="off"></div>
        </div>
        <div class="form-foot">
          <small>Sends from your email app to ${C.email}</small>
          <button class="btn btn--accent" type="submit">Send inquiry ${icon.arrow}</button>
        </div>
        <p class="form-status" role="status" aria-live="polite"></p>
      </form>
    </div>
  </div>
</section>
<section class="section--tight">
  <div class="container">
    <div class="map-frame reveal"><iframe title="Map to ${esc(C.name)}" src="https://www.google.com/maps?q=${mapQ}&amp;output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
  </div>
</section>
<section class="section section--sand">
  <div class="container">
    <div class="section-head reveal"><div><p class="eyebrow">FAQ</p><h2>Common questions</h2></div><p>Quick answers for contractors and owners.</p></div>
    <div class="faq">
      <details class="reveal"><summary>What areas do you serve?</summary><p>New Jersey, New York, Delaware and Eastern Pennsylvania, including the City of Philadelphia. Our office is in Hamilton, NJ (Mercer County).</p></details>
      <details class="reveal"><summary>Do you work as a subcontractor to general contractors?</summary><p>Yes — most of our work is for general contractors and construction managers such as Turner, L.F. Driscoll, Skanska, Hunter Roberts and Barr &amp; Barr, as well as directly for owners like RWJ Hospital and Princeton University.</p></details>
      <details class="reveal"><summary>Are you licensed, insured and bonded?</summary><p>Yes. We are a registered NJ public-works contractor, licensed in NJ, PA, DE and Philadelphia, with surety through ${esc(surety)}. See the full list on our <a href="about.html#qualifications">qualifications</a> page.</p></details>
      <details class="reveal"><summary>Are you a union contractor?</summary><p>We are signatory to Operating Engineers Locals 825 and 542, Laborers Locals 172, 472 and 332, Building Trades Local 77 and Bricklayers Local 1.</p></details>
      <details class="reveal"><summary>Are you a certified green-roof installer?</summary><p>Yes — we are certified Roof Meadows, American Hydrotech and LiveRoof contractors and have built intensive and extensive roofs from 4th-floor decks to an 80,000 sq ft hospital roof.</p></details>
      <details class="reveal"><summary>Do you take residential projects?</summary><p>We focus on commercial, institutional and public landscape construction. Give the office a call and we'll let you know if we're a fit.</p></details>
    </div>
  </div>
</section>`;
  return page({
    file: "contact.html",
    title: "Contact & Request a Bid | Sean's Landscaping, Inc. — Hamilton, NJ",
    description: `Contact Sean's Landscaping in Hamilton, NJ. Call ${C.phone}, email ${C.email}, or send your bid invitation and project details online.`,
    current: "contact",
    body,
    solidHeader: false,
    jsonld: businessLd,
  });
}

/* ================= 404 ================= */
function notFound() {
  return page({
    file: "404.html",
    title: "Page not found | Sean's Landscaping",
    description: "The page you were looking for could not be found.",
    current: "",
    base: "/",
    body: `<section class="page-hero" style="min-height:70vh;display:flex;align-items:center"><div class="container">
      <p class="eyebrow" style="color:var(--moss-400)">404</p><h1>This path is overgrown.</h1>
      <p>The page you're looking for has moved or no longer exists.</p>
      <p style="margin-top:28px;display:flex;gap:12px;flex-wrap:wrap"><a class="btn btn--accent" href="/index.html">Back to home ${icon.arrow}</a><a class="btn btn--ghost" href="/projects.html">Browse projects</a></p>
    </div></section>`,
  });
}

/* ================= build ================= */
const files = [home(), servicesPage(), projectsPage(), ...projects.map(projectDetail), about(), contact(), notFound()];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${files.filter((f) => f !== "404.html").map((f) => `  <url><loc>${SITE}/${f.replace(/index\.html$/, "")}</loc></url>`).join("\n")}
</urlset>
`;
writeFileSync(join(ROOT, "sitemap.xml"), sitemap);
writeFileSync(join(ROOT, "robots.txt"), DEMO ? "User-agent: *\nDisallow: /\n" : `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
if (ROOT !== REPO) cpSync(join(REPO, "assets"), join(ROOT, "assets"), { recursive: true });
console.log(`Built ${files.length} pages. Featured value: ${money(totalValue)}`);
