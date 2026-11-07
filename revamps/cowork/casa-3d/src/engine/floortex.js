// Procedural interior floors: tile grids (straight / diagonal / offset), wood
// planks (straight / herringbone) and granito, drawn per pixel at true scale
// (canvas meters = world meters), so 60 cm tiles are 60 cm tiles on a 4 m room.
// One painter feeds both the tiling textures and the UI swatches.
import { fbmField, rng, makeNoise, marbleField, makeTexture } from './textures.js';
import * as T from './textures.js';
import { FLOORS, normalizeFloor, tileDims, toneTint } from './floors.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;

function hash(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Identity of a tile / plank that repeats with the canvas: its center folded into one period.
function canonId(cx, cy, Px, Py) {
  const q = (c, P) => Math.round((((c % P) + P) % P) * 1000) % Math.round(P * 1000);
  return q(cx, Px) * 4001 + q(cy, Py);
}

// px per canvas side for a period in meters (about 2.3 mm per pixel, capped).
const pxFor = (P) => Math.min(1024, Math.max(128, Math.round((P * 430) / 16) * 16));

// ---- shared slabs (what the stone looks like before it is cut into tiles) ------------
const SLAB = 512, SLAB_M = 1.2;
const slabs = new Map();
function slab(name) {
  if (!slabs.has(name)) {
    if (name === 'porcelain') slabs.set(name, marbleField(SLAB, 81));
    else if (name === 'marble') slabs.set(name, marbleField(SLAB, 91));
    else if (name === 'ceramic') slabs.set(name, { cloud: fbmField(SLAB, { octaves: 5, base: 6, seed: 19 }) });
    else slabs.set(name, { cloud: fbmField(SLAB, { octaves: 5, base: 8, seed: 131 }) });
  }
  return slabs.get(name);
}
const at = (arr, u, v) => {
  const i = ((Math.floor((u / SLAB_M) * SLAB) % SLAB) + SLAB) % SLAB, j = ((Math.floor((v / SLAB_M) * SLAB) % SLAB) + SLAB) % SLAB;
  return arr[j * SLAB + i];
};

// ---- tile layouts ----------------------------------------------------------------------
// cell(x, y, o): o.cx/cy tile center, o.lx/ly position from that center, o.edge = meters to the nearest joint.
function tileLayout(pattern, w, h) {
  const reps = (m) => Math.max(1, Math.round(1.2 / m));
  if (pattern === 'diagonal') {
    const s2 = Math.SQRT2, k = Math.max(1, Math.ceil(1.6 / (s2 * w)));
    const P = s2 * w * k;
    return {
      Px: P, Py: P,
      cell(x, y, o) {
        const u = (x + y) / s2, v = (y - x) / s2;
        const i = Math.floor(u / w), j = Math.floor(v / h);
        const fu = u - i * w, fv = v - j * h;
        o.edge = Math.min(fu, w - fu, fv, h - fv);
        const cu = (i + 0.5) * w, cv = (j + 0.5) * h;
        o.cx = (cu - cv) / s2; o.cy = (cu + cv) / s2;
        o.lx = fu - w / 2; o.ly = fv - h / 2;
      },
    };
  }
  const brick = pattern === 'escalonado';
  const nx = reps(w);
  let ny = reps(h);
  if (brick && ny % 2) ny++;
  return {
    Px: w * nx, Py: h * ny,
    cell(x, y, o) {
      const j = Math.floor(y / h);
      const off = brick && j & 1 ? w / 2 : 0;
      const i = Math.floor((x - off) / w);
      const fx = x - off - i * w, fy = y - j * h;
      o.edge = Math.min(fx, w - fx, fy, h - fy);
      o.cx = off + (i + 0.5) * w; o.cy = (j + 0.5) * h;
      o.lx = fx - w / 2; o.ly = fy - h / 2;
    },
  };
}

// ---- tile finishes -----------------------------------------------------------------------
// paint(o, r, out): r = four per-tile randoms in [0,1). Fills out.r/g/b, rough, bump (0..1).
const rot = (o, r) => {
  // Each tile shows its own patch of the slab, turned a random quarter.
  const q = Math.floor(r[2] * 4);
  const [a, b] = q === 0 ? [o.lx, o.ly] : q === 1 ? [-o.ly, o.lx] : q === 2 ? [-o.lx, -o.ly] : [o.ly, -o.lx];
  return [a + r[0] * 7.31 + 0.6, b + r[1] * 5.17 + 0.6];
};
const TILE_FINISH = {
  porcelanato: {
    joint: 0.0028, jc: [150, 143, 132], bump: 0.04,
    paint(o, r, out) {
      const s = slab('porcelain'), [u, v] = rot(o, r);
      const k = 0.975 + r[3] * 0.05, f = at(s.cloud, u, v), vn = at(s.veins, u, v);
      const g = (234 + f * 16 - vn * 18) * k;
      out.r = g; out.g = g - 2; out.b = g - 6; out.rough = 0.28 + f * 0.12; out.bump = f;
    },
  },
  ceramica: {
    joint: 0.004, jc: [128, 116, 98], bump: 0.08,
    paint(o, r, out) {
      const s = slab('ceramic'), [u, v] = rot(o, r);
      const k = 0.94 + r[3] * 0.1, f = at(s.cloud, u, v);
      const g = (222 + f * 28) * k;
      out.r = g; out.g = g - 6; out.b = g - 16; out.rough = 0.36 + f * 0.04; out.bump = f;
    },
  },
  marmol: {
    joint: 0.0022, jc: [150, 145, 138], bump: 0.02,
    paint(o, r, out) {
      const s = slab('marble'), [u, v] = rot(o, r);
      const k = 0.985 + r[3] * 0.03, f = at(s.cloud, u, v), vn = at(s.veins, u, v);
      out.r = (242 + f * 10 - vn * 66) * k; out.g = (241 + f * 10 - vn * 63) * k; out.b = (238 + f * 10 - vn * 56) * k;
      out.rough = 0.18 + f * 0.12; out.bump = f;
    },
  },
  terracota: {
    joint: 0.008, jc: [185, 171, 148], bump: 0.3,
    paint(o, r, out) {
      const s = slab('terra'), [u, v] = rot(o, r);
      const k = 0.86 + r[3] * 0.2, hue = (r[1] - 0.5) * 22, f = at(s.cloud, u, v);
      out.r = (160 + f * 34 + hue) * k; out.g = (96 + f * 24) * k; out.b = (70 + f * 18 - hue * 0.4) * k;
      out.rough = 0.6 + f * 0.25; out.bump = f;
    },
  },
};

// ---- wood layouts ------------------------------------------------------------------------
// cell(x, y, o): o.id, o.along / o.across (m from the plank's end / side), o.len, o.wid, o.edge.
function plankLayout(bw, Lmin, Lmax, seed) {
  const nc = Math.max(1, Math.round(1.2 / bw)), Px = nc * bw, Py = 2.4;
  const r = rng(seed);
  const cols = Array.from({ length: nc }, () => {
    const n = Math.max(1, Math.round(Py / ((Lmin + Lmax) / 2)));
    const raw = Array.from({ length: n }, () => Lmin + r() * (Lmax - Lmin));
    const k = Py / raw.reduce((s, v) => s + v, 0);
    const lens = raw.map((v) => v * k);
    const cum = [];
    let a = 0;
    for (const l of lens) { cum.push(a); a += l; }
    return { lens, cum, off: r() * Py };
  });
  return {
    Px, Py,
    cell(x, y, o) {
      const c = Math.floor(x / bw), cm = ((c % nc) + nc) % nc, col = cols[cm];
      const t = ((((y - col.off) % Py) + Py) % Py);
      let s = col.lens.length - 1;
      while (s > 0 && col.cum[s] > t) s--;
      o.id = cm * 64 + s;
      o.along = t - col.cum[s]; o.len = col.lens[s];
      o.across = x - c * bw; o.wid = bw;
      o.edge = Math.min(o.across, bw - o.across, o.along, o.len - o.along);
    },
  };
}

// Herringbone: planks w x (n*w); horizontal and vertical ones share the diagonal index a-b mod 2n.
function herringLayout(w, n) {
  const P = 4 * n * w, N2 = 2 * n;
  return {
    Px: P, Py: P,
    cell(x, y, o) {
      const X = x / w, Y = y / w, a = Math.floor(X), b = Math.floor(Y), fx = X - a, fy = Y - b;
      const c = (((a - b) % N2) + N2) % N2;
      let cx, cy;
      if (c < n) {
        o.along = (c + fx) * w; o.across = fy * w;
        cx = (a - c + n / 2) * w; cy = (b + 0.5) * w;
      } else {
        const t = c - n;
        o.along = (t + 1 - fy) * w; o.across = fx * w;
        cx = (a + 0.5) * w; cy = (b + t + 1 - n / 2) * w;
      }
      o.len = n * w; o.wid = w;
      o.id = canonId(cx, cy, P, P);
      o.edge = Math.min(o.across, w - o.across, o.along, o.len - o.along);
    },
  };
}

// base: brightness at ring 0; ratio: r,g,b multipliers; rings: grain lines across a plank.
const WOOD = {
  madera: { bw: 0.15, Lmin: 0.5, Lmax: 0.95, seed: 111, base: 226, ratio: [1, 0.8, 0.6], contrast: 52, rings: 3, fine: 16, joint: 0.0012, jc: [60, 38, 24], rough: [0.45, 0.62], bump: 0.1 },
  'porcelanato-madera': { bw: 0.2, Lmin: 1.2, Lmax: 1.2, seed: 121, base: 196, ratio: [1, 0.76, 0.52], contrast: 46, rings: 5, fine: 20, joint: 0.003, jc: [112, 96, 82], rough: [0.34, 0.46], bump: 0.05 },
  vinil: { bw: 0.18, Lmin: 0.85, Lmax: 1.25, seed: 131, base: 216, ratio: [1, 0.84, 0.64], contrast: 30, rings: 4, fine: 12, joint: 0.0009, jc: [96, 80, 64], rough: [0.42, 0.56], bump: 0.04 },
};
const HERRING = { w: 0.12, n: 5 };

const nA = makeNoise(16, 6), nB = makeNoise(32, 7), nC = makeNoise(64, 8);
// Soft, fine grain: long streaks along the plank, faint rings, a little cross-fiber speckle.
function woodPixel(W, o, id, out) {
  const r0 = hash(id, 1), r1 = hash(id, 2), r2 = hash(id, 3), r3 = hash(id, 4);
  const tone = 0.88 + r0 * 0.24, t = o.across / o.wid, u = o.along;
  const warp = nA(u * 2.2 + r3 * 30, t * 1.3 + r1 * 20) * 1.4;
  const ring = (Math.sin((t + warp * 0.07) * Math.PI * W.rings * 2 + r3 * 6.28) * 0.5 + 0.5) ** 2.5;
  const streak = nB(t * 24 + r1 * 40, u * 1.7 + r2 * 40);
  const fine = nC(t * 70 + r2 * 20, u * 10 + r1 * 20);
  const g = (W.base - ring * W.contrast * 0.7 - (streak - 0.5) * W.fine * 1.5 + (fine - 0.5) * W.fine * 0.7) * tone;
  out.r = g * W.ratio[0]; out.g = g * W.ratio[1]; out.b = g * W.ratio[2];
  out.rough = mix(W.rough[0], W.rough[1], ring); out.bump = ring * 0.5 + streak * 0.5;
}

// ---- layouts + painters ---------------------------------------------------------------------
function layoutFor(spec) {
  if (spec.kind === 'tile') {
    const { w, h } = tileDims(spec.size);
    return tileLayout(spec.pattern, w, h);
  }
  if (spec.kind === 'wood') {
    if (spec.pattern === 'espiga') return herringLayout(HERRING.w, HERRING.n);
    const W = WOOD[spec.id] ?? WOOD.madera;
    return plankLayout(W.bw, W.Lmin, W.Lmax, W.seed);
  }
  return { Px: 1.2, Py: 1.2 };
}

// Returns paint(x, y, out) -> fills out.r/g/b (0..255), rough (0..1), h (0..1 height) for world meters.
function makePainter(spec, layout, mpp) {
  const o = {}, tmp = {};
  const aa = Math.max(mpp, 0.0007);
  if (spec.kind === 'tile') {
    const F = TILE_FINISH[spec.id] ?? TILE_FINISH.porcelanato;
    const gw = Math.max(F.joint, 1.6 * mpp), r = [0, 0, 0, 0];
    return (x, y, out) => {
      layout.cell(x, y, o);
      const id = canonId(o.cx, o.cy, layout.Px, layout.Py);
      r[0] = hash(id, 1); r[1] = hash(id, 2); r[2] = hash(id, 3); r[3] = hash(id, 4);
      F.paint(o, r, tmp);
      const t = clamp01((o.edge - gw / 2) / aa), bev = clamp01((o.edge - gw / 2) / 0.004);
      out.r = mix(F.jc[0], tmp.r, t); out.g = mix(F.jc[1], tmp.g, t); out.b = mix(F.jc[2], tmp.b, t);
      out.rough = mix(0.92, tmp.rough, t);
      out.h = bev * (1 - F.bump) + tmp.bump * F.bump;
    };
  }
  const W = WOOD[spec.id] ?? WOOD.madera;
  const gw = Math.max(spec.pattern === 'espiga' ? W.joint * 1.6 : W.joint, 1.5 * mpp);
  return (x, y, out) => {
    layout.cell(x, y, o);
    woodPixel(W, o, o.id, tmp);
    const t = clamp01((o.edge - gw / 2) / aa), bev = clamp01((o.edge - gw / 2) / 0.003);
    out.r = mix(W.jc[0], tmp.r, t); out.g = mix(W.jc[1], tmp.g, t); out.b = mix(W.jc[2], tmp.b, t);
    out.rough = mix(0.85, tmp.rough, t);
    out.h = bev * (1 - W.bump) + tmp.bump * W.bump;
  };
}

// Sobel normal map from a height array (wraps at the edges).
function normalCanvas(hf, sx, sy, strength) {
  const c = document.createElement('canvas');
  c.width = sx; c.height = sy;
  const ctx = c.getContext('2d'), img = ctx.createImageData(sx, sy);
  const h = (x, y) => hf[((y + sy) % sy) * sx + ((x + sx) % sx)];
  for (let y = 0; y < sy; y++) {
    for (let x = 0; x < sx; x++) {
      const dx = h(x + 1, y - 1) + 2 * h(x + 1, y) + h(x + 1, y + 1) - (h(x - 1, y - 1) + 2 * h(x - 1, y) + h(x - 1, y + 1));
      const dy = h(x - 1, y + 1) + 2 * h(x, y + 1) + h(x + 1, y + 1) - (h(x - 1, y - 1) + 2 * h(x, y - 1) + h(x + 1, y - 1));
      const nx = -dx * strength, ny = dy * strength, l = Math.hypot(nx, ny, 1), i = (y * sx + x) * 4;
      img.data[i] = (nx / l) * 127.5 + 127.5; img.data[i + 1] = (ny / l) * 127.5 + 127.5; img.data[i + 2] = (1 / l) * 127.5 + 127.5; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Polished terrazzo ("granito"): cream matrix with angular chips. Canvas = 1.2 m.
let granitoCache = null;
function granitoMaps() {
  if (granitoCache) return granitoCache;
  const size = 1024;
  const f = fbmField(256, { octaves: 4, base: 8, seed: 201 });
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = f[(y >> 2) * 256 + (x >> 2)], g = 190 + v * 34, i = (y * size + x) * 4;
    img.data[i] = g + 6; img.data[i + 1] = g; img.data[i + 2] = g - 10; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const r = rng(202);
  const tones = [['#ece8df', 30], ['#8c8a86', 20], ['#3b3a3b', 15], ['#1f1f21', 8], ['#96705a', 12], ['#b07f70', 7], ['#c8b28a', 8]];
  const total = tones.reduce((s, t) => s + t[1], 0);
  const pickTone = () => { let k = r() * total; for (const [col, w] of tones) { k -= w; if (k <= 0) return col; } return tones[0][0]; };
  for (let i = 0; i < 9500; i++) {
    const cx = r() * size, cy = r() * size, rad = 1.6 + r() ** 2.4 * 9, n = 5 + ((r() * 3) | 0), rot0 = r() * 6.28;
    ctx.fillStyle = pickTone();
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      if ((ox && cx > rad * 2 && cx < size - rad * 2) || (oy && cy > rad * 2 && cy < size - rad * 2)) continue;
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const a = rot0 + (k / n) * 6.283, rr = rad * (0.6 + r() * 0.5);
        ctx[k ? 'lineTo' : 'moveTo'](cx + ox + Math.cos(a) * rr, cy + oy + Math.sin(a) * rr * 0.8);
      }
      ctx.fill();
    }
  }
  const rc = document.createElement('canvas');
  rc.width = rc.height = 128;
  const rctx = rc.getContext('2d');
  rctx.fillStyle = '#2e2e2e'; rctx.fillRect(0, 0, 128, 128);
  granitoCache = { map: c, rough: rc };
  return granitoCache;
}

// ---- texture sets (cached; bounded by evicting sets no recent build used) ------------------------
const sets = new Map();
const keyOf = (s) => `${s.id}:${s.pattern}:${s.size}`;
export const usesLegacyTexture = (spec) => spec.id === 'cemento';

export function floorTexSet(specIn, epoch = 0) {
  const spec = normalizeFloor({ floor: specIn.id ?? specIn.floor, floorPattern: specIn.pattern ?? specIn.floorPattern, tileSize: specIn.size ?? specIn.tileSize });
  const key = keyOf(spec);
  let s = sets.get(key);
  if (!s) {
    s = { tex: spec.id === 'granito' ? buildGranito() : buildSet(spec), used: epoch };
    sets.set(key, s);
    if (sets.size > 14) {
      for (const [k, v] of sets) {
        if (v.used < epoch - 6 && k !== key) {
          for (const t of Object.values(v.tex.maps)) t.dispose();
          sets.delete(k);
        }
      }
    }
  }
  s.used = epoch;
  return s.tex;
}

function buildGranito() {
  const { map, rough } = granitoMaps();
  const m = makeTexture(map), rg = makeTexture(rough, { srgb: false });
  for (const t of [m, rg]) t.repeat.set(1 / 1.2, 1 / 1.2);
  return { maps: { map: m, roughnessMap: rg }, period: [1.2, 1.2] };
}

function buildSet(spec) {
  const layout = layoutFor(spec);
  const sx = pxFor(layout.Px), sy = pxFor(layout.Py);
  const mpp = layout.Px / sx;
  const paint = makePainter(spec, layout, mpp);
  const c = document.createElement('canvas'), rc = document.createElement('canvas');
  c.width = rc.width = sx; c.height = rc.height = sy;
  const ctx = c.getContext('2d'), rctx = rc.getContext('2d');
  const img = ctx.createImageData(sx, sy), rimg = rctx.createImageData(sx, sy);
  const hf = new Float32Array(sx * sy), out = {};
  for (let py = 0; py < sy; py++) {
    for (let px = 0; px < sx; px++) {
      paint(((px + 0.5) / sx) * layout.Px, ((py + 0.5) / sy) * layout.Py, out);
      const i = py * sx + px, j = i * 4, g = out.rough * 255;
      img.data[j] = out.r; img.data[j + 1] = out.g; img.data[j + 2] = out.b; img.data[j + 3] = 255;
      rimg.data[j] = rimg.data[j + 1] = rimg.data[j + 2] = g; rimg.data[j + 3] = 255;
      hf[i] = out.h;
    }
  }
  ctx.putImageData(img, 0, 0);
  rctx.putImageData(rimg, 0, 0);
  const maps = {
    map: makeTexture(c),
    normalMap: makeTexture(normalCanvas(hf, sx, sy, spec.kind === 'wood' ? 2 : 2.2), { srgb: false }),
    roughnessMap: makeTexture(rc, { srgb: false }),
  };
  for (const t of Object.values(maps)) t.repeat.set(1 / layout.Px, 1 / layout.Py);
  return { maps, period: [layout.Px, layout.Py] };
}

// ---- swatches for the UI -----------------------------------------------------------------------
const swatches = new Map();
const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const srgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

// spec: { id | floor, tone | floorTone, pattern | floorPattern, size | tileSize }; returns a PNG data URL.
export function floorSwatch(specIn = {}, px = 96) {
  const spec = normalizeFloor({
    floor: specIn.id ?? specIn.floor, floorTone: specIn.tone ?? specIn.floorTone,
    floorPattern: specIn.pattern ?? specIn.floorPattern, tileSize: specIn.size ?? specIn.tileSize,
  });
  px = Math.max(16, Math.min(512, Math.round(px)));
  const key = `${spec.id}:${spec.tone}:${spec.pattern}:${spec.size}:${px}`;
  if (swatches.has(key)) return swatches.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d'), img = ctx.createImageData(px, px);
  const tint = toneTint(spec.kind, spec.tone);
  // Window onto the floor: about three tiles / a handful of planks across.
  let span = 1.2, x0 = 0.15, y0 = 0.15;
  if (spec.kind === 'tile') span = Math.max(0.9, tileDims(spec.size).w * (spec.size === '120x60' ? 2 : 3));
  if (spec.pattern === 'espiga') span = 0.84;
  if (spec.id === 'granito') span = 0.5;
  const put = (j, r, g, b) => {
    img.data[j] = clamp01(srgb(clamp01(lin(r / 255) * tint[0]))) * 255;
    img.data[j + 1] = clamp01(srgb(clamp01(lin(g / 255) * tint[1]))) * 255;
    img.data[j + 2] = clamp01(srgb(clamp01(lin(b / 255) * tint[2]))) * 255;
    img.data[j + 3] = 255;
  };
  if (spec.id === 'cemento' || spec.id === 'granito') {
    const src = spec.id === 'cemento' ? T.polished().map.image : granitoMaps().map;
    const sw = src.width, win = Math.round(sw * (spec.id === 'cemento' ? 1.2 / 3 : span / 1.2));
    ctx.drawImage(src, 0, 0, win, win, 0, 0, px, px);
    const d = ctx.getImageData(0, 0, px, px);
    for (let j = 0; j < d.data.length; j += 4) put(j, d.data[j], d.data[j + 1], d.data[j + 2]);
  } else {
    const layout = layoutFor(spec), paint = makePainter(spec, layout, span / px), out = {};
    for (let py = 0; py < px; py++) for (let qx = 0; qx < px; qx++) {
      paint(x0 + ((qx + 0.5) / px) * span, y0 + ((py + 0.5) / px) * span, out);
      put((py * px + qx) * 4, out.r, out.g, out.b);
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = c.toDataURL('image/png');
  swatches.set(key, url);
  return url;
}

// Re-exported for callers that only know the list.
export { FLOORS };
