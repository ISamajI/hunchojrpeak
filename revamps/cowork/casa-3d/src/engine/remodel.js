// Remodel (Remodelar, 2026-11-07): compare the house as it is today (`base`, a frozen copy of the hand-built
// house) with the plan (`build`, the hand-built house he keeps editing). Pure functions, no Three.js.
//
// Walls are compared as line coverage, not by id (walls get split and merged at junctions while he edits):
// the parts of a base wall that no current wall covers are torn down (demoler); the parts of a current wall
// that no base wall covers are new (construir). Openings are matched by kind + position + width; slabs by outline.
// All coordinates are house-local metres, like the build model.

const ON_LINE = 0.04;   // m: a wall counts as "the same line" within this offset
const MIN_PART = 0.12;  // m: ignore slivers shorter than this
const OPEN_TOL = 0.2;   // m: an opening moved less than this is the same opening

const len = (w) => Math.hypot(w.x1 - w.x0, w.z1 - w.z0);

// Intervals [t0, t1] (metres along wall a) that wall b covers, or null when b is not on a's line.
function overlapOn(a, b) {
  const L = len(a);
  if (L < 1e-6) return null;
  const ux = (a.x1 - a.x0) / L, uz = (a.z1 - a.z0) / L;
  const bl = len(b);
  if (bl < 1e-6) return null;
  const vx = (b.x1 - b.x0) / bl, vz = (b.z1 - b.z0) / bl;
  if (Math.abs(ux * vz - uz * vx) > 0.02) return null; // not parallel
  // Both ends of b must sit on a's line (a wall whose far end moved a few cm is a changed wall).
  const off0 = Math.abs((b.x0 - a.x0) * -uz + (b.z0 - a.z0) * ux), off1 = Math.abs((b.x1 - a.x0) * -uz + (b.z1 - a.z0) * ux);
  if (off0 > ON_LINE || off1 > ON_LINE) return null;
  const t0 = (b.x0 - a.x0) * ux + (b.z0 - a.z0) * uz, t1 = (b.x1 - a.x0) * ux + (b.z1 - a.z0) * uz;
  const lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(L, Math.max(t0, t1));
  return hi - lo > 1e-3 ? [lo, hi] : null;
}

// [0, L] minus the union of `cover` intervals -> uncovered parts.
function uncovered(L, cover) {
  const iv = cover.filter(Boolean).sort((p, q) => p[0] - q[0]);
  const out = [];
  let at = 0;
  for (const [lo, hi] of iv) {
    if (lo > at + MIN_PART) out.push([at, lo]);
    at = Math.max(at, hi);
  }
  if (L - at > MIN_PART) out.push([at, L]);
  return out;
}

function part(w, [t0, t1], FH) {
  const L = len(w), ux = (w.x1 - w.x0) / L, uz = (w.z1 - w.z0) / L;
  return {
    x0: w.x0 + ux * t0, z0: w.z0 + uz * t0, x1: w.x0 + ux * t1, z1: w.z0 + uz * t1,
    len: t1 - t0, t: w.t ?? 0.15, h: w.h ?? FH, ext: !!w.ext, wallId: w.id,
  };
}

const openingsOf = (walls) => walls.flatMap((w) => {
  const L = len(w);
  if (L < 1e-6) return [];
  const ux = (w.x1 - w.x0) / L, uz = (w.z1 - w.z0) / L;
  return (w.openings ?? []).map((o) => ({
    id: o.id, wallId: w.id, kind: o.kind, w: o.w, h: o.h, sill: o.sill ?? 0, at: o.at,
    x: w.x0 + ux * o.at, z: w.z0 + uz * o.at, ang: Math.atan2(uz, ux), t: w.t ?? 0.15,
  }));
});
const doorish = (k) => (k === 'window' ? 'window' : 'door');
const sameOpening = (a, b) => doorish(a.kind) === doorish(b.kind) && Math.hypot(a.x - b.x, a.z - b.z) < OPEN_TOL && Math.abs((a.w ?? 0) - (b.w ?? 0)) < 0.15;
const sameSlab = (a, b) => Math.abs(a.x0 - b.x0) < 0.05 && Math.abs(a.x1 - b.x1) < 0.05 && Math.abs(a.z0 - b.z0) < 0.05 && Math.abs(a.z1 - b.z1) < 0.05;
const area = (s) => Math.max(0, (s.x1 - s.x0) * (s.z1 - s.z0));
// Is the point (x, z) on one of these wall parts (within half a wall thickness + a bit)?
function onParts(parts, x, z) {
  return parts.some((p) => {
    const L = p.len || 1e-6, ux = (p.x1 - p.x0) / L, uz = (p.z1 - p.z0) / L;
    const t = (x - p.x0) * ux + (z - p.z0) * uz;
    const d = Math.abs((x - p.x0) * -uz + (z - p.z0) * ux);
    return t > -0.05 && t < L + 0.05 && d < 0.1;
  });
}

// diff(base, build) -> { levels: [...], totals }  (both arguments are sanitized build objects)
export function remodelDiff(base, build) {
  const FH = build?.floorHeight ?? 3, FB = base?.floorHeight ?? FH;
  const nL = Math.max(base?.levels?.length ?? 0, build?.levels?.length ?? 0);
  const levels = [];
  const T = { demolishM: 0, demolishN: 0, addM: 0, addN: 0, doorsNew: 0, windowsNew: 0, closed: 0, slabsNew: 0, slabsGone: 0, areaBefore: 0, areaAfter: 0, levelsBefore: base?.levels?.length ?? 0, levelsAfter: build?.levels?.length ?? 0, roofChanged: false, changes: 0 };
  for (let li = 0; li < nL; li++) {
    const B = base?.levels?.[li] ?? { walls: [], slabs: [] }, C = build?.levels?.[li] ?? { walls: [], slabs: [] };
    const demolish = [], add = [];
    for (const w of B.walls) for (const iv of uncovered(len(w), C.walls.map((c) => overlapOn(w, c)))) demolish.push(part(w, iv, FB));
    for (const w of C.walls) for (const iv of uncovered(len(w), B.walls.map((b) => overlapOn(w, b)))) add.push(part(w, iv, FH));
    const ob = openingsOf(B.walls), oc = openingsOf(C.walls);
    // An opening in a wall that is torn down goes with the wall; one in a new wall comes with it (still listed as new).
    const closed = ob.filter((o) => !oc.some((q) => sameOpening(o, q)) && !onParts(demolish, o.x, o.z));
    const opened = oc.filter((o) => !ob.some((q) => sameOpening(o, q)));
    const slabNew = C.slabs.filter((s) => !B.slabs.some((q) => sameSlab(s, q)));
    const slabGone = B.slabs.filter((s) => !C.slabs.some((q) => sameSlab(s, q)));
    const before = B.slabs.reduce((a, s) => a + area(s), 0), after = C.slabs.reduce((a, s) => a + area(s), 0);
    levels.push({ level: li, demolish, add, closed, opened, slabNew, slabGone, areaBefore: before, areaAfter: after, isNew: li >= (base?.levels?.length ?? 0) });
    T.demolishM += demolish.reduce((a, p) => a + p.len, 0); T.demolishN += demolish.length;
    T.addM += add.reduce((a, p) => a + p.len, 0); T.addN += add.length;
    T.doorsNew += opened.filter((o) => o.kind !== 'window').length;
    T.windowsNew += opened.filter((o) => o.kind === 'window').length;
    T.closed += closed.length;
    T.slabsNew += slabNew.length; T.slabsGone += slabGone.length;
    T.areaBefore += before; T.areaAfter += after;
  }
  const rb = base?.roof ?? {}, rc = build?.roof ?? {};
  T.roofChanged = rb.type !== rc.type || rb.material !== rc.material;
  T.changes = T.demolishN + T.addN + T.doorsNew + T.windowsNew + T.closed + T.slabsNew + T.slabsGone + Math.abs(T.levelsAfter - T.levelsBefore) + (T.roofChanged ? 1 : 0);
  return { levels, totals: T, roofBefore: { type: rb.type, material: rb.material }, roofAfter: { type: rc.type, material: rc.material } };
}
