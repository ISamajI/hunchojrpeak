// Indoor furniture. A small "kit" draws rounded, real-looking pieces into a
// builder; house.js uses the same pieces for built-in furniture, and
// buildIndoorItem() wraps them as movable items (`indoor:<id>`).
import { Shape, ExtrudeGeometry, ShapeGeometry, BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry, LatheGeometry, Vector2, Matrix4, DoubleSide } from 'three';

import { createBuilder, mat4, roundedBox } from './builder.js';
import { rng } from './textures.js';
import { woodHex } from './materials.js';
import { FLOOR_T } from './layout.js';

// ---- kit -------------------------------------------------------------------------
// Draws into builder `B` in frame `M`; `S[slot]` = { material, part } per material slot.
// Bucket keys are prefixed so they never clash with the house's own buckets.
export function kit(B, S, M = new Matrix4(), prefix = 'k:') {
  const at = (x, y, z, ry = 0, rx = 0, rz = 0) => M.clone().multiply(mat4(x, y, z, ry, rx, rz));
  const opt = (k) => S[k] ?? S.wood;
  const K = {
    M, S,
    box(k, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) {
      B.geo(prefix + k, opt(k), new BoxGeometry(w, h, d), x, y, z, M, ry, rx, rz);
    },
    // Rounded box; r = edge radius.
    rbox(k, w, h, d, r, x, y, z, ry = 0, rx = 0, rz = 0, seg = 2) {
      const rr = Math.max(0.002, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
      B.geo(prefix + k, opt(k), roundedBox(w, h, d, seg, rr), x, y, z, M, ry, rx, rz);
    },
    cyl(k, rt, rb, h, x, y, z, seg = 12, rx = 0, rz = 0, open = false) {
      B.geo(prefix + k, opt(k), new CylinderGeometry(rt, rb, h, seg, 1, open), x, y, z, M, 0, rx, rz);
    },
    geo(k, g, x, y, z, ry = 0, rx = 0, rz = 0) { B.geo(prefix + k, opt(k), g, x, y, z, M, ry, rx, rz); },
    // A straight round bar between two local points (rails, legs at an angle).
    bar(k, a, b, r = 0.015, seg = 8) {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const len = Math.hypot(dx, dy, dz);
      const m = new Matrix4().lookAt({ x: 0, y: 0, z: 0 }, { x: dx, y: dy, z: dz }, { x: 0, y: 1, z: 0 });
      const g = new CylinderGeometry(r, r, len, seg);
      g.rotateX(Math.PI / 2);
      g.applyMatrix4(m);
      B.geo(prefix + k, opt(k), g, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, M);
    },
    // Sub-kit placed at x,y,z with yaw ry, in this kit's frame.
    at(x, y, z, ry = 0) { return kit(B, S, at(x, y, z, ry), prefix); },
  };
  return K;
}

// ---- pieces (origin = floor under the piece's center, front faces +z) ------------

export function sofa(K, w = 2.1, { pillows = true } = {}) {
  const d = 0.92, arm = 0.2, legH = 0.07;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.cyl('wood', 0.022, 0.016, legH, sx * (w / 2 - 0.08), legH / 2, sz * (d / 2 - 0.08), 8);
  K.rbox('sofa', w, 0.24, d, 0.04, 0, legH + 0.12, 0);
  for (const sx of [-1, 1]) K.rbox('sofa', arm, 0.4, d, 0.08, sx * (w / 2 - arm / 2), legH + 0.2 + 0.08, 0);
  K.rbox('sofa', w - 0.04, 0.46, 0.2, 0.08, 0, legH + 0.24 + 0.2, -d / 2 + 0.1);
  const inner = w - 2 * arm, n = inner > 1.5 ? 3 : 2, cw = inner / n;
  for (let i = 0; i < n; i++) {
    const x = -inner / 2 + cw * (i + 0.5);
    K.rbox('sofa', cw - 0.015, 0.15, d - 0.26, 0.06, x, legH + 0.24 + 0.075, 0.08);
    K.rbox('sofa', cw - 0.03, 0.42, 0.17, 0.08, x, legH + 0.24 + 0.15 + 0.2, -d / 2 + 0.27, 0, -0.14);
  }
  if (pillows) for (const sx of [-1, 1]) K.rbox('accent', 0.4, 0.38, 0.12, 0.07, sx * (inner / 2 - 0.25), legH + 0.24 + 0.15 + 0.2, -d / 2 + 0.42, sx * 0.15, -0.3);
}

export function armchair(K) {
  const w = 0.82, d = 0.82, legH = 0.12;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.cyl('wood', 0.022, 0.014, legH + 0.02, sx * (w / 2 - 0.09), legH / 2, sz * (d / 2 - 0.09), 8, sz * 0.12, -sx * 0.12);
  K.rbox('sofa', w, 0.2, d, 0.05, 0, legH + 0.1, 0);
  for (const sx of [-1, 1]) K.rbox('sofa', 0.15, 0.32, d - 0.02, 0.07, sx * (w / 2 - 0.075), legH + 0.2 + 0.12, 0.01);
  K.rbox('sofa', w - 0.02, 0.52, 0.17, 0.08, 0, legH + 0.2 + 0.24, -d / 2 + 0.085, 0, -0.1);
  K.rbox('sofa', w - 0.3, 0.14, d - 0.22, 0.06, 0, legH + 0.2 + 0.07, 0.07);
  K.rbox('accent', 0.38, 0.34, 0.11, 0.07, 0, legH + 0.2 + 0.3, -d / 2 + 0.26, 0.1, -0.25);
}

export function bed(K, bw = 1.5, bl = 2.0, { panels = 3, throwBlanket = true } = {}) {
  const hb = 0.08, z0 = -bl / 2 - hb;
  // Headboard: wood frame with upholstered panels.
  K.rbox('wood', bw + 0.18, 1.08, hb, 0.02, 0, 0.54, z0 + hb / 2);
  const pw = (bw + 0.06) / panels;
  for (let i = 0; i < panels; i++) K.rbox('sofa', pw - 0.05, 0.5, 0.05, 0.03, -bw / 2 - 0.03 + pw * (i + 0.5), 0.74, z0 + hb + 0.012);
  // Base on short legs, mattress, duvet draped over the foot two-thirds.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.cyl('wood', 0.03, 0.025, 0.1, sx * (bw / 2 - 0.05), 0.05, sz * (bl / 2 - 0.08), 8);
  K.rbox('wood', bw + 0.06, 0.22, bl, 0.02, 0, 0.21, 0);
  K.rbox('linen', bw, 0.22, bl - 0.04, 0.06, 0, 0.43, 0);
  const dl = bl * 0.66;
  K.rbox('blanket', bw + 0.07, 0.3, dl, 0.05, 0, 0.42, bl / 2 - dl / 2 + 0.02);
  if (throwBlanket) K.rbox('accent', bw + 0.1, 0.05, 0.38, 0.02, 0, 0.58, bl / 2 - 0.32);
  const np = bw > 1.2 ? 2 : 1, pwid = Math.min(0.66, bw / np - 0.08);
  for (let i = 0; i < np; i++) K.rbox('pillow', pwid, 0.13, 0.44, 0.045, -bw / 2 + (bw / np) * (i + 0.5), 0.61, -bl / 2 + 0.29, 0, -0.32, 0, 3);
}

export function nightstand(K, { lamp = true } = {}) {
  K.rbox('wood', 0.46, 0.5, 0.4, 0.015, 0, 0.3, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.cyl('wood', 0.018, 0.014, 0.05, sx * 0.19, 0.025, sz * 0.16, 6);
  for (const y of [0.22, 0.42]) { K.box('wood', 0.42, 0.16, 0.012, 0, y, 0.2); K.box('metal', 0.1, 0.012, 0.015, 0, y, 0.21); }
  if (lamp) tableLamp(K.at(0.04, 0.55, -0.02));
}

export function tableLamp(K) {
  K.cyl('porcelain', 0.035, 0.065, 0.22, 0, 0.11, 0, 14);
  K.cyl('metal', 0.008, 0.008, 0.08, 0, 0.26, 0, 6);
  K.cyl('shade', 0.1, 0.14, 0.18, 0, 0.36, 0, 18, 0, 0, true);
  K.geo('bulb', new SphereGeometry(0.035, 10, 8), 0, 0.33, 0);
}

export function coffeeTable(K, w = 1.1, d = 0.6) {
  K.rbox('wood', w, 0.045, d, 0.018, 0, 0.42, 0);
  K.rbox('wood', w - 0.12, 0.025, d - 0.1, 0.01, 0, 0.13, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.cyl('wood', 0.022, 0.016, 0.4, sx * (w / 2 - 0.07), 0.2, sz * (d / 2 - 0.07), 8);
  // A couple of books and a bowl so it reads as lived-in.
  K.rbox('book1', 0.28, 0.035, 0.2, 0.004, -w / 4, 0.46, 0, 0.2);
  K.rbox('book2', 0.24, 0.03, 0.18, 0.004, -w / 4, 0.49, 0, 0.35);
  K.geo('porcelain', new SphereGeometry(0.11, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), w / 5, 0.55, 0);
}

export function chair(K, { cushion = true } = {}) {
  const s = 0.44, seatY = 0.46;
  for (const sx of [-1, 1]) {
    K.cyl('wood', 0.018, 0.015, seatY, sx * (s / 2 - 0.03), seatY / 2, s / 2 - 0.03, 8);
    // Back legs run up into the back posts, raked slightly.
    K.bar('wood', [sx * (s / 2 - 0.03), 0, -s / 2 + 0.03], [sx * (s / 2 - 0.03), 0.95, -s / 2 - 0.02], 0.018);
  }
  K.rbox('wood', s, 0.04, s, 0.012, 0, seatY, 0);
  if (cushion) K.rbox('sofa', s - 0.04, 0.05, s - 0.05, 0.02, 0, seatY + 0.045, 0.01);
  for (const y of [0.68, 0.86]) K.rbox('wood', s - 0.04, y > 0.8 ? 0.1 : 0.04, 0.025, 0.01, 0, y, -s / 2 - 0.002 + (y - seatY) * -0.055);
}

export function diningTable(K, w = 1.6, d = 0.9) {
  K.rbox('wood', w, 0.045, d, 0.02, 0, 0.75, 0);
  K.rbox('wood', w - 0.14, 0.08, d - 0.14, 0.01, 0, 0.69, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.cyl('wood', 0.03, 0.022, 0.71, sx * (w / 2 - 0.09), 0.355, sz * (d / 2 - 0.09), 10);
  // Runner + fruit bowl.
  K.box('accent', Math.min(1.1, w * 0.6), 0.004, 0.32, 0, 0.775, 0);
  K.geo('porcelain', new SphereGeometry(0.15, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0, 0.92, 0);
  for (let i = 0; i < 4; i++) K.geo(i % 2 ? 'fruit2' : 'fruit1', new SphereGeometry(0.045, 10, 8), Math.cos(i * 1.7) * 0.06, 0.82, Math.sin(i * 1.7) * 0.06);
}

export function pendant(K, drop = 0.7) {
  K.cyl('metal', 0.004, 0.004, drop, 0, -drop / 2, 0, 4);
  K.geo('shadeOut', new SphereGeometry(0.2, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), 0, -drop - 0.02, 0);
  K.geo('bulb', new SphereGeometry(0.05, 10, 8), 0, -drop - 0.04, 0);
}

// Flush ceiling light (origin at the ceiling).
export function ceilingLight(K, r = 0.17) {
  K.cyl('casing', r + 0.02, r + 0.02, 0.015, 0, -0.008, 0, 20);
  K.geo('bulb', new SphereGeometry(r, 20, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, 0.3, 1), 0, -0.012, 0);
}

export function tvUnit(K, w = 1.6, { tv = 1.25 } = {}) {
  const h = 0.48, d = 0.42, legH = 0.12;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.cyl('metal', 0.012, 0.01, legH, sx * (w / 2 - 0.06), legH / 2, sz * (d / 2 - 0.06), 6);
  K.rbox('wood', w, h, d, 0.015, 0, legH + h / 2, 0);
  const n = w > 1.4 ? 3 : 2, dw = w / n;
  for (let i = 0; i < n; i++) {
    K.box('wood', dw - 0.012, h - 0.04, 0.012, -w / 2 + dw * (i + 0.5), legH + h / 2, d / 2 + 0.004);
    K.box('metal', 0.012, 0.12, 0.015, -w / 2 + dw * (i + 0.5) + dw / 2 - 0.06, legH + h / 2, d / 2 + 0.014);
  }
  if (!tv) return;
  const tw = tv, th = tv * 0.58, ty = legH + h + 0.07 + th / 2;
  K.rbox('black', tw, th, 0.04, 0.008, 0, ty, -0.02);
  K.box('screen', tw - 0.03, th - 0.03, 0.004, 0, ty, 0.0);
  K.box('black', 0.3, 0.012, 0.2, 0, legH + h + 0.008, -0.02);
  K.box('black', 0.05, 0.08, 0.03, 0, legH + h + 0.05, -0.04);
  // Speaker bar.
  K.rbox('black', Math.min(0.9, tw * 0.7), 0.06, 0.08, 0.025, 0, legH + h + 0.03, 0.12);
}

export function bookshelf(K, w = 0.9, h = 1.85, d = 0.32, seed = 7) {
  const r = rng(seed);
  const t = 0.022;
  for (const sx of [-1, 1]) K.box('wood', t, h, d, sx * (w / 2 - t / 2), h / 2, 0);
  K.box('wood', w, t, d, 0, h - t / 2, 0);
  K.box('wood', w - 2 * t, 0.08, d - 0.02, 0, 0.04, 0.01);
  K.box('wood', w - 2 * t, h - 0.08, 0.01, 0, h / 2, -d / 2 + 0.005);
  const shelves = Math.max(3, Math.round((h - 0.1) / 0.36));
  const sh = (h - 0.08 - t) / shelves;
  for (let s = 0; s < shelves; s++) {
    const y = 0.08 + s * sh;
    if (s > 0) K.box('wood', w - 2 * t, t, d - 0.02, 0, y, 0.005);
    // Books of varied colors/heights; sometimes a short stack lying flat.
    let x = -w / 2 + t + 0.02;
    const end = w / 2 - t - 0.02;
    while (x < end - 0.03) {
      if (r() < 0.12 && end - x > 0.24) {
        for (let k = 0; k < 3; k++) K.box(`book${(r() * 6) | 0}`, 0.22, 0.035, 0.17, x + 0.11, y + t / 2 + 0.018 + k * 0.036, 0.0, r() * 0.2 - 0.1);
        x += 0.26;
        continue;
      }
      if (r() < 0.08 && end - x > 0.14) {
        K.geo('porcelain', new CylinderGeometry(0.04, 0.05, 0.16, 12), x + 0.06, y + t / 2 + 0.08, 0);
        x += 0.13;
        continue;
      }
      const bwid = 0.022 + r() * 0.028, bh = Math.min(sh - 0.05, 0.19 + r() * 0.12), bd = 0.17 + r() * 0.06;
      const lean = end - x < 0.08 && r() < 0.6 ? 0.18 : 0;
      K.box(`book${(r() * 6) | 0}`, bwid, bh, bd, x + bwid / 2, y + t / 2 + bh / 2, d / 2 - 0.02 - bd / 2, 0, 0, -lean);
      x += bwid + 0.002;
    }
  }
}

export function sideTable(K) {
  K.cyl('wood', 0.26, 0.26, 0.028, 0, 0.57, 0, 28);
  K.cyl('wood', 0.2, 0.2, 0.02, 0, 0.2, 0, 24);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    K.bar('wood', [Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24], [Math.cos(a) * 0.16, 0.56, Math.sin(a) * 0.16], 0.016);
  }
  K.geo('porcelain', new LatheGeometry([[0, 0], [0.05, 0], [0.065, 0.05], [0.04, 0.14], [0.03, 0.18], [0.035, 0.2]].map(([x, y]) => new Vector2(x, y)), 14), 0.08, 0.584, 0.02);
  K.rbox('book3', 0.2, 0.03, 0.15, 0.004, -0.06, 0.6, -0.04, 0.4);
}

export function floorLamp(K) {
  K.cyl('metal', 0.15, 0.17, 0.03, 0, 0.015, 0, 24);
  K.cyl('metal', 0.012, 0.012, 1.42, 0, 0.74, 0, 8);
  K.cyl('shade', 0.17, 0.23, 0.32, 0, 1.5, 0, 24, 0, 0, true);
  K.cyl('metal', 0.005, 0.005, 0.22, 0, 1.5, 0, 4, Math.PI / 2);
  K.geo('bulb', new SphereGeometry(0.05, 12, 8), 0, 1.43, 0);
}

export function plant(K, s = 1, seed = 3) {
  const r = rng(seed);
  // Glazed pot with a rolled rim, soil, then three tiers of arching leaves.
  K.geo('pot', new LatheGeometry([[0, 0], [0.15, 0], [0.17, 0.03], [0.2, 0.34], [0.225, 0.36], [0.225, 0.39], [0.19, 0.39], [0.185, 0.36]].map(([x, y]) => new Vector2(x * s, y * s)), 20), 0, 0, 0);
  K.cyl('soil', 0.186 * s, 0.186 * s, 0.01, 0, 0.35 * s, 0, 16);
  const leafGeo = (len, wid) => {
    const sh = new Shape();
    sh.moveTo(0, 0);
    sh.quadraticCurveTo(wid * 0.75, len * 0.25, wid * 0.5, len * 0.62);
    sh.quadraticCurveTo(wid * 0.3, len * 0.9, 0, len);
    sh.quadraticCurveTo(-wid * 0.3, len * 0.9, -wid * 0.5, len * 0.62);
    sh.quadraticCurveTo(-wid * 0.75, len * 0.25, 0, 0);
    const g = new ShapeGeometry(sh, 4);
    // Fold at the midrib and arch the tip down.
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), t = y / len;
      p.setXYZ(i, x, y * Math.cos(t * 1.2), Math.abs(x) * 0.3 - y * Math.sin(t * 1.2) * 0.7);
    }
    g.computeVertexNormals();
    return g;
  };
  const tiers = [[7, 0.42, 0.55, 0.15], [6, 0.52, 0.85, 0.45], [5, 0.48, 1.1, 0.8]];
  for (const [n, len, tilt, h] of tiers) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.6 + h * 3;
      const L = (len + r() * 0.12) * s;
      const y = (0.36 + h * 0.5) * s;
      K.bar('stem', [0, 0.36 * s, 0], [Math.cos(a) * 0.04 * s, y, Math.sin(a) * 0.04 * s], 0.008 * s, 5);
      K.geo(i % 3 ? 'leaf' : 'leaf2', leafGeo(L, L * 0.38), Math.cos(a) * 0.04 * s, y, Math.sin(a) * 0.04 * s, -a + Math.PI / 2, -(Math.PI / 2 - tilt - r() * 0.25));
    }
  }
}

export function rockingChair(K) {
  // Two curved rockers (arc of a 1.1 m circle), a cane seat and back, and arms.
  const R = 1.1, a = 0.44, th = 0.045;
  const sh = new Shape();
  sh.absarc(0, R, R, -Math.PI / 2 - a, -Math.PI / 2 + a, false);
  sh.absarc(0, R, R - th, -Math.PI / 2 + a, -Math.PI / 2 - a, true);
  const rocker = new ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: false, curveSegments: 18 });
  rocker.translate(0, 0, -0.0175);
  const W = 0.56;
  for (const sx of [-1, 1]) K.geo('wood', rocker.clone(), sx * (W / 2 - 0.02), 0, 0, Math.PI / 2);
  rocker.dispose();
  const seatY = 0.44, zF = 0.2, zB = -0.22;
  const ground = (z) => R - Math.sqrt(R * R - z * z) + th * 0.5;
  for (const sx of [-1, 1]) {
    const x = sx * (W / 2 - 0.02);
    K.bar('wood', [x, ground(zF), zF], [x, 0.66, zF + 0.02], 0.018);
    K.bar('wood', [x, ground(zB), zB], [x, 1.08, zB - 0.12], 0.02);
    // Arm rest, with a turned spindle under it.
    K.rbox('wood', 0.06, 0.03, 0.5, 0.012, x, 0.66, -0.02);
    K.bar('wood', [x, seatY, -0.02], [x, 0.65, -0.02], 0.012);
  }
  // Seat frame + cane panel.
  K.rbox('wood', W, 0.04, 0.06, 0.01, 0, seatY, zF);
  K.rbox('wood', W, 0.04, 0.06, 0.01, 0, seatY, zB + 0.02);
  for (const sx of [-1, 1]) K.rbox('wood', 0.05, 0.04, zF - zB, 0.01, sx * (W / 2 - 0.02), seatY, (zF + zB) / 2);
  K.box('rattan', W - 0.08, 0.012, zF - zB - 0.06, 0, seatY + 0.005, (zF + zB) / 2 + 0.01);
  // Back: two rails and a cane panel raked back.
  const backM = (y) => [0, y, zB - 0.02 - (y - seatY) * 0.19];
  for (const y of [0.56, 1.02]) K.rbox('wood', W - 0.04, 0.05, 0.03, 0.01, ...backM(y), 0, -0.19);
  K.box('rattan', W - 0.1, 0.4, 0.01, ...backM(0.79), 0, -0.19);
  // Stretchers between the rockers.
  for (const z of [zF - 0.05, zB + 0.06]) K.bar('wood', [-(W / 2 - 0.02), ground(z) + 0.12, z], [W / 2 - 0.02, ground(z) + 0.12, z], 0.012);
}

export function desk(K, w = 1.2) {
  K.rbox('wood', w, 0.035, 0.6, 0.01, 0, 0.74, 0);
  for (const sx of [-1, 1]) K.box('metal', 0.04, 0.72, 0.55, sx * (w / 2 - 0.04), 0.36, 0);
  K.box('metal', w - 0.1, 0.04, 0.02, 0, 0.6, -0.25);
  // Laptop + mug.
  K.box('black', 0.34, 0.015, 0.24, 0, 0.765, 0.05);
  K.box('black', 0.34, 0.22, 0.01, 0, 0.87, -0.07, 0, -0.25);
  K.cyl('porcelain', 0.04, 0.04, 0.1, w / 2 - 0.2, 0.81, 0.1, 12);
}

export function officeChair(K) {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    K.bar('black', [0, 0.07, 0], [Math.cos(a) * 0.3, 0.04, Math.sin(a) * 0.3], 0.015, 6);
    K.geo('black', new SphereGeometry(0.025, 8, 6), Math.cos(a) * 0.3, 0.025, Math.sin(a) * 0.3);
  }
  K.cyl('metal', 0.025, 0.025, 0.38, 0, 0.26, 0, 8);
  K.rbox('sofa', 0.5, 0.08, 0.48, 0.035, 0, 0.47, 0);
  K.rbox('sofa', 0.46, 0.5, 0.07, 0.035, 0, 0.84, -0.25, 0, -0.08);
  K.box('black', 0.05, 0.3, 0.03, 0, 0.58, -0.24);
}

export function rug(K, w, d, k = 'rug') {
  K.rbox(k, w, 0.012, d, 0.005, 0, 0.006, 0);
}

// ---- material slots ---------------------------------------------------------------
// Book / fruit colors that read well in both warm and cool rooms.
const BOOKS = ['#7b2d26', '#1f4e5f', '#c9a227', '#2f5d3a', '#e8e1d4', '#3b3355'];

export function furnitureSlots(mats, interior = {}, part = (k) => null) {
  const I = interior ?? {};
  const wood = mats.wood(I.wood);
  const sofaM = mats.fabric(I.sofa);
  const s = {
    wood: { material: wood, part: part('wood') },
    sofa: { material: sofaM, part: part('sofa') },
    accent: { material: mats.fabric('#7d8b6a'), part: part('deco') },
    linen: { material: mats.fabric('#f4f1ea'), part: part('deco') },
    pillow: { material: mats.fabric('#fbfaf6'), part: part('deco') },
    blanket: { material: mats.fabric('#d9cbb4'), part: part('deco') },
    metal: { material: mats.plain('#2b2b2b', { roughness: 0.4, metalness: 0.7 }), part: part('deco') },
    steel: { material: mats.plain('#c6cacd', { roughness: 0.28, metalness: 0.85, side: DoubleSide }), part: part('deco') },
    black: { material: mats.plain('#16171a', { roughness: 0.35, metalness: 0.2, side: DoubleSide }), part: part('deco') },
    screen: { material: mats.plain('#07090c', { roughness: 0.08, metalness: 0.4 }), part: part('deco') },
    porcelain: { material: mats.plain('#f6f5f1', { roughness: 0.18, side: DoubleSide }), part: part('deco') },
    shade: { material: mats.bulb('#efe6d4'), part: part('deco'), shadow: false },
    shadeOut: { material: mats.plain('#2f2f2c', { roughness: 0.5, metalness: 0.5, side: DoubleSide }), part: part('deco') },
    bulb: { material: mats.bulb(), part: part('deco'), shadow: false },
    rug: { material: mats.fabric('#cdb89a'), part: part('deco'), shadow: false },
    rattan: { material: mats.textured('rattan', '#ffffff', { roughness: 0.8, side: DoubleSide }), part: part('wood') },
    pot: { material: mats.plain('#d7cfc2', { roughness: 0.35 }), part: part('deco') },
    soil: { material: mats.plain('#3a2a1e', { roughness: 1 }), part: part('deco') },
    stem: { material: mats.plain('#4d6b2f', { roughness: 0.8 }), part: part('deco') },
    leaf: { material: mats.plain('#3f7a34', { roughness: 0.55, side: DoubleSide }), part: part('deco') },
    leaf2: { material: mats.plain('#2e6128', { roughness: 0.55, side: DoubleSide }), part: part('deco') },
    fruit1: { material: mats.plain('#e0a526', { roughness: 0.5 }), part: part('deco') },
    fruit2: { material: mats.plain('#b5361f', { roughness: 0.45 }), part: part('deco') },
    casing: { material: mats.plain('#f7f6f2', { roughness: 0.6 }), part: part('deco') },
  };
  BOOKS.forEach((c, i) => { s[`book${i}`] = { material: mats.plain(c, { roughness: 0.7 }), part: part('deco') }; });
  return s;
}

// ---- movable items ---------------------------------------------------------------
const DRAW = {
  mecedora: (K) => rockingChair(K),
  butaca: (K) => armchair(K),
  planta: (K, seed) => plant(K, 1.25, seed),
  tv: (K) => tvUnit(K, 1.5, { tv: 1.25 }),
  lampara: (K) => floorLamp(K),
  estante: (K, seed) => bookshelf(K, 0.9, 1.85, 0.32, seed),
  mesa: (K) => sideTable(K),
  cama: (K) => { bed(K.at(0, 0, 0.04), 0.95, 1.95, { panels: 2 }); },
};
const RADIUS = { mecedora: 0.45, butaca: 0.5, planta: 0.35, tv: 0.8, lampara: 0.25, estante: 0.5, mesa: 0.3, cama: 1.1 };

// item = { id, type, x, z, rot }; mats = createMaterialSet(); interior = state.interior.
// Returns a Group whose origin is the structural floor (y = P + level * floorHeight);
// contents sit on the finished floor, FLOOR_T above it.
export function buildIndoorItem(item, mats, interior) {
  const draw = DRAW[item?.type];
  if (!draw) return null;
  const tag = `indoor:${item.id}`;
  const B = createBuilder();
  const S = furnitureSlots(mats, interior, () => tag);
  const seed = [...String(item.id)].reduce((s, c) => s * 31 + c.charCodeAt(0), 7) >>> 0;
  draw(kit(B, S, mat4(0, FLOOR_T, 0)), seed);
  const g = B.build();
  g.position.set(+item.x || 0, 0, +item.z || 0);
  g.rotation.y = +item.rot || 0;
  g.userData.part = tag;
  g.userData.radius = RADIUS[item.type] ?? 0.5;
  g.traverse((m) => { m.userData.part = tag; if (m.isMesh) m.receiveShadow = true; });
  const shade = S.shade.material, bulbM = S.bulb.material;
  g.userData.setLit = (on) => {
    bulbM.emissiveIntensity = on ? 3 : 0;
    shade.emissiveIntensity = on ? 1.1 : 0;
  };
  return g;
}

export { woodHex };
