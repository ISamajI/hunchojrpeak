/* LTGPeak demo kit — motion & interaction. Requires gsap + ScrollTrigger (bundled locally).
   Everything degrades gracefully: without JS/GSAP or with reduced motion, content is fully visible. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  if (hasGsap && !reduce) root.classList.add('motion');
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- concept bar offset ---------- */
  var bar = $('.concept-bar');
  function setBar() { root.style.setProperty('--bar-h', (bar ? bar.offsetHeight : 0) + 'px'); }
  setBar(); window.addEventListener('resize', setBar);

  /* ---------- navigation ---------- */
  var nav = $('.nav');
  var lastY = 0;
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    if (nav) {
      nav.classList.toggle('scrolled', y > 40);
      nav.classList.toggle('hide', y > 400 && y > lastY && !document.body.classList.contains('menu-open'));
    }
    lastY = y;
  }, { passive: true });
  var toggle = $('.menu-toggle');
  var menu = $('.mobile-menu');
  function closeMenu() { document.body.classList.remove('menu-open'); if (toggle) toggle.setAttribute('aria-expanded', 'false'); if (menu) menu.setAttribute('aria-hidden', 'true'); }
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = !document.body.classList.contains('menu-open');
      document.body.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-hidden', String(!open));
      if (open) { var first = $('a', menu); if (first) setTimeout(function () { first.focus(); }, 300); }
    });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', closeMenu); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }

  /* ---------- split headlines into lines/words (for reveal) ---------- */
  $$('[data-split]').forEach(function (el) {
    var html = [];
    el.childNodes.forEach(function (n) {
      if (n.nodeType === 3) n.textContent.split(/(\s+)/).forEach(function (w) { if (w.trim()) html.push(wrap(document.createTextNode(w))); else if (w) html.push(document.createTextNode(' ')); });
      else if (n.nodeName === 'BR') html.push(document.createElement('br'));
      else html.push(wrap(n.cloneNode(true)));
    });
    function wrap(node) { var l = document.createElement('span'); l.className = 'line'; l.style.display = 'inline-block'; var s = document.createElement('span'); s.appendChild(node); l.appendChild(s); return l; }
    el.textContent = '';
    html.forEach(function (n) { el.appendChild(n); });
    el.classList.add('split');
  });
  /* scroll-filled statement: wrap words */
  $$('.statement').forEach(function (el) {
    var words = el.textContent.split(/\s+/).filter(Boolean);
    el.textContent = '';
    words.forEach(function (w, i) { var s = document.createElement('span'); s.className = 'w'; s.textContent = w; el.appendChild(s); if (i < words.length - 1) el.appendChild(document.createTextNode(' ')); });
  });

  /* ---------- booking form → real message to the business ---------- */
  $$('form.book').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = $('.form-status', form);
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var d = new FormData(form);
      var lines = ['Hi ' + form.dataset.business + ', I\'d like to book:', 'Service: ' + (d.get('service') || '—'), 'Preferred: ' + [d.get('date'), d.get('time')].filter(Boolean).join(' ') , 'Name: ' + d.get('name'), d.get('contact') ? 'Contact: ' + d.get('contact') : '', d.get('note') ? 'Note: ' + d.get('note') : ''].filter(Boolean);
      var body = lines.join('\n');
      var phone = form.dataset.sms, email = form.dataset.email;
      var href = phone ? 'sms:' + phone + (/iPhone|iPad|Mac/.test(navigator.userAgent) ? '&' : '?') + 'body=' + encodeURIComponent(body)
        : 'mailto:' + email + '?subject=' + encodeURIComponent('Booking request — ' + (d.get('service') || '')) + '&body=' + encodeURIComponent(body);
      if (status) status.textContent = phone ? 'Opening your messages app with the request ready to send…' : 'Opening your email app with the request ready to send…';
      window.location.href = href;
    });
  });

  /* ---------- lightbox ---------- */
  $$('[data-lightbox]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var img = $('img', btn); if (!img) return;
      var prev = document.activeElement;
      var box = document.createElement('div'); box.className = 'lightbox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', img.alt || 'Photo');
      var big = document.createElement('img'); big.src = img.currentSrc || img.src; big.alt = img.alt;
      var close = document.createElement('button'); close.type = 'button'; close.setAttribute('aria-label', 'Close'); close.textContent = '×';
      function shut() { box.remove(); document.removeEventListener('keydown', key); if (prev) prev.focus(); }
      function key(e) { if (e.key === 'Escape') shut(); }
      close.addEventListener('click', shut); box.addEventListener('click', function (e) { if (e.target === box) shut(); });
      document.addEventListener('keydown', key);
      box.appendChild(big); box.appendChild(close); document.body.appendChild(box); close.focus();
    });
  });

  /* ---------- services index hover preview ---------- */
  var preview = $('.svc-preview');
  if (preview && fine) {
    var px = 0, py = 0, cx = 0, cy = 0, shown = false;
    $$('.svc-row').forEach(function (row, i) {
      row.addEventListener('mouseenter', function () {
        shown = true; preview.style.opacity = 1; preview.style.transform = 'translate(-50%,-50%) scale(1)';
        $$('.svc-preview > *').forEach(function (m, j) { m.classList.toggle('on', j === i); });
      });
      row.addEventListener('mouseleave', function () { shown = false; preview.style.opacity = 0; preview.style.transform = 'translate(-50%,-50%) scale(.8)'; });
    });
    window.addEventListener('mousemove', function (e) { px = e.clientX; py = e.clientY; }, { passive: true });
    (function loop() { cx += (px - cx) * 0.14; cy += (py - cy) * 0.14; preview.style.left = cx + 'px'; preview.style.top = cy + 'px'; preview.style.transition = 'opacity .35s, transform .5s cubic-bezier(.2,.7,.2,1)'; requestAnimationFrame(loop); })();
  }

  /* ---------- cursor ---------- */
  var cursor = $('.cursor');
  if (cursor && fine && !reduce) {
    var mx = 0, my = 0, ux = 0, uy = 0;
    window.addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; cursor.style.opacity = 1; }, { passive: true });
    $$('a, button, summary, [data-lightbox]').forEach(function (el) { el.addEventListener('mouseenter', function () { cursor.classList.add('big'); }); el.addEventListener('mouseleave', function () { cursor.classList.remove('big'); }); });
    (function loop() { ux += (mx - ux) * 0.2; uy += (my - uy) * 0.2; cursor.style.left = ux + 'px'; cursor.style.top = uy + 'px'; requestAnimationFrame(loop); })();
  }

  /* ---------- hours: highlight today ---------- */
  var dn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
  $$('.hours tr').forEach(function (tr) {
    var t = tr.getAttribute('data-days') || '';
    var order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var parts = t.split('–'); var a = order.indexOf(parts[0]), b = order.indexOf(parts[1] || parts[0]), d = order.indexOf(dn);
    if (a > -1 && d >= a && d <= b) tr.classList.add('today');
  });

  /* ---------- WebGL hero light field ---------- */
  $$('canvas[data-shader]').forEach(function (canvas) {
    var gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
    if (!gl) { canvas.style.background = getComputedStyle(root).getPropertyValue('--shader-fallback'); return; }
    var hex = function (h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16) / 255; }); };
    var kind = { silk: 0, ember: 1, grid: 2, grain: 3 }[canvas.dataset.shader] || 0;
    var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    var fs = [
      'precision mediump float;uniform vec2 r;uniform float t;uniform vec2 m;uniform vec3 a;uniform vec3 b;uniform vec3 c;uniform int k;',
      'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
      'float fbm(vec2 p){float v=0.,s=.5;for(int i=0;i<5;i++){v+=s*n(p);p=p*2.02+vec2(1.7,9.2);s*=.5;}return v;}',
      'void main(){vec2 uv=gl_FragCoord.xy/r;vec2 q=uv*vec2(r.x/r.y,1.);vec3 col;',
      'if(k==0){float f=fbm(q*1.6+vec2(t*.6,t*.25)+fbm(q*2.+t*.3)*1.4+m*.25);float band=smoothstep(.35,.85,f);col=mix(c,b,smoothstep(.1,.7,f));col=mix(col,a,pow(band,2.2)*.85);col+=a*.08*pow(1.-length(uv-vec2(.75+m.x*.1,.6)),3.);}',
      'else if(k==1){vec2 p=q*vec2(2.2,1.4)+vec2(0.,-t*1.2);float f=fbm(p+fbm(p*1.3)*1.2);float heat=pow(1.-uv.y,1.4)*f;col=mix(c,b,smoothstep(.15,.6,heat*1.4));col=mix(col,a,smoothstep(.45,.9,heat*1.6));vec2 cell=q*vec2(36.,24.)+vec2(0.,t*9.);vec2 id=floor(cell);vec2 fc=fract(cell)-.5;float on=step(.985,h(id));float sp=on*smoothstep(.12,0.,length(fc+vec2(h(id+3.)-.5,h(id+7.)-.5)*.5))*(1.-uv.y)*(.5+.5*sin(t*6.+h(id)*30.));col+=a*sp*.9;}',
      'else if(k==2){vec2 g=vec2(q.x-.9-m.x*.05,(1.-uv.y)*1.);float z=1./max(g.y,.08);vec2 w=vec2(g.x*z,z+t*3.);vec2 l=abs(fract(w*.5)-.5)/fwidthp(w);float line=1.-min(min(l.x,l.y),1.);line*=smoothstep(.02,.5,g.y)*(1.-smoothstep(.55,1.,g.y));col=mix(c,b,smoothstep(1.,0.,uv.y)*.55);col=mix(col,a,line*.65);float scan=smoothstep(.0,.02,abs(fract(uv.y*.5-t*.15)-.5)-.48);col+=a*.25*(1.-scan)*uv.y;}',
      'else{float g=h(q*r.y+t*60.);float f=fbm(q*1.2+t*.4);col=mix(c,b,f*.7);col=mix(col,a,pow(smoothstep(.55,1.,fbm(q*2.5-t*.5)),2.)*.6);col+=(g-.5)*.08;}',
      'float v=1.-smoothstep(.35,1.25,length(uv-.5)*1.25);col*=mix(.55,1.,v);gl_FragColor=vec4(col,1.);}',
    ].join('\n').replace('fwidthp(w)', 'vec2(.06)');
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { canvas.style.background = getComputedStyle(root).getPropertyValue('--shader-fallback'); return; }
    gl.useProgram(pr);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = function (n) { return gl.getUniformLocation(pr, n); };
    gl.uniform3fv(U('a'), hex(canvas.dataset.a)); gl.uniform3fv(U('b'), hex(canvas.dataset.b)); gl.uniform3fv(U('c'), hex(canvas.dataset.c)); gl.uniform1i(U('k'), kind);
    var speed = parseFloat(canvas.dataset.speed || '0.1'), mouse = [0, 0], target = [0, 0], visible = true, start = performance.now();
    function size() { var dpr = Math.min(window.devicePixelRatio || 1, 1.5); var w = canvas.clientWidth * dpr, hgt = canvas.clientHeight * dpr; if (canvas.width !== w || canvas.height !== hgt) { canvas.width = w; canvas.height = hgt; gl.viewport(0, 0, w, hgt); } gl.uniform2f(U('r'), w, hgt); }
    function frame(now) {
      size();
      mouse[0] += (target[0] - mouse[0]) * 0.04; mouse[1] += (target[1] - mouse[1]) * 0.04;
      gl.uniform1f(U('t'), reduce ? 4.0 : ((now - start) / 1000) * speed); gl.uniform2f(U('m'), mouse[0], mouse[1]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!reduce && visible) requestAnimationFrame(frame);
    }
    if (fine) window.addEventListener('mousemove', function (e) { target = [e.clientX / innerWidth - 0.5, 0.5 - e.clientY / innerHeight]; }, { passive: true });
    new IntersectionObserver(function (es) { var was = visible; visible = es[0].isIntersecting; if (visible && !was && !reduce) requestAnimationFrame(frame); }).observe(canvas);
    requestAnimationFrame(frame);
  });

  if (!hasGsap || reduce) return;

  /* ================= GSAP choreography ================= */
  var gsap = window.gsap, ST = window.ScrollTrigger;
  gsap.registerPlugin(ST);
  var ease = 'expo.out';

  // Intro: curtain lifts, hero headline rises line by line, media settles.
  var tl = gsap.timeline({ defaults: { ease: ease } });
  tl.to('.curtain', { yPercent: -100, duration: 0.85, ease: 'expo.inOut' })
    .from('.hero-media img, .hero-media canvas, .frame img, .frame canvas', { scale: 1.18, duration: 2.2 }, '<0.1')
    .to('.hero [data-split] .line > span', { y: 0, duration: 1.1, stagger: 0.07 }, '<0.25')
    .to('.hero [data-reveal]', { opacity: 1, y: 0, duration: 0.9, stagger: 0.07 }, '<0.2')
    .from('.nav-inner', { opacity: 0, duration: 0.8 }, '<');

  // Section headlines
  $$('[data-split]').filter(function (el) { return !el.closest('.hero'); }).forEach(function (el) {
    gsap.to($$('.line > span', el), { y: 0, duration: 1.2, ease: ease, stagger: 0.07, scrollTrigger: { trigger: el, start: 'top 85%' } });
  });
  $$('[data-reveal]').filter(function (el) { return !el.closest('.hero'); }).forEach(function (el) {
    gsap.to(el, { opacity: 1, y: 0, duration: 1.1, ease: ease, scrollTrigger: { trigger: el, start: 'top 88%' } });
  });
  $$('[data-clip]').forEach(function (el) {
    gsap.to(el, { clipPath: 'inset(0% 0 0 0)', duration: 1.4, ease: 'expo.inOut', scrollTrigger: { trigger: el, start: 'top 80%' } });
  });
  $$('[data-parallax]').forEach(function (el) {
    gsap.to(el, { yPercent: parseFloat(el.dataset.parallax) * -100, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // Statement: words fill in as you read.
  $$('.statement').forEach(function (el) {
    gsap.to($$('.w', el), { color: getComputedStyle(root).getPropertyValue('--ink'), stagger: 0.05, ease: 'none', scrollTrigger: { trigger: el, start: 'top 75%', end: 'bottom 45%', scrub: true } });
  });

  // Marquees drift with scroll velocity.
  $$('.marquee .row').forEach(function (row, i) {
    var dir = i % 2 ? 1 : -1;
    var tween = gsap.to(row, { xPercent: dir * -50, ease: 'none', duration: 28 + i * 6, repeat: -1 });
    if (dir === 1) gsap.set(row, { xPercent: -50 });
    ST.create({ onUpdate: function (s) { tween.timeScale(1 + Math.min(4, Math.abs(s.getVelocity()) / 600)); gsap.to(tween, { timeScale: 1, duration: 0.8, overwrite: true, delay: 0.1 }); } });
  });

  // Counters
  $$('[data-count]').forEach(function (el) {
    var end = parseFloat(el.dataset.count), dec = (el.dataset.count.split('.')[1] || '').length, obj = { v: 0 };
    gsap.to(obj, { v: end, duration: 2, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%' }, onUpdate: function () { el.textContent = obj.v.toFixed(dec); } });
  });

  // Sticky storytelling: active visual follows the step in view.
  var visuals = $$('.steps-visual > *');
  $$('.step').forEach(function (step, i) {
    ST.create({ trigger: step, start: 'top 55%', end: 'bottom 55%', onToggle: function (s) { if (s.isActive) visuals.forEach(function (v, j) { v.classList.toggle('on', j === i); }); } });
  });

  // Gallery: pinned horizontal travel on desktop.
  var pin = $('.pin-gallery');
  if (pin && window.innerWidth >= 1024) {
    var track = $('.gallery-track', pin);
    gsap.to(track, { x: function () { return -(track.scrollWidth - pin.clientWidth); }, ease: 'none', scrollTrigger: { trigger: pin, start: 'top top', end: function () { return '+=' + (track.scrollWidth - pin.clientWidth); }, pin: true, scrub: 1, invalidateOnRefresh: true } });
  } else if (pin) root.classList.remove('motion-gallery');

  // Magnetic buttons
  if (fine) $$('[data-magnetic]').forEach(function (btn) {
    var qx = gsap.quickTo(btn, 'x', { duration: 0.6, ease: 'elastic.out(1,0.4)' }), qy = gsap.quickTo(btn, 'y', { duration: 0.6, ease: 'elastic.out(1,0.4)' });
    btn.addEventListener('mousemove', function (e) { var r = btn.getBoundingClientRect(); qx((e.clientX - r.left - r.width / 2) * 0.35); qy((e.clientY - r.top - r.height / 2) * 0.35); });
    btn.addEventListener('mouseleave', function () { qx(0); qy(0); });
  });

  window.addEventListener('load', function () { ST.refresh(); });
})();
