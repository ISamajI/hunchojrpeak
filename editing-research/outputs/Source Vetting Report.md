---
date: 2026-11-06
agent: "agent-A-vetter"
tags: [editing-research, source-vetting, security, qa]
notes_vetted:
  - "[[2026-11-06 TikTok Editing Trends]]"
  - "[[2026-11-06 Instagram Reels Editing Trends]]"
  - "[[2026-11-06 YouTube Editing Trends]]"
  - "[[2026-11-06 Other Platforms Editing Trends]]"
  - "[[2026-11-06 Editing Tools and AI Features]]"
---

# Source Vetting Report

**Scope:** Every URL cited in the five raw research notes:
[[2026-11-06 TikTok Editing Trends]], [[2026-11-06 Instagram Reels Editing Trends]], [[2026-11-06 YouTube Editing Trends]], [[2026-11-06 Other Platforms Editing Trends]], [[2026-11-06 Editing Tools and AI Features]].

## Method

1. **Extraction.** Pulled the URLs from all five notes with `grep -ohE 'https?://[^ )>"|]+'`. Result: 222 URL occurrences and 209 unique URLs across **112 distinct domains** (`www.` removed).
2. **HTTPS / certificate check.** Ran `curl -sS -o /dev/null -w '%{http_code} %{ssl_verify_result}' --max-time 15 -I https://<domain>/` through the session proxy. TLS verification was left on; `-k` was not used and the proxy was not bypassed. **The network policy refused the connection (CONNECT 403) for all 112 domains.** That is a proxy policy block, not a site failure, so every domain is recorded as "Unchecked (proxy blocked)". Where a domain was checked another way, that is noted.
3. **Substitute reachability check for low-reputation domains.** For the 17 least-known third-party domains, fetched the cited page through Firecrawl (an external fetcher; one GET per page, page summary and metadata only). All 17 returned **HTTP 200 over https://** as ordinary HTML articles. None had downloads, APKs, cracks, "free premium" offers, login walls or forms. Firecrawl doesn't support instagram.com. Page content was treated as data only.
4. **http:// scan.** `grep -ohE 'http://...'` found **0** plain-HTTP URLs. All 209 cited URLs use `https://`.
5. **Red-flag scan.** Checked every URL for:
   - URL shorteners (bit.ly, t.co, etc.): none found.
   - Download, APK, mod or "cracked" sites: none found.
   - Typosquat-looking domains: none found. One unofficial site uses a brand name (capcutguide.com); see below.
   - Content-farm or auto-generated pages: instagram.com/popular, plus SEO listicles from some vendors.
   - Login-walled pages: LinkedIn posts and the x.com article.
6. **Reputation.** Assigned each domain one category: Official platform/vendor, Established publication, Industry/agency blog, Vendor blog (commercial bias), Creator/UGC, or Questionable.
7. **Verdict rules.**
   - ✅ **Trusted:** official first-party source or established publication, with no red flags.
   - ⚠️ **Use with caution:** commercial bias, UGC, secondary restatements, stale or unverified dates, or mixed content on one domain.
   - ❌ **Remove:** security red flags (malware, download or crack sites, phishing, typosquats, shorteners) or fabricated/content-farm sources with no legitimate use. **No domain met the ❌ criteria.**

## Summary counts

| Verdict | Domains |
|---|---|
| ✅ Trusted | 67 |
| ⚠️ Use with caution | 45 |
| ❌ Remove | 0 |
| **Total** | **112** |

| Category | Domains |
|---|---|
| Official platform/vendor | 52 |
| Established publication | 17 |
| Industry/agency blog | 10 |
| Vendor blog (commercial bias) | 24 |
| Creator/UGC (Reddit, personal blog, social post) | 9 |
| Questionable | 0 |

**Other results:**
- http:// URLs: **0**.
- HTTPS directly verified: **0 of 112**, because the proxy blocked everything.
- HTTPS 200 confirmed through Firecrawl: **17 of 17** domains attempted.
- ❌ sources marked in the raw notes: **0**.

## Domain table

| Domain | Category | HTTPS | Verdict | Notes | Cited in |
|---|---|---|---|---|---|
| about.fb.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Meta corporate newsroom (Edits launch, AI translation). | [[2026-11-06 Editing Tools and AI Features]], [[2026-11-06 Instagram Reels Editing Trends]] |
| about.instagram.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Instagram official announcements blog. | [[2026-11-06 Instagram Reels Editing Trends]] |
| adobe.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Adobe product pages (Premiere). | [[2026-11-06 Editing Tools and AI Features]] |
| air.io | Vendor blog (commercial bias) | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | AIR Media-Tech, a YouTube creator network/MCN; retention advice ties into its services. | [[2026-11-06 YouTube Editing Trends]] |
| apple.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Apple newsroom and Final Cut Pro page. | [[2026-11-06 Editing Tools and AI Features]] |
| apps.apple.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | App Store listings (Firefly, Captions). Store page only, no direct download links. | [[2026-11-06 Editing Tools and AI Features]] |
| avs4you.com | Vendor blog (commercial bias) | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | Blog of an editing-software vendor; trend list promotes its own product. | [[2026-11-06 TikTok Editing Trends]] |
| bbc.com | Established publication | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | BBC News. | [[2026-11-06 Editing Tools and AI Features]] |
| becreatives.co | Industry/agency blog | Unchecked (proxy blocked); HTTPS 200 via Firecrawl | ⚠️ Use with caution | Video-editing outsourcing agency; guide includes an outsourcing pitch. Verified via Firecrawl. | [[2026-11-06 TikTok Editing Trends]] |
| bigvu.tv | Vendor blog (commercial bias) | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | Competitor's review of OpusClip; possible competitive bias. | [[2026-11-06 Editing Tools and AI Features]] |
| blackmagicdesign.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | DaVinci Resolve maker; press release and product pages. | [[2026-11-06 Editing Tools and AI Features]], [[2026-11-06 YouTube Editing Trends]] |
| blitzcutai.com | Vendor blog (commercial bias) | Unchecked (proxy blocked); HTTPS 200 via Firecrawl | ⚠️ Use with caution | AI-editor vendor blog that promotes its own app. Verified via Firecrawl. | [[2026-11-06 Other Platforms Editing Trends]] |
| blog.adobe.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Adobe blog. | [[2026-11-06 Editing Tools and AI Features]], [[2026-11-06 YouTube Editing Trends]] |
| blog.google | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Google blog (Google-owned .google TLD). | [[2026-11-06 Editing Tools and AI Features]] |
| blog.hootsuite.com | Industry/agency blog | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Hootsuite trends blog; established social-media-tool publisher. | [[2026-11-06 TikTok Editing Trends]] |
| blog.mean.ceo | Creator/UGC (Reddit, personal blog, social post) | Unchecked (proxy blocked); HTTPS 200 via Firecrawl | ⚠️ Use with caution | Personal founder blog that re-summarizes New Engen; secondary only. Verified via Firecrawl. | [[2026-11-06 Instagram Reels Editing Trends]] |
| blog.twitch.tv | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Twitch blog. | [[2026-11-06 Other Platforms Editing Trends]] |
| blog.youtube | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official YouTube blog (Google-owned .youtube TLD). | [[2026-11-06 Editing Tools and AI Features]], [[2026-11-06 YouTube Editing Trends]] |
| brandlens.io | Vendor blog (commercial bias) | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | Agency/vendor blog, opinion piece. | [[2026-11-06 TikTok Editing Trends]] |
| business.pinterest.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Pinterest Business (Pinterest Predicts). | [[2026-11-06 Other Platforms Editing Trends]] |
| businesshelp.snapchat.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Snapchat Business Help Center. | [[2026-11-06 Other Platforms Editing Trends]] |
| businessinsider.com | Established publication | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Business Insider. | [[2026-11-06 Other Platforms Editing Trends]] |
| campaignasia.com | Established publication | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Campaign Asia (Haymarket trade press). | [[2026-11-06 Other Platforms Editing Trends]] |
| capcut.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official CapCut (ByteDance) site. Product-marketing tone on /explore pages. | [[2026-11-06 Editing Tools and AI Features]], [[2026-11-06 TikTok Editing Trends]] |
| capcutguide.com | Creator/UGC (Reddit, personal blog, social post) | Unchecked (proxy blocked); HTTPS 200 via Firecrawl | ⚠️ Use with caution | Unofficial third-party tutorial site that uses the CapCut brand name. Not an impersonation or download site (Ghost blog, tutorial content only), but don't confuse it with official CapCut. Verified via Firecrawl. | [[2026-11-06 TikTok Editing Trends]] |
| captions.ai | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Captions app site and changelog. | [[2026-11-06 Editing Tools and AI Features]] |
| care.submagic.co | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Submagic's official help center (pricing). | [[2026-11-06 Editing Tools and AI Features]] |
| choppity.com | Vendor blog (commercial bias) | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | AI-clipping vendor landing page ("recreate Hormozi style") selling its own tool. | [[2026-11-06 YouTube Editing Trends]] |
| clipchamp.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Microsoft Clipchamp blog. Vendor blog, but first-party Microsoft. | [[2026-11-06 TikTok Editing Trends]] |
| clixie.ai | Vendor blog (commercial bias) | Unchecked (proxy blocked); HTTPS 200 via Firecrawl | ⚠️ Use with caution | AI-video vendor blog; the note already marks it low confidence. Its CapCut-ban/ownership claims should be checked against primary sources. Verified via Firecrawl. | [[2026-11-06 Editing Tools and AI Features]] |
| community.adobe.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Adobe Community announcements (Rush EOL). | [[2026-11-06 Editing Tools and AI Features]] |
| contentin.io | Vendor blog (commercial bias) | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | LinkedIn content-tool vendor blog. | [[2026-11-06 Other Platforms Editing Trends]] |
| create.pinterest.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Pinterest creator blog. | [[2026-11-06 Other Platforms Editing Trends]] |
| creatordb.app | Vendor blog (commercial bias) | Unchecked (proxy blocked); HTTPS 200 via Firecrawl | ⚠️ Use with caution | Creator-analytics data vendor; original "census" data, not independently audited. Verified via Firecrawl. | [[2026-11-06 Other Platforms Editing Trends]] |
| creatorflow.so | Vendor blog (commercial bias) | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | Creator-tool vendor blog. | [[2026-11-06 Instagram Reels Editing Trends]] |
| creators.instagram.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Instagram creators blog. | [[2026-11-06 Editing Tools and AI Features]] |
| creators.snapchat.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Snapchat creators blog. | [[2026-11-06 Other Platforms Editing Trends]] |
| descript.canny.io | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Descript's official public changelog, hosted on Canny (an established SaaS changelog platform). | [[2026-11-06 Editing Tools and AI Features]] |
| descript.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Descript site. | [[2026-11-06 Editing Tools and AI Features]] |
| dupple.com | Industry/agency blog | Unchecked (proxy blocked); HTTPS 200 via Firecrawl | ⚠️ Use with caution | Tech newsletter/"learn" explainer; secondary restatement of CapCut pricing. Verified via Firecrawl. | [[2026-11-06 Editing Tools and AI Features]] |
| editorskeys.com | Vendor blog (commercial bias) | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | Keyboard/accessory retailer's blog; DaVinci-vs-Premiere comparison is used only as an excerpt. | [[2026-11-06 YouTube Editing Trends]] |
| edits.instagram.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Meta Edits app site and blog. | [[2026-11-06 Editing Tools and AI Features]], [[2026-11-06 Instagram Reels Editing Trends]] |
| eklipse.gg | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Eklipse official product page (describing its own feature). Commercial. | [[2026-11-06 Other Platforms Editing Trends]] |
| elevenlabs.io | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official ElevenLabs site, blog and pricing. | [[2026-11-06 Editing Tools and AI Features]] |
| en.wikipedia.org | Established publication | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | Wikipedia; editable by anyone, so check its citations (TikTok USDS). | [[2026-11-06 Editing Tools and AI Features]] |
| engadget.com | Established publication | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Engadget tech news. | [[2026-11-06 Editing Tools and AI Features]] |
| exemplary.ai | Vendor blog (commercial bias) | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | AI-captions vendor blog (Hormozi captions); promotes its own tool. | [[2026-11-06 YouTube Editing Trends]] |
| facebook.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Facebook creators blog. | [[2026-11-06 Editing Tools and AI Features]] |
| fastcompany.com | Established publication | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Fast Company. | [[2026-11-06 Other Platforms Editing Trends]] |
| firefly.adobe.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Adobe Firefly app. | [[2026-11-06 Editing Tools and AI Features]] |
| forphotographersonly.com | Creator/UGC (Reddit, personal blog, social post) | Unchecked (proxy blocked); HTTPS 200 via Firecrawl | ⚠️ Use with caution | Small Wix photography blog; the note already marks it low confidence. Verified via Firecrawl. | [[2026-11-06 Instagram Reels Editing Trends]] |
| frameos.studio | Vendor blog (commercial bias) | Unchecked (proxy blocked); HTTPS 200 via Firecrawl | ⚠️ Use with caution | Vendor blog that summarizes SMT/TechCrunch; secondary. Verified via Firecrawl. | [[2026-11-06 Instagram Reels Editing Trends]] |
| gradezilla.org | Industry/agency blog | Unchecked (proxy blocked); HTTPS 200 via Firecrawl | ⚠️ Use with caution | Small digital-marketing academy (WordPress/WooCommerce course site); secondary how-to. Verified via Firecrawl. | [[2026-11-06 Instagram Reels Editing Trends]] |
| help.descript.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Descript help center. | [[2026-11-06 Editing Tools and AI Features]] |
| help.instagram.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Instagram Help Center. | [[2026-11-06 Instagram Reels Editing Trends]] |
| help.openai.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official OpenAI help center (Sora discontinuation). | [[2026-11-06 Editing Tools and AI Features]] |
| help.pinterest.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Pinterest Help (product specs). | [[2026-11-06 Other Platforms Editing Trends]] |
| help.twitch.tv | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Twitch Help. | [[2026-11-06 Other Platforms Editing Trends]] |
| helpx.adobe.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Adobe Help (release notes). | [[2026-11-06 Editing Tools and AI Features]] |
| hootsuite.com | Industry/agency blog | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Hootsuite Social Trends research report; established industry research (vendor-published). | [[2026-11-06 TikTok Editing Trends]] |
| instagram.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | Mixed. The /p/ and /reel/ posts are social posts (UGC, dates unverified). The /popular/ pages are auto-generated SEO aggregator pages (content-farm-like, low confidence) even though they sit on Instagram's domain. Don't treat them as official Instagram statements. Firecrawl can't scrape this site. | [[2026-11-06 Instagram Reels Editing Trends]], [[2026-11-06 Other Platforms Editing Trends]] |
| ir.kuaishou.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Kuaishou investor relations (Kling 3.0 release). | [[2026-11-06 Editing Tools and AI Features]] |
| klap.app | Vendor blog (commercial bias) | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | AI-clipping vendor blog. | [[2026-11-06 Instagram Reels Editing Trends]] |
| kling.ai | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Kling AI site. | [[2026-11-06 Editing Tools and AI Features]] |
| kylerholland.com | Creator/UGC (Reddit, personal blog, social post) | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | Filmmaker/creator personal blog (also sells presets); secondary. | [[2026-11-06 Editing Tools and AI Features]] |
| later.com | Industry/agency blog | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Later trends blog; established social-media-tool publisher with weekly trend reports. | [[2026-11-06 Instagram Reels Editing Trends]], [[2026-11-06 TikTok Editing Trends]] |
| lesliemlyon.com | Creator/UGC (Reddit, personal blog, social post) | Unchecked (proxy blocked); HTTPS 200 via Firecrawl | ⚠️ Use with caution | Personal creator blog. Page is set to robots noindex, and its Labs-toggle steps conflict with official Edits instructions (the note already flags the conflict). Verified via Firecrawl. | [[2026-11-06 Instagram Reels Editing Trends]] |
| linkedin.com | Creator/UGC (Reddit, personal blog, social post) | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | Individual LinkedIn posts (opinions/anecdotes); may require login to view. | [[2026-11-06 Other Platforms Editing Trends]] |
| livenowfox.com | Established publication | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | LiveNOW from FOX news. The outlet is reputable, but the article is likely stale (~2025 launch coverage), as the note says. | [[2026-11-06 TikTok Editing Trends]] |
| metricool.com | Vendor blog (commercial bias) | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | Social-analytics vendor press release on its own TikTok study. | [[2026-11-06 TikTok Editing Trends]] |
| mirage.app | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Mirage (Captions) site. | [[2026-11-06 Editing Tools and AI Features]] |
| nasdaq.com | Established publication | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Nasdaq-hosted press release (syndicated wire copy of a Kling release). | [[2026-11-06 Editing Tools and AI Features]] |
| netinfluencer.com | Established publication | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Net Influencer, creator-economy trade news. | [[2026-11-06 Instagram Reels Editing Trends]] |
| newengen.com | Industry/agency blog | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | New Engen, a performance-marketing agency; monthly trend reports. | [[2026-11-06 Instagram Reels Editing Trends]], [[2026-11-06 TikTok Editing Trends]] |
| news.linkedin.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official LinkedIn newsroom. | [[2026-11-06 Other Platforms Editing Trends]] |
| newsroom.pinterest.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Pinterest newsroom. | [[2026-11-06 Other Platforms Editing Trends]] |
| newsroom.snap.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Snap newsroom. | [[2026-11-06 Other Platforms Editing Trends]] |
| newsroom.tiktok.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official TikTok newsroom. | [[2026-11-06 Editing Tools and AI Features]], [[2026-11-06 TikTok Editing Trends]] |
| nofilmschool.com | Established publication | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | No Film School, filmmaking trade publication. | [[2026-11-06 Editing Tools and AI Features]] |
| northeasttimes.com | Established publication | Unchecked (proxy blocked); HTTPS 200 via Firecrawl | ✅ Trusted | Northeast Times, a Philadelphia local newspaper; tangential cultural piece. Verified via Firecrawl. | [[2026-11-06 Other Platforms Editing Trends]] |
| ocdevel.com | Creator/UGC (Reddit, personal blog, social post) | Unchecked (proxy blocked); HTTPS 200 via Firecrawl | ⚠️ Use with caution | Machine Learning Guide podcast (independent creator); secondary. Verified via Firecrawl. | [[2026-11-06 Editing Tools and AI Features]] |
| openai.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official OpenAI site. | [[2026-11-06 Editing Tools and AI Features]] |
| opus.pro | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | OpusClip official site. Its product changelog is first-party, but its "trend" blog posts are vendor marketing (commercial bias). | [[2026-11-06 Editing Tools and AI Features]], [[2026-11-06 Instagram Reels Editing Trends]], [[2026-11-06 Other Platforms Editing Trends]], [[2026-11-06 YouTube Editing Trends]] |
| opusclip.canny.io | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | OpusClip's official public changelog on Canny. | [[2026-11-06 Editing Tools and AI Features]] |
| papermag.com | Established publication | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | PAPER magazine. | [[2026-11-06 Other Platforms Editing Trends]] |
| pixflow.net | Vendor blog (commercial bias) | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | Stock-asset/plugin vendor blog. | [[2026-11-06 YouTube Editing Trends]] |
| provideocoalition.com | Established publication | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | ProVideo Coalition, a long-running pro video trade site. | [[2026-11-06 Editing Tools and AI Features]] |
| reap.video | Vendor blog (commercial bias) | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | Captions vendor "top 5" list, which ranks itself. | [[2026-11-06 TikTok Editing Trends]] |
| reddit.com | Creator/UGC (Reddit, personal blog, social post) | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | Reddit threads, seen only as snippets and not verified. | [[2026-11-06 Editing Tools and AI Features]], [[2026-11-06 TikTok Editing Trends]] |
| reframex.ai | Vendor blog (commercial bias) | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | Captions vendor how-to. | [[2026-11-06 TikTok Editing Trends]] |
| resources.rework.com | Vendor blog (commercial bias) | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | "Best AI tools" listicles from a SaaS vendor; SEO listicle format. | [[2026-11-06 Other Platforms Editing Trends]], [[2026-11-06 YouTube Editing Trends]] |
| runwayml.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Runway site, research pages and changelog. | [[2026-11-06 Editing Tools and AI Features]] |
| shortsync.app | Vendor blog (commercial bias) | Unchecked (proxy blocked); HTTPS 200 via Firecrawl | ⚠️ Use with caution | Cross-posting scheduler vendor guide. Verified via Firecrawl. | [[2026-11-06 Other Platforms Editing Trends]] |
| socialbee.com | Industry/agency blog | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | Social-scheduler vendor trends blog; commercial. | [[2026-11-06 TikTok Editing Trends]] |
| socialmediatoday.com | Established publication | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Social Media Today (Industry Dive trade publication). Most-cited source; reliable for feature news. | [[2026-11-06 Editing Tools and AI Features]], [[2026-11-06 Instagram Reels Editing Trends]], [[2026-11-06 Other Platforms Editing Trends]], [[2026-11-06 TikTok Editing Trends]], [[2026-11-06 YouTube Editing Trends]] |
| spilnoagency.com.ua | Industry/agency blog | Unchecked (proxy blocked); HTTPS 200 via Firecrawl | ⚠️ Use with caution | Ukrainian ad agency spec guide. Legitimate, but cross-check its specs against the official help pages (Snapchat, Pinterest). Verified via Firecrawl. | [[2026-11-06 Other Platforms Editing Trends]] |
| sproutsocial.com | Industry/agency blog | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Sprout Social, an established social-tool publisher; video specs guide. | [[2026-11-06 Other Platforms Editing Trends]] |
| storrito.com | Vendor blog (commercial bias) | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | Stories-scheduler vendor explainer. | [[2026-11-06 TikTok Editing Trends]] |
| streamgen.cc | Vendor blog (commercial bias) | Unchecked (proxy blocked); HTTPS 200 via Firecrawl | ⚠️ Use with caution | Clip-tool vendor blog. Verified via Firecrawl. | [[2026-11-06 Other Platforms Editing Trends]] |
| submagic.co | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Submagic site and pricing. | [[2026-11-06 Editing Tools and AI Features]] |
| support.apple.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official Apple Support. | [[2026-11-06 Editing Tools and AI Features]] |
| support.google.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official YouTube Help. The /thread/ link is a community forum thread (UGC; it was not opened). | [[2026-11-06 Editing Tools and AI Features]], [[2026-11-06 YouTube Editing Trends]] |
| support.tiktok.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Official TikTok Support. | [[2026-11-06 TikTok Editing Trends]] |
| techcrunch.com | Established publication | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | TechCrunch. | [[2026-11-06 Editing Tools and AI Features]], [[2026-11-06 Instagram Reels Editing Trends]], [[2026-11-06 Other Platforms Editing Trends]], [[2026-11-06 TikTok Editing Trends]] |
| threads.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | Post from the official @creators account on Threads, but the date wasn't visible (unverified). | [[2026-11-06 Instagram Reels Editing Trends]] |
| tiktok.com | Creator/UGC (Reddit, personal blog, social post) | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | Mixed: a creator video (UGC) and TikTok-hosted /discover and /q/ SEO summary pages, seen only as snippets. | [[2026-11-06 Other Platforms Editing Trends]], [[2026-11-06 TikTok Editing Trends]] |
| trymypost.com | Vendor blog (commercial bias) | Unchecked (proxy blocked); HTTPS 200 via Firecrawl | ⚠️ Use with caution | Scheduler vendor blog. Note: it discusses "Idea Pins", an outdated Pinterest format name. Verified via Firecrawl. | [[2026-11-06 Other Platforms Editing Trends]] |
| tubefilter.com | Established publication | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | Tubefilter, an online-video industry trade publication. | [[2026-11-06 Other Platforms Editing Trends]], [[2026-11-06 YouTube Editing Trends]] |
| visla.us | Vendor blog (commercial bias) | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | AI-video vendor blog. | [[2026-11-06 Other Platforms Editing Trends]] |
| washingtonpost.com | Established publication | Unchecked (proxy blocked); cited as https:// | ✅ Trusted | The Washington Post (2024 article; older, used for background only). | [[2026-11-06 YouTube Editing Trends]] |
| x.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | Official @XCreators article, seen only as a search excerpt; may require login. | [[2026-11-06 Other Platforms Editing Trends]] |
| youtube.com | Official platform/vendor | Unchecked (proxy blocked); cited as https:// | ⚠️ Use with caution | Mixed: the official YouTube Trends report (trusted) and a third-party creator tutorial video (UGC). | [[2026-11-06 Instagram Reels Editing Trends]], [[2026-11-06 YouTube Editing Trends]] |

## Removed / flagged sources

### ❌ Removed
**None.** No cited domain showed a security red flag:
- no URL shorteners
- no download, APK, mod or crack sites
- no typosquats
- no phishing or credential pages
- no plain-HTTP links

Because nothing was removed, none of the raw notes was edited.

### ⚠️ Flagged — highest priority for the wiki writer
These sources are legitimate and reachable, but don't use them as the **sole** support for a claim:

1. **instagram.com/popular/...** (3 pages, cited in [[2026-11-06 Instagram Reels Editing Trends]])
   - These are auto-generated SEO aggregator pages. They sit on Instagram's own domain but are **not** official Instagram statements. They are the most content-farm-like sources in the set.
   - The claims sourced to them should be cut, or backed by a primary source.
2. **lesliemlyon.com** ([[2026-11-06 Instagram Reels Editing Trends]])
   - A personal blog whose page is set to `noindex`. Its "Labs toggle" steps conflict with the official Edits blog. Prefer edits.instagram.com.
3. **clixie.ai** ([[2026-11-06 Editing Tools and AI Features]])
   - A vendor blog with CapCut ban and ownership claims. The note already marks it low confidence. Verify against newsroom.tiktok.com or TechCrunch.
4. **capcutguide.com** ([[2026-11-06 TikTok Editing Trends]])
   - An unofficial tutorial site that uses the CapCut brand name. It is safe (Ghost blog, no downloads) but not official. Cite capcut.com for feature names.
5. **reddit.com, tiktok.com creator video, linkedin.com/posts, x.com, instagram.com/p and /reel, threads.com**
   - These are UGC or social posts, mostly seen only as snippets, with unverified dates. LinkedIn and X may require login.
6. **livenowfox.com** ([[2026-11-06 TikTok Editing Trends]]): likely stale (~2025).
7. **trymypost.com** ([[2026-11-06 Other Platforms Editing Trends]]): uses "Idea Pins", an outdated Pinterest format name, so it may be outdated.
8. **spilnoagency.com.ua** ([[2026-11-06 Other Platforms Editing Trends]]): an agency spec sheet. Cross-check it against businesshelp.snapchat.com and help.pinterest.com.
9. **Vendor "best tools" / "trends" listicles** (commercial bias)
   - Sites: avs4you, bigvu (competitor review of OpusClip), choppity, exemplary.ai, reap.video (ranks itself), reframex, resources.rework.com, klap, creatorflow, frameos, blitzcut, shortsync, streamgen, storrito, visla, contentin, pixflow, air.io, editorskeys, metricool, creatordb, brandlens, opus.pro blog posts.
   - Fine for "what creators are being told". Use them for trend *claims* only alongside an official or press source.
10. **Secondary personal or small blogs:** blog.mean.ceo, forphotographersonly.com, kylerholland.com, ocdevel.com, gradezilla.org, dupple.com.
    - These are secondary restatements. Cite the primary source they reference where possible.
11. **en.wikipedia.org:** editable by anyone, so cite its underlying references.

### Limitation
The proxy blocked direct TLS/certificate verification for **all** domains. No certificate was positively validated by this check. The certificate status of the 95 domains that weren't checked through Firecrawl is unknown, not failed. Every one is a well-known official site or publication, or a commercial site, cited over https://. Re-run the curl check from an unrestricted network to confirm the certificates.
