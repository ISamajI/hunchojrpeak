// Floor plan editing, as pure functions on a house object. Each edit takes
// `h` (state.house, plan may be null) and returns a NEW normalized plan, or
// null when the edit is not allowed. state.js wraps them as undoable store
// actions; the engine uses wallInfo() to clamp a drag.
import { roomLabels, layoutHouse, resolvePlan, planGeom, newPlanId, autoFront, clampFront, MIN_W, DEFAULT_W, PLAN_TYPES } from './layout.js';

const r2 = (v) => Math.round(v * 100) / 100;
const minW = (type) => MIN_W[type] ?? 1.5;
// A room already squeezed below its minimum may stay as it is but not shrink further.
const floorW = (r) => Math.min(minW(r.type), r.w);
export const MAX_PER_BAND = 8;
const BED = ['dormitorio', 'principal'];

// The stored plan, or a plan copied from the automatic layout so nothing moves.
export function materialize(h) {
  const cur = h.plan ? resolvePlan(h) : null;
  if (cur) return cur;
  const floors = layoutHouse({ ...h, plan: null });
  const { inner } = planGeom(h);
  const f0 = floors[0];
  const side = (fl, band) => fl.rooms.filter((r) => r.band === band).map((r) => ({ id: r.key, type: r.type, w: r.x1 - r.x0 }));
  const plan = {
    frontDepth: f0.zF - f0.zHallFront, hall: f0.zHallFront - f0.zHallBack, innerDepth: inner,
    levels: floors.map((fl) => ({ front: side(fl, 'front'), back: side(fl, 'back') })),
  };
  return resolvePlan({ ...h, plan });
}

const finish = (h, plan, opts) => (plan ? resolvePlan({ ...h, plan }, opts) : null);

function find(plan, id) {
  for (let level = 0; level < plan.levels.length; level++) {
    for (const band of ['front', 'back']) {
      const list = plan.levels[level][band];
      const index = list.findIndex((r) => r.id === id);
      if (index >= 0) return { level, band, list, index, room: list[index] };
    }
  }
  return null;
}

const salaCount = (plan) => plan.levels[0].front.concat(plan.levels[0].back).filter((r) => r.type === 'sala').length;

const countType = (plan, type) => plan.levels.reduce((n, lv) => n + lv.front.concat(lv.back).filter((r) => r.type === type).length, 0);

// room = { id, type }. Never leaves a band empty or holding only stairs, nor the house without a bathroom or ground sala.
export function canDelete(plan, level, band, room) {
  const list = plan.levels[level][band];
  if (room.type === 'escalera' || list.length < 2) return false;
  if (!list.some((r) => r.id !== room.id && r.type !== 'escalera')) return false;
  if (room.type === 'bano' && countType(plan, 'bano') < 2) return false;
  return !(level === 0 && room.type === 'sala' && salaCount(plan) < 2);
}

export function setRoomType(h, id, type) {
  if (!PLAN_TYPES.includes(type) || type === 'escalera') return null;
  const plan = materialize(h);
  const f = plan && find(plan, id);
  if (!f || f.room.type === 'escalera' || f.room.type === type) return null;
  if (f.level === 0 && f.room.type === 'sala' && salaCount(plan) < 2) return null;
  if (f.room.type === 'bano' && countType(plan, 'bano') < 2) return null;
  f.room.type = type;
  const out = finish(h, plan);
  const g = out && find(out, id);
  return g && g.room.w >= minW(type) - 1e-6 ? out : null;
}

export function setRoomWidth(h, id, meters) {
  if (!Number.isFinite(+meters)) return null;
  const plan = materialize(h);
  const f = plan && find(plan, id);
  if (!f) return null;
  const nb = f.list[f.index + 1] ?? f.list[f.index - 1];
  if (!nb) return null;
  const before = widthsOf(plan);
  const m = r2(Math.min(f.room.w + nb.w - floorW(nb), Math.max(floorW(f.room), +meters)));
  const delta = m - f.room.w;
  if (Math.abs(delta) < 0.005) return null;
  f.room.w = m;
  nb.w -= delta;
  const out = finish(h, plan, { stairsFrom: f.level });
  return out && okWidths(out, before) ? out : null;
}

// No room ends up below its minimum width unless it already was (stairs resizes touch every level).
function okWidths(plan, before) {
  return plan.levels.every((lv) => lv.front.concat(lv.back).every((r) => r.w >= Math.min(minW(r.type), before.get(r.id) ?? 99) - 0.011));
}
const widthsOf = (plan) => new Map(plan.levels.flatMap((lv) => lv.front.concat(lv.back)).map((r) => [r.id, r.w]));

// Where a wall can go: { x, lo, hi, left0, right1, left, right } (absolute house-local x).
export function wallInfo(h, level, band, index) {
  const plan = materialize(h);
  const list = plan?.levels[level]?.[band];
  if (!list || !Number.isInteger(index) || index < 1 || index >= list.length) return null;
  const { xL } = planGeom(h);
  let left0 = xL;
  for (let i = 0; i < index - 1; i++) left0 += list[i].w;
  const left = list[index - 1], right = list[index];
  const right1 = left0 + left.w + right.w;
  return { x: left0 + left.w, lo: left0 + floorW(left), hi: right1 - floorW(right), left0, right1, left, right };
}

export function moveWall(h, level, band, index, x) {
  if (!Number.isFinite(+x)) return null;
  const info = wallInfo(h, level, band, index);
  if (!info || info.hi < info.lo) return null;
  const plan = materialize(h);
  const before = widthsOf(plan);
  const list = plan.levels[level][band];
  const w = r2(Math.min(info.hi - info.left0, Math.max(info.lo - info.left0, +x - info.left0)));
  const delta = w - list[index - 1].w;
  if (Math.abs(delta) < 0.005) return null;
  list[index - 1].w = w;
  list[index].w -= delta;
  const out = finish(h, plan, { stairsFrom: level });
  return out && okWidths(out, before) ? out : null;
}

// Hall wall: front band depth in meters (hall thickness stays).
export function setFrontDepth(h, meters) {
  if (!Number.isFinite(+meters)) return null;
  const plan = materialize(h);
  if (!plan) return null;
  const { inner } = planGeom(h);
  const c = clampFront(inner, +meters, plan.hall);
  const fb = r2(c.fb);
  if (Math.abs(fb - plan.frontDepth) < 0.005) return null;
  plan.frontDepth = fb;
  return finish(h, plan);
}

// Allowed range for the front band depth.
export function frontRange(h) {
  const { inner } = planGeom(h);
  const plan = materialize(h);
  const hall = plan?.hall ?? autoFront(inner).hall;
  return { lo: clampFront(inner, 0, hall).fb, hi: clampFront(inner, 99, hall).fb, hall };
}

// Add `type` at the end of a band; width comes proportionally from rooms that have slack.
export function addRoom(h, level, band, type) {
  if (!PLAN_TYPES.includes(type) || type === 'escalera' || (band !== 'front' && band !== 'back')) return null;
  const plan = materialize(h);
  const list = plan?.levels[level]?.[band];
  if (!list || list.length >= MAX_PER_BAND) return null;
  const donors = list.filter((r) => r.type !== 'escalera');
  const slack = donors.reduce((s, r) => s + Math.max(0, r.w - minW(r.type)), 0);
  const need = minW(type);
  if (slack < need - 1e-6) return null;
  const nw = Math.min(slack, Math.max(need, DEFAULT_W[type] ?? need));
  for (const r of donors) r.w -= (nw * Math.max(0, r.w - minW(r.type))) / slack;
  const used = new Set(plan.levels[level].front.concat(plan.levels[level].back).map((r) => r.id));
  const id = newPlanId(level, type, used);
  if (!id) return null;
  list.push({ id, type, w: nw });
  return finish(h, plan);
}

// Neighbours take the freed width (half each when it has two).
export function removeRoom(h, id) {
  const plan = materialize(h);
  const f = plan && find(plan, id);
  if (!f || !canDelete(plan, f.level, f.band, f.room)) return null;
  const [gone] = f.list.splice(f.index, 1);
  const l = f.list[f.index - 1], r = f.list[f.index];
  if (l && r) { l.w += gone.w / 2; r.w += gone.w / 2; } else (l ?? r).w += gone.w;
  return finish(h, plan);
}

export function moveRoom(h, id, dir) {
  const plan = materialize(h);
  const f = plan && find(plan, id);
  if (!f || (dir !== -1 && dir !== 1)) return null;
  const k = f.index + dir;
  if (k < 0 || k >= f.list.length || f.list[k].type === 'escalera' || f.room.type === 'escalera') return null;
  [f.list[f.index], f.list[k]] = [f.list[k], f.list[f.index]];
  return finish(h, plan);
}

// Slack of a band: width its rooms could still give up.
const slackOf = (list) => list.filter((r) => r.type !== 'escalera').reduce((s, r) => s + Math.max(0, r.w - minW(r.type)), 0);

// Bring the number of bedrooms / bathrooms in line with a stepper value.
// kind: 'bed' | 'bath'. Returns the new plan (unchanged plan when nothing fits).
export function adjustCount(h, kind, want) {
  let plan = materialize(h);
  if (!plan) return null;
  const types = kind === 'bed' ? BED : ['bano'];
  const addType = kind === 'bed' ? 'dormitorio' : 'bano';
  const count = (p) => p.levels.reduce((s, lv) => s + lv.front.concat(lv.back).filter((r) => types.includes(r.type)).length, 0);
  const view = (p) => ({ ...h, plan: p });
  for (let guard = 0; guard < 24 && count(plan) < want; guard++) {
    const cands = [];
    plan.levels.forEach((lv, level) => {
      for (const band of ['back', 'front']) {
        const list = lv[band];
        // The ground floor's front band (open living area) is the last resort.
        if (list.length < MAX_PER_BAND && slackOf(list) >= minW(addType) - 1e-6) cands.push({ level, band, slack: slackOf(list), last: level === 0 && band === 'front' });
      }
    });
    cands.sort((a, b) => Number(a.last) - Number(b.last) || b.slack - a.slack || a.level - b.level);
    let next = null;
    for (const c of cands) { next = addRoom(view(plan), c.level, c.band, addType); if (next) break; }
    if (!next) break;
    plan = next;
  }
  for (let guard = 0; guard < 24 && count(plan) > want; guard++) {
    // Newest first: top level down, back band before front, right to left.
    let victim = null;
    for (let level = plan.levels.length - 1; level >= 0 && !victim; level--) {
      for (const band of ['back', 'front']) {
        const list = plan.levels[level][band];
        for (let i = list.length - 1; i >= 0; i--) {
          const r = list[i];
          if (r.type === (kind === 'bed' ? 'dormitorio' : 'bano') && canDelete(plan, level, band, r)) { victim = r; break; }
        }
        if (victim) break;
      }
    }
    const next = victim && removeRoom(view(plan), victim.id);
    if (!next) break;
    plan = next;
  }
  return plan;
}

// Everything the plan UI needs for one level (house-local meters, rounded 0.01).
export function planInfo(h, level = 0) {
  const stored = h.plan ? resolvePlan(h) : null;
  const view = stored ?? materialize(h);
  const floors = layoutHouse(stored ? { ...h, plan: stored } : h);
  const lvl = Math.max(0, Math.min(floors.length - 1, Math.round(+level) || 0));
  const fl = floors[lvl];
  const p = view ?? materialize(h);
  const entry = (r, band, index) => {
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    return {
      id: r.key, type: r.type, band, index, level: lvl,
      w: r2(w), d: r2(d), x0: r2(r.x0), x1: r2(r.x1), z0: r2(r.z0), z1: r2(r.z1), area: r2(w * d),
      canDelete: p ? canDelete(p, lvl, band, { id: r.key, type: r.type }) : false,
      label: labels.get(r.key),
      canRetype: r.type !== 'escalera',
    };
  };
  const lang = typeof document !== 'undefined' && document.documentElement.lang?.startsWith('en') ? 'en' : 'es';
  const labels = roomLabels(floors.flatMap((f) => f.rooms.filter((r) => r.band !== 'hall')), lang);
  const bands = {};
  for (const band of ['front', 'back']) bands[band] = fl.rooms.filter((r) => r.band === band).map((r, i) => entry(r, band, i));
  const rangeOf = frontRange(h);
  return {
    custom: !!stored, level: lvl, levels: floors.length,
    frontDepth: r2(fl.zF - fl.zHallFront), hall: { z0: r2(fl.zHallBack), z1: r2(fl.zHallFront) },
    frontRange: [r2(rangeOf.lo), r2(rangeOf.hi)],
    bands, width: h.width, depth: h.depth, xL: r2(fl.xL), xR: r2(fl.xR), zF: r2(fl.zF), zB: r2(fl.zB),
  };
}
