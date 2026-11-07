// Yard: movable items (palms, trees, car...), fence with gates, pool,
// driveway, walkway and garden beds.
import { Group, Mesh, PlaneGeometry, CylinderGeometry, IcosahedronGeometry, SphereGeometry, Shape, ExtrudeGeometry, ConeGeometry, MeshStandardMaterial, DoubleSide, Vector3, Color, CatmullRomCurve3, BoxGeometry } from 'three';
import { createBuilder, mat4 } from './builder.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { frond, foliage, rng, palmBark, flowerCluster } from './textures.js';
import { canopyGeometry, leafMaterial } from './foliage.js';
import { poolRect } from './site.js';
import { buildFences } from './buildfence.js';

export { poolRect };

const PORCH_D = 2.6;

// ---- shared item geometry (built once) ----------------------------------------
let shared = null;
function sharedAssets() {
  if (shared) return shared;
  const f = frond().map;
  const leaf = foliage();
  shared = {
    frondMat: new MeshStandardMaterial({ map: f, alphaTest: 0.45, side: DoubleSide, roughness: 0.85, color: 0xd0dcb8 }),
    trunkMat: new MeshStandardMaterial({ color: 0xc9bca6, roughness: 0.95, map: palmBark().map, normalMap: palmBark().normalMap }),
    barkMat: new MeshStandardMaterial({ color: 0x5b4632, roughness: 0.95 }),
    leafMat: new MeshStandardMaterial({ map: leaf.map, normalMap: leaf.normalMap, normalScale: { x: 0.6, y: 0.6 }, roughness: 0.9, color: 0xc4d2b0 }),
    canopyMat: leafMaterial(MeshStandardMaterial),
    shrubMats: [leafMaterial(MeshStandardMaterial, { vertexColors: false, color: 0x4a7a32 }), leafMaterial(MeshStandardMaterial, { vertexColors: false, color: 0x5c8e3c })],
    // Blossom colours of Dominican gardens: trinitaria pink, coral red, white, orange, magenta, yellow.
    bloomMats: ['#ff4f93', '#f2333f', '#ffffff', '#ff9326', '#d846c8', '#ffd02e'].map((c) => new MeshStandardMaterial({ map: flowerCluster().map, alphaTest: 0.4, color: new Color(c), roughness: 0.6 })),
    potMat: new MeshStandardMaterial({ color: 0xf4f2ec, roughness: 0.5 }),
    lanternBody: new MeshStandardMaterial({ color: 0x1d1e1f, roughness: 0.45, metalness: 0.6 }),
    lanternGlass: new MeshStandardMaterial({ color: 0xfff1d0, emissive: new Color('#ffbb55'), emissiveIntensity: 0.08, roughness: 0.2, transparent: true, opacity: 0.92 }),
    frondGeo: makeFrondGeo(),
  };
  return shared;
}

// A frond: a strip bent down along its length and folded at the midrib.
function makeFrondGeo(sx = 4, sy = 14) {
  const g = new PlaneGeometry(0.75, 3.2, sx, sy);
  g.translate(0, 1.6, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const t = y / 3.2;
    p.setXYZ(i, x * (1 - t * 0.35), y * Math.cos(t * 0.9), -Math.abs(x) * 0.35 - y * Math.sin(t * 0.9) * 0.9);
  }
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

// Instanced palms for the landscape (land.js): one crown of 11 frond cards, shared frond material.
export function palmCrownGeometry(seed = 5) {
  const r = rng(seed);
  const parts = [];
  const base = makeFrondGeo(1, 6); // light fronds: these palms are instanced by the hundred
  for (let i = 0; i < 11; i++) {
    const f = base.clone();
    f.rotateX(-0.25 + r() * 0.5 - (i % 2) * 0.35);
    f.rotateY((i / 11) * Math.PI * 2 + r() * 0.3);
    f.scale(0.9 + r() * 0.25, 0.9 + r() * 0.25, 0.9 + r() * 0.25);
    parts.push(f);
  }
  return mergeGeometries(parts);
}
export const frondMaterial = () => sharedAssets().frondMat;

// Fence / porch lanterns glow with the house lights (index.js applyLights).
export function setLanternsOn(on) { sharedAssets().lanternGlass.emissiveIntensity = on ? 2.2 : 0.08; }

// A flowering shrub for beds and planters: a leaf-card bush with blossom cards on its upper surface.
function flowerBush(B, x, y, z, sz, ci, r) {
  const a = sharedAssets();
  const leaf = canopyGeometry(r, [[0, 0, 0, sz * 1.15, sz * 0.85, sz * 1.05]], ['#ffffff'], { n: 10, size: [sz * 0.42, sz * 0.62] });
  B.add(ci % 2 ? 'shrubB' : 'shrubA', leaf, mat4(x, y, z), { material: a.shrubMats[ci % 2], part: null, keepUV: true });
  const bloom = canopyGeometry(r, [[0, sz * 0.38, 0, sz * 1.1, sz * 0.62, sz * 1.05]], ['#ffffff'], { n: 18, size: [sz * 0.24, sz * 0.36] });
  const k = ci % a.bloomMats.length;
  B.add(`bloom${k}`, bloom, mat4(x, y, z), { material: a.bloomMats[k], part: null, keepUV: true });
}

function palm(seed) {
  const a = sharedAssets();
  const r = rng(seed);
  const g = new Group();
  const height = 6 + r() * 3;
  const lean = 0.5 + r() * 1.0;
  const curve = new CatmullRomCurve3([new Vector3(0, 0, 0), new Vector3(lean * 0.2, height * 0.35, 0), new Vector3(lean * 0.7, height * 0.7, 0), new Vector3(lean, height, 0)]);
  const segs = 14;
  for (let i = 0; i < segs; i++) {
    const p0 = curve.getPoint(i / segs), p1 = curve.getPoint((i + 1) / segs);
    const len = p0.distanceTo(p1);
    const rad = 0.2 - (i / segs) * 0.07;
    const c = new Mesh(new CylinderGeometry(rad * 0.92, rad, len * 1.02, 10), a.trunkMat);
    c.position.copy(p0).add(p1).multiplyScalar(0.5);
    c.lookAt(p1);
    c.rotateX(Math.PI / 2);
    c.castShadow = true;
    g.add(c);
  }
  const topP = curve.getPoint(1);
  const n = 11;
  for (let i = 0; i < n; i++) {
    const f = new Mesh(a.frondGeo, a.frondMat);
    f.position.copy(topP);
    f.rotation.set(0, (i / n) * Math.PI * 2 + r() * 0.3, 0, 'YXZ');
    f.rotateX(-0.25 + r() * 0.5 - (i % 2) * 0.35);
    f.scale.setScalar(0.85 + r() * 0.3);
    f.castShadow = true;
    g.add(f);
  }
  const coco = new MeshStandardMaterial({ color: 0x6b8e23, roughness: 0.6 });
  for (let i = 0; i < 4; i++) {
    const c = new Mesh(new SphereGeometry(0.13, 10, 8), coco);
    c.position.copy(topP).add(new Vector3(Math.cos(i * 1.6) * 0.22, -0.25, Math.sin(i * 1.6) * 0.22));
    g.add(c);
  }
  return g;
}

function mango(seed) {
  const a = sharedAssets();
  const r = rng(seed);
  const g = new Group();
  const trunk = new Mesh(new CylinderGeometry(0.22, 0.32, 2.6, 10), a.barkMat);
  trunk.position.y = 1.3;
  trunk.castShadow = true;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const b = new Mesh(new CylinderGeometry(0.08, 0.14, 1.8, 7), a.barkMat);
    b.position.set(Math.cos(i * 2.1) * 0.4, 2.9, Math.sin(i * 2.1) * 0.4);
    b.rotation.set(Math.sin(i * 2.1) * 0.5, 0, -Math.cos(i * 2.1) * 0.5);
    g.add(b);
  }
  // Canopy: clustered leaves (darker underneath / inside) instead of a few big blobs.
  const spots = [[0, 4.3, 0, 2.6, 1.3, 2.4]];
  for (let i = 0; i < 5; i++) {
    const ang = r() * Math.PI * 2, rad = 1.0 + r() * 1.3;
    spots.push([Math.cos(ang) * rad, 3.6 + r() * 1.6, Math.sin(ang) * rad, 1.1 + r() * 0.5, 0.8 + r() * 0.3, 1.1 + r() * 0.5]);
  }
  const canopy = new Mesh(canopyGeometry(r, spots, ['#4c6a39', '#587843', '#43602f', '#62824a', '#4f6e3e'], { n: 70, size: [0.24, 0.48] }), a.canopyMat);
  canopy.castShadow = true;
  canopy.receiveShadow = true;
  g.add(canopy);
  return g;
}

function flowers(seed) {
  const a = sharedAssets();
  const r = rng(seed);
  const g = new Group();
  const palette = [0xd6246e, 0xf26b9a, 0xff9f1c, 0xe63946, 0xffffff];
  const petal = new MeshStandardMaterial({ color: palette[(r() * palette.length) | 0], roughness: 0.6 });
  for (let i = 0; i < 5; i++) {
    const geo = new IcosahedronGeometry(0.45 + r() * 0.25, 1);
    const m = new Mesh(geo, a.leafMat);
    m.position.set((r() - 0.5) * 1.2, 0.35 + r() * 0.25, (r() - 0.5) * 1.2);
    m.scale.y = 0.8;
    m.castShadow = true;
    g.add(m);
  }
  const dot = new IcosahedronGeometry(0.07, 0);
  for (let i = 0; i < 70; i++) {
    const m = new Mesh(dot, petal);
    const ang = r() * Math.PI * 2, rad = 0.3 + r() * 0.65;
    m.position.set(Math.cos(ang) * rad, 0.45 + r() * 0.5, Math.sin(ang) * rad);
    g.add(m);
  }
  return g;
}

const CAR_COLORS = [0xf2f2f0, 0xb8bcc2, 0x1f2a44, 0xa4161a, 0x2b2d2f];
function car(seed, mats) {
  const r = rng(seed);
  const g = new Group();
  const paint = mats.plain('#' + new Color(CAR_COLORS[(r() * CAR_COLORS.length) | 0]).getHexString(), { roughness: 0.25, metalness: 0.6 });
  const L = 4.6, Wd = 1.85;
  // Side profile (x along length, y up), extruded across the width.
  const s = new Shape();
  s.moveTo(-L / 2, 0.35);
  s.lineTo(-L / 2, 0.85);
  s.quadraticCurveTo(-L / 2 + 0.05, 0.98, -L / 2 + 0.4, 1.0);
  s.lineTo(-0.55, 1.05);
  s.lineTo(0.95, 1.05);
  s.quadraticCurveTo(L / 2 - 0.1, 0.95, L / 2, 0.75);
  s.lineTo(L / 2, 0.35);
  s.lineTo(-L / 2, 0.35);
  const body = new ExtrudeGeometry(s, { depth: Wd - 0.12, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 4, curveSegments: 10 });
  body.translate(0, 0, -(Wd - 0.12) / 2);
  const bm = new Mesh(body, paint);
  bm.castShadow = true;
  g.add(bm);
  const cab = new Shape();
  cab.moveTo(-1.55, 1.0);
  cab.lineTo(-1.1, 1.48);
  cab.lineTo(0.35, 1.5);
  cab.lineTo(0.95, 1.04);
  cab.lineTo(-1.55, 1.0);
  const cg = new ExtrudeGeometry(cab, { depth: Wd - 0.34, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3 });
  cg.translate(0, 0, -(Wd - 0.34) / 2);
  const glass = mats.glass();
  g.add(new Mesh(cg, glass));
  const roof = new Mesh(new BoxGeometry(1.35, 0.05, Wd - 0.3), paint);
  roof.position.set(-0.4, 1.5, 0);
  g.add(roof);
  const tire = mats.plain('#151515', { roughness: 0.9 });
  const rim = mats.plain('#c9ccd0', { roughness: 0.25, metalness: 0.9 });
  for (const x of [-1.4, 1.45]) for (const z of [-1, 1]) {
    const t = new Mesh(new CylinderGeometry(0.36, 0.36, 0.26, 24), tire);
    t.rotation.x = Math.PI / 2;
    t.position.set(x, 0.36, z * (Wd / 2 - 0.08));
    t.castShadow = true;
    g.add(t);
    const rm = new Mesh(new CylinderGeometry(0.22, 0.22, 0.27, 16), rim);
    rm.rotation.x = Math.PI / 2;
    rm.position.copy(t.position);
    g.add(rm);
  }
  const lamp = mats.plain('#fff6d5', { roughness: 0.1 });
  const tail = mats.plain('#b0121b', { roughness: 0.3 });
  for (const z of [-1, 1]) {
    const hl = new Mesh(new BoxGeometry(0.06, 0.12, 0.38), lamp);
    hl.position.set(L / 2 + 0.04, 0.72, z * 0.62);
    g.add(hl);
    const tl = new Mesh(new BoxGeometry(0.06, 0.14, 0.34), tail);
    tl.position.set(-L / 2 - 0.04, 0.82, z * 0.64);
    g.add(tl);
  }
  return g;
}

function gazebo(mats) {
  const g = new Group();
  const wood = mats.textured('wood', '#8a5a3b', { roughness: 0.6 });
  const roof = mats.roof('tile', '#a5472f');
  const deck = new Mesh(new BoxGeometry(3.4, 0.2, 3.4), wood);
  deck.position.y = 0.1;
  g.add(deck);
  for (const x of [-1.5, 1.5]) for (const z of [-1.5, 1.5]) {
    const post = new Mesh(new BoxGeometry(0.16, 2.5, 0.16), wood);
    post.position.set(x, 1.35, z);
    post.castShadow = true;
    g.add(post);
  }
  const cone = new ConeGeometry(2.9, 1.4, 4, 1);
  cone.rotateY(Math.PI / 4);
  const cm = new Mesh(cone, roof);
  cm.position.y = 3.3;
  cm.castShadow = true;
  g.add(cm);
  const t = new Mesh(new CylinderGeometry(0.6, 0.6, 0.05, 24), wood);
  t.position.y = 0.95;
  g.add(t);
  return g;
}

function bench(mats) {
  const g = new Group();
  const wood = mats.textured('wood', '#9c6b43', { roughness: 0.6 });
  const iron = mats.plain('#2c2c2c', { roughness: 0.5, metalness: 0.6 });
  for (let i = 0; i < 4; i++) {
    const s = new Mesh(new BoxGeometry(1.6, 0.04, 0.09), wood);
    s.position.set(0, 0.45, -0.18 + i * 0.12);
    g.add(s);
  }
  for (let i = 0; i < 3; i++) {
    const s = new Mesh(new BoxGeometry(1.6, 0.09, 0.04), wood);
    s.position.set(0, 0.6 + i * 0.13, -0.24);
    g.add(s);
  }
  for (const x of [-0.7, 0.7]) {
    const l = new Mesh(new BoxGeometry(0.05, 0.45, 0.5), iron);
    l.position.set(x, 0.225, -0.03);
    g.add(l);
  }
  g.traverse((m) => { m.castShadow = true; });
  return g;
}

function bbq(mats) {
  const g = new Group();
  const brick = mats.paint('#a0522d', 'block');
  const top = mats.plain('#ddd8cf', { roughness: 0.4 });
  const iron = mats.plain('#1e1e1e', { roughness: 0.4, metalness: 0.7 });
  const base = new Mesh(new BoxGeometry(2.0, 0.9, 0.8), brick);
  base.position.y = 0.45;
  g.add(base);
  const ct = new Mesh(new BoxGeometry(2.1, 0.06, 0.9), top);
  ct.position.y = 0.93;
  g.add(ct);
  const grill = new Mesh(new BoxGeometry(0.9, 0.35, 0.6), iron);
  grill.position.set(0.4, 1.12, 0);
  g.add(grill);
  const chim = new Mesh(new BoxGeometry(0.5, 1.2, 0.5), brick);
  chim.position.set(-0.6, 1.5, 0.05);
  g.add(chim);
  g.traverse((m) => { m.castShadow = true; m.receiveShadow = true; });
  return g;
}

const ITEM_RADIUS = { palm: 0.4, mango: 0.6, flowers: 0.6, car: 1.2, gazebo: 1.7, bench: 0.6, bbq: 1.0 };

export function buildItem(item, mats) {
  const seed = [...item.id].reduce((s, c) => s * 31 + c.charCodeAt(0), 7);
  const make = { palm: () => palm(seed), mango: () => mango(seed), flowers: () => flowers(seed), car: () => car(seed, mats), gazebo: () => gazebo(mats), bench: () => bench(mats), bbq: () => bbq(mats) }[item.type];
  if (!make) return null;
  const g = make();
  g.position.set(item.x, 0, item.z);
  g.rotation.y = item.rot ?? 0;
  g.userData.itemId = item.id;
  g.traverse((m) => {
    m.userData.part = `item:${item.id}`;
    if (m.isMesh) m.receiveShadow = true;
  });
  g.userData.radius = ITEM_RADIUS[item.type] ?? 0.5;
  return g;
}

// Static yard features in world coordinates.
export function buildYard(state, mats, houseInfo) {
  const { land, house: h, yard } = state;
  const B = createBuilder();
  const hx = h.offsetX, hz = h.offsetZ;
  const LW = land.width, LD = land.depth;
  const front = LD / 2;
  const porchFront = hz + h.depth / 2 + (h.porch ? PORCH_D + 1.0 : 0.4);
  const concrete = { material: mats.textured('concrete', '#dcd8d0'), part: null };
  const pavers = { material: mats.textured('pavers', '#ffffff', { roughness: 0.9 }), part: null };
  const mulch = { material: mats.plain('#5a4330', { roughness: 1 }), part: null };
  const fenceM = { material: mats.paint(yard.fenceColor), part: 'fence' };
  const capM = { material: mats.paint(yard.fenceColor), part: 'fence' };
  const iron = { material: mats.plain('#2a2a2a', { roughness: 0.45, metalness: 0.6 }), part: 'fence' };
  const coping = { material: mats.plain('#efe9df', { roughness: 0.7 }), part: null };
  const poolTile = { material: mats.textured('poolTile', '#ffffff', { roughness: 0.3 }), part: null };
  const waterM = { material: mats.water(), part: null, shadow: false };

  // Driveway from the street to the carport (or a parking pad).
  let drive = null;
  const plan = state.yardPlan;
  if (plan) {
    for (const r of plan.drive) B.box('concrete', concrete, r.w, 0.06, r.d, r.x, 0.03, r.z);
    for (const r of plan.walk) B.box('pavers', pavers, r.w, 0.05, r.d, r.x, 0.025, r.z);
  } else if (h.carport && houseInfo.carport) {
    const c = houseInfo.carport;
    drive = { x: hx + c.x, w: c.w, z0: hz + c.zBack, z1: front };
    B.box('concrete', concrete, c.w, 0.06, front - (hz + c.zFront), drive.x, 0.03, (hz + c.zFront + front) / 2);
  } else if (yard.driveway) {
    const x = Math.min(LW / 2 - 2.2, hx + h.width / 2 + 2.2);
    drive = { x, w: 3.2, z0: front - 6, z1: front };
    B.box('concrete', concrete, 3.2, 0.06, 6, x, 0.03, front - 3);
  }
  // Joints in the concrete every 1.5 m read as real paving.
  if (drive) for (let z = drive.z1 - 1.5; z > drive.z0 + 0.5; z -= 1.5) B.box('joint', { material: mats.plain('#a9a49b'), part: null, shadow: false }, drive.w, 0.065, 0.025, drive.x, 0.03, z);

  // Walkway from the gate to the front steps.
  const pathLen = front - porchFront;
  if (!plan && pathLen > 0.3) B.box('pavers', pavers, 1.3, 0.05, pathLen, hx, 0.025, porchFront + pathLen / 2);

  // Garden beds along the front.
  if (yard.garden) {
    const z = hz + h.depth / 2 + (h.porch ? PORCH_D : 0) + 0.55;
    const r = rng(land.seed);
    for (const side of [-1, 1]) {
      const x0 = hx + side * 1.6, x1 = hx + side * (h.width / 2 - 0.2);
      const len = Math.abs(x1 - x0);
      if (len < 1) continue;
      B.box('mulch', mulch, len, 0.08, 0.9, (x0 + x1) / 2, 0.04, z);
      B.box('curb', coping, len + 0.1, 0.14, 0.08, (x0 + x1) / 2, 0.07, z + 0.48);
      const n = Math.floor(len / 0.7);
      for (let i = 0; i < n; i++) {
        // Flowering shrubs in mixed colours (leaf cards + blossom cards).
        flowerBush(B, Math.min(x0, x1) + 0.35 + i * 0.7, 0.3, z + (r() - 0.5) * 0.2, 0.3 + r() * 0.12, (i + (side > 0 ? 3 : 0)) % 6, r);
      }
    }
  }

  // Pool with coping, deck, and loungers.
  const pr = poolRect(state);
  if (pr) {
    const depth = 1.4, wl = -0.12;
    const { x, z, w, d } = pr;
    B.box('poolTile', poolTile, w, 0.05, d, x, -depth, z);
    for (const [ww, dd, xx, zz] of [[w, 0.05, x, z - d / 2], [w, 0.05, x, z + d / 2], [0.05, d, x - w / 2, z], [0.05, d, x + w / 2, z]]) B.box('poolTile', poolTile, ww, depth, dd, xx, -depth / 2, zz);
    B.box('water', waterM, w, 0.02, d, x, wl, z);
    const cw = 0.35;
    for (const [ww, dd, xx, zz] of [[w + 2 * cw, cw, x, z - d / 2 - cw / 2], [w + 2 * cw, cw, x, z + d / 2 + cw / 2], [cw, d, x - w / 2 - cw / 2, z], [cw, d, x + w / 2 + cw / 2, z]]) B.box('coping', coping, ww, 0.06, dd, xx, 0.03, zz);
    const lounger = { material: mats.plain('#ffffff', { roughness: 0.5 }), part: null };
    for (const k of [-1, 1]) {
      const lx = x + k * 1.1, lz = z + d / 2 + cw + 1.0;
      if (lz > front - 1) continue;
      B.box('lounger', lounger, 0.7, 0.3, 1.9, lx, 0.15, lz);
      B.box('lounger', lounger, 0.7, 0.06, 0.7, 0, 0, 0, mat4(lx, 0.55, lz - 0.75, 0, -0.6));
    }
  }

  // Lot fence with a vehicle gate and a pedestrian gate on the street side (or the hand-drawn fences).
  let customSegs = [];
  if (yard.fence === 'custom') {
    const fences = state.build?.fences ?? [];
    customSegs = buildFences(B, mats, fences).segments;
    if (!fences.length) {
      const stake = { material: mats.plain('#f2efe8'), part: null };
      for (const [x, z] of [[-LW / 2, -LD / 2], [LW / 2, -LD / 2], [-LW / 2, front], [LW / 2, front]]) B.box('stake', stake, 0.12, 0.6, 0.12, x, 0.3, z);
    }
  } else if (yard.fence !== 'none') {
    const H = 1.9;
    const low = yard.fence === 'rejas' ? 0.6 : H;
    const gates = [{ x: hx, w: 1.3 }];
    if (drive) gates.push({ x: drive.x, w: Math.max(3.4, drive.w) });
    const run = (x0, z0, x1, z1, withGates) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const dirx = (x1 - x0) / len, dirz = (z1 - z0) / len;
      const cuts = withGates ? gates.map((g) => [g.x - g.w / 2 - x0, g.x + g.w / 2 - x0]).sort((a, b) => a[0] - b[0]) : [];
      const pieces = [];
      let t = 0;
      for (const [a, b] of cuts) { if (a > t) pieces.push([t, a]); t = Math.max(t, b); }
      if (t < len) pieces.push([t, len]);
      for (const [a, b] of pieces) {
        const pl = b - a;
        if (pl < 0.05) continue;
        const cx = x0 + dirx * (a + pl / 2), cz = z0 + dirz * (a + pl / 2);
        const ry = Math.atan2(-dirz, dirx);
        B.box('fence', fenceM, pl, low, 0.2, cx, low / 2, cz, null, ry);
        B.box('fenceCap', capM, pl + 0.04, 0.06, 0.28, cx, low + 0.03, cz, null, ry);
        if (yard.fence === 'rejas') {
          const n = Math.floor(pl / 0.14);
          for (let i = 1; i < n; i++) {
            const tt = a + (i * pl) / n;
            B.box('bars', iron, 0.025, H - low, 0.025, x0 + dirx * tt, low + (H - low) / 2, z0 + dirz * tt);
          }
          B.box('bars', iron, pl, 0.04, 0.04, cx, H - 0.08, cz, null, ry);
        }
        // Pillars (the street side carries a black lantern on each, like the gate posts of most Dominican houses).
        const np = Math.max(1, Math.round(pl / 3));
        const la = sharedAssets();
        for (let i = 0; i <= np; i++) {
          const tt = a + (i * pl) / np;
          const px = x0 + dirx * tt, pz = z0 + dirz * tt;
          B.box('fence', fenceM, 0.38, H + 0.15, 0.38, px, (H + 0.15) / 2, pz);
          B.box('fenceCap', capM, 0.48, 0.08, 0.48, px, H + 0.19, pz);
          if (withGates && (i === 0 || i === np)) {
            B.box('lanternBody', { material: la.lanternBody, part: null }, 0.24, 0.04, 0.24, px, H + 0.25, pz);
            B.box('lanternGlass', { material: la.lanternGlass, part: null, shadow: false }, 0.17, 0.26, 0.17, px, H + 0.4, pz);
            for (const [ox, oz] of [[-0.09, -0.09], [0.09, -0.09], [-0.09, 0.09], [0.09, 0.09]]) B.box('lanternBody', { material: la.lanternBody, part: null }, 0.025, 0.28, 0.025, px + ox, H + 0.4, pz + oz);
            B.box('lanternBody', { material: la.lanternBody, part: null }, 0.26, 0.05, 0.26, px, H + 0.56, pz);
            B.box('lanternBody', { material: la.lanternBody, part: null }, 0.12, 0.06, 0.12, px, H + 0.61, pz);
          }
        }
      }
    };
    run(-LW / 2, front, LW / 2, front, true);
    run(-LW / 2, -LD / 2, LW / 2, -LD / 2, false);
    run(-LW / 2, -LD / 2, -LW / 2, front, false);
    run(LW / 2, -LD / 2, LW / 2, front, false);
    // Iron gates (portón), drawn closed-but-see-through.
    for (const g of gates) {
      const gw = g.w - 0.1;
      B.box('bars', iron, gw, 0.05, 0.05, g.x, 0.12, front);
      B.box('bars', iron, gw, 0.05, 0.05, g.x, H - 0.05, front);
      B.box('bars', iron, gw, 0.04, 0.04, g.x, H * 0.55, front);
      const n = Math.floor(gw / 0.13);
      for (let i = 1; i < n; i++) B.box('bars', iron, 0.025, H - 0.12, 0.025, g.x - gw / 2 + (i * gw) / n, H / 2 + 0.03, front);
    }
  } else {
    // Boundary stakes (lindero) so the lot edge is readable.
    const stake = { material: mats.plain('#f2efe8'), part: null };
    for (const [x, z] of [[-LW / 2, -LD / 2], [LW / 2, -LD / 2], [-LW / 2, front], [LW / 2, front]]) B.box('stake', stake, 0.12, 0.6, 0.12, x, 0.3, z);
    // (The lot edge line is drawn by land.js on the slab.)
  }

  // Flower strip inside the street fence (both sides of the gates), and potted plants at the foot of the walkway.
  if (yard.garden && (yard.fence === 'wall' || yard.fence === 'rejas') && !plan) {
    const r = rng(land.seed + 17);
    const zs = front - 0.62;
    const blocked = [{ x: hx, w: 1.3 + 0.9 }];
    if (drive) blocked.push({ x: drive.x, w: Math.max(3.4, drive.w) + 0.9 });
    const spans = [];
    let x = -LW / 2 + 0.35;
    const xEnd = LW / 2 - 0.35;
    blocked.sort((p, q) => p.x - q.x);
    for (const g of blocked) { const a0 = g.x - g.w / 2; if (a0 > x + 0.8) spans.push([x, Math.min(a0, xEnd)]); x = Math.max(x, g.x + g.w / 2); }
    if (xEnd > x + 0.8) spans.push([x, xEnd]);
    let ci = 0;
    for (const [a0, a1] of spans) {
      const len = a1 - a0;
      B.box('mulch', mulch, len, 0.07, 0.85, (a0 + a1) / 2, 0.035, zs);
      B.box('curb', coping, len, 0.12, 0.07, (a0 + a1) / 2, 0.06, zs - 0.46);
      const n = Math.max(1, Math.floor(len / 0.62));
      for (let i = 0; i < n; i++) flowerBush(B, a0 + (i + 0.5) * (len / n), 0.36, zs + (r() - 0.5) * 0.18, 0.36 + r() * 0.12, ci++ % 6, r);
    }
  }
  if (yard.garden && !plan && pathLen > 1.2) {
    const r = rng(land.seed + 23);
    const a = sharedAssets();
    for (const side of [-1, 1]) {
      const px = hx + side * 1.05, pz = porchFront + 0.45;
      B.add('pot', new CylinderGeometry(0.26, 0.19, 0.5, 18), mat4(px, 0.25, pz), { material: a.potMat, part: null });
      B.add('potRim', new CylinderGeometry(0.28, 0.28, 0.06, 18), mat4(px, 0.5, pz), { material: a.potMat, part: null });
      flowerBush(B, px, 0.82, pz, 0.32, side > 0 ? 0 : 5, r);
    }
  }

  const group = B.build();
  group.name = 'yard';
  // Fence collision for walk mode.
  const segments = [];
  if (yard.fence === 'custom') segments.push(...customSegs);
  else if (yard.fence !== 'none') {
    segments.push({ a: [-LW / 2, -LD / 2], b: [LW / 2, -LD / 2] }, { a: [-LW / 2, -LD / 2], b: [-LW / 2, front] }, { a: [LW / 2, -LD / 2], b: [LW / 2, front] });
  }
  return { group, segments, pool: pr };
}
