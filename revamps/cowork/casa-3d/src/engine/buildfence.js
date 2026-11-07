// Custom lot fences for build mode: block, rejas, madera, malla, piedra, with columns, caps and gates.
// Coordinates are lot-local. `groundY(x, z)` lets a fence follow the terrain (the lot itself is flat today).
import { CylinderGeometry } from 'three';
import { mat4 } from './builder.js';

export function buildFences(B, mats, fences, { groundY = () => 0 } = {}) {
  const segments = [];
  const iron = { material: mats.plain('#2a2a2a', { roughness: 0.45, metalness: 0.6 }), part: 'fence' };
  const steel = { material: mats.plain('#9aa0a6', { roughness: 0.4, metalness: 0.8 }), part: 'fence' };
  for (const f of fences) {
    const len = Math.hypot(f.x1 - f.x0, f.z1 - f.z0);
    if (len < 0.3) continue;
    const dx = (f.x1 - f.x0) / len, dz = (f.z1 - f.z0) / len;
    const ry = Math.atan2(-dz, dx);
    const gy = groundY(f.x0, f.z0);
    const Mx = mat4(f.x0, gy, f.z0, ry);
    const H = f.h;
    const paint = { material: mats.paint(f.color, 'smooth', { grime: true }), part: 'fence' };
    const paintCap = { material: mats.paint(f.color), part: 'fence' };
    const wood = { material: mats.textured('wood', f.color, { roughness: 0.8 }), part: 'fence' };
    const stone = { material: mats.textured('stone', f.color, { roughness: 0.95, normalScale: 1.2 }), part: 'fence' };
    const stoneCap = { material: mats.textured('stone', '#d9d3c7', { roughness: 0.9 }), part: 'fence' };
    const mesh = { material: mats.chainlink(), part: 'fence' };
    const k = `fence:${f.type}:${f.color}`;
    const gates = f.gates ?? (f.gate ? [f.gate] : []);
    const pieces = [];
    let cursor = 0;
    for (const g of gates) { pieces.push([cursor, g.at - g.w / 2]); cursor = g.at + g.w / 2; }
    pieces.push([cursor, len]);
    const type = f.type;

    // column at position x along the fence
    const column = (x, extra = 0) => {
      if (type === 'madera') {
        B.box(`${k}:post`, wood, 0.11, H + 0.08 + extra, 0.11, x, (H + 0.08 + extra) / 2, 0, Mx);
        B.box(`${k}:postcap`, wood, 0.15, 0.04, 0.15, x, H + 0.1 + extra, 0, Mx);
      } else if (type === 'malla') {
        B.geo(`${k}:post`, steel, new CylinderGeometry(0.035, 0.04, H + 0.1, 10), x, (H + 0.1) / 2, 0, Mx);
        B.geo(`${k}:post`, steel, new CylinderGeometry(0.045, 0.045, 0.04, 10), x, H + 0.12, 0, Mx);
      } else if (type === 'piedra') {
        B.box(`${k}:col`, stone, 0.55, H + 0.3 + extra, 0.55, x, (H + 0.3 + extra) / 2, 0, Mx);
        B.box(`${k}:colcap`, stoneCap, 0.66, 0.1, 0.66, x, H + 0.35 + extra, 0, Mx);
        B.box(`${k}:colcap`, stoneCap, 0.5, 0.06, 0.5, x, H + 0.43 + extra, 0, Mx);
      } else {
        B.box(`${k}:col`, paint, 0.38, H + 0.15 + extra, 0.38, x, (H + 0.15 + extra) / 2, 0, Mx);
        B.box(`${k}:colband`, paintCap, 0.44, 0.07, 0.44, x, H - 0.1, 0, Mx);
        B.box(`${k}:colcap`, paintCap, 0.48, 0.08, 0.48, x, H + 0.19 + extra, 0, Mx);
        B.box(`${k}:colcap`, paintCap, 0.34, 0.05, 0.34, x, H + 0.255 + extra, 0, Mx);
      }
    };

    const panel = (a, b) => {
      const pl = b - a, cx = (a + b) / 2;
      if (pl < 0.04) return;
      segments.push({ a: [f.x0 + dx * a, f.z0 + dz * a], b: [f.x0 + dx * b, f.z0 + dz * b] });
      if (type === 'block') {
        B.box(`${k}:wall`, paint, pl, H, 0.2, cx, H / 2, 0, Mx);
        B.box(`${k}:plinth`, paintCap, pl, 0.2, 0.23, cx, 0.1, 0, Mx);
        B.box(`${k}:band`, paintCap, pl, 0.07, 0.215, cx, H * 0.78, 0, Mx);
        B.box(`${k}:cap`, paintCap, pl + 0.04, 0.06, 0.28, cx, H + 0.03, 0, Mx);
      } else if (type === 'piedra') {
        B.box(`${k}:wall`, stone, pl, H, 0.36, cx, H / 2, 0, Mx);
        B.box(`${k}:cap`, stoneCap, pl + 0.05, 0.08, 0.46, cx, H + 0.04, 0, Mx);
      } else if (type === 'rejas') {
        const low = Math.min(0.6, H * 0.35);
        B.box(`${k}:wall`, paint, pl, low, 0.2, cx, low / 2, 0, Mx);
        B.box(`${k}:cap`, paintCap, pl + 0.04, 0.06, 0.28, cx, low + 0.03, 0, Mx);
        const n = Math.max(2, Math.floor(pl / 0.14));
        for (let i = 0; i <= n; i++) {
          const x = a + (i * pl) / n;
          B.box(`${k}:bars`, iron, 0.025, H - low - 0.06, 0.025, x, low + 0.06 + (H - low - 0.06) / 2, 0, Mx);
          B.cyl(`${k}:tips`, iron, 0, 0.022, 0.1, x, H + 0.03, 0, Mx, 4);
        }
        B.box(`${k}:rail`, iron, pl, 0.04, 0.04, cx, H - 0.06, 0, Mx);
        B.box(`${k}:rail`, iron, pl, 0.04, 0.04, cx, low + 0.1, 0, Mx);
        // scroll rings between the rails
        for (let i = 0; i < Math.floor(pl / 0.7); i++) B.geo(`${k}:ring`, iron, new CylinderGeometry(0.07, 0.07, 0.018, 12), a + (i + 0.5) * (pl / Math.floor(pl / 0.7)), (H + low) / 2 + 0.05, 0, Mx, 0, Math.PI / 2);
      } else if (type === 'madera') {
        const n = Math.floor(pl / 0.125);
        for (let i = 0; i < n; i++) {
          const x = a + ((i + 0.5) * pl) / n;
          const hh = H * (1 - 0.03 * ((i * 7) % 3 === 0 ? 1 : 0));
          B.box(`${k}:picket`, wood, Math.min(0.09, pl / n - 0.02), hh, 0.022, x, 0.08 + hh / 2, 0.035, Mx);
        }
        for (const y of [H * 0.22, H * 0.74]) B.box(`${k}:rail`, wood, pl, 0.07, 0.04, cx, y, 0, Mx);
      } else if (type === 'malla') {
        B.box(`${k}:curb`, { material: mats.textured('concrete', '#d7d3cc'), part: 'fence' }, pl, 0.16, 0.12, cx, 0.08, 0, Mx);
        B.box(`${k}:mesh`, mesh, pl, H - 0.2, 0.012, cx, 0.16 + (H - 0.2) / 2, 0, Mx);
        B.geo(`${k}:toprail`, steel, new CylinderGeometry(0.02, 0.02, pl, 8), cx, H + 0.02, 0, Mx, 0, 0, Math.PI / 2);
        B.geo(`${k}:toprail`, steel, new CylinderGeometry(0.012, 0.012, pl, 6), cx, 0.2, 0, Mx, 0, 0, Math.PI / 2);
      }
      // columns: at both ends and every ~3 m (posts every ~2.2 m for wood / 2.5 m for mesh)
      const spacing = type === 'madera' ? 2.2 : type === 'malla' ? 2.5 : 3.0;
      const np = Math.max(1, Math.round(pl / spacing));
      for (let i = 0; i <= np; i++) column(a + (i * pl) / np);
    };
    for (const [a, b] of pieces) panel(a, b);

    // Gates between posts.
    for (const gate of gates) {
      const gw = gate.w - 0.12, gc = gate.at;
      const leafH = Math.min(H - 0.08, 2.1);
      const leaf = (cx, w, hinge) => {
        const white = type === 'madera';
        if (white) {
          const n = Math.floor(w / 0.125);
          for (let i = 0; i < n; i++) B.box(`${k}:gpicket`, wood, Math.min(0.09, w / n - 0.02), leafH, 0.022, cx - w / 2 + ((i + 0.5) * w) / n, 0.1 + leafH / 2, 0.035, Mx);
          for (const y of [leafH * 0.2, leafH * 0.75]) B.box(`${k}:grail`, wood, w, 0.08, 0.045, cx, y, 0, Mx);
          B.box(`${k}:gbrace`, wood, w * 0.9, 0.06, 0.04, cx, leafH * 0.5, 0, Mx, 0);
        } else {
          B.box(`${k}:gframe`, iron, w, 0.05, 0.05, cx, 0.14, 0, Mx);
          B.box(`${k}:gframe`, iron, w, 0.05, 0.05, cx, 0.14 + leafH - 0.06, 0, Mx);
          B.box(`${k}:gframe`, iron, w, 0.04, 0.04, cx, 0.14 + leafH * 0.55, 0, Mx);
          for (const s of [-1, 1]) B.box(`${k}:gframe`, iron, 0.05, leafH, 0.05, cx + s * (w / 2 - 0.025), 0.14 + leafH / 2 - 0.03, 0, Mx);
          const n = Math.floor(w / 0.12);
          for (let i = 1; i < n; i++) {
            B.box(`${k}:gbars`, iron, 0.022, leafH - 0.1, 0.022, cx - w / 2 + (i * w) / n, 0.14 + leafH / 2 - 0.03, 0, Mx);
            if (type !== 'malla') B.cyl(`${k}:gtips`, iron, 0, 0.02, 0.09, cx - w / 2 + (i * w) / n, 0.14 + leafH - 0.01, 0, Mx, 4);
          }
          if (type === 'malla') B.box(`${k}:gmesh`, mesh, w - 0.1, leafH - 0.2, 0.012, cx, 0.14 + leafH / 2, 0, Mx);
        }
        // hinges + latch on the free side
        for (const y of [0.3, leafH - 0.1]) B.box(`${k}:hinge`, iron, 0.06, 0.05, 0.07, cx + hinge * (w / 2 - 0.02), y, 0, Mx);
        B.box(`${k}:latch`, iron, 0.08, 0.04, 0.06, cx - hinge * (w / 2 - 0.05), 1.0, 0.045, Mx);
      };
      if (gate.kind === 'vehicular') {
        const half = gw / 2;
        leaf(gc - half / 2 - 0.005, half - 0.01, -1);
        leaf(gc + half / 2 + 0.005, half - 0.01, 1);
        // ground track + stop
        B.box(`${k}:track`, iron, gw, 0.02, 0.05, gc, 0.01, 0, Mx);
        B.box(`${k}:stop`, iron, 0.04, 0.12, 0.04, gc, 0.06, 0, Mx);
      } else leaf(gc, gw, 1);
    }
  }
  void mat4;
  return { segments };
}
