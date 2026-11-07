// Procedural textures drawn on canvases, so the app ships no image files.
// Each maker returns { map, normalMap?, roughnessMap? } of THREE.CanvasTexture.
import { CanvasTexture, RepeatWrapping, ClampToEdgeWrapping, SRGBColorSpace, NoColorSpace, LinearMipmapLinearFilter } from 'three';

const cache = new Map();

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// Tileable value noise on an integer lattice of `period` cells.
export function makeNoise(period, seed) {
  const r = rng(seed);
  const grid = new Float32Array(period * period).map(() => r());
  const at = (x, y) => grid[((y % period + period) % period) * period + ((x % period + period) % period)];
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

// Fractal noise in [0,1], tileable over a canvas of `size` px.
export function fbmField(size, { octaves = 5, base = 4, seed = 7 } = {}) {
  const layers = Array.from({ length: octaves }, (_, i) => ({ n: makeNoise(base << i, seed + i * 31), f: (base << i) / size, a: 0.5 ** i }));
  const norm = layers.reduce((s, l) => s + l.a, 0);
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (const l of layers) v += l.n(x * l.f, y * l.f) * l.a;
      out[y * size + x] = v / norm;
    }
  }
  return out;
}

export function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function tex(c, { srgb = true, repeat = 1 } = {}) {
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  t.minFilter = LinearMipmapLinearFilter;
  t.anisotropy = 8;
  t.repeat.set(repeat, repeat);
  return t;
}

// Sobel normal map from a height canvas (red channel), wraps at edges.
export function normalFromHeight(hc, strength = 2) {
  const size = hc.width;
  const src = hc.getContext('2d').getImageData(0, 0, size, size).data;
  const h = (x, y) => src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y - 1) + 2 * h(x + 1, y) + h(x + 1, y + 1)) - (h(x - 1, y - 1) + 2 * h(x - 1, y) + h(x - 1, y + 1));
      const dy = (h(x - 1, y + 1) + 2 * h(x, y + 1) + h(x + 1, y + 1)) - (h(x - 1, y - 1) + 2 * h(x, y - 1) + h(x + 1, y - 1));
      let nx = -dx * strength, ny = dy * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      img.data[i] = (nx / l * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function fieldToCanvas(field, size, map) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < field.length; i++) {
    const [r, g, b] = map(field[i], i % size, (i / size) | 0);
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function memo(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

// Light stucco: near-white so material.color carries the paint. Two noise
// scales (trowel blotches + fine grain) and a matching roughness map.
export const stucco = () => memo('stucco', () => {
  const size = 256;
  const f = fbmField(size, { octaves: 6, base: 8, seed: 11 });
  const b = fbmField(size, { octaves: 3, base: 2, seed: 12 });
  const col = fieldToCanvas(f, size, (v, x, y) => { const k = b[y * size + x]; const g = 234 + v * 14 + (k - 0.5) * 8; return [g, g - 1, g - 3]; });
  const hc = fieldToCanvas(f, size, (v) => [v * 255, 0, 0]);
  const rough = fieldToCanvas(f, size, (v) => { const g = 200 + v * 55; return [g, g, g]; });
  return { map: tex(col), normalMap: tex(normalFromHeight(hc, 1.2), { srgb: false }), roughnessMap: tex(rough, { srgb: false }) };
});

export const concrete = () => memo('concrete', () => {
  const size = 256;
  const f = fbmField(size, { octaves: 6, base: 6, seed: 23 });
  const r = rng(5);
  const col = fieldToCanvas(f, size, (v) => { const g = 180 + v * 60 + (r() - 0.5) * 10; return [g, g - 2, g - 6]; });
  const hc = fieldToCanvas(f, size, (v) => [v * 255, 0, 0]);
  return { map: tex(col), normalMap: tex(normalFromHeight(hc, 0.8), { srgb: false }) };
});

// Flat roof: smooth waterproofed slab (elastomeric coat), barely-there variation and a soft normal.
export const roofSlab = () => memo('roofSlab', () => {
  const size = 256;
  const f = fbmField(size, { octaves: 4, base: 4, seed: 61 });
  const col = fieldToCanvas(f, size, (v) => { const g = 226 + v * 14; return [g, g - 1, g - 3]; });
  const hc = fieldToCanvas(fbmField(size, { octaves: 3, base: 16, seed: 3 }), size, (v) => [v * 255, 0, 0]);
  return { map: tex(col), normalMap: tex(normalFromHeight(hc, 0.25), { srgb: false }) };
});

// Concrete block, 40 x 20 cm units; canvas = 1.6 x 1.6 m.
export const block = () => memo('block', () => {
  const size = 512, rows = 8, cols = 4;
  const c = canvas(size), ctx = c.getContext('2d');
  const hcv = canvas(size), hx = hcv.getContext('2d');
  const f = fbmField(size, { octaves: 5, base: 16, seed: 3 });
  const base = fieldToCanvas(f, size, (v) => { const g = 225 + v * 30; return [g, g, g]; });
  ctx.drawImage(base, 0, 0);
  hx.fillStyle = '#c8c8c8'; hx.fillRect(0, 0, size, size);
  const bh = size / rows, bw = size / cols;
  ctx.strokeStyle = 'rgba(80,80,80,0.55)'; ctx.lineWidth = 5;
  hx.strokeStyle = '#000'; hx.lineWidth = 6;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? bw / 2 : 0;
    for (const g of [ctx, hx]) {
      g.beginPath(); g.moveTo(0, r * bh); g.lineTo(size, r * bh); g.stroke();
      for (let k = -1; k <= cols; k++) { g.beginPath(); g.moveTo(k * bw + off, r * bh); g.lineTo(k * bw + off, (r + 1) * bh); g.stroke(); }
    }
  }
  return { map: tex(c), normalMap: tex(normalFromHeight(hcv, 3), { srgb: false }) };
});

// Natural stone cladding (keeps its own colors). Canvas = 1.2 m.
export const stone = () => memo('stone', () => {
  const size = 512;
  const c = canvas(size), ctx = c.getContext('2d');
  const hcv = canvas(size), hx = hcv.getContext('2d');
  const r = rng(42);
  ctx.fillStyle = '#6d655b'; ctx.fillRect(0, 0, size, size);
  hx.fillStyle = '#000'; hx.fillRect(0, 0, size, size);
  const tones = ['#b9a88f', '#a39580', '#c9bba3', '#8f8576', '#d2c3a8', '#9c8b72', '#b5a48a'];
  let y = 0;
  while (y < size) {
    const h = 34 + r() * 30;
    let x = -r() * 40;
    while (x < size) {
      const w = 50 + r() * 70;
      const pad = 3;
      for (const dx of [0, size, -size]) {
        for (const [g, fill] of [[ctx, tones[(r() * tones.length) | 0]], [hx, `rgb(${170 + r() * 80},0,0)`]]) {
          g.fillStyle = fill;
          g.beginPath();
          g.roundRect(x + dx + pad, y + pad, w - pad * 2, Math.min(h, size - y) - pad * 2, 9);
          g.fill();
        }
      }
      x += w;
    }
    y += h;
  }
  // Grain on top of each stone.
  const f = fbmField(size, { octaves: 4, base: 16, seed: 9 });
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < f.length; i++) { const k = 0.82 + f[i] * 0.3; for (let ch = 0; ch < 3; ch++) img.data[i * 4 + ch] *= k; }
  ctx.putImageData(img, 0, 0);
  return { map: tex(c), normalMap: tex(normalFromHeight(hcv, 4), { srgb: false }) };
});

// Barrel clay roof tiles (grayscale, tinted by roof color). Canvas = 1.2 m.
export const roofTile = () => memo('roofTile', () => {
  const size = 512, cols = 6, rows = 4;
  const c = canvas(size), ctx = c.getContext('2d');
  const hcv = canvas(size), hx = hcv.getContext('2d');
  const r = rng(77);
  const cw = size / cols, rh = size / rows;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = col * cw, y0 = row * rh;
      const shade = 0.82 + r() * 0.28;
      // Per-tile hue drift: some tiles a bit redder, some browner, some paler.
      const tr = 1 + (r() - 0.5) * 0.16, tg = 1 + (r() - 0.5) * 0.12, tb = 1 + (r() - 0.5) * 0.18;
      for (let px = 0; px < cw; px++) {
        const t = px / cw;
        const curve = Math.sin(t * Math.PI);             // barrel profile
        const lit = 0.55 + 0.45 * Math.sin(t * Math.PI * 0.95 + 0.3);
        const g = Math.min(255, 255 * lit * shade);
        const grad = ctx.createLinearGradient(0, y0, 0, y0 + rh);
        const rgb = (k) => `rgb(${Math.min(255, g * k * tr)},${Math.min(255, g * k * tg)},${Math.min(255, g * k * tb)})`;
        grad.addColorStop(0, rgb(0.7));
        grad.addColorStop(0.15, rgb(1));
        grad.addColorStop(1, rgb(0.9));
        ctx.fillStyle = grad;
        ctx.fillRect(x0 + px, y0, 1, rh);
        const hv = 60 + curve * 160;
        const hg = hx.createLinearGradient(0, y0, 0, y0 + rh);
        hg.addColorStop(0, `rgb(${hv * 0.3},0,0)`);
        hg.addColorStop(0.12, `rgb(${hv},0,0)`);
        hg.addColorStop(1, `rgb(${hv * 0.95},0,0)`);
        hx.fillStyle = hg;
        hx.fillRect(x0 + px, y0, 1, rh);
      }
    }
  }
  const f = fbmField(size, { octaves: 4, base: 8, seed: 13 });
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < f.length; i++) { const k = 0.85 + f[i] * 0.3; for (let ch = 0; ch < 3; ch++) img.data[i * 4 + ch] *= k; }
  ctx.putImageData(img, 0, 0);
  return { map: tex(c), normalMap: tex(normalFromHeight(hcv, 5), { srgb: false }) };
});

// Trapezoidal metal roofing (aluzinc): raised ribs every 25 cm with flat
// pans between, faint vertical streaks in the roughness. Canvas = 1 m.
export const metal = () => memo('metal', () => {
  const size = 256, ribs = 4;
  const c = canvas(size), ctx = c.getContext('2d');
  const hcv = canvas(size), hx = hcv.getContext('2d');
  const rc = canvas(size), rx = rc.getContext('2d');
  const pitch = size / ribs;
  for (let x = 0; x < size; x++) {
    const t = (x % pitch) / pitch;
    // 0..0.12 rib top, 0.12..0.2 slope down, 0.2..0.92 pan, 0.92..1 slope up.
    const hgt = t < 0.12 ? 1 : t < 0.2 ? 1 - (t - 0.12) / 0.08 : t < 0.92 ? 0.08 * Math.sin(((t - 0.2) / 0.72) * Math.PI * 3) ** 2 : (t - 0.92) / 0.08;
    const lit = t >= 0.12 && t < 0.2 ? 0.8 : t >= 0.92 ? 1.08 : 1;
    const g = Math.min(255, (196 + hgt * 26) * lit);
    ctx.fillStyle = `rgb(${g},${g},${g})`; ctx.fillRect(x, 0, 1, size);
    hx.fillStyle = `rgb(${hgt * 255},0,0)`; hx.fillRect(x, 0, 1, size);
  }
  const r = rng(17);
  rx.fillStyle = '#9a9a9a'; rx.fillRect(0, 0, size, size);
  for (let i = 0; i < 120; i++) {
    const v = 120 + r() * 100;
    rx.fillStyle = `rgba(${v},${v},${v},0.35)`;
    rx.fillRect(r() * size, 0, 1 + r() * 3, size);
  }
  return { map: tex(c), normalMap: tex(normalFromHeight(hcv, 3), { srgb: false }), roughnessMap: tex(rc, { srgb: false }) };
});

// Ceramic floor tiles 40 cm, warm beige with per-tile shade. Canvas = 1.2 m.
export const floorTile = () => memo('floorTile', () => {
  const size = 512, n = 3;
  const c = canvas(size), ctx = c.getContext('2d');
  const hcv = canvas(size), hx = hcv.getContext('2d');
  const rc = canvas(size), rx = rc.getContext('2d');
  const f = fbmField(size, { octaves: 5, base: 6, seed: 19 });
  const r = rng(190);
  const s = size / n;
  const shade = Array.from({ length: n * n }, () => 0.94 + r() * 0.1);
  const base = fieldToCanvas(f, size, (v, x, y) => { const k = shade[((y / s) | 0) * n + ((x / s) | 0)]; const g = (222 + v * 28) * k; return [g, g - 6, g - 16]; });
  ctx.drawImage(base, 0, 0);
  hx.fillStyle = '#fff'; hx.fillRect(0, 0, size, size);
  rx.fillStyle = '#5a5a5a'; rx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(150,138,120,0.9)'; hx.fillStyle = '#000'; rx.fillStyle = '#f0f0f0';
  for (let i = 0; i <= n; i++) {
    for (const g of [ctx, hx, rx]) { g.fillRect(i * s - 2, 0, 4, size); g.fillRect(0, i * s - 2, size, 4); }
  }
  return { map: tex(c), normalMap: tex(normalFromHeight(hcv, 2), { srgb: false }), roughnessMap: tex(rc, { srgb: false }) };
});

// Stone pavers for walkways. Canvas = 2 m.
export const pavers = () => memo('pavers', () => {
  const size = 512;
  const c = canvas(size), ctx = c.getContext('2d');
  const hcv = canvas(size), hx = hcv.getContext('2d');
  const r = rng(8);
  ctx.fillStyle = '#7d7466'; ctx.fillRect(0, 0, size, size);
  hx.fillStyle = '#000'; hx.fillRect(0, 0, size, size);
  const cell = size / 4;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const t = 175 + r() * 40;
    ctx.fillStyle = `rgb(${t},${t - 8},${t - 22})`;
    ctx.beginPath(); ctx.roundRect(x * cell + 4, y * cell + 4, cell - 8, cell - 8, 10); ctx.fill();
    hx.fillStyle = '#ddd';
    hx.beginPath(); hx.roundRect(x * cell + 4, y * cell + 4, cell - 8, cell - 8, 10); hx.fill();
  }
  const f = fbmField(size, { octaves: 4, base: 8, seed: 21 });
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < f.length; i++) { const k = 0.86 + f[i] * 0.26; for (let ch = 0; ch < 3; ch++) img.data[i * 4 + ch] *= k; }
  ctx.putImageData(img, 0, 0);
  return { map: tex(c), normalMap: tex(normalFromHeight(hcv, 3), { srgb: false }) };
});

// Lawn: tileable color with blade speckle. Canvas = 4 m.
export const grass = () => memo('grass', () => {
  const size = 512;
  const f = fbmField(size, { octaves: 6, base: 4, seed: 31 });
  const r = rng(99);
  const c = fieldToCanvas(f, size, (v) => {
    const k = 0.75 + v * 0.5;
    return [88 * k, 122 * k, 60 * k];
  });
  const ctx = c.getContext('2d');
  for (let i = 0; i < 9000; i++) {
    const x = r() * size, y = r() * size;
    const l = 2 + r() * 5;
    const tone = r();
    ctx.strokeStyle = tone > 0.5 ? `rgba(${128 + r() * 40},${150 + r() * 30},${84 + r() * 30},0.5)` : `rgba(${52},${78 + r() * 20},${36},0.5)`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 2, y - l); ctx.stroke();
  }
  const hc = fieldToCanvas(fbmField(size, { octaves: 3, base: 32, seed: 2 }), size, (v) => [v * 255, 0, 0]);
  return { map: tex(c), normalMap: tex(normalFromHeight(hc, 1.5), { srgb: false }) };
});

export const sand = () => memo('sand', () => {
  const size = 256;
  const f = fbmField(size, { octaves: 6, base: 8, seed: 51 });
  const c = fieldToCanvas(f, size, (v) => [222 + v * 25, 204 + v * 25, 160 + v * 25]);
  return { map: tex(c) };
});

// Wood grain for doors, furniture, benches (warm near-white, tinted by color).
// Grain runs along v; warped growth rings with darker latewood lines.
export const wood = () => memo('wood', () => {
  const size = 256;
  const c = canvas(size), ctx = c.getContext('2d');
  const rc = canvas(size), rx = rc.getContext('2d');
  const n = makeNoise(16, 4), m = makeNoise(32, 5);
  const img = ctx.createImageData(size, size);
  const rimg = rx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const warp = n(x / 16, y / 48) * 9 + m(x / 8, y / 96) * 3;
    const amp = 0.5 + n(x / 64 + 7, y / 256) * 0.8;
    const ring = (Math.sin((x / size) * 120 + warp) * 0.5 + 0.5) ** 5 * amp;
    const g = 232 - ring * 24 + (m(x / 1.5, y / 40) - 0.5) * 12 + (n(x / 32, y / 128) - 0.5) * 14;
    const i = (y * size + x) * 4;
    img.data[i] = g; img.data[i + 1] = g * 0.92; img.data[i + 2] = g * 0.83; img.data[i + 3] = 255;
    const rv = 150 + ring * 70;
    rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = rv; rimg.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  rx.putImageData(rimg, 0, 0);
  return { map: tex(c), roughnessMap: tex(rc, { srgb: false }) };
});

// Small-wave water normal map for the pool.
export const water = () => memo('water', () => {
  const size = 256;
  const hc = fieldToCanvas(fbmField(size, { octaves: 4, base: 8, seed: 61 }), size, (v) => [v * 255, 0, 0]);
  return { normalMap: tex(normalFromHeight(hc, 3), { srgb: false }) };
});

// Pool mosaic tiles (blue).
export const poolTile = () => memo('poolTile', () => {
  const size = 256, n = 16;
  const c = canvas(size), ctx = c.getContext('2d');
  const r = rng(71);
  const s = size / n;
  ctx.fillStyle = '#d8eef2'; ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const b = r();
    ctx.fillStyle = `rgb(${40 + b * 40},${150 + b * 40},${190 + b * 40})`;
    ctx.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
  }
  return { map: tex(c) };
});

// Palm frond: feather of leaflets on transparent background.
export const frond = () => memo('frond', () => {
  const w = 128, h = 512;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const r = rng(12);
  ctx.strokeStyle = '#5a6b2a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(w / 2, h); ctx.lineTo(w / 2, 0); ctx.stroke();
  for (let y = 8; y < h - 20; y += 7) {
    const t = 1 - y / h;
    const len = (w / 2 - 4) * Math.sin(Math.min(1, t * 1.15) * Math.PI) ** 0.6;
    for (const dir of [-1, 1]) {
      const g = 90 + r() * 50;
      ctx.strokeStyle = `rgb(${g * 0.55},${g + 30},${g * 0.35})`;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(w / 2, y + 6);
      ctx.quadraticCurveTo(w / 2 + dir * len * 0.5, y - 2, w / 2 + dir * len, y + 14 + r() * 6);
      ctx.stroke();
    }
  }
  const t = tex(c);
  t.wrapS = t.wrapT = 1001; // ClampToEdge
  return { map: t };
});

// Generic leafy foliage (for mango tree, shrubs).
export const foliage = () => memo('foliage', () => {
  const size = 256;
  const c = canvas(size), ctx = c.getContext('2d');
  const r = rng(33);
  ctx.fillStyle = '#2c5a1e'; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1400; i++) {
    const x = r() * size, y = r() * size, s = 4 + r() * 7;
    const g = r();
    ctx.fillStyle = `rgb(${30 + g * 50},${80 + g * 70},${20 + g * 30})`;
    ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.45, r() * Math.PI, 0, Math.PI * 2); ctx.fill();
  }
  const hc = fieldToCanvas(fbmField(size, { octaves: 4, base: 16, seed: 34 }), size, (v) => [v * 255, 0, 0]);
  return { map: tex(c), normalMap: tex(normalFromHeight(hc, 3), { srgb: false }) };
});

// ---- interior finishes ------------------------------------------------------------

// Gray roughness canvas from a field: lo..hi mapped to 0..255.
function roughCanvas(field, size, lo, hi) {
  return fieldToCanvas(field, size, (v) => { const g = (lo + v * (hi - lo)) * 255; return [g, g, g]; });
}

// Draw tile joints on color / height / roughness canvases.
function joints(cols, rows, size, { ctx, hx, rx, color, w = 3, offsetRows = false }) {
  const cw = size / cols, rh = size / rows;
  for (let r = 0; r <= rows; r++) {
    for (const [g, fill] of [[ctx, color], [hx, '#000'], [rx, '#f2f2f2']]) { if (!g) continue; g.fillStyle = fill; g.fillRect(0, r * rh - w / 2, size, w); }
    if (r === rows) break;
    const off = offsetRows && r % 2 ? cw / 2 : 0;
    for (let k = -1; k <= cols; k++) {
      for (const [g, fill] of [[ctx, color], [hx, '#000'], [rx, '#f2f2f2']]) { if (!g) continue; g.fillStyle = fill; g.fillRect(k * cw + off - w / 2, r * rh, w, rh); }
    }
  }
}

// Marble field: warped veins on a cloudy white base, in [0,1] (1 = vein).
export function marbleField(size, seed) {
  const f = fbmField(size, { octaves: 6, base: 3, seed });
  const g = fbmField(size, { octaves: 4, base: 2, seed: seed + 5 });
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const t = (x + y * 0.6) / size * Math.PI * 4 + f[i] * 9 + g[i] * 3;
    out[i] = Math.pow(1 - Math.abs(Math.sin(t)), 9) * 0.85 + Math.pow(1 - Math.abs(Math.sin(t * 2.3 + 1)), 22) * 0.4;
  }
  return { veins: out, cloud: f };
}

// Large-format porcelain 60 x 60 cm, faint stone clouding. Canvas = 1.2 m.
export const porcelain = () => memo('porcelain', () => {
  const size = 512, n = 2;
  const c = canvas(size), ctx = c.getContext('2d');
  const hcv = canvas(size), hx = hcv.getContext('2d');
  const rc = canvas(size), rx = rc.getContext('2d');
  const { veins, cloud } = marbleField(size, 81);
  const r = rng(82);
  const shade = Array.from({ length: n * n }, () => 0.97 + r() * 0.05);
  const s = size / n;
  ctx.drawImage(fieldToCanvas(cloud, size, (v, x, y) => {
    const k = shade[((y / s) | 0) * n + ((x / s) | 0)];
    const g = (234 + v * 16 - veins[y * size + x] * 18) * k;
    return [g, g - 2, g - 6];
  }), 0, 0);
  hx.fillStyle = '#fff'; hx.fillRect(0, 0, size, size);
  rx.drawImage(roughCanvas(cloud, size, 0.28, 0.4), 0, 0);
  joints(n, n, size, { ctx, hx, rx, color: 'rgba(180,172,160,0.95)', w: 2 });
  return { map: tex(c), normalMap: tex(normalFromHeight(hcv, 1.5), { srgb: false }), roughnessMap: tex(rc, { srgb: false }) };
});

// Polished white marble slab (counters) — keeps its own colors. Canvas = 1.6 m.
export const marble = () => memo('marble', () => {
  const size = 512;
  const { veins, cloud } = marbleField(size, 91);
  const c = fieldToCanvas(cloud, size, (v, x, y) => {
    const k = veins[y * size + x];
    return [242 + v * 10 - k * 95, 241 + v * 10 - k * 92, 238 + v * 10 - k * 84];
  });
  return { map: tex(c), roughnessMap: tex(roughCanvas(cloud, size, 0.18, 0.3), { srgb: false }) };
});

// Marble floor: the slab cut into 80 cm tiles with thin joints. Canvas = 1.6 m.
export const marbleTile = () => memo('marbleTile', () => {
  const size = 512;
  const src = marble();
  const c = canvas(size), ctx = c.getContext('2d');
  const hcv = canvas(size), hx = hcv.getContext('2d');
  // Each quadrant uses a rotated copy so veins don't run on across joints.
  for (let q = 0; q < 4; q++) {
    ctx.save();
    ctx.translate((q % 2) * size / 2 + size / 4, ((q / 2) | 0) * size / 2 + size / 4);
    ctx.rotate((q * Math.PI) / 2);
    ctx.drawImage(src.map.image, q * 60, q * 40, size / 2, size / 2, -size / 4, -size / 4, size / 2, size / 2);
    ctx.restore();
  }
  hx.fillStyle = '#fff'; hx.fillRect(0, 0, size, size);
  joints(2, 2, size, { ctx, hx, color: 'rgba(170,165,158,0.9)', w: 2 });
  return { map: tex(c), normalMap: tex(normalFromHeight(hcv, 1.5), { srgb: false }), roughnessMap: src.roughnessMap };
});

// Speckled granite (counters), dark gray-brown with mica flecks. Canvas = 1 m.
export const granite = () => memo('granite', () => {
  const size = 256;
  const f = fbmField(size, { octaves: 4, base: 16, seed: 101 });
  const c = fieldToCanvas(f, size, (v) => { const g = 82 + v * 30; return [g + 6, g, g - 4]; });
  const ctx = c.getContext('2d');
  const r = rng(102);
  const tones = ['#2a2725', '#3a3532', '#9d958b', '#7a5f4c', '#8c8378', '#4a3f38', '#b8afa4'];
  for (let i = 0; i < 3600; i++) {
    ctx.fillStyle = tones[(r() * tones.length) | 0];
    const s = 0.8 + r() * 2.6;
    ctx.beginPath(); ctx.ellipse(r() * size, r() * size, s, s * (0.5 + r() * 0.5), r() * 3, 0, Math.PI * 2); ctx.fill();
  }
  return { map: tex(c), roughnessMap: tex(roughCanvas(f, size, 0.16, 0.3), { srgb: false }) };
});

// Wood plank floor: 15 cm boards, staggered ends, each its own tone. Canvas = 1.2 m.
export const woodPlank = () => memo('woodPlank', () => {
  const size = 512, boards = 8;
  const c = canvas(size), ctx = c.getContext('2d');
  const hcv = canvas(size), hx = hcv.getContext('2d');
  const rc = canvas(size), rx = rc.getContext('2d');
  const n = makeNoise(16, 6), m = makeNoise(32, 7);
  const r = rng(111);
  const bw = size / boards;
  const img = ctx.createImageData(size, size), rimg = rx.createImageData(size, size);
  hx.fillStyle = '#fff'; hx.fillRect(0, 0, size, size);
  for (let b = 0; b < boards; b++) {
    // 2-3 boards per column, random joints (wrap so the canvas tiles).
    const cuts = [r() * size];
    cuts.push((cuts[0] + size * (0.35 + r() * 0.3)) % size);
    const tones = cuts.map(() => [0.8 + r() * 0.3, r() * 40]);
    for (let y = 0; y < size; y++) {
      const seg = cuts.filter((k) => k <= y).length % cuts.length;
      const [tone, ph] = tones[seg];
      for (let x = b * bw; x < (b + 1) * bw; x++) {
        const warp = n(x / 16, (y + ph * 10) / 64) * 3 + m(x / 6, y / 120) * 1.2;
        const ring = (Math.sin(((x - b * bw) / bw) * 9 + warp + ph) * 0.5 + 0.5) ** 3;
        const g = (226 - ring * 52 + (m(x / 2, y / 30) - 0.5) * 16) * tone;
        const i = (y * size + x) * 4;
        img.data[i] = g; img.data[i + 1] = g * 0.8; img.data[i + 2] = g * 0.6; img.data[i + 3] = 255;
        const rv = 110 + ring * 60;
        rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = rv; rimg.data[i + 3] = 255;
      }
    }
    for (const k of cuts) {
      for (const g of [hx]) { g.fillStyle = '#000'; g.fillRect(b * bw, k - 1, bw, 2); }
      for (let x = b * bw; x < (b + 1) * bw; x++) for (const yy of [k - 1, k]) {
        const i = ((((yy | 0) + size) % size) * size + x) * 4;
        img.data[i] *= 0.45; img.data[i + 1] *= 0.45; img.data[i + 2] *= 0.45;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  rx.putImageData(rimg, 0, 0);
  ctx.fillStyle = 'rgba(40,25,15,0.55)'; hx.fillStyle = '#000';
  for (let b = 0; b <= boards; b++) { ctx.fillRect(b * bw - 1, 0, 2, size); hx.fillRect(b * bw - 1, 0, 2, size); }
  return { map: tex(c), normalMap: tex(normalFromHeight(hcv, 2), { srgb: false }), roughnessMap: tex(rc, { srgb: false }) };
});

// Polished concrete: soft clouding, faint trowel arcs, fine aggregate. Canvas = 3 m.
export const polished = () => memo('polished', () => {
  const size = 512;
  const f = fbmField(size, { octaves: 6, base: 3, seed: 121 });
  const c = fieldToCanvas(f, size, (v) => { const g = 168 + v * 50; return [g, g - 1, g - 3]; });
  const ctx = c.getContext('2d');
  const r = rng(122);
  ctx.lineWidth = 6;
  for (let i = 0; i < 40; i++) {
    const v = 150 + r() * 70;
    ctx.strokeStyle = `rgba(${v},${v},${v},0.08)`;
    ctx.beginPath(); ctx.arc(r() * size, r() * size, 40 + r() * 120, r() * 6, r() * 6 + 1.2); ctx.stroke();
  }
  for (let i = 0; i < 1600; i++) {
    const v = 110 + r() * 120;
    ctx.fillStyle = `rgba(${v},${v - 4},${v - 8},0.5)`;
    ctx.fillRect(r() * size, r() * size, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  return { map: tex(c), roughnessMap: tex(roughCanvas(f, size, 0.2, 0.45), { srgb: false }) };
});

// Handmade terracotta floor tiles 30 cm with cream joints. Own colors. Canvas = 1.2 m.
export const terracotta = () => memo('terracotta', () => {
  const size = 512, n = 4;
  const c = canvas(size), ctx = c.getContext('2d');
  const hcv = canvas(size), hx = hcv.getContext('2d');
  const rc = canvas(size), rx = rc.getContext('2d');
  const f = fbmField(size, { octaves: 5, base: 8, seed: 131 });
  const r = rng(132);
  const s = size / n;
  const tone = Array.from({ length: n * n }, () => [0.86 + r() * 0.2, (r() - 0.5) * 22]);
  ctx.drawImage(fieldToCanvas(f, size, (v, x, y) => {
    const [k, hue] = tone[((y / s) | 0) * n + ((x / s) | 0)];
    return [(160 + v * 34 + hue) * k, (96 + v * 24) * k, (70 + v * 18 - hue * 0.4) * k];
  }), 0, 0);
  hx.drawImage(fieldToCanvas(f, size, (v) => [200 + v * 55, 0, 0]), 0, 0);
  rx.drawImage(roughCanvas(f, size, 0.6, 0.85), 0, 0);
  joints(n, n, size, { ctx, hx, rx, color: '#b9ab94', w: 4 });
  return { map: tex(c), normalMap: tex(normalFromHeight(hcv, 2.5), { srgb: false }), roughnessMap: tex(rc, { srgb: false }) };
});

// Glossy wall tiles 20 x 20 cm (bathroom, kitchen backsplash), near-white. Canvas = 0.6 m.
export const wallTile = () => memo('wallTile', () => {
  const size = 256, n = 3;
  const c = canvas(size), ctx = c.getContext('2d');
  const hcv = canvas(size), hx = hcv.getContext('2d');
  const rc = canvas(size), rx = rc.getContext('2d');
  const r = rng(141);
  const s = size / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const g = 238 + r() * 14;
    ctx.fillStyle = `rgb(${g},${g},${g - 2})`; ctx.fillRect(x * s, y * s, s, s);
  }
  hx.fillStyle = '#fff'; hx.fillRect(0, 0, size, size);
  rx.fillStyle = '#303030'; rx.fillRect(0, 0, size, size);
  joints(n, n, size, { ctx, hx, rx, color: '#c9c6c0', w: 3 });
  return { map: tex(c), normalMap: tex(normalFromHeight(hcv, 2), { srgb: false }), roughnessMap: tex(rc, { srgb: false }) };
});

// Upholstery / linen (near-white, tinted by the fabric color): soft slub
// noise plus a faint fine weave in the normal map. Canvas = 0.5 m.
export const fabric = () => memo('fabric', () => {
  const size = 256;
  const f = fbmField(size, { octaves: 4, base: 32, seed: 151 });
  const c = fieldToCanvas(f, size, (v, x, y) => { const g = 236 + v * 14 + ((x + y) % 4 < 2 ? 2 : -2); return [g, g, g]; });
  const hc = fieldToCanvas(f, size, (v, x, y) => [128 + Math.sin(x * 1.6) * 40 + Math.sin(y * 1.6) * 40 + v * 30, 0, 0]);
  return { map: tex(c), normalMap: tex(normalFromHeight(hc, 0.6), { srgb: false }) };
});

// Woven cane (pajilla) for rocking chairs: octagonal weave, own colors. Canvas = 0.2 m.
export const rattan = () => memo('rattan', () => {
  const size = 128, cells = 8;
  const c = canvas(size), ctx = c.getContext('2d');
  const hcv = canvas(size), hx = hcv.getContext('2d');
  ctx.fillStyle = '#3d2a1a'; ctx.fillRect(0, 0, size, size);
  hx.fillStyle = '#000'; hx.fillRect(0, 0, size, size);
  const s = size / cells;
  ctx.lineCap = hx.lineCap = 'round';
  for (const [g, col, lw] of [[ctx, '#d8b67c', 3], [hx, '#fff', 3]]) {
    g.strokeStyle = col; g.lineWidth = lw;
    for (let i = -cells; i <= cells * 2; i++) {
      g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, size); g.stroke();
      g.beginPath(); g.moveTo(0, i * s); g.lineTo(size, i * s); g.stroke();
      g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s + size, size); g.stroke();
      g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s - size, size); g.stroke();
    }
  }
  return { map: tex(c), normalMap: tex(normalFromHeight(hcv, 2), { srgb: false }) };
});


// Clay brick courses (keeps a light base so the wall colour tints it). Canvas = 1.2 m: 16 courses x 5 bricks.
export const brick = () => memo('brick', () => {
  const size = 512, rows = 16, cols = 5;
  const c = canvas(size), ctx = c.getContext('2d');
  const hcv = canvas(size), hx = hcv.getContext('2d');
  const r = rng(41);
  const f = fbmField(size, { octaves: 5, base: 24, seed: 9 });
  ctx.fillStyle = '#d8d2c8'; ctx.fillRect(0, 0, size, size); // mortar
  hx.fillStyle = '#000'; hx.fillRect(0, 0, size, size);
  const bh = size / rows, bw = size / cols, gap = 3;
  for (let j = 0; j < rows; j++) {
    const off = j % 2 ? bw / 2 : 0;
    for (let i = -1; i <= cols; i++) {
      const x = i * bw + off, y = j * bh;
      const v = 0.82 + r() * 0.18;
      const g = Math.round(255 * v);
      ctx.fillStyle = `rgb(${g},${Math.round(g * (0.9 + r() * 0.06))},${Math.round(g * (0.86 + r() * 0.06))})`;
      ctx.fillRect(x + gap, y + gap, bw - gap * 2, bh - gap * 2);
      hx.fillStyle = '#c0c0c0';
      hx.fillRect(x + gap, y + gap, bw - gap * 2, bh - gap * 2);
    }
  }
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < size * size; i++) { const k = (f[i] - 0.5) * 26; img.data[i * 4] += k; img.data[i * 4 + 1] += k; img.data[i * 4 + 2] += k; }
  ctx.putImageData(img, 0, 0);
  return { map: tex(c), normalMap: tex(normalFromHeight(hcv, 2.5), { srgb: false }) };
});

// Chain-link mesh with transparent gaps (alpha-tested). Canvas = 0.5 m.
export const chainlink = () => memo('chainlink', () => {
  const size = 128;
  const c = canvas(size), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = '#c9ced3'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  const s = size / 2;
  for (let i = -2; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s + size, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s - size, size); ctx.stroke();
  }
  return { map: tex(c) };
});

// Text label sprite canvas for room names.
// Room / size tags: Archivo 600 ink on a near-white, square-ish pill (REVAMP "Plano" labels).
export function labelCanvas(text, { font = 600, px = 44, color = '#1B1F1E', bg = 'rgba(255,255,255,0.9)', line = 'rgba(27,31,30,0.14)' } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const face = `${font} ${px}px Archivo, "Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif`;
  ctx.font = face;
  const w = Math.ceil(ctx.measureText(text).width) + px * 1.1;
  c.width = w; c.height = Math.ceil(px * 1.75);
  ctx.font = face;
  const r = c.height * 0.24;
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(1, 1, c.width - 2, c.height - 2, r); ctx.fill();
  if (line) { ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillText(text, c.width / 2, c.height / 2 + 2);
  return c;
}

// Natural tropical lawn: muted olive / sage two-tone at large scale plus darker irregular patches; tileable,
// used at ~60 m per tile, no stripes.
export const lawnTone = () => memo('lawnTone', () => {
  const size = 256;
  const f = fbmField(size, { octaves: 4, base: 3, seed: 17 });
  const pf = fbmField(size, { octaves: 3, base: 6, seed: 23 });
  const a = [0x88, 0x8d, 0x66], b = [0x71, 0x78, 0x55];
  const c = fieldToCanvas(f, size, (v, x, y) => {
    const k = Math.min(1, Math.max(0, (v - 0.3) * 2.2));
    const patch = Math.min(1, Math.max(0, (pf[y * size + x] - 0.56) * 6)) * 0.2;
    return a.map((q, i) => (q + (b[i] - q) * k) * (1 - patch));
  });
  return { map: tex(c) };
});

// Compacted earth / sand for the raised lot slab (#CDBB9A), fine grain + a soft normal.
export const earth = () => memo('earth', () => {
  const size = 256;
  const f = fbmField(size, { octaves: 6, base: 8, seed: 73 });
  const r = rng(5);
  const c = fieldToCanvas(f, size, (v) => { const k = 0.93 + v * 0.14; return [0xcd * k, 0xbb * k, 0x9a * k]; });
  const ctx = c.getContext('2d');
  for (let i = 0; i < 2600; i++) { ctx.fillStyle = r() > 0.5 ? 'rgba(255,248,232,0.35)' : 'rgba(120,100,70,0.22)'; ctx.fillRect(r() * size, r() * size, 1 + r(), 1 + r()); }
  const hc = fieldToCanvas(fbmField(size, { octaves: 3, base: 32, seed: 9 }), size, (v) => [v * 255, 0, 0]);
  return { map: tex(c), normalMap: tex(normalFromHeight(hc, 0.8), { srgb: false }) };
});

// ---- Realism pass (2026-11-07) ------------------------------------------------------------------

// Tropical turf (canvas = 4 m): olive / green / straw mix, thousands of short blades, dark gaps between
// clumps and a few bare-soil specks, so the yard reads as a real Caribbean lawn instead of a flat colour.
export const turf = () => memo('turf', () => {
  const size = 512;
  const f = fbmField(size, { octaves: 6, base: 4, seed: 131 });
  const g = fbmField(size, { octaves: 4, base: 8, seed: 137 });
  const r = rng(211);
  const OL = [92, 128, 50], GR = [64, 116, 40], DRY = [140, 140, 80];
  const c = fieldToCanvas(f, size, (v, x, y) => {
    const k = Math.min(1, Math.max(0, (v - 0.35) * 2.4));
    const dry = Math.min(1, Math.max(0, (g[y * size + x] - 0.6) * 3.2)) * 0.55;
    return OL.map((q, i) => (q + (GR[i] - q) * k) * (1 - dry) + DRY[i] * dry);
  });
  const ctx = c.getContext('2d');
  const hc = canvas(size), hx = hc.getContext('2d');
  hx.fillStyle = '#404040'; hx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2200; i++) { // dark gaps between clumps (shade at the roots)
    const x = r() * size, y = r() * size;
    ctx.fillStyle = `rgba(30,40,18,${0.12 + r() * 0.12})`;
    ctx.beginPath(); ctx.ellipse(x, y, 2 + r() * 4, 1 + r() * 2, r() * 3, 0, 6.29); ctx.fill();
  }
  for (let i = 0; i < 220; i++) { // bare soil specks
    ctx.fillStyle = `rgba(${120 + r() * 30},${100 + r() * 20},${70 + r() * 15},${0.35 + r() * 0.3})`;
    ctx.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2);
  }
  for (let i = 0; i < 16000; i++) { // blades, drawn wrapped so the tile has no seam
    const x = r() * size, y = r() * size, l = 3 + r() * 7, lean = (r() - 0.5) * 4;
    const t = r();
    const col = t > 0.72 ? [150 + r() * 40, 160 + r() * 30, 90 + r() * 30] : t > 0.3 ? [86 + r() * 30, 118 + r() * 30, 52 + r() * 20] : [48, 66 + r() * 16, 30];
    ctx.strokeStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},0.55)`;
    hx.strokeStyle = `rgba(255,255,255,${0.25 + t * 0.35})`;
    ctx.lineWidth = hx.lineWidth = r() > 0.85 ? 1.6 : 1;
    const xs = [0], ys = [0];
    if (x + lean > size) xs.push(-size); else if (x + lean < 0) xs.push(size);
    if (y - l < 0) ys.push(size);
    for (const ox of xs) for (const oy of ys) {
      ctx.beginPath(); ctx.moveTo(x + ox, y + oy); ctx.lineTo(x + ox + lean, y + oy - l); ctx.stroke();
      hx.beginPath(); hx.moveTo(x + ox, y + oy); hx.lineTo(x + ox + lean, y + oy - l); hx.stroke();
    }
  }
  return { map: tex(c), normalMap: tex(normalFromHeight(hc, 2.2), { srgb: false }) };
});

// Large-scale lawn variation (linear, ~0.5 grey = no change): lush darker patches, sun-dried straw patches
// and a faint mottling. Sampled at tens of metres per tile on top of the 4 m turf (see land.js macroTint).
export const lawnMacro = () => memo('lawnMacro', () => {
  const size = 256;
  const f = fbmField(size, { octaves: 5, base: 3, seed: 61 });
  const d = fbmField(size, { octaves: 4, base: 5, seed: 67 });
  const c = fieldToCanvas(f, size, (v, x, y) => {
    const lush = (v - 0.5) * 0.8; // about -0.3..0.3
    const dry = Math.max(0, d[y * size + x] - 0.55) * 2.6;
    const k = 1 - lush;
    return [128 * k * (1 + dry * 0.55), 128 * k * (1 + dry * 0.22), 128 * k * (1 - dry * 0.35)].map((q) => Math.min(255, q));
  });
  return { map: tex(c, { srgb: false }) };
});

// One bay x one storey of a Dominican block house (u: 3.2 m, v: 3 m): white render (tinted by the material
// colour), a window with a light frame, dark glass with a sky reflection, rejas (iron bars) and a sill.
export const facade = () => memo('facade', () => {
  const size = 256;
  const f = fbmField(size, { octaves: 5, base: 8, seed: 141 });
  const c = fieldToCanvas(f, size, (v) => { const k = 0.9 + v * 0.12; return [246 * k, 244 * k, 238 * k]; });
  const ctx = c.getContext('2d');
  // Floor band / slab edge at the top, faint rain stains under it.
  ctx.fillStyle = 'rgba(0,0,0,0.07)'; ctx.fillRect(0, 0, size, 10);
  const st = ctx.createLinearGradient(0, 10, 0, 60); st.addColorStop(0, 'rgba(60,55,45,0.10)'); st.addColorStop(1, 'rgba(60,55,45,0)');
  ctx.fillStyle = st; ctx.fillRect(0, 10, size, 50);
  // Window: 1.2 m x 1.3 m, sill at 1.0 m (v from the bottom).
  const px = size / 3.2, py = size / 3;
  const w = 1.25 * px, h = 1.3 * py, x0 = (size - w) / 2, y0 = size - (1.0 * py + h);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x0 - 6, y0 - 6, w + 12, h + 14); // reveal shadow
  ctx.fillStyle = '#f3f1ea'; ctx.fillRect(x0 - 5, y0 - 5, w + 10, h + 10); // frame
  const gl = ctx.createLinearGradient(0, y0, 0, y0 + h); gl.addColorStop(0, '#5d7286'); gl.addColorStop(0.45, '#2c3a46'); gl.addColorStop(1, '#1d262d');
  ctx.fillStyle = gl; ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + w * 0.45, y0); ctx.lineTo(x0, y0 + h * 0.6); ctx.fill();
  ctx.fillStyle = '#e9e6dc'; ctx.fillRect(x0 + w / 2 - 2, y0, 4, h); // mullion
  ctx.fillStyle = '#2a2b2b'; // rejas
  for (let i = 1; i < 7; i++) ctx.fillRect(x0 + (w * i) / 7 - 1.5, y0 - 2, 3, h + 4);
  ctx.fillRect(x0, y0 + h * 0.33, w, 3); ctx.fillRect(x0, y0 + h * 0.66, w, 3);
  ctx.fillStyle = '#dcd8cc'; ctx.fillRect(x0 - 10, y0 + h + 4, w + 20, 7); // sill
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x0 - 10, y0 + h + 11, w + 20, 4);
  // Dirty plinth along the bottom of the ground floor.
  const pl = ctx.createLinearGradient(0, size - 26, 0, size); pl.addColorStop(0, 'rgba(90,75,55,0)'); pl.addColorStop(1, 'rgba(90,75,55,0.22)');
  ctx.fillStyle = pl; ctx.fillRect(0, size - 26, size, 26);
  return { map: tex(c) };
});

// Worn asphalt (canvas = 4 m): dark grey aggregate, lighter wheel tracks, a few patches and hairline cracks.
export const asphalt = () => memo('asphalt', () => {
  const size = 512;
  const f = fbmField(size, { octaves: 6, base: 6, seed: 151 });
  const r = rng(157);
  const c = fieldToCanvas(f, size, (v) => { const k = 0.82 + v * 0.3; return [86 * k, 87 * k, 88 * k]; });
  const ctx = c.getContext('2d');
  for (let i = 0; i < 14000; i++) { const t = r(); ctx.fillStyle = t > 0.5 ? `rgba(160,158,152,${0.25 + r() * 0.3})` : `rgba(28,28,30,${0.3 + r() * 0.3})`; ctx.fillRect(r() * size, r() * size, 1 + r(), 1 + r()); }
  for (let i = 0; i < 5; i++) { ctx.fillStyle = `rgba(40,40,42,${0.18 + r() * 0.12})`; ctx.fillRect(r() * size, r() * size, 30 + r() * 90, 20 + r() * 60); }
  ctx.strokeStyle = 'rgba(25,25,25,0.45)'; ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    let x = r() * size, y = r() * size; ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 9; k++) { x += (r() - 0.5) * 30; y += (r() - 0.3) * 22; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const hc = fieldToCanvas(fbmField(size, { octaves: 3, base: 64, seed: 159 }), size, (v) => [v * 255, 0, 0]);
  return { map: tex(c), normalMap: tex(normalFromHeight(hc, 1.2), { srgb: false }) };
});

// Coconut palm bark: grey-brown with the ring scars of old fronds (5 rings per tile; one tile per trunk segment).
export const palmBark = () => memo('palmBark', () => {
  const size = 128;
  const f = fbmField(size, { octaves: 5, base: 4, seed: 171 });
  const r = rng(173);
  const c = fieldToCanvas(f, size, (v) => { const k = 0.85 + v * 0.25; return [150 * k, 132 * k, 108 * k]; });
  const ctx = c.getContext('2d');
  const hc = canvas(size), hx = hc.getContext('2d');
  hx.fillStyle = '#808080'; hx.fillRect(0, 0, size, size);
  for (let i = 0; i < 5; i++) {
    const y = (i + 0.5) * (size / 5) + (r() - 0.5) * 4;
    for (let x = 0; x < size; x += 2) {
      const yy = y + Math.sin(x / size * 6.283 * 2 + i) * 2;
      ctx.fillStyle = 'rgba(70,58,44,0.55)'; ctx.fillRect(x, yy, 2, 3);
      ctx.fillStyle = 'rgba(205,190,165,0.35)'; ctx.fillRect(x, yy + 3, 2, 2);
      hx.fillStyle = '#202020'; hx.fillRect(x, yy, 2, 3);
      hx.fillStyle = '#d0d0d0'; hx.fillRect(x, yy + 3, 2, 3);
    }
  }
  for (let i = 0; i < 500; i++) { ctx.fillStyle = `rgba(60,50,40,${r() * 0.25})`; ctx.fillRect(r() * size, r() * size, 1, 2 + r() * 5); }
  return { map: tex(c), normalMap: tex(normalFromHeight(hc, 2.5), { srgb: false }) };
});

// Leaf cluster for leaf-card canopies (RGBA, 256 px): a twig with ~80 broad tropical leaves, near-neutral
// light green so the per-card vertex colour sets the hue; lighter tips, a pale midrib, soft self-shadow.
export const leafCluster = () => memo('leafCluster', () => {
  const size = 256, R = size / 2;
  const c = canvas(size), ctx = c.getContext('2d');
  const r = rng(301);
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(92,74,52,0.9)'; ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) { // twigs
    const a = r() * 6.283, l = 40 + r() * 70;
    ctx.lineWidth = 2 + r() * 2;
    ctx.beginPath(); ctx.moveTo(R, R); ctx.quadraticCurveTo(R + Math.cos(a + 0.3) * l * 0.5, R + Math.sin(a + 0.3) * l * 0.5, R + Math.cos(a) * l, R + Math.sin(a) * l); ctx.stroke();
  }
  const leaves = [];
  for (let i = 0; i < 86; i++) {
    const rad = Math.sqrt(r()) * 96, a = r() * 6.283;
    leaves.push({ x: R + Math.cos(a) * rad, y: R + Math.sin(a) * rad, rot: a + (r() - 0.5) * 1.4, L: 26 + r() * 26, W: 9 + r() * 8, k: r() });
  }
  leaves.sort((p, q) => p.k - q.k); // darker leaves first (underneath)
  for (const lf of leaves) {
    ctx.save(); ctx.translate(lf.x, lf.y); ctx.rotate(lf.rot);
    const v = 0.62 + lf.k * 0.38;
    // shadow under the leaf
    ctx.fillStyle = 'rgba(20,30,10,0.25)';
    ctx.beginPath(); ctx.moveTo(-lf.L / 2 + 2, 2); ctx.quadraticCurveTo(2, -lf.W + 2, lf.L / 2 + 2, 2); ctx.quadraticCurveTo(2, lf.W + 2, -lf.L / 2 + 2, 2); ctx.fill();
    const g = ctx.createLinearGradient(-lf.L / 2, 0, lf.L / 2, 0);
    g.addColorStop(0, `rgb(${(205 * v) | 0},${(228 * v) | 0},${(190 * v) | 0})`);
    g.addColorStop(1, `rgb(${(232 * v) | 0},${(248 * v) | 0},${(205 * v) | 0})`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-lf.L / 2, 0); ctx.quadraticCurveTo(0, -lf.W, lf.L / 2, 0); ctx.quadraticCurveTo(0, lf.W, -lf.L / 2, 0); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,235,${0.25 + lf.k * 0.2})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-lf.L / 2 + 2, 0); ctx.lineTo(lf.L / 2 - 2, 0); ctx.stroke();
    ctx.restore();
  }
  const t = tex(c);
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  return { map: t };
});

// Flower cluster (RGBA, 128 px): ~14 five-petal blossoms, near-white petals with a warm centre, tinted by the
// material colour (pink, red, white, orange...). Used as small alpha cards on flowering shrubs.
export const flowerCluster = () => memo('flowerCluster', () => {
  const size = 128, R = size / 2;
  const c = canvas(size), ctx = c.getContext('2d');
  const r = rng(401);
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 15; i++) {
    const rad = Math.sqrt(r()) * 44, a = r() * 6.283;
    const x = R + Math.cos(a) * rad, y = R + Math.sin(a) * rad, s = 7 + r() * 6, v = 0.8 + r() * 0.2;
    ctx.save(); ctx.translate(x, y); ctx.rotate(r() * 6.283);
    for (let k = 0; k < 5; k++) {
      ctx.rotate(6.283 / 5);
      const g = ctx.createRadialGradient(0, -s * 0.55, 1, 0, -s * 0.55, s * 0.7);
      g.addColorStop(0, `rgb(${255 * v | 0},${255 * v | 0},${255 * v | 0})`);
      g.addColorStop(1, `rgb(${225 * v | 0},${222 * v | 0},${220 * v | 0})`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, -s * 0.55, s * 0.42, s * 0.6, 0, 0, 6.283); ctx.fill();
    }
    ctx.fillStyle = '#f2d36b'; ctx.beginPath(); ctx.arc(0, 0, s * 0.22, 0, 6.283); ctx.fill();
    ctx.restore();
  }
  const t = tex(c);
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  return { map: t };
});

export function makeTexture(c, opts) { return tex(c, opts); }

// Floor swatches for the UI (drawn by floortex.js with the same painter as the 3D floors).
export { floorSwatch } from './floortex.js';
