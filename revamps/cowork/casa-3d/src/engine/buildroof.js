// Roofs for build mode, over the top-most slab footprint of each column.
// flat: roof slab + lip + parapet + coping. hip / gable / shed: the roof surface is the upper envelope of
// one hip / gable / shed roof per maximal rectangle of the footprint (overlapping rectangles), so L, T and +
// shapes get real valleys, ridges and hips. Faces are clipped with exact half-plane maths (no sampling).
import { Shape, ExtrudeGeometry, Matrix4, Vector3, TorusGeometry, SphereGeometry, CylinderGeometry } from 'three';
import { mat4 } from './builder.js';
import { slabHasWalls, slabGrid, gridRects, gridEdges, SLAB_T } from './buildmodel.js';

const PITCH = { hip: 24, gable: 26, shed: 10 };
const EPS = 1e-4;

// Sutherland-Hodgman against a x + b z + c >= 0.
function clipHalf(poly, a, b, c) {
  const out = [];
  const ev = (p) => a * p[0] + b * p[1] + c;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const ep = ev(p), eq = ev(q);
    if (ep >= 0) out.push(p);
    if ((ep >= 0) !== (eq >= 0)) { const t = ep / (ep - eq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out.length >= 3 ? out : [];
}
const area2 = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const [x0, z0] = p[i], [x1, z1] = p[(i + 1) % p.length]; a += x0 * z1 - x1 * z0; } return a / 2; };

// poly minus the convex region described by half-planes.
function subtract(poly, hps) {
  const pieces = [];
  let rem = poly;
  for (const [a, b, c] of hps) {
    const outside = clipHalf(rem, -a, -b, -c);
    if (outside.length) pieces.push(outside);
    rem = clipHalf(rem, a, b, c);
    if (!rem.length) break;
  }
  return pieces;
}

// Maximal rectangles (overlapping) that cover a boolean cell grid.
function coverRects(cell, nx, nz, all = false) {
  const cands = [];
  for (let j0 = 0; j0 < nz; j0++) for (let i0 = 0; i0 < nx; i0++) {
    if (!cell(i0, j0)) continue;
    let maxI = nx - 1;
    for (let j1 = j0; j1 < nz; j1++) {
      let i = i0;
      while (i + 1 <= maxI && cell(i + 1, j1)) i++;
      if (!cell(i0, j1)) break;
      maxI = Math.min(maxI, i);
      cands.push({ i0, i1: maxI, j0, j1 });
    }
  }
  // Rectangles can also grow left / up: keep the ones not contained in another.
  const maximal = cands.filter((r, k) => !cands.some((q, m) => m !== k && q.i0 <= r.i0 && q.i1 >= r.i1 && q.j0 <= r.j0 && q.j1 >= r.j1 && (q.i1 - q.i0 > r.i1 - r.i0 || q.j1 - q.j0 > r.j1 - r.j0 || m < k)));
  if (all) return maximal.sort((p, q) => (q.i1 - q.i0 + 1) * (q.j1 - q.j0 + 1) - (p.i1 - p.i0 + 1) * (p.j1 - p.j0 + 1)).slice(0, 12);
  const covered = new Set();
  const out = [];
  const need = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (cell(i, j)) need.push(`${i},${j}`);
  const areaOf = (r) => (r.i1 - r.i0 + 1) * (r.j1 - r.j0 + 1);
  maximal.sort((p, q) => areaOf(q) - areaOf(p));
  for (const r of maximal) {
    let adds = false;
    for (let j = r.j0; j <= r.j1 && !adds; j++) for (let i = r.i0; i <= r.i1; i++) if (!covered.has(`${i},${j}`)) { adds = true; break; }
    if (!adds) continue;
    out.push(r);
    for (let j = r.j0; j <= r.j1; j++) for (let i = r.i0; i <= r.i1; i++) covered.add(`${i},${j}`);
    if (covered.size >= need.length) break;
  }
  return out;
}

export function buildRoof({ b, mats, M, layers, soup, y0Of, FH, C, h, I, railing }) {
  const NL = b.levels.length;
  const roof = b.roof;
  const R = layers.roof, RS = soup('roof');
  const o = roof.overhang;
  const type = roof.type;
  let topMax = y0Of(NL - 1) + FH;

  // Global grid over every level's slabs: topmost level per cell.
  const all = [];
  b.levels.forEach((L, li) => L.slabs.forEach((s) => { if (!s.kind && slabHasWalls(L, s)) all.push({ ...s, level: li }); }));
  const g = slabGrid(all);
  const lvl = new Int8Array(g.nx * g.nz).fill(-1);
  for (let j = 0; j < g.nz; j++) for (let i = 0; i < g.nx; i++) {
    const k = g.at(i, j);
    if (k < 0) continue;
    const cx = (g.X[i] + g.X[i + 1]) / 2, cz = (g.Z[j] + g.Z[j + 1]) / 2;
    let best = -1;
    for (const s of all) if (cx > s.x0 && cx < s.x1 && cz > s.z0 && cz < s.z1) best = Math.max(best, s.level);
    lvl[j * g.nx + i] = best;
  }
  const levelAt = (x, z) => {
    // Level of the cell under a point (house-local), or -1.
    let i = -1, j = -1;
    for (let k = 0; k < g.nx; k++) if (x >= g.X[k] && x < g.X[k + 1]) { i = k; break; }
    for (let k = 0; k < g.nz; k++) if (z >= g.Z[k] && z < g.Z[k + 1]) { j = k; break; }
    return i < 0 || j < 0 ? -1 : lvl[j * g.nx + i];
  };

  const wallMat = { material: mats.paint(C.walls, h.wallFinish === 'block' ? 'block' : 'smooth', { grime: true }), part: 'walls' };
  const flatMat = { material: mats.textured('roofSlab', roof.color, { roughness: 0.9, normalScale: 0.5 }), part: 'roof' };
  const roofMat = { material: mats.roof(roof.material, roof.color), part: 'roof', keepUV: true };
  const capMat = { material: mats.plain(roof.color, { roughness: 0.75 }), part: 'roof' };

  const X = b.extras ?? {};
  const railStyle = ['iron', 'balusters', 'glass', 'concrete'].includes(h.railing) ? h.railing : 'iron';
  const lastWithSlab = all.length ? Math.max(...all.map((q) => q.level)) : -1;
  const mainBox = (rects) => ({ x0: Math.min(...rects.map((r) => r.x0)), x1: Math.max(...rects.map((r) => r.x1)), z0: Math.min(...rects.map((r) => r.z0)), z1: Math.max(...rects.map((r) => r.z1)) });
  const dark = { material: mats.plain('#1d1f21', { roughness: 0.55 }), part: null };
  const panelM = { material: mats.plain('#1b2a4a', { roughness: 0.15, metalness: 0.6 }), part: null };
  function tank(Lr, x, y, z, k = 1) {
    Lr.box('concrete', M.concrete, 1.4 * k, 0.2, 1.4 * k, x, y + 0.1, z);
    Lr.cyl('tank', dark, 0.56 * k, 0.6 * k, 1.25 * k, x, y + 0.2 + 0.625 * k, z, null, 28);
    for (let i = 1; i < 5; i++) Lr.add('tank', new TorusGeometry(0.595 * k, 0.025, 6, 28), mat4(x, y + 0.2 + i * 0.25 * k, z, 0, Math.PI / 2), dark);
    const dome = new SphereGeometry(0.56 * k, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.scale(1, 0.35, 1);
    Lr.add('tank', dome, mat4(x, y + 0.2 + 1.25 * k, z), dark);
    Lr.cyl('tank', dark, 0.18, 0.18, 0.1, x, y + 0.2 + 1.25 * k + 0.22, z, null, 16);
  }
  // Roof extras on the main (top) roof: terrace, pergola, tinaco, solar panels.
  function extrasFlat(bx, yE, rt) {
    const ph = X.roofTerrace ? (railStyle === 'concrete' ? 1.0 : 0.3) : 0.5;
    const cy = yE + rt;
    if (X.roofTerrace) {
      const cw = 2.8, cd = 2.6, ch = 2.4, cx = bx.x0 + 0.3 + cw / 2 + 0.2, cz = bx.z0 + 0.3 + cd / 2 + 0.2;
      R.box('walls', wallMat, cw, ch, cd, cx, cy + ch / 2, cz);
      R.box('trim', M.trim, cw + 0.3, 0.18, cd + 0.3, cx, cy + ch + 0.09, cz);
      R.box('door', M.door, 0.9, 2.05, 0.06, cx + 0.5, cy + 1.03, cz + cd / 2 + 0.02);
      R.box('trim', M.trim, 1.1, 0.1, 0.08, cx + 0.5, cy + 2.1, cz + cd / 2 + 0.03);
    }
    if (X.pergola && X.roofTerrace) {
      const px0 = (bx.x0 + bx.x1) / 2, px1 = bx.x1 - 0.6, pz0 = (bx.z0 + bx.z1) / 2 - 1.5, pz1 = bx.z1 - 0.8;
      if (px1 > px0 + 1 && pz1 > pz0 + 1) {
        for (const [x, z] of [[px0, pz0], [px1, pz0], [px0, pz1], [px1, pz1]]) R.box('accent', M.accent, 0.15, 2.5, 0.15, x, cy + 1.25, z);
        for (let x = px0; x <= px1 + 0.01; x += 0.45) R.box('accent', M.accent, 0.07, 0.2, pz1 - pz0 + 0.4, x, cy + 2.5, (pz0 + pz1) / 2);
      }
    }
    if (X.waterTank) tank(R, bx.x1 - 1.1, cy, bx.z0 + 1.1, 1);
    if (X.solar) {
      const W = bx.x1 - bx.x0, n = Math.max(2, Math.min(5, Math.floor((W - 5) / 1.15)));
      const mx = (bx.x0 + bx.x1) / 2, mz = (bx.z0 + bx.z1) / 2;
      for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) {
        const x = mx + (i - (n - 1) / 2) * 1.15 + 0.8, z = mz - 0.6 - r * 2.0;
        const Mp = mat4(x, cy + 0.49, z, 0, -0.22);
        R.box('solar', panelM, 1.05, 0.04, 1.75, 0, 0, 0, Mp);
        R.box('alu', M.alu, 1.1, 0.03, 0.05, 0, 0, 0.88, Mp);
        R.box('alu', M.alu, 0.04, 0.5, 0.04, x - 0.45, cy + 0.25, z + 0.7);
        R.box('alu', M.alu, 0.04, 0.5, 0.04, x + 0.45, cy + 0.25, z + 0.7);
      }
    }
    return ph;
  }

  for (let L = 0; L < NL; L++) {
    // Cells whose topmost slab is on level L.
    const own = (i, j) => lvl[j * g.nx + i] === L;
    let any = false;
    for (let j = 0; j < g.nz && !any; j++) for (let i = 0; i < g.nx; i++) if (own(i, j)) { any = true; break; }
    if (!any) continue;
    const yE = y0Of(L) + FH;
    // sub-grid of this group
    const sub = { X: g.X, Z: g.Z, nx: g.nx, nz: g.nz, owner: new Int16Array(g.nx * g.nz), at: null };
    for (let k = 0; k < sub.owner.length; k++) sub.owner[k] = lvl[k] === L ? 0 : -1;
    sub.at = (i, j) => (i < 0 || j < 0 || i >= sub.nx || j >= sub.nz ? -1 : sub.owner[j * sub.nx + i]);
    const rects = gridRects(sub);
    const edges = gridEdges(sub);
    const higherBeside = (e) => {
      const mx = (e.x0 + e.x1) / 2 + e.nx * 0.06, mz = (e.z0 + e.z1) / 2 + e.nz * 0.06;
      return levelAt(mx, mz) > L;
    };
    const free = edges.filter((e) => !higherBeside(e));

    // Ceiling / roof slab body and its edge band.
    for (const r of rects) R.box(`rslab${L}`, M.slabBody, r.x1 - r.x0, SLAB_T, r.z1 - r.z0, (r.x0 + r.x1) / 2, yE - SLAB_T / 2, (r.z0 + r.z1) / 2);
    for (const e of edges) {
      if (higherBeside(e)) continue;
      const len = Math.hypot(e.x1 - e.x0, e.z1 - e.z0), horiz = e.nz !== 0;
      R.box(`redge${L}`, M.trim, horiz ? len + 0.08 : 0.06, 0.24, horiz ? 0.06 : len + 0.08, (e.x0 + e.x1) / 2 + e.nx * 0.01, yE - 0.12, (e.z0 + e.z1) / 2 + e.nz * 0.01);
    }

    if (type === 'flat') {
      const main = L === lastWithSlab;
      const lip = 0.1 + o * 0.25, ph = main && X.roofTerrace ? (railStyle === 'concrete' ? 1.0 : 0.3) : roof.parapet ? 0.5 : 0, pt = 0.15, rt = 0.26;
      for (const r of rects) R.box('roofFlat', flatMat, r.x1 - r.x0, rt, r.z1 - r.z0, (r.x0 + r.x1) / 2, yE + rt / 2, (r.z0 + r.z1) / 2);
      for (const e of free) {
        const len = Math.hypot(e.x1 - e.x0, e.z1 - e.z0), horiz = e.nz !== 0;
        const cx = (e.x0 + e.x1) / 2, cz = (e.z0 + e.z1) / 2;
        // Extend the strip past an end only at convex corners (a concave end would cross the roof surface).
        const tx = (e.x1 - e.x0) / len, tz = (e.z1 - e.z0) / len;
        const convex = (px, pz, dir) => !(levelAt(px + dir * tx * 0.05 - e.nx * 0.05, pz + dir * tz * 0.05 - e.nz * 0.05) >= L);
        const cvA = convex(e.x0, e.z0, -1), cvB = convex(e.x1, e.z1, 1);
        // Lip slab strips always overlap the corner; parapet / trim strips meet exactly (extend at outside corners, stop short at inside corners).
        const extA = lip, extB = lip;
        const pA = cvA ? lip : -(lip - pt), pB = cvB ? lip : -(lip - pt);
        const sizeA = len + extA + extB;
        const cxs = cx + tx * (extB - extA) / 2, czs = cz + tz * (extB - extA) / 2;
        const sizeP = len + pA + pB, cxp = cx + tx * (pB - pA) / 2, czp = cz + tz * (pB - pA) / 2;
        // lip strip beyond the wall line
        R.box('roofFlat', flatMat, horiz ? sizeA : lip, rt, horiz ? lip : sizeA, cxs + e.nx * (lip / 2), yE + rt / 2, czs + e.nz * (lip / 2));
        R.box('trim', M.trim, horiz ? sizeP + 0.12 : lip + 0.12, 0.12, horiz ? lip + 0.12 : sizeP + 0.12, cxp + e.nx * (lip / 2), yE + 0.02, czp + e.nz * (lip / 2));
        if (ph) {
          const off = lip - pt / 2;
          R.box('walls', wallMat, horiz ? sizeP : pt, ph, horiz ? pt : sizeP, cxp + e.nx * off, yE + rt + ph / 2, czp + e.nz * off);
          R.box('trim', M.trim, horiz ? sizeP + 0.1 : 0.25, 0.06, horiz ? 0.25 : sizeP + 0.1, cxp + e.nx * off, yE + rt + ph + 0.03, czp + e.nz * off);
          if (main && X.roofTerrace && railStyle !== 'concrete') {
            const o2 = lip - pt / 2, yr = yE + rt + ph + 0.06;
            railing(R, e.x0 - tx * pA + e.nx * o2, e.z0 - tz * pA + e.nz * o2, e.x1 + tx * pB + e.nx * o2, e.z1 + tz * pB + e.nz * o2, yr);
          }
        }
      }
      if (main) { const bx = mainBox(rects); extrasFlat(bx, yE, rt); }
      topMax = Math.max(topMax, yE + rt + ph + 0.06);
      continue;
    }

    // ---- pitched roofs ----
    const tan = Math.tan((PITCH[type] * Math.PI) / 180);
    const cover = coverRects((i, j) => own(i, j), g.nx, g.nz, type === 'hip');
    const ridgeRects = cover.map((r) => ({ x0: g.X[r.i0] - o, x1: g.X[r.i1 + 1] + o, z0: g.Z[r.j0] - o, z1: g.Z[r.j1 + 1] + o, fx0: g.X[r.i0], fx1: g.X[r.i1 + 1], fz0: g.Z[r.j0], fz1: g.Z[r.j1 + 1] }));
    const zFrontAll = Math.max(...ridgeRects.map((r) => r.z1));
    // Cross gables: a narrower wing stops at the wider roof it runs into (valley pair), so ridges never cross.
    if (type === 'gable') {
      const info = ridgeRects.map((r) => { const ax = r.x1 - r.x0 >= (r.z1 - r.z0) * 0.8; r.axisFixed = ax; return { r, alongX: ax, lat: ax ? r.z1 - r.z0 : r.x1 - r.x0 }; });
      for (const a of info) for (const j of info) {
        if (a === j || j.alongX === a.alongX) continue;
        const wider = j.lat > a.lat + 1e-6 || (Math.abs(j.lat - a.lat) < 1e-6 && info.indexOf(j) < info.indexOf(a));
        if (!wider) continue;
        const r = a.r, q = j.r;
        if (r.x1 <= q.x0 + 1e-6 || r.x0 >= q.x1 - 1e-6 || r.z1 <= q.z0 + 1e-6 || r.z0 >= q.z1 - 1e-6) continue;
        const depth = a.lat / 2;
        if (a.alongX) {
          if (r.x0 < q.x0 - 1e-6 && r.x1 <= q.x1 + 1e-6) { r.x1 = Math.max(r.x0 + 0.5, Math.min(r.x1, q.x0 + depth)); r.fx1 = Math.min(r.fx1, r.x1 - o); }
          else if (r.x1 > q.x1 + 1e-6 && r.x0 >= q.x0 - 1e-6) { r.x0 = Math.min(r.x1 - 0.5, Math.max(r.x0, q.x1 - depth)); r.fx0 = Math.max(r.fx0, r.x0 + o); }
        } else if (r.z0 < q.z0 - 1e-6 && r.z1 <= q.z1 + 1e-6) { r.z1 = Math.max(r.z0 + 0.5, Math.min(r.z1, q.z0 + depth)); r.fz1 = Math.min(r.fz1, r.z1 - o); }
        else if (r.z1 > q.z1 + 1e-6 && r.z0 >= q.z0 - 1e-6) { r.z0 = Math.min(r.z1 - 0.5, Math.max(r.z0, q.z1 - depth)); r.fz0 = Math.max(r.fz0, r.z0 + o); }
      }
    }
    // planes: height = a x + b z + c
    const planesOf = (r) => {
      const W = r.x1 - r.x0, D = r.z1 - r.z0;
      const left = [tan, 0, yE - tan * r.x0], right = [-tan, 0, yE + tan * r.x1], front = [0, -tan, yE + tan * r.z1], back = [0, tan, yE - tan * r.z0];
      if (type === 'hip') return [left, right, front, back];
      if (type === 'gable') return (r.axisFixed ?? W >= D * 0.8) ? [front, back] : [left, right];
      return [[0, -tan, yE + tan * zFrontAll]];
    };
    const rectPoly = (r) => [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]];
    const rectHP = (r) => [[1, 0, -r.x0], [-1, 0, r.x1], [0, 1, -r.z0], [0, -1, r.z1]];
    ridgeRects.forEach((r) => { r.planes = planesOf(r); r.poly = rectPoly(r); r.hp = rectHP(r); r.alongX = r.axisFixed ?? r.x1 - r.x0 >= (r.z1 - r.z0); });
    const heightAt = (r, x, z) => Math.min(...r.planes.map((p) => p[0] * x + p[1] * z + p[2]));
    const envelope = (x, z) => Math.max(...ridgeRects.filter((r) => x >= r.x0 - 1e-6 && x <= r.x1 + 1e-6 && z >= r.z0 - 1e-6 && z <= r.z1 + 1e-6).map((r) => heightAt(r, x, z)), -Infinity);
    const faces = [];
    ridgeRects.forEach((r, i) => {
      r.planes.forEach((pl, k) => {
        let region = r.poly;
        // region where this plane is the lowest of the rect's planes
        r.planes.forEach((q, m) => { if (m !== k && region.length) region = clipHalf(region, q[0] - pl[0], q[1] - pl[1], q[2] - pl[2]); });
        if (region.length < 3) return;
        let pieces = [region];
        ridgeRects.forEach((rj, j) => {
          if (j === i || !pieces.length) return;
          const hps = [...rj.hp];
          for (const q of rj.planes) hps.push([q[0] - pl[0], q[1] - pl[1], q[2] - pl[2] + (j < i ? EPS : -EPS)]);
          const next = [];
          for (const pc of pieces) next.push(...subtract(pc, hps));
          pieces = next;
        });
        for (const pc of pieces) if (Math.abs(area2(pc)) > 1e-3) faces.push({ poly: pc, pl });
      });
    });
    for (const f of faces) {
      const [a, bb, c0] = f.pl;
      const gl = Math.hypot(a, bb);
      const nrm = [-a, 1, -bb];
      const nl = Math.hypot(...nrm);
      const n = nrm.map((v) => v / nl);
      // texture axes: u along the eave (horizontal), v up the slope
      const ux = gl > 1e-6 ? -bb / gl : 1, uz = gl > 1e-6 ? a / gl : 0;
      const sx = gl > 1e-6 ? a / gl : 0, sz = gl > 1e-6 ? bb / gl : 1;
      const k = nl;
      const P3 = (p) => [p[0], a * p[0] + bb * p[1] + c0, p[1]];
      const UV = (p) => [p[0] * ux + p[1] * uz, (p[0] * sx + p[1] * sz) * k];
      const pts = f.poly;
      for (let i = 1; i < pts.length - 1; i++) RS.tri('roof', roofMat, P3(pts[0]), P3(pts[i]), P3(pts[i + 1]), n, [UV(pts[0]), UV(pts[i]), UV(pts[i + 1])]);
      for (const p of pts) topMax = Math.max(topMax, a * p[0] + bb * p[1] + c0);
    }

    // Fascia + soffit + cornice along the footprint outline (not beside a higher roof).
    const yS = yE - 0.19;
    for (const e of free) {
      const len = Math.hypot(e.x1 - e.x0, e.z1 - e.z0), horiz = e.nz !== 0;
      const cx = (e.x0 + e.x1) / 2, cz = (e.z0 + e.z1) / 2;
      // soffit strip under the overhang
      const x0 = horiz ? e.x0 - o : Math.min(e.x0, e.x0 + e.nx * o), x1 = horiz ? e.x1 + o : Math.max(e.x0, e.x0 + e.nx * o);
      const z0 = horiz ? Math.min(e.z0, e.z0 + e.nz * o) : e.z0 - o, z1 = horiz ? Math.max(e.z0, e.z0 + e.nz * o) : e.z1 + o;
      if (o > 0.02) {
        const yz = (z) => (type === 'shed' ? yE + tan * (zFrontAll - z) - 0.19 : yS);
        RS.quad(`soffit${L}`, M.trim, [x0, yz(z0), z0], [x1, yz(z0), z0], [x1, yz(z1), z1], [x0, yz(z1), z1], [0, -1, 0]);
      }
      // cornice band at the wall
      R.box('trim', M.trim, horiz ? len + 0.12 : 0.06, 0.12, horiz ? 0.06 : len + 0.12, cx + e.nx * 0.03, yE - 0.26, cz + e.nz * 0.03);
    }
    // Eave fascia: along the outline of the union of eave rectangles.
    {
      const fx = [], fz = [];
      for (const r of ridgeRects) { fx.push(r.x0, r.x1); fz.push(r.z0, r.z1); }
      const eg = slabGrid(ridgeRects.map((r) => ({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 })));
      for (const e of gridEdges(eg)) {
        const mx = (e.x0 + e.x1) / 2, mz = (e.z0 + e.z1) / 2;
        // Gable ends carry barge boards instead; higher neighbours need nothing.
        const owner = ridgeRects.find((r) => (e.nz === 0 ? Math.abs(mx - (e.nx > 0 ? r.x1 : r.x0)) < 1e-4 && mz >= r.z0 - 1e-4 && mz <= r.z1 + 1e-4 : Math.abs(mz - (e.nz > 0 ? r.z1 : r.z0)) < 1e-4 && mx >= r.x0 - 1e-4 && mx <= r.x1 + 1e-4));
        if (type === 'gable' && owner && (owner.alongX ? e.nz === 0 : e.nz !== 0)) continue;
        if (levelAt(mx + e.nx * (o + 0.06), mz + e.nz * (o + 0.06)) > L) continue;
        const len = Math.hypot(e.x1 - e.x0, e.z1 - e.z0), horiz = e.nz !== 0;
        if (type === 'shed') {
          // Follows the sloping roof edge: level on the front / back, tilted along the sides.
          const hAt = (z) => yE + tan * (zFrontAll - z);
          if (horiz) R.box('trim', M.trim, len + 0.04, 0.24, 0.05, mx, hAt(mz) - 0.1, mz);
          else {
            const A = new Vector3(mx, hAt(e.z0) - 0.1, e.z0), B = new Vector3(mx, hAt(e.z1) - 0.1, e.z1);
            const m = new Matrix4().lookAt(A, B, new Vector3(0, 1, 0));
            m.setPosition(A.clone().add(B).multiplyScalar(0.5));
            R.box('trim', M.trim, 0.05, 0.24, A.distanceTo(B) + 0.04, 0, 0, 0, m);
          }
        } else R.box('trim', M.trim, horiz ? len + 0.04 : 0.05, 0.24, horiz ? 0.05 : len + 0.04, mx, yE - 0.1, mz);
      }
    }

    // Ridge caps and hip rafters, only where that roof is the visible one.
    const beam = (pa, pb) => {
      // Only the stretches where this roof is the visible one (valleys hide the rest); ends stop short of the fascia.
      const A = new Vector3(...pa), B = new Vector3(...pb), len = A.distanceTo(B);
      const n = Math.max(2, Math.ceil(len / 0.2));
      let run = null;
      const flush = (t0, t1) => {
        let a0 = t0 * len, a1 = t1 * len;
        if (t0 <= 1e-6) a0 += 0.08;
        if (t1 >= 1 - 1e-6) a1 -= 0.08;
        if (a1 - a0 < 0.15) return;
        const P0 = A.clone().lerp(B, a0 / len), P1 = A.clone().lerp(B, a1 / len);
        const m = new Matrix4().lookAt(P0, P1, new Vector3(0, 1, 0));
        m.setPosition(P0.clone().add(P1).multiplyScalar(0.5));
        R.box('roofCap', capMat, 0.16, 0.1, P0.distanceTo(P1), 0, 0.02, 0, m);
      };
      for (let k = 0; k <= n; k++) {
        const t = k / n, p = A.clone().lerp(B, t);
        const vis = Math.abs(envelope(p.x, p.z) - p.y) < 0.03;
        if (vis && run === null) run = t;
        if ((!vis || k === n) && run !== null) { flush(run, vis ? 1 : t - 1 / n); run = null; }
      }
    };
    for (const r of ridgeRects) {
      if (type === 'shed') continue;
      const W = r.x1 - r.x0, D = r.z1 - r.z0;
      const hgt = (x, z) => heightAt(r, x, z);
      if (type === 'gable') {
        if (r.alongX) beam([r.x0, hgt(r.x0, (r.z0 + r.z1) / 2), (r.z0 + r.z1) / 2], [r.x1, hgt(r.x1, (r.z0 + r.z1) / 2), (r.z0 + r.z1) / 2]);
        else beam([(r.x0 + r.x1) / 2, hgt((r.x0 + r.x1) / 2, r.z0), r.z0], [(r.x0 + r.x1) / 2, hgt((r.x0 + r.x1) / 2, r.z1), r.z1]);
      } else {
        const rr = Math.abs(W - D) / 2, cxm = (r.x0 + r.x1) / 2, czm = (r.z0 + r.z1) / 2;
        const ra = r.alongX ? [cxm - rr, czm] : [cxm, czm - rr], rb = r.alongX ? [cxm + rr, czm] : [cxm, czm + rr];
        const P2 = (p) => [p[0], hgt(p[0], p[1]), p[1]];
        beam(P2(ra), P2(rb));
        for (const [cx2, cz2] of [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]]) {
          const target = Math.hypot(cx2 - ra[0], cz2 - ra[1]) < Math.hypot(cx2 - rb[0], cz2 - rb[1]) ? ra : rb;
          beam(P2([cx2, cz2]), P2(target));
        }
      }
    }
    // Valley flashing: edges between roof faces where the neighbouring roof is higher.
    {
      const seen = new Set();
      // Tile / concrete roofs: the valley is mortared in the roof colour (a grey metal strip read as a gap); zinc keeps metal.
      const vCol = '#' + [1, 3, 5].map((i) => Math.round(parseInt(roof.color.slice(i, i + 2), 16) * 0.82).toString(16).padStart(2, '0')).join('');
      const flash = roof.material === 'metal'
        ? { material: mats.plain('#8a9096', { roughness: 0.4, metalness: 0.7 }), part: 'roof' }
        : { material: mats.plain(vCol, { roughness: 0.8 }), part: 'roof' };
      for (const f of faces) {
        const [pa, pb, pc] = f.pl;
        const hh = (x, z) => pa * x + pb * z + pc;
        const cxm = f.poly.reduce((t, p) => t + p[0], 0) / f.poly.length, czm = f.poly.reduce((t, p) => t + p[1], 0) / f.poly.length;
        for (let i = 0; i < f.poly.length; i++) {
          const p = f.poly[i], q = f.poly[(i + 1) % f.poly.length];
          const el = Math.hypot(q[0] - p[0], q[1] - p[1]);
          if (el < 0.3) continue;
          const key = [p, q].map((v) => `${Math.round(v[0] * 20)},${Math.round(v[1] * 20)}`).sort().join('|');
          if (seen.has(key)) continue;
          let nx = -(q[1] - p[1]) / el, nz = (q[0] - p[0]) / el;
          const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
          if ((mx - cxm) * nx + (mz - czm) * nz < 0) { nx = -nx; nz = -nz; }
          const ox = mx + nx * 0.06, oz = mz + nz * 0.06;
          const env = envelope(ox, oz);
          if (env === -Infinity || env < hh(ox, oz) + 0.03) continue;
          // the neighbour is higher: a valley (the two faces meet at this edge)
          seen.add(key);
          const A = new Vector3(p[0], hh(p[0], p[1]) + 0.02, p[1]), B = new Vector3(q[0], hh(q[0], q[1]) + 0.02, q[1]);
          const m = new Matrix4().lookAt(A, B, new Vector3(0, 1, 0));
          m.setPosition(A.clone().add(B).multiplyScalar(0.5));
          R.box('valley', flash, roof.material === 'metal' ? 0.16 : 0.1, 0.03, A.distanceTo(B), 0, 0, 0, m);
        }
      }
    }
    // Gable end walls under the rake, shed side / back walls.
    if (type === 'gable') {
      for (const r of ridgeRects) {
        const half = r.alongX ? (r.z1 - r.z0) / 2 : (r.x1 - r.x0) / 2;
        const yR = yE + tan * half, yO = yE + tan * o;
        for (const end of [-1, 1]) {
          // end plane at the footprint line (the roof overhangs it)
          const e = r.alongX ? (end < 0 ? r.fx0 : r.fx1) : (end < 0 ? r.fz0 : r.fz1);
          const outward = [r.alongX ? end : 0, r.alongX ? 0 : end];
          const probe = [r.alongX ? e + end * 0.15 : (r.x0 + r.x1) / 2, r.alongX ? (r.z0 + r.z1) / 2 : e + end * 0.15];
          if (levelAt(probe[0], probe[1]) >= 0 && levelAt(probe[0], probe[1]) >= L) continue;
          if (ridgeRects.some((q) => q !== r && probe[0] > q.fx0 && probe[0] < q.fx1 && probe[1] > q.fz0 && probe[1] < q.fz1)) continue;
          const lat0 = r.alongX ? r.fz0 : r.fx0, lat1 = r.alongX ? r.fz1 : r.fx1, latC = (lat0 + lat1) / 2;
          const pt = (l, y) => (r.alongX ? [e, y, l] : [l, y, e]);
          const n3 = [outward[0], 0, outward[1]];
          const poly = [pt(lat0, yE - 0.02), pt(lat1, yE - 0.02), pt(lat1, yO), pt(latC, yR - 0.04), pt(lat0, yO)];
          for (let i = 1; i < poly.length - 1; i++) {
            RS.tri(`gw${L}`, wallMat, poly[0], poly[i], poly[i + 1], n3);
            RS.tri(`gw${L}`, wallMat, poly[0], poly[i], poly[i + 1], [-n3[0], 0, -n3[2]]);
          }
          // barge boards along the rake
          const re = r.alongX ? (end < 0 ? r.x0 : r.x1) : (end < 0 ? r.z0 : r.z1);
          const bp = (l, y) => (r.alongX ? [re, y, l] : [l, y, re]);
          for (const [pa, pb] of [[bp(r.alongX ? r.z0 : r.x0, yE - 0.05), bp((r.alongX ? r.z0 + r.z1 : r.x0 + r.x1) / 2, yR - 0.05)], [bp((r.alongX ? r.z0 + r.z1 : r.x0 + r.x1) / 2, yR - 0.05), bp(r.alongX ? r.z1 : r.x1, yE - 0.05)]]) {
            const A = new Vector3(...pa), B = new Vector3(...pb);
            const m = new Matrix4().lookAt(A, B, new Vector3(0, 1, 0));
            m.setPosition(A.clone().add(B).multiplyScalar(0.5));
            R.box('trim', M.trim, 0.06, 0.24, A.distanceTo(B), 0, 0, 0, m);
          }
        }
      }
    } else if (type === 'shed') {
      for (const e of free) {
        const hAt = (x, z) => yE + tan * (zFrontAll - z);
        const a2 = [e.x0, e.z0], b2 = [e.x1, e.z1];
        const n3 = [e.nx, 0, e.nz];
        const poly = [[a2[0], yE - 0.02, a2[1]], [b2[0], yE - 0.02, b2[1]], [b2[0], hAt(b2[0], b2[1]) - 0.03, b2[1]], [a2[0], hAt(a2[0], a2[1]) - 0.03, a2[1]]];
        for (let i = 1; i < poly.length - 1; i++) {
          RS.tri(`gw${L}`, wallMat, poly[0], poly[i], poly[i + 1], n3);
          RS.tri(`gw${L}`, wallMat, poly[0], poly[i], poly[i + 1], [-n3[0], 0, -n3[2]]);
        }
      }
    }
  }
  // Tinaco and solar panels on pitched roofs: tank on a steel stand behind the house, panels flush on the front slope.
  if (type !== 'flat' && lastWithSlab >= 0 && (X.waterTank || X.solar)) {
    const L = lastWithSlab, yE = y0Of(L) + FH;
    const rs = [];
    for (let j = 0; j < g.nz; j++) for (let i = 0; i < g.nx; i++) if (lvl[j * g.nx + i] === L) rs.push({ x0: g.X[i], x1: g.X[i + 1], z0: g.Z[j], z1: g.Z[j + 1] });
    const bx = mainBox(rs);
    if (X.waterTank) {
      const x = bx.x1 - 1.2, z = bx.z0 - Math.max(1.4, o + 0.8), ht = Math.min(yE, 3.2);
      const F0 = layers.f0;
      for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) F0.box('iron', M.iron, 0.08, ht, 0.08, x + dx, ht / 2, z + dz);
      F0.box('iron', M.iron, 1.4, 0.08, 1.4, x, ht, z);
      tank(F0, x, ht - 0.16, z, 0.9);
    }
    if (X.solar && type !== 'shed') {
      const tan = Math.tan((PITCH[type] * Math.PI) / 180);
      const W = bx.x1 - bx.x0, D = bx.z1 - bx.z0, zf = bx.z1 + o;
      const zc = Math.min(zf - (D / 2 + o) * 0.5, bx.z1 - 1.2), d = zf - zc;
      const y = yE + d * tan + 0.07, n = Math.min(6, Math.floor((type === 'hip' ? W + 2 * o - 2 * d - 1 : W - 1) / 1.12));
      for (let i = 0; i < n; i++) R.box('solar', panelM, 1.05, 0.04, 1.7, 0, 0, 0, mat4((bx.x0 + bx.x1) / 2 + (i - (n - 1) / 2) * 1.12, y, zc, 0, Math.atan(tan)));
    }
  }

  // Porch / carport roofs: a separate low flat roof slab on the posts (nothing under an upper slab that covers it).
  const DROP = 0.3;
  b.levels.forEach((Lv, li) => {
    for (const sl of Lv.slabs) {
      if (sl.kind !== 'porch' && sl.kind !== 'carport') continue;
      const cx = (sl.x0 + sl.x1) / 2, cz = (sl.z0 + sl.z1) / 2;
      if (li < NL - 1 && b.levels[li + 1].slabs.some((q) => cx > q.x0 && cx < q.x1 && cz > q.z0 && cz < q.z1)) continue;
      const yT = y0Of(li) + FH - DROP, w = sl.x1 - sl.x0 + 0.3, d = sl.z1 - sl.z0 + 0.3;
      R.box(`kroofB${li}`, M.slabBody, sl.x1 - sl.x0, 0.2, sl.z1 - sl.z0, cx, yT - 0.1, cz);
      R.box('trim', M.trim, w, 0.28, d, cx, yT + 0.0, cz);
      // Pitched-roof houses: the porch / carport roof shows the roof material on top (a shallow lean-to look).
      if (type !== 'flat') R.box('kroofTop', { material: mats.roof('metal', '#c4c8cd'), part: 'roof' }, w - 0.1, 0.07, d - 0.1, cx, yT + 0.175, cz);
      topMax = Math.max(topMax, yT + 0.2);
    }
  });
  void ExtrudeGeometry; void Shape; void railing;
  return { top: topMax };
}
