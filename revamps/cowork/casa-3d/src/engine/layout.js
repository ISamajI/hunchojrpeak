// Room layout per floor. Front of the house faces +z.
// Returns rooms (rects), interior partition pieces, and window/door
// openings per facade, so walls, labels and furniture all agree.

export const T = 0.2;      // wall thickness
export const P = 0.45;     // plinth (floor raised above ground)
export const HALL = 1.2;
export const FLOOR_T = 0.04; // finished floor (tile / wood) on top of the slab

// Stable id for a room: level, type, and its index among that type on the level
// (front band, back band, then the hall), e.g. '1:dormitorio:0'.
export const roomKey = (level, type, n) => `${level}:${type}:${n}`;

const NAMES = {
  sala: { es: 'Sala', en: 'Living room' },
  comedor: { es: 'Comedor', en: 'Dining' },
  cocina: { es: 'Cocina', en: 'Kitchen' },
  dormitorio: { es: 'Habitación', en: 'Bedroom' },
  principal: { es: 'Hab. principal', en: 'Main bedroom' },
  bano: { es: 'Baño', en: 'Bathroom' },
  escalera: { es: 'Escalera', en: 'Stairs' },
  estudio: { es: 'Estudio', en: 'Study' },
  lavado: { es: 'Lavado', en: 'Laundry' },
  closet: { es: 'Closet', en: 'Walk-in closet' },
  pasillo: { es: 'Pasillo', en: 'Hall' },
  cuarto: { es: 'Cuarto', en: 'Room' },
};
export const roomName = (type, lang = 'es') => NAMES[type]?.[lang] ?? type;
const SHORT = {
  es: { sala: 'Sala', comedor: 'Com.', cocina: 'Coc.', dormitorio: 'Hab.', principal: 'Princ.', bano: 'Baño', escalera: 'Esc.', estudio: 'Est.', lavado: 'Lav.', closet: 'Clo.' },
  en: { sala: 'Liv.', comedor: 'Din.', cocina: 'Kit.', dormitorio: 'Bed', principal: 'Main', bano: 'Bath', escalera: 'Stairs', estudio: 'Study', lavado: 'Laun.', closet: 'Clos.' },
};
export const roomShort = (type, lang = 'es') => SHORT[lang]?.[type] ?? roomName(type, lang);

// Display names: the type name, numbered ("Baño 2") when a level has several of a type.
// Order is level, front band then back band, left to right. Returns Map key -> label; short names in `.short`.
export function roomLabels(rooms, lang = 'es') {
  const out = new Map();
  out.short = new Map();
  const bandRank = { front: 0, back: 1 };
  const groups = new Map();
  for (const r of rooms) {
    if (r.type === 'pasillo' || r.hidden) continue;
    const k = `${r.level}:${r.type}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => (bandRank[a.band] ?? 2) - (bandRank[b.band] ?? 2) || a.x0 - b.x0);
    list.forEach((r, i) => {
      const n = list.length > 1 ? ` ${i + 1}` : '';
      out.set(r.key, roomName(r.type, lang) + n);
      out.short.set(r.key, roomShort(r.type, lang) + n);
    });
  }
  return out;
}

// Narrowest a room can be and still work (meters).
export const MIN_W = { sala: 2.6, comedor: 2.0, cocina: 2.2, dormitorio: 2.5, principal: 2.8, bano: 1.5, escalera: 1.1, estudio: 2.0, lavado: 1.5, closet: 1.5 };

export const WEIGHT = { sala: 1.3, comedor: 1, cocina: 1.2, dormitorio: 1, principal: 1.25, bano: 0.6, escalera: 0.75, estudio: 0.9, lavado: 0.6, closet: 0.6 };

// Split [x0,x1] among rooms by weight.
function splitX(types, x0, x1) {
  const total = types.reduce((s, t) => s + WEIGHT[t], 0);
  let x = x0;
  return types.map((type) => {
    const w = ((x1 - x0) * WEIGHT[type]) / total;
    const r = { type, x0: x, x1: x + w };
    x += w;
    return r;
  });
}

// Which rooms go on which floor.
function program(F, bedrooms, baths) {
  if (F === 1) {
    const back = [];
    for (let i = 0; i < bedrooms; i++) back.push(i === 0 ? 'principal' : 'dormitorio');
    // Interleave bathrooms between bedrooms.
    for (let i = 0; i < baths; i++) back.splice(Math.min(back.length, 1 + i * 2), 0, 'bano');
    return [{ front: ['sala', 'comedor', 'cocina'], back, openFront: true }];
  }
  const floors = [{ front: ['sala', 'comedor'], back: ['escalera', 'cocina', 'bano'], openFront: true }];
  const uppers = F - 1;
  let bedLeft = bedrooms, bathLeft = Math.max(0, baths - 1);
  for (let f = 0; f < uppers; f++) {
    const remainingFloors = uppers - f;
    const beds = Math.ceil(bedLeft / remainingFloors);
    const bths = Math.ceil(bathLeft / remainingFloors);
    bedLeft -= beds; bathLeft -= bths;
    const list = [];
    for (let i = 0; i < beds; i++) list.push(f === 0 && i === 0 ? 'principal' : 'dormitorio');
    for (let i = 0; i < bths; i++) list.splice(Math.min(list.length, 1 + i * 2), 0, 'bano');
    if (!list.length) list.push('estudio');
    // Bedrooms prefer the front (street view); bathrooms go to the back.
    const dry = list.filter((t) => t !== 'bano');
    const nFront = Math.max(1, Math.ceil(dry.length / 2));
    const front = dry.slice(0, nFront);
    const rest = dry.slice(nFront);
    const back = ['escalera'];
    const wet = list.filter((t) => t === 'bano');
    // Alternate bedroom / bathroom across the back band.
    while (rest.length || wet.length) {
      if (wet.length) back.push(wet.shift());
      if (rest.length) back.push(rest.shift());
    }
    floors.push({ front: front.length ? front : ['estudio'], back, openFront: false });
  }
  return floors;
}

// Openings per facade, u measured along the facade (see house.js).
function openingsFor(h, level, front, back, F) {
  const openings = { front: [], back: [], left: [], right: [] };
  const win = (type) => (type === 'bano' || type === 'lavado' ? 'small' : type === 'escalera' ? 'narrow' : 'window');
  const isGround = level === 0;
  const doorX = 0;
  if (isGround) openings.front.push({ x: doorX, kind: 'door' });
  if (!isGround && h.balcony) openings.front.push({ x: 0, kind: 'slider' });
  for (const r of front) {
    if (r.type === 'closet') continue;
    const cx = (r.x0 + r.x1) / 2;
    const taken = openings.front.some((o) => Math.abs(o.x - cx) < 1.7);
    let x = cx;
    if (taken) {
      // Slide the window toward the room side away from the door.
      x = cx < 0 ? Math.min(cx, -1.9) : Math.max(cx, 1.9);
      if (x - 0.7 < r.x0 + 0.1 || x + 0.7 > r.x1 - 0.1 || openings.front.some((o) => Math.abs(o.x - x) < 1.6)) continue;
    }
    openings.front.push({ x, kind: 'window', room: r });
  }
  for (const r of back) if (r.type !== 'closet') openings.back.push({ x: (r.x0 + r.x1) / 2, kind: win(r.type), room: r });
  if (isGround && F > 1) openings.back = openings.back.map((o) => (o.room?.type === 'cocina' ? { ...o, kind: 'window' } : o));
  // Sides: one window for each band's end room.
  const sideRooms = (pick) => [pick(back), pick(front)].filter((r) => r && r.type !== 'closet');
  for (const r of sideRooms((b) => b[0])) openings.left.push({ z: (r.z0 + r.z1) / 2, kind: win(r.type), room: r });
  for (const r of sideRooms((b) => b[b.length - 1])) openings.right.push({ z: (r.z0 + r.z1) / 2, kind: win(r.type), room: r });

  return openings;
}

export function layoutHouse(h) {
  if (h.plan) {
    const rp = resolvePlan(h);
    if (rp) return layoutFromPlan(h, rp);
  }
  const F = h.floors, W = h.width, D = h.depth;
  const xL = -W / 2 + T, xR = W / 2 - T;
  const zF = D / 2 - T, zB = -D / 2 + T;
  const inner = zF - zB;
  const fb = Math.max(2.8, Math.min(6, inner * 0.45));
  const hall = inner - fb > 5.2 ? HALL : Math.max(0.9, inner - fb - 2.8);
  const zHallFront = zF - fb;
  const zHallBack = zHallFront - hall;

  const plan = program(F, h.bedrooms, h.bathrooms);
  // Drop rooms that can't fit their band (newest first) and remember how many.
  const missing = { bedrooms: 0, bathrooms: 0 };
  const width = xR - xL;
  const fits = (list) => list.reduce((s, t) => s + MIN_W[t], 0) <= width;
  for (const p of plan) {
    for (const band of ['back', 'front']) {
      const list = p[band];
      while (!fits(list)) {
        const i = list.findLastIndex((t) => t === 'dormitorio' || t === 'bano' || t === 'estudio');
        if (i < 0) break;
        const [t] = list.splice(i, 1);
        if (t === 'dormitorio') missing.bedrooms++;
        else if (t === 'bano') missing.bathrooms++;
      }
    }
  }
  const floors = plan.map((p, level) => {
    const front = splitX(p.front, xL, xR).map((r) => ({ ...r, z0: zHallFront, z1: zF, band: 'front' }));
    const back = splitX(p.back, xL, xR).map((r) => ({ ...r, z0: zB, z1: zHallBack, band: 'back' }));
    const rooms = [...front, ...back];
    if (hall > 0.5) rooms.push({ type: 'pasillo', x0: xL, x1: xR, z0: zHallBack, z1: zHallFront, band: 'hall', hidden: true });
    const count = {};
    for (const r of rooms) {
      const n = count[r.type] ?? 0;
      count[r.type] = n + 1;
      r.key = roomKey(level, r.type, n);
      r.level = level;
    }

    // Interior walls: [x0,z0,x1,z1] pieces with door gaps already cut.
    const walls = [];
    // Door gaps in partitions: { x, z, w, room, into } (into = +1/-1 along z).
    const doors = [];
    const gapLine = (z, rs) => {
      let x = xL;
      for (const r of rs) {
        const cx = (r.x0 + r.x1) / 2;
        const gw = r.type === 'escalera' ? Math.max(0.9, r.x1 - r.x0 - 0.4) : r.type === 'cocina' ? Math.min(2.2, r.x1 - r.x0 - 0.6) : 0.9;
        if (cx - gw / 2 > x + 0.05) walls.push([x, z, cx - gw / 2, z]);
        doors.push({ x: cx, z, w: gw, room: r, into: r.z0 < z - 0.01 ? -1 : 1, leaf: gw <= 0.95 });
        x = cx + gw / 2;
      }
      if (xR > x + 0.05) walls.push([x, z, xR, z]);
    };
    gapLine(zHallBack, back);
    for (let i = 1; i < back.length; i++) walls.push([back[i].x0, zB, back[i].x0, zHallBack]);
    if (!p.openFront) {
      gapLine(zHallFront, front);
      for (let i = 1; i < front.length; i++) walls.push([front[i].x0, zHallFront, front[i].x0, zF]);
    }

    const openings = openingsFor(h, level, front, back, F);

    return { level, rooms, walls, doors, openings, zHallFront, zHallBack, xL, xR, zF, zB };
  });
  floors.missing = missing;
  return floors;
}

// ---- editable plan ---------------------------------------------------------------------------
// `house.plan` (see .squad/PLANEDIT.md): { frontDepth, hall, innerDepth, levels: [{ front: [Room], back: [Room] }] },
// Room = { id, type, w }. resolvePlan() turns whatever is stored into a plan the layout can trust.

export const PLAN_TYPES = ['sala', 'comedor', 'cocina', 'dormitorio', 'principal', 'bano', 'escalera', 'estudio', 'lavado', 'closet'];
// Width a room gets when it is added.
export const DEFAULT_W = { sala: 3.6, comedor: 2.8, cocina: 3.0, dormitorio: 3.0, principal: 3.4, bano: 1.8, escalera: 1.4, estudio: 2.6, lavado: 1.8, closet: 1.8 };
// Rooms that share one open floor on the ground level (no walls between them).
export const OPEN_TYPES = new Set(['sala', 'comedor', 'cocina']);
export const STAIR_W = 1.4;
const ID_RE = /^\d:[a-z]+:\d{1,2}$/;
const r3 = (v) => Math.round(v * 1000) / 1000;
const minW = (type) => MIN_W[type] ?? 1.5;
const okNum = (v) => typeof v === 'number' && Number.isFinite(v);

// House-local inner rectangle every level shares.
export function planGeom(h) {
  const xL = -h.width / 2 + T, xR = h.width / 2 - T;
  const zF = h.depth / 2 - T, zB = -h.depth / 2 + T;
  return { xL, xR, zF, zB, width: xR - xL, inner: zF - zB };
}

// What the automatic layout does with the front band depth and the hall.
export function autoFront(inner) {
  const fb = Math.max(2.8, Math.min(6, inner * 0.45));
  const hall = inner - fb > 5.2 ? HALL : Math.max(0.9, inner - fb - 2.8);
  return { fb, hall };
}

// Front band >= 2.8 m, back band >= 2.6 m, hall between 0.9 and 2.4 m.
export function clampFront(inner, fb, hall) {
  hall = Math.min(2.4, Math.max(0.9, hall));
  const lo = 2.8, hi = inner - hall - 2.6;
  if (hi < lo) return { fb: lo, hall: Math.max(0.5, Math.min(hall, inner - lo - 2.6)) };
  return { fb: Math.min(hi, Math.max(lo, fb)), hall };
}

// Free id `${level}:${type}:${n}` (n 0..99) not in `used`; null when the type is exhausted.
export function newPlanId(level, type, used) {
  for (let n = 0; n < 100; n++) {
    const id = roomKey(level, type, n);
    if (!used.has(id)) return id;
  }
  return null;
}

// Make a band's widths sum to `total` and respect each room's minimum width.
// Stairs keep their width while other rooms can give. Mutates and returns `rooms`.
export function fitBand(rooms, total, { lockStairs = false } = {}) {
  const n = rooms.length;
  if (!n) return rooms;
  let sum = rooms.reduce((s, r) => s + r.w, 0);
  if (!(sum > 0)) rooms.forEach((r) => { r.w = WEIGHT[r.type] ?? 1; });
  sum = rooms.reduce((s, r) => s + r.w, 0);
  for (const r of rooms) r.w *= total / sum;
  const mins = rooms.map((r) => minW(r.type));
  const minSum = mins.reduce((s, v) => s + v, 0);
  if (minSum > total) {
    // Cannot fit: share what is left evenly by minimum width (the stairs keep theirs when locked).
    const keep = lockStairs ? rooms.filter((r) => r.type === 'escalera') : [];
    const keepW = keep.reduce((s, r) => s + r.w, 0);
    const others = rooms.filter((r) => !keep.includes(r));
    const oSum = others.reduce((s, r) => s + minW(r.type), 0);
    if (keep.length && others.length && keepW < total - 0.5) others.forEach((r) => { r.w = (minW(r.type) * (total - keepW)) / oSum; });
    else rooms.forEach((r, i) => { r.w = (mins[i] * total) / minSum; });
  } else {
    for (let pass = 0; pass < 12; pass++) {
      let deficit = 0;
      rooms.forEach((r, i) => { if (r.w < mins[i] - 1e-9) { deficit += mins[i] - r.w; r.w = mins[i]; } });
      if (deficit < 1e-9) break;
      const donors = (strict) => rooms.map((r, i) => ({ r, i })).filter(({ r, i }) => r.w > mins[i] + 1e-9 && !(strict && r.type === 'escalera'));
      let list = donors(lockStairs);
      let slack = list.reduce((s, { r, i }) => s + r.w - mins[i], 0);
      if (slack < deficit - 1e-9) { list = donors(false); slack = list.reduce((s, { r, i }) => s + r.w - mins[i], 0); }
      if (slack <= 1e-9) break;
      const k = Math.min(1, deficit / slack);
      for (const { r, i } of list) r.w -= (r.w - mins[i]) * k;
    }
  }
  rooms.forEach((r) => { r.w = r3(r.w); });
  // Put the rounding crumbs on the widest room that is not the stairs.
  const diff = r3(total - rooms.reduce((s, r) => s + r.w, 0));
  if (diff) {
    let best = rooms.find((r) => r.type !== 'escalera') ?? rooms[0];
    for (const r of rooms) if (r.type !== 'escalera' && r.w > best.w) best = r;
    best.w = r3(best.w + diff);
  }
  return rooms;
}

// A fresh upper level: two bedrooms in front, stairs + bath + study behind.
export function autoLevel(level, width, stairW, used) {
  const mk = (type) => ({ id: newPlanId(level, type, used) ?? roomKey(level, type, 99), type, w: WEIGHT[type] });
  const take = (r) => { used.add(r.id); return r; };
  const front = fitBand([take(mk('dormitorio')), take(mk('dormitorio'))], width);
  const stairs = take(mk('escalera'));
  stairs.w = stairW;
  const rest = [take(mk('bano')), take(mk('estudio'))];
  rest.forEach((r) => { r.w = (WEIGHT[r.type] * (width - stairW)) / (WEIGHT.bano + WEIGHT.estudio); });
  const back = fitBand([stairs, ...rest], width, { lockStairs: true });
  return { front, back };
}

// Validate + normalize h.plan against the current house size and floor count.
// Returns a fresh plan (never the stored object) or null when it cannot be used.
// opts.stairsFrom: level whose stairs width wins when levels disagree (default 0).
export function resolvePlan(h, { stairsFrom = 0 } = {}) {
  const p = h.plan;
  if (!p || typeof p !== 'object' || Array.isArray(p) || !Array.isArray(p.levels)) return null;
  const F = Math.max(1, Math.round(h.floors) || 1);
  const { width, inner } = planGeom(h);
  const levels = [];
  for (let level = 0; level < Math.min(F, p.levels.length); level++) {
    const src = p.levels[level];
    if (!src || typeof src !== 'object') return null;
    const used = new Set();
    const clean = (list) => {
      if (!Array.isArray(list)) return [];
      const out = [];
      for (const r of list.slice(0, 12)) {
        if (!r || typeof r !== 'object' || !PLAN_TYPES.includes(r.type)) continue;
        let id = typeof r.id === 'string' && ID_RE.test(r.id) && r.id.startsWith(`${level}:`) && !used.has(r.id) ? r.id : null;
        if (!id) id = newPlanId(level, r.type, used);
        if (!id) continue;
        used.add(id);
        out.push({ id, type: r.type, w: okNum(r.w) && r.w > 0 ? r.w : DEFAULT_W[r.type] });
      }
      return out;
    };
    const front = clean(src.front), back = clean(src.back);
    if (!front.length || !back.length) return null;
    levels.push({ front, back, used });
  }
  if (!levels.length) return null;
  if (!levels[0].front.concat(levels[0].back).some((r) => r.type === 'sala')) return null;

  // Stairs: exactly one per level when there is more than one floor, first in the back band, same width everywhere.
  let sw = null;
  const stairsOf = (lv) => lv.front.concat(lv.back).find((r) => r.type === 'escalera');
  if (F > 1) {
    const ref = stairsOf(levels[Math.min(stairsFrom, levels.length - 1)]) ?? stairsOf(levels[0]) ?? levels.map(stairsOf).find(Boolean);
    sw = Math.min(width * 0.45, Math.max(minW('escalera'), ref?.w ?? STAIR_W));
  }
  for (let level = 0; level < levels.length; level++) {
    const lv = levels[level];
    const old = stairsOf(lv);
    const strip = (list) => {
      // Take all stairs out of a band; their width goes to the next room.
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].type !== 'escalera') continue;
        const [gone] = list.splice(i, 1);
        const nb = list[i] ?? list[i - 1];
        if (nb) nb.w += gone.w;
      }
    };
    const keepFirst = F > 1 && lv.back[0]?.type === 'escalera' ? lv.back[0] : null;
    if (F === 1) { strip(lv.back); strip(lv.front); } else if (keepFirst) {
      const rest = lv.back.slice(1);
      strip(rest); strip(lv.front);
      const nb = rest[0];
      const delta = sw - keepFirst.w;
      if (nb) nb.w -= delta;
      keepFirst.w = sw;
      lv.back = [keepFirst, ...rest];
    } else {
      strip(lv.back); strip(lv.front);
      const stairs = { id: old?.id && !lv.back.concat(lv.front).some((r) => r.id === old.id) ? old.id : newPlanId(level, 'escalera', lv.used), type: 'escalera', w: sw };
      if (stairs.id) lv.used.add(stairs.id);
      const k = (width - sw) / Math.max(1e-6, lv.back.reduce((s, r) => s + r.w, 0));
      lv.back.forEach((r) => { r.w *= k; });
      lv.back.unshift(stairs);
    }
    if (!lv.front.length || !lv.back.length) return null;
    fitBand(lv.front, width);
    fitBand(lv.back, width, { lockStairs: true });
  }
  // Missing upper levels get a fresh one.
  const stairW = sw ?? STAIR_W;
  while (levels.length < F) {
    const level = levels.length, used = new Set();
    const lv = autoLevel(level, width, stairW, used);
    levels.push({ ...lv, used });
  }

  // Hall + front band depth. Depth changes scale the front band with the house.
  const auto = autoFront(inner);
  let fb = okNum(p.frontDepth) ? p.frontDepth : auto.fb;
  if (okNum(p.innerDepth) && p.innerDepth > 0 && Math.abs(p.innerDepth - inner) > 1e-6) fb *= inner / p.innerDepth;
  const c = clampFront(inner, fb, okNum(p.hall) ? p.hall : auto.hall);
  return {
    frontDepth: r3(c.fb), hall: r3(c.hall), innerDepth: r3(inner),
    levels: levels.map(({ front, back }) => ({ front: front.map(({ id, type, w }) => ({ id, type, w })), back: back.map(({ id, type, w }) => ({ id, type, w })) })),
  };
}

// layoutHouse() for a resolved plan. Same shape as the automatic layout.
function layoutFromPlan(h, rp) {
  const F = h.floors;
  const { xL, xR, zF, zB } = planGeom(h);
  const zHallFront = zF - rp.frontDepth, zHallBack = zHallFront - rp.hall;
  const floors = rp.levels.map((lv, level) => {
    const place = (list, band, z0, z1) => {
      let x = xL;
      return list.map((r, i) => {
        const o = { type: r.type, x0: x, x1: i === list.length - 1 ? xR : x + r.w, z0, z1, band, key: r.id, level };
        x = o.x1;
        return o;
      });
    };
    const front = place(lv.front, 'front', zHallFront, zF);
    const back = place(lv.back, 'back', zB, zHallBack);
    const rooms = [...front, ...back];
    if (rp.hall > 0.5) rooms.push({ type: 'pasillo', x0: xL, x1: xR, z0: zHallBack, z1: zHallFront, band: 'hall', hidden: true, key: roomKey(level, 'pasillo', 0), level });

    const walls = [], doors = [];
    // Rooms with no wall toward the hall (the ground floor's open living area).
    const open = (r) => level === 0 && OPEN_TYPES.has(r.type);
    const gapLine = (z, rs) => {
      let x = xL;
      for (const r of rs) {
        if (open(r)) {
          if (r.x0 > x + 0.05) walls.push([x, z, r.x0, z]);
          x = r.x1;
          continue;
        }
        const cx = (r.x0 + r.x1) / 2;
        const gw = r.type === 'escalera' ? Math.max(0.9, r.x1 - r.x0 - 0.4) : r.type === 'cocina' ? Math.min(2.2, r.x1 - r.x0 - 0.6) : 0.9;
        if (cx - gw / 2 > x + 0.05) walls.push([x, z, cx - gw / 2, z]);
        doors.push({ x: cx, z, w: gw, room: r, into: r.z0 < z - 0.01 ? -1 : 1, leaf: gw <= 0.95 });
        x = cx + gw / 2;
      }
      if (xR > x + 0.05) walls.push([x, z, xR, z]);
    };
    gapLine(zHallBack, back);
    for (let i = 1; i < back.length; i++) walls.push([back[i].x0, zB, back[i].x0, zHallBack]);
    gapLine(zHallFront, front);
    for (let i = 1; i < front.length; i++) if (!(open(front[i - 1]) && open(front[i]))) walls.push([front[i].x0, zHallFront, front[i].x0, zF]);

    const openings = openingsFor(h, level, front, back, F);
    return { level, rooms, walls, doors, openings, zHallFront, zHallBack, xL, xR, zF, zB };
  });
  floors.missing = { bedrooms: 0, bathrooms: 0 };
  return floors;
}
