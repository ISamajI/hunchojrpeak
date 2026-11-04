/* Sean's Landscaping, Inc. — site interactions (no dependencies) */
(function () {
  "use strict";

  var doc = document.documentElement;
  doc.classList.add("js");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ---------- Broken image fallback: keep the green gradient frame instead of a broken icon ---------- */
  function markBroken(img) { img.classList.add("is-broken"); img.setAttribute("aria-hidden", "true"); }
  $$("img").forEach(function (img) {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) markBroken(img);
    img.addEventListener("error", function () { markBroken(img); }, { once: true });
  });

  /* ---------- Footer year ---------- */
  $$("[data-year]").forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  /* ---------- Header: solid after scroll, hide on scroll down ---------- */
  var header = $(".site-header");
  var progress = $(".scroll-progress");
  var actionBar = $(".action-bar");
  var toTop = $(".to-top");
  var lastY = window.scrollY;
  var ticking = false;
  var headerAlwaysSolid = header && header.classList.contains("site-header--solid");

  function onScroll() {
    var y = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (header) {
      if (!headerAlwaysSolid) header.classList.toggle("is-solid", y > 40);
      var menuOpen = doc.classList.contains("menu-open");
      var hide = y > lastY && y > 400 && !menuOpen && !header.contains(document.activeElement);
      header.classList.toggle("is-hidden", hide);
    }
    if (progress) progress.style.transform = "scaleX(" + (max > 0 ? Math.min(y / max, 1) : 0) + ")";
    if (actionBar) actionBar.classList.toggle("is-visible", y > 500);
    if (toTop) toTop.classList.toggle("is-visible", y > 900);
    lastY = y;
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  if (toTop) toTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });

  /* ---------- Mobile menu ---------- */
  var toggle = $(".menu-toggle");
  var mobileMenu = $(".mobile-menu");
  function setMenu(open) {
    doc.classList.toggle("menu-open", open);
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
    if (mobileMenu) {
      if (open) mobileMenu.removeAttribute("inert"); else mobileMenu.setAttribute("inert", "");
      mobileMenu.setAttribute("aria-hidden", String(!open));
    }
    if (header && open) header.classList.remove("is-hidden");
  }
  if (toggle && mobileMenu) {
    setMenu(false);
    toggle.addEventListener("click", function () { setMenu(!doc.classList.contains("menu-open")); });
    $$("a", mobileMenu).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && doc.classList.contains("menu-open")) { setMenu(false); toggle.focus(); }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 1080 && doc.classList.contains("menu-open")) setMenu(false);
    });
  }

  /* ---------- Desktop dropdown (click + keyboard support; hover handled in CSS) ---------- */
  $$(".has-dropdown").forEach(function (item) {
    var btn = $(".nav-link", item);
    if (!btn || btn.tagName !== "BUTTON") return;
    btn.addEventListener("click", function () {
      var open = !item.classList.contains("is-open");
      item.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
    });
    item.addEventListener("focusout", function (e) {
      if (!item.contains(e.relatedTarget)) { item.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false"); }
    });
    item.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { item.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false"); btn.focus(); }
    });
  });
  document.addEventListener("click", function (e) {
    $$(".has-dropdown.is-open").forEach(function (item) {
      if (!item.contains(e.target)) {
        item.classList.remove("is-open");
        var b = $(".nav-link", item); if (b) b.setAttribute("aria-expanded", "false");
      }
    });
  });

  /* ---------- Reveal on scroll ---------- */
  var reveals = $$(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("is-in"); io.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0 });
    reveals.forEach(function (el) { io.observe(el); });
    // Safety net: a fast flick or anchor jump can skip an element between frames, so once
    // scrolling settles, reveal anything that is in view or already scrolled past.
    var settle;
    window.addEventListener("scroll", function () {
      clearTimeout(settle);
      settle = setTimeout(function () {
        reveals.forEach(function (el) {
          if (!el.classList.contains("is-in") && el.getBoundingClientRect().top < window.innerHeight) {
            el.classList.add("is-in");
            io.unobserve(el);
          }
        });
      }, 150);
    }, { passive: true });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- Count-up stats ---------- */
  var counters = $$("[data-count]");
  function runCount(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var suffix = el.getAttribute("data-suffix") || "";
    if (reduceMotion || isNaN(target)) { el.textContent = target + suffix; return; }
    var start = null, dur = 1600;
    function frame(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }
  if (counters.length && "IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { runCount(entry.target); cio.unobserve(entry.target); }
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  /* ---------- Hero slideshow ---------- */
  var slides = $$(".hero-slide");
  var caption = $("[data-hero-caption]");
  if (slides.length > 1 && !reduceMotion) {
    var idx = 0;
    setInterval(function () {
      if (document.hidden) return;
      slides[idx].classList.remove("is-active");
      idx = (idx + 1) % slides.length;
      slides[idx].classList.add("is-active");
      var img = $("img", slides[idx]);
      if (img) { img.style.animation = "none"; void img.offsetWidth; img.style.animation = ""; }
      if (caption) caption.textContent = slides[idx].getAttribute("data-caption") || "";
    }, 6500);
  }

  /* ---------- Project filters ---------- */
  var filterWrap = $("[data-filters]");
  if (filterWrap) {
    var cards = $$("[data-category]");
    var empty = $(".empty-state");
    var buttons = $$(".filter-btn", filterWrap);
    buttons.forEach(function (btn) {
      var f = btn.getAttribute("data-filter");
      var count = f === "all" ? cards.length : cards.filter(function (c) {
        return (" " + c.getAttribute("data-category") + " ").indexOf(" " + f + " ") > -1;
      }).length;
      var span = document.createElement("span");
      span.className = "filter-count";
      span.textContent = String(count);
      btn.appendChild(span);
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
        var shown = 0;
        cards.forEach(function (card) {
          var match = f === "all" || (" " + card.getAttribute("data-category") + " ").indexOf(" " + f + " ") > -1;
          card.classList.toggle("is-filtered-out", !match);
          if (match) { shown++; card.classList.add("is-in"); }
        });
        if (empty) empty.classList.toggle("is-visible", shown === 0);
        var live = $("[data-filter-status]");
        if (live) live.textContent = shown + " project" + (shown === 1 ? "" : "s") + " shown";
      });
    });
  }

  /* ---------- Lightbox (video + image) ---------- */
  var lb = $("#lightbox");
  var lbStage = lb ? $(".lightbox-stage", lb) : null;
  var lbTitle = lb ? $(".lightbox-title", lb) : null;
  var lastTrigger = null;

  function embedFor(url) {
    var m;
    if ((m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/))) {
      return { type: "iframe", src: "https://www.youtube-nocookie.com/embed/" + m[1] + "?autoplay=1&rel=0" };
    }
    if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/))) {
      return { type: "iframe", src: "https://player.vimeo.com/video/" + m[1] + "?autoplay=1" };
    }
    if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return { type: "video", src: url };
    if (/\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url)) return { type: "image", src: url };
    return { type: "link", src: url };
  }

  function closeLightbox() {
    if (!lb) return;
    if (typeof lb.close === "function" && lb.open) lb.close(); else lb.removeAttribute("open");
  }

  function openLightbox(url, title, sub) {
    if (!lb || !lbStage) { window.open(url, "_blank", "noopener"); return; }
    var e = embedFor(url);
    lbStage.innerHTML = "";
    var node;
    if (e.type === "iframe") {
      node = document.createElement("iframe");
      node.src = e.src;
      node.title = title || "Project video";
      node.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
      node.allowFullscreen = true;
    } else if (e.type === "video") {
      node = document.createElement("video");
      node.src = e.src;
      node.controls = true;
      node.autoplay = true;
      node.playsInline = true;
      node.setAttribute("aria-label", title || "Project video");
    } else if (e.type === "image") {
      node = document.createElement("img");
      node.src = e.src;
      node.alt = title || "";
    } else {
      node = document.createElement("div");
      node.className = "lightbox-fallback";
      var a = document.createElement("a");
      a.href = e.src; a.target = "_blank"; a.rel = "noopener"; a.className = "btn btn--accent";
      a.textContent = "Open project video";
      node.appendChild(a);
    }
    lbStage.appendChild(node);
    if (lbTitle) {
      lbTitle.textContent = title || "";
      if (sub) { var s = document.createElement("small"); s.textContent = sub; lbTitle.insertBefore(s, lbTitle.firstChild); }
    }
    if (typeof lb.showModal === "function") lb.showModal(); else lb.setAttribute("open", "");
  }

  if (lb) {
    lb.addEventListener("close", function () {
      if (lbStage) lbStage.innerHTML = "";
      if (lastTrigger) lastTrigger.focus();
    });
    lb.addEventListener("click", function (e) { if (e.target === lb) closeLightbox(); });
    var closeBtn = $(".lightbox-close", lb);
    if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-media]") : null;
    if (!t) return;
    e.preventDefault();
    lastTrigger = t;
    openLightbox(t.getAttribute("data-media"), t.getAttribute("data-title"), t.getAttribute("data-sub"));
  });

  /* ---------- Service page scroll-spy ---------- */
  var spyLinks = $$(".service-nav a");
  if (spyLinks.length && "IntersectionObserver" in window) {
    var map = {};
    spyLinks.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var link = map[entry.target.id];
        if (!link) return;
        spyLinks.forEach(function (l) { l.classList.remove("is-active"); l.removeAttribute("aria-current"); });
        link.classList.add("is-active");
        link.setAttribute("aria-current", "true");
        var nav = link.parentElement && link.parentElement.parentElement;
        if (nav && nav.scrollTo) {
          nav.scrollTo({ left: link.offsetLeft - nav.clientWidth / 2 + link.clientWidth / 2, behavior: reduceMotion ? "auto" : "smooth" });
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) sio.observe(s); });
  }

  /* ---------- Contact form: validate, then hand off to the visitor's email app ---------- */
  var form = $("#quote-form");
  if (form) {
    var status = $(".form-status", form);
    // Pre-select a scope when arriving from a service page link (contact.html?service=green-roofs)
    var pre = new URLSearchParams(window.location.search).get("service");
    if (pre) {
      var box = form.querySelector("input[data-service='" + pre.replace(/[^a-z-]/g, "") + "']");
      if (box) box.checked = true;
    }
    var rules = {
      name: function (v) { return v.trim().length >= 2 || "Please enter your name."; },
      email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || "Please enter a valid email address."; },
      phone: function (v) { return v.trim() === "" || v.replace(/\D/g, "").length >= 10 || "Please enter a 10-digit phone number, or leave it blank."; },
      message: function (v) { return v.trim().length >= 10 || "Tell us a little about the project (10+ characters)."; }
    };
    function validateField(input) {
      var rule = rules[input.name];
      if (!rule) return true;
      var res = rule(input.value);
      var field = input.closest(".field");
      var err = field ? $(".error", field) : null;
      var ok = res === true;
      if (field) field.classList.toggle("has-error", !ok);
      input.setAttribute("aria-invalid", String(!ok));
      if (err) err.textContent = ok ? "" : res;
      return ok;
    }
    Object.keys(rules).forEach(function (name) {
      var input = form.elements[name];
      if (!input) return;
      input.addEventListener("blur", function () { if (input.value) validateField(input); });
      input.addEventListener("input", function () {
        var f = input.closest(".field");
        if (f && f.classList.contains("has-error")) validateField(input);
      });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.elements.company_site && form.elements.company_site.value) return; // honeypot
      var firstBad = null;
      Object.keys(rules).forEach(function (name) {
        var input = form.elements[name];
        if (input && !validateField(input) && !firstBad) firstBad = input;
      });
      if (firstBad) { firstBad.focus(); return; }

      var services = $$("input[name='services']:checked", form).map(function (i) { return i.value; });
      var get = function (n) { return form.elements[n] ? form.elements[n].value.trim() : ""; };
      var lines = [
        "Name: " + get("name"),
        get("company") ? "Company: " + get("company") : null,
        "Email: " + get("email"),
        get("phone") ? "Phone: " + get("phone") : null,
        get("location") ? "Project location: " + get("location") : null,
        get("type") ? "Project type: " + get("type") : null,
        services.length ? "Scope: " + services.join(", ") : null,
        get("timeline") ? "Timeline: " + get("timeline") : null,
        "",
        get("message")
      ].filter(function (l) { return l !== null; });
      var to = form.getAttribute("data-mailto");
      var subject = "Project inquiry — " + (get("company") || get("name"));
      var href = "mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n"));
      if (status) {
        status.textContent = "Thanks, " + get("name").split(" ")[0] + "! Your email app should open with your message ready to send. If it doesn't, email us at " + to + ".";
        status.classList.add("is-visible");
      }
      window.location.href = href;
    });
  }
})();
