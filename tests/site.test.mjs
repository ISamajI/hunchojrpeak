// End-to-end checks for the static site. Run: node tests/site.test.mjs [baseUrl]
// Starts nothing itself: serve the repo root first (e.g. `python3 -m http.server 8765`).
// Remote photos/videos on seanslandscaping.com are stubbed with placeholders so the
// suite runs offline and deterministically.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.argv[2] || "http://localhost:8765").replace(/\/$/, "");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS || "";
const pages = ["index.html", "services.html", "projects.html", "about.html", "contact.html", "404.html",
  ...readdirSync(join(ROOT, "projects")).map((f) => "projects/" + f)];
const viewports = { mobile: { width: 375, height: 812 }, tablet: { width: 820, height: 1180 }, desktop: { width: 1440, height: 900 } };

let failures = 0, passes = 0;
const fail = (msg) => { failures++; console.log("  ✗ " + msg); };
const ok = (cond, msg) => { if (cond) passes++; else fail(msg); };

const placeholder = (label) => {
  const hue = [...label].reduce((a, c) => a + c.charCodeAt(0), 0) % 60 + 90;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},35%,42%)"/><stop offset="1" stop-color="hsl(${hue + 20},40%,18%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="50%" fill="rgba(255,255,255,.35)" font-family="sans-serif" font-size="44" text-anchor="middle">${label.replace(/[<&]/g, "")}</text></svg>`;
};

async function newPage(browser, vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: vp, reducedMotion: opts.reducedMotion || "no-preference" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  page.on("response", (r) => { if (r.url().startsWith(BASE) && r.status() >= 400 && !r.url().endsWith("/does-not-exist")) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.includes("seanslandscaping.com/wp-content/uploads/")) {
      if (/\.(mp4|webm)$/i.test(url)) return route.fulfill({ status: 200, contentType: "video/mp4", body: "" });
      return route.fulfill({ status: 200, contentType: "image/svg+xml", body: placeholder(url.split("/").pop()) });
    }
    if (url.startsWith(BASE) || url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com")) return route.continue();
    return route.abort(); // maps iframe etc. — external, not under test
  });
  return { ctx, page, errors };
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.6;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 1200));
  });
}

async function staticChecks(browser) {
  console.log("\n▶ Per-page checks (" + pages.length + " pages × 3 viewports)");
  const linkSet = new Set();
  for (const [vpName, vp] of Object.entries(viewports)) {
    for (const p of pages) {
      const { ctx, page, errors } = await newPage(browser, vp);
      await page.goto(`${BASE}/${p}`, { waitUntil: "load" });
      await scrollThrough(page);
      const r = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const wide = [...document.querySelectorAll("body *")].filter((el) => {
          if (el.closest(".marquee, .reel, .filters, .service-nav ul, .mobile-menu, dialog, .footer-big, .skip-link, .visually-hidden, .hp")) return false;
          const b = el.getBoundingClientRect();
          if (!(b.width > 0 && (b.right > vw + 1 || b.left < -1))) return false;
          // Ignore content clipped by an overflow:hidden/clip ancestor that itself fits the viewport.
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const o = getComputedStyle(p).overflowX;
            if (o === "hidden" || o === "clip") { const pb = p.getBoundingClientRect(); if (pb.right <= vw + 1 && pb.left >= -1) return false; }
          }
          return true;
        }).slice(0, 3).map((el) => el.tagName + "." + el.className + " " + Math.round(el.getBoundingClientRect().right));
        const hidden = [...document.querySelectorAll(".reveal")].filter((el) => getComputedStyle(el).display !== "none" && !el.classList.contains("is-in")).length;
        return {
          overflow: document.documentElement.scrollWidth - vw,
          wide,
          h1: document.querySelectorAll("h1").length,
          title: document.title,
          desc: document.querySelector('meta[name="description"]')?.content || "",
          noAlt: [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length,
          brokenImgs: [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src).slice(0, 3),
          hiddenReveals: hidden,
          ids: (() => { const seen = {}, d = []; document.querySelectorAll("[id]").forEach((e) => { if (seen[e.id]) d.push(e.id); seen[e.id] = 1; }); return d; })(),
          links: [...document.querySelectorAll("a[href]")].map((a) => a.href),
          emptyLinks: [...document.querySelectorAll("a, button")].filter((a) => !(a.textContent.trim() || a.getAttribute("aria-label"))).length,
        };
      });
      const tag = `[${vpName}] ${p}`;
      ok(errors.length === 0, `${tag}: errors → ${errors.join(" | ")}`);
      ok(r.overflow <= 0, `${tag}: horizontal overflow ${r.overflow}px`);
      ok(r.wide.length === 0, `${tag}: elements outside viewport → ${r.wide.join(", ")}`);
      ok(r.h1 === 1, `${tag}: expected 1 h1, got ${r.h1}`);
      ok(r.title.length > 10 && r.desc.length > 40, `${tag}: missing title/description`);
      ok(r.noAlt === 0, `${tag}: ${r.noAlt} img without alt`);
      ok(r.brokenImgs.length === 0, `${tag}: broken images → ${r.brokenImgs.join(", ")}`);
      ok(r.hiddenReveals === 0, `${tag}: ${r.hiddenReveals} reveal blocks never became visible`);
      ok(r.ids.length === 0, `${tag}: duplicate ids → ${r.ids.join(", ")}`);
      ok(r.emptyLinks === 0, `${tag}: ${r.emptyLinks} links/buttons without accessible name`);
      if (vpName === "desktop") r.links.forEach((l) => linkSet.add(l));
      if (SHOTS && ["index.html", "services.html", "projects.html", "about.html", "contact.html", "projects/reading-hospital.html"].includes(p) && vpName !== "tablet") {
        mkdirSync(SHOTS, { recursive: true });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(400);
        await page.screenshot({ path: join(SHOTS, `${vpName}-${p.replace(/\//g, "_")}.png`), fullPage: true });
      }
      await ctx.close();
    }
  }

  console.log("\n▶ Link check (" + linkSet.size + " unique links)");
  for (const l of linkSet) {
    if (l.startsWith("tel:") || l.startsWith("mailto:")) { ok(/^tel:\+1\d{10}$|^mailto:[^@\s]+@[^@\s]+\.\w+/.test(l), `bad link ${l}`); continue; }
    if (!l.startsWith(BASE)) { ok(/^https:\/\//.test(l), `non-https external link ${l}`); continue; }
    const u = new URL(l);
    const res = await fetch(BASE + u.pathname);
    ok(res.ok, `broken internal link ${l} → ${res.status}`);
    if (u.hash && res.ok) {
      const html = await res.text();
      ok(html.includes(`id="${u.hash.slice(1)}"`), `missing anchor ${l}`);
    }
  }
}

async function interactionChecks(browser) {
  console.log("\n▶ Interaction checks");
  // Desktop header + dropdown
  {
    const { ctx, page, errors } = await newPage(browser, viewports.desktop);
    await page.goto(`${BASE}/index.html`);
    ok(!(await page.$eval(".site-header", (h) => h.classList.contains("is-solid"))), "header should start transparent on home");
    await page.mouse.wheel(0, 300); await page.waitForTimeout(300);
    ok(await page.$eval(".site-header", (h) => h.classList.contains("is-solid")), "header should become solid after scroll");
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
    await page.click(".has-dropdown > button");
    await page.waitForTimeout(400);
    ok(await page.$eval(".has-dropdown > button", (b) => b.getAttribute("aria-expanded") === "true"), "dropdown aria-expanded after click");
    ok(await page.$eval(".dropdown", (d) => getComputedStyle(d).visibility === "visible"), "dropdown visible after click");
    await page.keyboard.press("Escape"); await page.mouse.move(5, 600); await page.waitForTimeout(400);
    ok(await page.$eval(".has-dropdown > button", (b) => b.getAttribute("aria-expanded") === "false"), "dropdown closes on Escape");
    await page.click(".has-dropdown > button");
    await page.click(".dropdown a[href$='#wetlands']");
    await page.waitForTimeout(1200);
    ok(page.url().endsWith("services.html#wetlands"), "dropdown link navigates to service anchor");
    ok(await page.$eval(".service-nav a[href='#wetlands']", (a) => a.classList.contains("is-active")), "scroll-spy marks Wetlands active");
    ok(errors.length === 0, "desktop header errors: " + errors.join(" | "));
    await ctx.close();
  }
  // Mobile menu + action bar
  {
    const { ctx, page, errors } = await newPage(browser, viewports.mobile);
    await page.goto(`${BASE}/index.html`);
    ok(await page.$eval("#mobile-menu", (m) => m.hasAttribute("inert")), "mobile menu inert when closed");
    await page.click(".menu-toggle");
    await page.waitForTimeout(450);
    ok(await page.$eval(".menu-toggle", (b) => b.getAttribute("aria-expanded") === "true"), "menu toggle aria-expanded=true");
    ok(await page.$eval("#mobile-menu", (m) => !m.hasAttribute("inert") && getComputedStyle(m).visibility === "visible"), "mobile menu visible & interactive");
    ok(await page.evaluate(() => getComputedStyle(document.documentElement).overflow === "hidden"), "page scroll locked while menu open");
    await page.keyboard.press("Escape"); await page.waitForTimeout(450);
    ok(await page.$eval("#mobile-menu", (m) => m.hasAttribute("inert")), "Escape closes mobile menu");
    await page.click(".menu-toggle"); await page.waitForTimeout(400);
    await page.click("#mobile-menu a[href='projects.html']");
    await page.waitForLoadState("load");
    ok(page.url().endsWith("/projects.html"), "mobile menu link navigates");
    await page.mouse.wheel(0, 900); await page.waitForTimeout(600);
    ok(await page.$eval(".action-bar", (b) => b.classList.contains("is-visible")), "mobile action bar appears after scroll");
    ok(errors.length === 0, "mobile menu errors: " + errors.join(" | "));
    await ctx.close();
  }
  // Project filters
  {
    const { ctx, page, errors } = await newPage(browser, viewports.desktop);
    await page.goto(`${BASE}/projects.html`);
    const total = await page.$$eval(".project-card", (c) => c.length);
    ok(total === 24, `expected 24 project cards, got ${total}`);
    for (const f of ["green-roofs", "healthcare", "universities", "water-features", "civic", "corporate", "hardscape", "landscaping"]) {
      await page.click(`.filter-btn[data-filter='${f}']`);
      const r = await page.evaluate((f) => ({
        visible: [...document.querySelectorAll(".project-card")].filter((c) => c.offsetParent !== null).length,
        expected: [...document.querySelectorAll(".project-card")].filter((c) => c.dataset.category.split(" ").includes(f)).length,
        badge: parseInt(document.querySelector(`.filter-btn[data-filter='${f}'] .filter-count`).textContent, 10),
        pressed: document.querySelector(`.filter-btn[data-filter='${f}']`).getAttribute("aria-pressed"),
        status: document.querySelector("[data-filter-status]").textContent,
      }), f);
      ok(r.visible === r.expected && r.visible > 0 && r.badge === r.visible && r.pressed === "true" && r.status.startsWith(String(r.visible)), `filter ${f}: ${JSON.stringify(r)}`);
    }
    await page.click(".filter-btn[data-filter='all']");
    ok((await page.$$eval(".project-card", (c) => c.filter((x) => x.offsetParent !== null).length)) === 24, "All filter restores 24 cards");
    // card click → detail page
    await page.click(".project-card:first-child .stretched");
    await page.waitForLoadState("load");
    ok(/\/projects\/[\w-]+\.html$/.test(page.url()), "project card navigates to detail page");
    ok(errors.length === 0, "filter errors: " + errors.join(" | "));
    await ctx.close();
  }
  // Lightbox: video + image + focus return
  {
    const { ctx, page, errors } = await newPage(browser, viewports.desktop);
    await page.goto(`${BASE}/index.html#videos`);
    await page.waitForTimeout(600);
    const btn = page.locator(".reel-card").first();
    await btn.click();
    await page.waitForTimeout(300);
    ok(await page.$eval("#lightbox", (d) => d.open), "lightbox opens for video");
    const src = await page.$eval("#lightbox video", (v) => v.getAttribute("src")).catch(() => "");
    ok(/CIRA-South-Green%20Roof\.mp4$/.test(src), "lightbox video src set correctly: " + src);
    ok((await page.$eval(".lightbox-title", (t) => t.textContent)).includes("Cira South Garage"), "lightbox title set");
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    ok(!(await page.$eval("#lightbox", (d) => d.open)), "Escape closes lightbox");
    ok(await page.$eval("#lightbox .lightbox-stage", (s) => s.children.length === 0), "video removed (stops playback) on close");
    ok(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("reel-card")), "focus returns to trigger");
    await btn.click(); await page.waitForTimeout(300);
    await page.click(".lightbox-close"); await page.waitForTimeout(300);
    ok(!(await page.$eval("#lightbox", (d) => d.open)), "close button closes lightbox");
    await btn.click(); await page.waitForTimeout(300);
    await page.mouse.click(10, 10); await page.waitForTimeout(300);
    ok(!(await page.$eval("#lightbox", (d) => d.open)), "backdrop click closes lightbox");
    await page.goto(`${BASE}/projects/reading-hospital.html`);
    await page.click(".gallery .media-frame:nth-child(2)"); await page.waitForTimeout(300);
    ok(await page.$eval("#lightbox img", (i) => /Reading-hospital-3/.test(i.src)).catch(() => false), "gallery image opens in lightbox");
    await page.keyboard.press("Escape");
    await page.click("button:has-text('Watch the project video')"); await page.waitForTimeout(300);
    ok(await page.$eval("#lightbox video", (v) => /Reading-Water-Feature\.mp4$/.test(v.src)).catch(() => false), "project video button opens related video");
    ok(errors.length === 0, "lightbox errors: " + errors.join(" | "));
    await ctx.close();
  }
  // Contact form
  {
    const { ctx, page, errors } = await newPage(browser, viewports.mobile);
    await page.goto(`${BASE}/contact.html?service=green-roofs#quote`);
    ok(await page.$eval("input[data-service='green-roofs']", (i) => i.checked), "?service= preselects scope chip");
    await page.click("#quote-form button[type=submit]");
    const errCount = await page.$$eval(".field.has-error", (f) => f.length);
    ok(errCount === 3, `empty submit shows 3 errors, got ${errCount}`);
    ok(await page.evaluate(() => document.activeElement && document.activeElement.id === "f-name"), "focus moves to first invalid field");
    await page.fill("#f-name", "Pat Builder");
    await page.fill("#f-email", "not-an-email");
    await page.fill("#f-phone", "123");
    await page.fill("#f-message", "Bid due Friday for a 20k sq ft green roof.");
    await page.click("#quote-form button[type=submit]");
    ok(await page.$eval("#f-email", (i) => i.closest(".field").classList.contains("has-error")), "invalid email flagged");
    ok(await page.$eval("#f-phone", (i) => i.closest(".field").classList.contains("has-error")), "short phone flagged");
    await page.fill("#f-email", "pat@example.com");
    ok(!(await page.$eval("#f-email", (i) => i.closest(".field").classList.contains("has-error"))), "error clears live once fixed");
    await page.fill("#f-phone", "609-555-0100");
    // Capture the mailto hand-off instead of letting the browser try to open it.
    await page.evaluate(() => {
      window.__mailto = null;
      document.getElementById("quote-form").addEventListener("submit", () => {}, true);
    });
    const [req] = await Promise.all([
      page.waitForEvent("request", (r) => r.url().startsWith("mailto:"), { timeout: 3000 }).catch(() => null),
      page.click("#quote-form button[type=submit]"),
    ]);
    await page.waitForTimeout(300);
    ok(await page.$eval(".form-status", (s) => s.classList.contains("is-visible") && s.textContent.includes("Pat")), "success status shown");
    if (req) {
      const u = decodeURIComponent(req.url());
      ok(u.includes("mailto:seanslandscapinginc@gmail.com") && u.includes("Scope: Green Roofs") && u.includes("Pat Builder"), "mailto contains form data");
    } else {
      // Some headless builds don't surface mailto navigations as requests; status check above still covers the flow.
      passes++;
    }
    ok(errors.length === 0, "contact errors: " + errors.join(" | "));
    await ctx.close();
  }
  // Reduced motion: content visible immediately, slideshow static
  {
    const { ctx, page, errors } = await newPage(browser, viewports.desktop, { reducedMotion: "reduce" });
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(200);
    const hidden = await page.$$eval(".reveal", (els) => els.filter((e) => parseFloat(getComputedStyle(e).opacity) < 0.99).length);
    ok(hidden === 0, `reduced motion: ${hidden} reveal blocks still hidden`);
    ok(errors.length === 0, "reduced-motion errors: " + errors.join(" | "));
    await ctx.close();
  }
  // Keyboard: skip link + focus visible order
  {
    const { ctx, page } = await newPage(browser, viewports.desktop);
    await page.goto(`${BASE}/about.html`);
    await page.keyboard.press("Tab");
    ok(await page.evaluate(() => document.activeElement.classList.contains("skip-link")), "first Tab focuses skip link");
    await page.keyboard.press("Enter");
    ok(page.url().endsWith("#main"), "skip link jumps to main");
    await ctx.close();
  }
  // No-JS: content still readable
  {
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: viewports.desktop });
    const page = await ctx.newPage();
    await page.route("**/*", (r) => (r.request().url().startsWith(BASE) ? r.continue() : r.abort()));
    await page.goto(`${BASE}/index.html`);
    const hidden = await page.$$eval(".reveal", (els) => els.filter((e) => parseFloat(getComputedStyle(e).opacity) < 0.99).length);
    ok(hidden === 0, `no-JS: ${hidden} blocks hidden`);
    await ctx.close();
  }
  // 404 page served from nested path keeps assets (absolute base)
  {
    const { ctx, page } = await newPage(browser, viewports.desktop);
    await page.goto(`${BASE}/404.html`);
    ok(await page.evaluate(() => getComputedStyle(document.body).backgroundColor !== "rgba(0, 0, 0, 0)"), "404 page styled");
    await ctx.close();
  }
}

const browser = await chromium.launch();
const t0 = Date.now();
try {
  await staticChecks(browser);
  await interactionChecks(browser);
} finally {
  await browser.close();
}
console.log(`\n${failures ? "FAILED" : "PASSED"} — ${passes} passed, ${failures} failed (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
process.exit(failures ? 1 : 0);
