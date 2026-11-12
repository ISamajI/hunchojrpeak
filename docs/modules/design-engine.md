# Design engine (Orochimaru)

Every demo is art-directed, built, and QA'd by this pipeline (`src/branches/orochimaru-demo.js`):

1. **Research (Jiraiya):** audits the business website. It captures real booking and ordering links (Booksy, Vagaro, Square, Calendly, OpenTable, DoorDash and others) and the site's own large images. Google Places supplies photos, rating, reviews and hours when it's connected.
2. **Creative director** (`design/director.js`): scores all **12 design systems** (`design/directions.js`) and keeps three distinct candidates. Scoring covers:
   - industry fit
   - researched brand tone
   - photo availability: photo-led layouts need real imagery, and photo-free layouts are composed to stand alone
   - computed WCAG contrast for every text/background pair; a direction that fails is disqualified
   - a per-business seed, so two barbers in one city don't get the same site

   It selects the strongest and writes a rationale.
3. **Photography briefs:** five section-specific prompts (hero, story, three services). Each specifies camera angle, lens, light direction, composition, colour grade, palette, atmosphere and placement. They're used for AI generation and are shown in the dashboard so you can brief a photographer.
4. **Imagery** (`design/assets.js`), in strict priority order. Stock photos are never used.
   1. The business's own Google Places photos, attributed.
   2. Images from the business's own website. Only images at least 900px wide are kept, and logos/icons are rejected using the image's real header dimensions.
   3. AI concept imagery (OpenAI `gpt-image-1` or Replicate Flux), when `IMAGE_PROVIDER` is set. These are labeled "Concept imagery — to be replaced with your own photography" and capped at `AKAMARU_IMAGEGEN_MAX` (default 4).
   4. None of the above: a photo-free cinematic composition (WebGL light field, editorial type, grain).
5. **Copy:** Claude writes it in the direction's voice when connected, and is guarded against invented facts and contact details. Otherwise it's template copy built from real facts.
6. **Render** (`design/render.js` + `design/kit/`): a multi-file static site with self-hosted fonts, GSAP + ScrollTrigger bundled locally, and no third-party requests.
7. **Itachi QA** (`itachi-qa.js`): static checks plus a **real-browser pass at 375, 390, 430, 768, 1024, 1440 and 1920px**. It checks for horizontal overflow, script/console errors, headline and CTA in the first viewport, a working mobile menu, and touch targets of at least 40px. Failing demos are never deployed.

## Design systems
| Direction | Best for | Type | Hero | Services layout |
|---|---|---|---|---|
| Noir Atelier | barber, tattoo | Instrument Serif / Inter Tight | cinematic | numbered index + cursor preview |
| Street Grade | barber, tattoo, fitness | Bebas Neue / Space Grotesk | kinetic name marquee | bento cards |
| Soft Salon | beauty, spa | Cormorant Garamond / Manrope | editorial + framed media | accordion |
| Ember | restaurants | Fraunces / Inter Tight | cinematic ember field | editorial menu |
| Market Fresh | cafés, restaurants | DM Serif Display / Manrope | editorial | editorial menu |
| Roastery Editorial | cafés | Instrument Serif / Inter Tight | editorial | numbered index |
| Precision Garage | auto, trades | Archivo / Inter Tight | cinematic technical grid | spec sheet |
| Trade & Trust | trades | Bricolage Grotesque / Inter Tight | editorial | bento cards |
| Clinical Calm | dental, health | Fraunces / Manrope | editorial | accordion |
| Kinetic | gyms | Unbounded / Space Grotesk | kinetic marquee | bento cards |
| Gallery Minimal | retail, boutiques | Syne / Inter Tight | editorial | numbered index |
| Civic Modern | professional services | DM Serif Display / Manrope | editorial | bento cards |

## Sections (each only when real data supports it)
- **Always:** concept bar, glass nav with mobile overlay menu, hero, editorial introduction (words fill as you scroll), services marquee band, services, sticky storytelling "How it works", visit/booking, oversized-wordmark footer.
- **Stats:** only real numbers (Google rating, review count, days open).
- **Gallery:** pinned horizontal scroll with a lightbox. Only with 3+ real photos.
- **Reviews:** only verified Google reviews, attributed to author and source. QA rejects any rating that doesn't match the real Google figure.

## Business functionality
- **Primary CTA:** the business's real booking or ordering link when one exists.
- **Booking request form:** composes a real SMS (or email) to the business with the request filled in. It works on any host with no backend, and nothing is faked.
- **Contact actions:** call, directions, opening hours (today highlighted) and LocalBusiness JSON-LD.
- **Production phase:** full booking systems, carts, checkout and accounts are built after the client signs. They need the client's own accounts (payments, scheduling) and are owner-approval actions.

## Motion
- Curtain intro and line-by-line headline reveals.
- Clip-path image reveals and parallax.
- Scroll-scrubbed editorial text.
- Velocity-reactive marquees.
- Magnetic buttons, a custom cursor, and a cursor-following service preview.
- Animated counters for real stats.
- Pinned horizontal gallery.

`prefers-reduced-motion` disables all of it, and content is fully visible without JavaScript.
