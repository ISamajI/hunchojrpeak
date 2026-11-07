// Land. Realism pass (2026-11-07): the lot is a real tropical lawn (4 m turf + large-scale lush / dry patches)
// with a concrete curb (or the user's photo), instanced grass tufts along the fences and around the lot, worn
// asphalt, painted Dominican neighbour houses with windows, rejas and tinacos, more trees, and hazy hills.
import { ShaderMaterial, Shape, Path, ShapeGeometry, ExtrudeGeometry, BufferGeometry, PlaneGeometry, Mesh, MeshStandardMaterial, MeshBasicMaterial, MeshPhysicalMaterial, Group, Color, CylinderGeometry, IcosahedronGeometry, ConeGeometry, BoxGeometry, InstancedMesh, Object3D, TextureLoader, SRGBColorSpace, DoubleSide, Float32BufferAttribute, RepeatWrapping } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { grass, sand, concrete, water as waterTex, rng, turf, lawnMacro, facade, asphalt } from './textures.js';
import { canopyGeometry, leafMaterial } from './foliage.js';
import { palmCrownGeometry, frondMaterial } from './props.js';

export const NEAR = 70;
// The lot top stays at y = 0 (everything is built on it); the land around sits this much lower.
export const SLAB = 0.06;

// Smooth 2D value noise (not tileable; used for terrain heights).
function noise2(seed) {
  const hash = (x, y) => {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = s(x - xi), yf = s(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}
function fbm(n, x, y, oct = 5) {
  let v = 0, a = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { v += n(x * f, y * f) * a; norm += a; a *= 0.5; f *= 2.03; }
  return v / norm;
}
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Low rolling ground around the lot; the big hills / mountains are separate hazy ridge layers far away.
export function terrainHeight(scenery, seed) {
  const n = noise2(seed);
  return (x, z) => {
    const d = Math.max(Math.abs(x) - NEAR, Math.abs(z) - NEAR, 0);
    const ramp = smoothstep(0, 160, d);
    const base = fbm(n, x / 220, z / 220);
    if (scenery === 'sea') {
      if (z < -NEAR) return -smoothstep(0, 45, -z - NEAR) * 7 + smoothstep(-NEAR - 3, -NEAR, z) * 0.2;
      return ramp * (1.5 + base * 7) * (z > 0 ? 1 : 0.6);
    }
    if (scenery === 'countryside') return ramp * (1 + base * 6) + smoothstep(0, 40, d) * fbm(n, x / 40, z / 40, 3) * 1.5;
    return ramp * (1.5 + base * 8);
  };
}

// Distant ridges as flat silhouettes (aerial perspective): 3 rings, further = higher, lighter, bluer.
// Their colours are re-tinted toward the haze by tint() every time the light changes.
const HAZE_RIDGE = new Color(0xa9c4cf);
function ridgeLayers(scenery, seed, own) {
  // Realism pass 3: forested green mountains (vertex-coloured canopy mottling, darker valleys, lighter crests)
  // instead of pale grey silhouettes; aerial perspective only on the farther layers.
  const n = noise2(seed + 41), m = noise2(seed + 43);
  const big = scenery === 'mountains' || !scenery;
  const spec = [
    { r: 470, h: big ? 30 : 13, col: 0x3a6a2c, k: 0.14, f: 60 },
    { r: 640, h: big ? 60 : 24, col: 0x47703c, k: 0.38, f: 90 },
    { r: 840, h: big ? 100 : 36, col: 0x557a52, k: 0.58, f: 130 },
  ];
  const sea = scenery === 'sea';
  const layers = [];
  const group = new Group();
  const col = new Color(), dark = new Color(0x1f3a1c);
  for (const [i, L] of spec.entries()) {
    const t0 = sea ? -Math.PI / 2 + 0.25 : 0, tl = sea ? Math.PI - 0.5 : Math.PI * 2;
    const geo = own(new CylinderGeometry(L.r, L.r, 1, 480, 12, true, t0, tl));
    const p = geo.attributes.position;
    const cols = new Float32Array(p.count * 3);
    const base = new Color(L.col);
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), z = p.getZ(k), f = p.getY(k) + 0.5; // 0 bottom .. 1 top
      const a = Math.atan2(x, z);
      // Bigger behind the lot (the view most cameras see past the house) for mountain scenery.
      const back = big ? 0.55 + 0.45 * smoothstep(0.2, -0.9, Math.cos(a)) : 1;
      const v = fbm(n, Math.cos(a) * L.f / 40 + i * 7, Math.sin(a) * L.f / 40, 4);
      const top = (0.2 + v * 1.1) * L.h * back;
      p.setY(k, -12 + f * f * (top + 12));
      // Canopy mottling (tree clumps), darker toward the valley floor, sunlit crests.
      const mot = fbm(m, Math.cos(a) * L.f / 4 + i * 3, f * 6 + Math.sin(a) * L.f / 4, 4);
      const ridge = fbm(m, Math.cos(a) * L.f / 1.5 + 40, Math.sin(a) * L.f / 1.5, 2); // folds and gullies
      col.copy(base).lerp(dark, (1 - f) * 0.3 + (mot - 0.5) * 1.2 * (1 - i * 0.3) + (ridge - 0.5) * 0.5)
        .multiplyScalar(0.9 + f * 0.22);
      // Aerial perspective baked per layer: farther ridges turn paler and bluer.
      col.lerp(HAZE_RIDGE, L.k * (0.75 + 0.25 * f));
      cols.set([col.r, col.g, col.b], k * 3);
    }
    geo.setAttribute('color', new Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const mat = own(new MeshBasicMaterial({ color: 0xffffff, vertexColors: true, side: DoubleSide, fog: false }));
    const mesh = new Mesh(geo, mat);
    mesh.position.y = -2;
    mesh.renderOrder = -5;
    mesh.raycast = () => {};
    group.add(mesh);
    layers.push({ mat, k: L.k });
  }
  const white = new Color(1, 1, 1), air = new Color();
  return {
    group,
    tint(haze, day) {
      // At night the ridges sit as dark silhouettes against the last light, never brighter than the sky.
      air.copy(haze).multiplyScalar(1.4);
      for (const L of layers) L.mat.color.copy(white).lerp(air, L.k * 0.3).multiplyScalar(0.06 + 0.94 * day);
    },
  };
}

export function buildLand(state, pool, onLoad = () => {}) {
  const { land } = state;
  const group = new Group();
  group.name = 'land';
  const owned = [];
  let disposed = false;
  const own = (o) => { owned.push(o); return o; };
  const W = land.width, D = land.depth;
  const front = D / 2;
  const height = terrainHeight(land.scenery, land.seed);

  // ---- the lot -----------------------------------------------------------------
  const lotShape = new Shape().moveTo(-W / 2, -D / 2).lineTo(W / 2, -D / 2).lineTo(W / 2, D / 2).lineTo(-W / 2, D / 2).lineTo(-W / 2, -D / 2);
  if (pool) {
    // Shape y maps to world -z after the rotation below.
    const { x, z, w, d } = pool;
    lotShape.holes.push(new Path().moveTo(x - w / 2, -z - d / 2).lineTo(x + w / 2, -z - d / 2).lineTo(x + w / 2, -z + d / 2).lineTo(x - w / 2, -z + d / 2).lineTo(x - w / 2, -z - d / 2));
  }
  const lotGeo = own(new ShapeGeometry(lotShape));
  const usePhotoGround = land.mode === 'photo' && land.photo && land.photoMode === 'ground';
  {
    const p = lotGeo.attributes.position;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      if (usePhotoGround) { uv[i * 2] = (x + W / 2) / W; uv[i * 2 + 1] = (y + D / 2) / D; }
      else { uv[i * 2] = x / 4; uv[i * 2 + 1] = y / 4; }
    }
    lotGeo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  }
  lotGeo.rotateX(-Math.PI / 2);
  const g = grass();
  const tf = turf();
  let lotMat;
  if (usePhotoGround) {
    const t = own(new TextureLoader().load(land.photo, onLoad));
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    lotMat = own(new MeshStandardMaterial({ map: t, roughness: 0.95 }));
  } else {
    lotMat = own(macroTint(new MeshStandardMaterial({ map: tf.map, normalMap: tf.normalMap, normalScale: { x: 0.7, y: 0.7 }, color: land.scenery === 'sea' ? 0xf0f0dc : 0xffffff, roughness: 1 }), 1 / 9));
  }
  const lot = new Mesh(lotGeo, lotMat);
  lot.receiveShadow = true;
  lot.name = 'lot';
  group.add(lot);
  // Lot edge: soil sides (6 cm) and a thin concrete curb on top (1.5 cm).
  {
    const sideMat = own(new MeshStandardMaterial({ color: 0x6f5f45, roughness: 1 }));
    const edgeMat = own(new MeshStandardMaterial({ color: 0xc9c4b8, roughness: 0.9 }));
    const e = 0.015;
    for (const [w, d, x, z] of [[W, e, 0, -D / 2], [W, e, 0, D / 2], [e, D, -W / 2, 0], [e, D, W / 2, 0]]) {
      const side = new Mesh(own(new BoxGeometry(w + e, SLAB, d + e)), sideMat);
      side.position.set(x, -SLAB / 2 - 0.001, z);
      side.receiveShadow = true;
      group.add(side);
      const edge = new Mesh(own(new BoxGeometry(w + e, 0.004, d + e)), edgeMat);
      edge.position.set(x, 0.001, z);
      edge.receiveShadow = true;
      group.add(edge);
    }
  }

  // ---- near ring (flat neighborhood around the lot) ----------------------------
  const ring = new Shape().moveTo(-NEAR, -NEAR).lineTo(NEAR, -NEAR).lineTo(NEAR, NEAR).lineTo(-NEAR, NEAR).lineTo(-NEAR, -NEAR);
  ring.holes.push(new Path().moveTo(-W / 2, -D / 2).lineTo(W / 2, -D / 2).lineTo(W / 2, D / 2).lineTo(-W / 2, D / 2).lineTo(-W / 2, -D / 2));
  const ringGeo = own(new ShapeGeometry(ring));
  {
    const p = ringGeo.attributes.position;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / 4; uv[i * 2 + 1] = p.getY(i) / 4; }
    ringGeo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  }
  ringGeo.rotateX(-Math.PI / 2);
  // Lawn: the same 4 m turf as the lot, slightly wilder and drier, with large lush / dry patches on top.
  const wildGrass = own(macroTint(new MeshStandardMaterial({ map: tf.map, normalMap: tf.normalMap, normalScale: { x: 0.6, y: 0.6 }, color: land.scenery === 'sea' ? 0xece6c8 : 0xf4f2e2, roughness: 1 }), 1 / 14));
  const ringMesh = new Mesh(ringGeo, wildGrass);
  ringMesh.position.y = -SLAB;
  ringMesh.receiveShadow = true;
  group.add(ringMesh);

  // ---- street + sidewalk in front ---------------------------------------------
  const rural = land.scenery === 'countryside';
  const conc = concrete();
  const sidewalkMat = own(new MeshStandardMaterial({ map: conc.map, normalMap: conc.normalMap, color: 0xeeebe4, roughness: 0.9 }));
  const asp = asphalt();
  const roadMat = own(rural
    ? new MeshStandardMaterial({ color: 0xc2ae8e, roughness: 0.95, map: sand().map })
    : new MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, map: asp.map, normalMap: asp.normalMap, normalScale: { x: 0.5, y: 0.5 } }));
  const sw = new Mesh(own(new BoxGeometry(NEAR * 2, 0.12, 1.8)), sidewalkMat);
  sw.position.set(0, 0.06 - SLAB / 2, front + 0.9);
  sw.scale.y = (0.12 + SLAB) / 0.12;
  sw.receiveShadow = true;
  if (!rural) group.add(sw);
  const roadGeo = own(new BoxGeometry(NEAR * 2, 0.04, 7));
  { const uv = roadGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (NEAR * 2) / 4, uv.getY(i) * 7 / 4); }
  const road = new Mesh(roadGeo, roadMat);
  road.position.set(0, 0.02 - SLAB, front + (rural ? 0.5 : 1.8) + 3.5);
  road.receiveShadow = true;
  group.add(road);
  if (!rural) {
    const lineMat = own(new MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.8 }));
    const dash = own(new BoxGeometry(2.4, 0.045, 0.12));
    for (let x = -NEAR + 2; x < NEAR; x += 6) {
      const l = new Mesh(dash, lineMat);
      l.position.set(x, 0.025 - SLAB, front + 1.8 + 3.5);
      l.receiveShadow = true;
      group.add(l);
    }
  }

  // ---- far terrain ---------------------------------------------------------------
  const size = 1600, segs = 160;
  const tg = own(new PlaneGeometry(size, size, segs, segs));
  tg.rotateX(-Math.PI / 2);
  const tp = tg.attributes.position;
  const colors = new Float32Array(tp.count * 3);
  const c = new Color();
  const cn = noise2(land.seed + 5);
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i);
    const inside = Math.abs(x) < NEAR - 4 && Math.abs(z) < NEAR - 4;
    const y = inside ? -3 : height(x, z) - SLAB;
    tp.setY(i, y);
    const v = fbm(cn, x / 60, z / 60, 3);
    if (y < -0.5 && land.scenery === 'sea') c.setRGB(0.86, 0.8, 0.62);
    else if (land.scenery === 'sea' && z < -NEAR + 2 && z > -NEAR - 40) c.setRGB(0.9, 0.84, 0.66);
    else {
      // Two hazy greens (#9CB59A near, #B8C9B4 on the ridges) with soft patches; never saturated.
      const forest = smoothstep(0.45, 0.7, fbm(cn, x / 25 + 9, z / 25, 3));
      const hi = smoothstep(8, 70, y);
      c.copy(HILL_A).lerp(HILL_B, hi * 0.6 + v * 0.3).multiplyScalar(1 - forest * 0.14);
      const dist = Math.max(Math.abs(x), Math.abs(z));
      // Blend out of the lawn ring so there is no seam at its edge, then toward a pale blue-grey with distance.
      c.lerp(LAWN, 1 - smoothstep(NEAR - 6, NEAR + 90, dist));
      c.lerp(AIR, smoothstep(110, 760, Math.hypot(x, z)) * 0.75);
    }
    colors.set([c.r, c.g, c.b], i * 3);
  }
  tg.setAttribute('color', new Float32BufferAttribute(colors, 3));
  tg.computeVertexNormals();
  const terrainMat = own(new MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  // Plane UVs are 0..1; scale through the texture repeat.
  const terrain = new Mesh(tg, terrainMat);
  terrain.receiveShadow = true;
  terrain.position.y = -0.02;
  const ridges = ridgeLayers(land.scenery, land.seed, own);
  group.add(ridges.group);
  group.add(terrain);

  // ---- sea -------------------------------------------------------------------------
  let water = null;
  if (land.scenery === 'sea') {
    const wn = waterTex().normalMap.clone();
    wn.needsUpdate = true;
    wn.wrapS = wn.wrapT = RepeatWrapping;
    wn.repeat.set(120, 120);
    own(wn);
    const wm = own(new MeshPhysicalMaterial({ color: 0x1f8fa8, roughness: 0.08, metalness: 0, normalMap: wn, normalScale: { x: 0.4, y: 0.4 }, envMapIntensity: 1.2, clearcoat: 0.6 }));
    water = new Mesh(own(new PlaneGeometry(2400, 1400)), wm);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -1.2, -NEAR - 700);
    water.name = 'sea';
    group.add(water);
  }

  // ---- trees around (instanced, max 40: round broadleaf, tall oval, palm) ----------------
  const r = rng(land.seed + 99);
  const roundG = treeGeometry(0), ovalG = treeGeometry(1);
  const palmG = palmLiteGeometry(0.5), palmG2 = palmLiteGeometry(1.3);
  const treeMat = own(new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  const leafMat = own(leafMaterial(MeshStandardMaterial));
  const nPalm = land.scenery === 'sea' ? 48 : 36, nRound = 34, nOval = 20;
  // Broadleaf trees: trunk and leaf-card crown are two instanced meshes sharing the same matrices.
  const trees = new InstancedMesh(roundG.trunk, treeMat, nRound);
  const ovals = new InstancedMesh(ovalG.trunk, treeMat, nOval);
  const crowns = new InstancedMesh(roundG.canopy, leafMat, nRound);
  const ovalCrowns = new InstancedMesh(ovalG.canopy, leafMat, nOval);
  trees.userData.twin = crowns; ovals.userData.twin = ovalCrowns;
  // Coconut palms: ringed trunk + a crown of real frond cards (same fronds as the yard palm), two lean variants.
  const palms = new InstancedMesh(palmG.trunk, treeMat, Math.ceil(nPalm / 2));
  const palms2 = new InstancedMesh(palmG2.trunk, treeMat, Math.floor(nPalm / 2));
  const palmCrowns = new InstancedMesh(palmG.crown, frondMaterial(), Math.ceil(nPalm / 2));
  const palmCrowns2 = new InstancedMesh(palmG2.crown, frondMaterial(), Math.floor(nPalm / 2));
  palms.userData.twin = palmCrowns; palms2.userData.twin = palmCrowns2;
  const dummy = new Object3D();
  const place = (mesh, n, minR, maxR, scaleMin, scaleMax) => {
    let k = 0, guard = 0;
    while (k < n && guard++ < n * 40) {
      const ang = r() * Math.PI * 2;
      const rad = minR + Math.sqrt(r()) * (maxR - minR);
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      // Keep the lot, street and a margin clear.
      if (Math.abs(x) < W / 2 + 4 && Math.abs(z) < D / 2 + 4) continue;
      if (z > front - 1 && z < front + 11 && Math.abs(x) < NEAR) continue;
      // The default and most-used camera angles look from the street side: keep that near zone open.
      if (z > -D / 4 && rad < 80) continue;
      if (land.scenery === 'sea' && z < -NEAR + 18) continue;
      const y = Math.abs(x) < NEAR - 4 && Math.abs(z) < NEAR - 4 ? -SLAB : height(x, z) - SLAB;
      if (y > 70) continue;
      dummy.position.set(x, y - 0.1, z);
      dummy.rotation.set(0, r() * Math.PI * 2, 0);
      dummy.scale.setScalar(scaleMin + r() * (scaleMax - scaleMin));
      dummy.updateMatrix();
      mesh.userData.twin?.setMatrixAt(k, dummy.matrix);
      mesh.setMatrixAt(k++, dummy.matrix);
    }
    mesh.count = k;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.userData.twin) { mesh.userData.twin.count = k; mesh.userData.twin.instanceMatrix.needsUpdate = true; }
  };
  const R0 = Math.max(W, D) / 2 + 6;
  place(trees, nRound, R0, 110, 0.85, 1.35);
  place(ovals, nOval, R0, 90, 0.9, 1.25);
  place(palms, Math.ceil(nPalm / 2), R0 - 1, 90, 0.9, 1.2);
  place(palms2, Math.floor(nPalm / 2), R0 - 1, 90, 0.85, 1.15);
  // Far belt (realism pass 2): clumps of lighter trees out to ~320 m so the plain reads as a lived-in Dominican
  // landscape instead of an empty field. Cheaper crowns (fewer cards), no shadows.
  const farG = treeGeometry(0, 12), farN = (typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700) ? 120 : 280;
  const farPalmN = Math.round(farN * 0.8);
  const farPalmT = new InstancedMesh(palmG.trunk, treeMat, farPalmN), farPalmC = new InstancedMesh(palmG.crown, frondMaterial(), farPalmN);
  const farTrunks = new InstancedMesh(farG.trunk, treeMat, farN), farCrowns = new InstancedMesh(farG.canopy, leafMat, farN);
  farTrunks.userData.twin = farCrowns;
  {
    const fn = noise2(land.seed + 41);
    let k = 0, guard = 0;
    while (k < farN && guard++ < farN * 30) {
      const ang = r() * Math.PI * 2, rad = 60 + Math.sqrt(r()) * 260;
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      if (fbm(fn, x / 40, z / 40, 3) < 0.5) continue; // clumps and hedgerows, open fields between
      if (z > front - 1 && z < front + 11 && Math.abs(x) < NEAR) continue;
      if (land.scenery === 'sea' && z < -NEAR + 18) continue;
      const y = Math.abs(x) < NEAR - 4 && Math.abs(z) < NEAR - 4 ? -SLAB : height(x, z) - SLAB;
      if (y > 60) continue;
      dummy.position.set(x, y - 0.1, z);
      dummy.rotation.set(0, r() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.9 + r() * 0.8);
      dummy.updateMatrix();
      farTrunks.setMatrixAt(k, dummy.matrix);
      farCrowns.setMatrixAt(k++, dummy.matrix);
    }
    farTrunks.count = farCrowns.count = k;
    farTrunks.instanceMatrix.needsUpdate = farCrowns.instanceMatrix.needsUpdate = true;
    // Coconut groves: palms in looser bands (the skyline of every Dominican campo).
    let q = 0; guard = 0;
    while (q < farPalmN && guard++ < farPalmN * 30) {
      const ang = r() * Math.PI * 2, rad = 40 + Math.sqrt(r()) * 240;
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      if (fbm(fn, x / 55 + 13, z / 55, 3) < 0.46) continue;
      if (Math.abs(x) < W / 2 + 6 && Math.abs(z) < D / 2 + 6) continue;
      if (z > front - 1 && z < front + 11 && Math.abs(x) < NEAR) continue;
      if (land.scenery === 'sea' && z < -NEAR + 18) continue;
      const y = Math.abs(x) < NEAR - 4 && Math.abs(z) < NEAR - 4 ? -SLAB : height(x, z) - SLAB;
      if (y > 45) continue;
      dummy.position.set(x, y - 0.1, z);
      dummy.rotation.set(0, r() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.85 + r() * 0.5);
      dummy.updateMatrix();
      farPalmT.setMatrixAt(q, dummy.matrix);
      farPalmC.setMatrixAt(q++, dummy.matrix);
    }
    farPalmT.count = farPalmC.count = q;
    farPalmT.instanceMatrix.needsUpdate = farPalmC.instanceMatrix.needsUpdate = true;
  }
  own(farG.trunk); own(farG.canopy);
  group.add(farTrunks, farCrowns, farPalmT, farPalmC);
  trees.castShadow = ovals.castShadow = palms.castShadow = palms2.castShadow = crowns.castShadow = ovalCrowns.castShadow = palmCrowns.castShadow = palmCrowns2.castShadow = true;
  trees.receiveShadow = ovals.receiveShadow = crowns.receiveShadow = ovalCrowns.receiveShadow = true;
  own(roundG.trunk); own(roundG.canopy); own(ovalG.trunk); own(ovalG.canopy); own(palmG.trunk); own(palmG.crown); own(palmG2.trunk); own(palmG2.crown);
  group.add(trees, ovals, crowns, ovalCrowns, palms, palms2, palmCrowns, palmCrowns2);

  // A few neighbor houses so the lot sits in a real place.
  const nb = neighborHouses(r, W, D, front, land.scenery, height, own);
  group.add(nb);

  // Grass tufts: along the inside of the fences (sides + back) and in clumps on the lawn around the lot.
  const tufts = grassTufts(land, W, D, front, own);
  group.add(tufts);

  // ---- photo backdrop --------------------------------------------------------------
  if (land.mode === 'photo' && land.photo && land.photoMode === 'backdrop') {
    const t = own(new TextureLoader().load(land.photo, (tex) => {
      if (disposed) return;
      const aspect = tex.image.width / tex.image.height;
      const arc = 1.9, rad = Math.max(W, D) / 2 + 30;
      const hgt = (rad * arc) / aspect;
      backdrop.geometry.dispose();
      backdrop.geometry = new CylinderGeometry(rad, rad, hgt, 64, 1, true, Math.PI - arc / 2, arc);
      backdrop.position.y = hgt / 2 - 2;
      onLoad();
    }));
    t.colorSpace = SRGBColorSpace;
    t.wrapS = RepeatWrapping;
    t.repeat.x = -1;
    const backdrop = new Mesh(new CylinderGeometry(50, 50, 30, 64, 1, true, Math.PI - 0.95, 1.9), own(new MeshBasicMaterial({ map: t, side: DoubleSide, fog: false, toneMapped: false })));
    backdrop.name = 'backdrop';
    group.add(backdrop);
  }

  return {
    group,
    water,
    tint: ridges.tint,
    dispose() {
      disposed = true;
      trees.dispose();
      ovals.dispose();
      crowns.dispose();
      ovalCrowns.dispose();
      farTrunks.dispose();
      farCrowns.dispose();
      farPalmT.dispose();
      farPalmC.dispose();
      palms.dispose();
      palms2.dispose();
      palmCrowns.dispose();
      palmCrowns2.dispose();
      tufts.dispose();
      group.traverse((o) => { if (o.isMesh && o.geometry && !owned.includes(o.geometry)) o.geometry.dispose(); });
      for (const o of owned) o.dispose?.();
    },
  };
}

function colorize(geo, hex) {
  const c = new Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new Float32BufferAttribute(arr, 3));
  return geo.index ? geo.toNonIndexed() : geo;
}

const HILL_A = new Color(0x5f8f3e), HILL_B = new Color(0x7da35a), LAWN = new Color(0x6c9440), AIR = new Color(0xa9c2c4);
const LEAF = ['#3f7a2e', '#4c8a35', '#356a27', '#5a9440', '#447a30'];

// Broadleaf trees: a slim trunk + branches under a canopy of clustered leaves (see foliage.js).
// kind 0 = round broadleaf, 1 = tall oval.
function treeGeometry(kind, cards = null) {
  const r = rng(kind ? 811 : 377);
  const trunkH = kind ? 3.2 : 2.3;
  const parts = [colorize(new CylinderGeometry(0.12, 0.22, trunkH, 7).translate(0, trunkH / 2, 0), 0x5e4e3e)];
  for (let i = 0; i < 3; i++) {
    const b = new CylinderGeometry(0.05, 0.09, 1.4, 5).translate(0, 0.7, 0).rotateZ(0.6).rotateY(i * 2.1 + 0.4).translate(0, trunkH - 0.2, 0);
    parts.push(colorize(b, 0x5e4e3e));
  }
  const spots = kind
    ? [[0, 4.4, 0, 1.2, 1.5, 1.2], [0.2, 5.7, 0.1, 0.9, 1.0, 0.9]]
    : [[0, 3.4, 0, 1.9, 1.0, 1.8], [1.0, 3.1, 0.5, 1.1, 0.8, 1.1], [-0.9, 3.2, -0.4, 1.2, 0.8, 1.1], [0.2, 4.1, -0.3, 1.1, 0.8, 1.1]];
  for (const p of parts) p.deleteAttribute('uv');
  const canopy = canopyGeometry(r, spots, LEAF, cards ? { n: cards, size: [0.45, 0.75] } : { n: kind ? 30 : 24, size: [0.3, 0.55] });
  return { trunk: mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p))), canopy };
}

// Palm: a trunk that bends more toward the top (bend in metres at the crown), 8 fronds.
function palmLiteGeometry(bend = 0.8) {
  const parts = [];
  const H = 7.5, segs = 7;
  const off = (t) => bend * t ** 1.8;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const dx = off(t1) - off(t0), len = Math.hypot(dx, H / segs);
    const cyl = new CylinderGeometry(0.17 - t1 * 0.05, 0.17 - t0 * 0.05, len * 1.04, 7);
    cyl.rotateZ(-Math.atan2(dx, H / segs));
    cyl.translate((off(t0) + off(t1)) / 2, (t0 + t1) / 2 * H, 0);
    parts.push(colorize(cyl, i % 2 ? 0x8a7a64 : 0x7d6e5a));
  }
  for (const p of parts) p.deleteAttribute('uv');
  const crown = palmCrownGeometry(Math.round(bend * 100) + 3).translate(bend, H, 0);
  return { trunk: mergeGeometries(parts), crown };
}

// Soft contact shadow for a w x d footprint inside a (w + 3) x (d + 3) plane (uv space).
function contactMat() {
  return new ShaderMaterial({
    uniforms: {},
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; void main() { vec2 d = abs(vUv - 0.5) * 2.0; float r = max(d.x, d.y); float k = 1.0 - smoothstep(0.62, 1.0, r); gl_FragColor = vec4(0.0, 0.0, 0.0, 0.32 * k * k); }',
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
}

// Large-scale variation on a tiled material: multiplies the base colour by lawnMacro() sampled at `scale`
// times the map UVs (so lush and sun-dried patches span tens of metres while the turf stays 4 m).
function macroTint(m, scale) {
  const macro = lawnMacro().map;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.macroMap = { value: macro };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D macroMap;')
      .replace('#include <map_fragment>', `#include <map_fragment>\n  diffuseColor.rgb *= texture2D(macroMap, vMapUv * ${scale.toFixed(5)}).rgb * 2.0;`);
  };
  m.customProgramCacheKey = () => `macroTint${scale.toFixed(5)}`;
  return m;
}

// One tuft = 7 thin blades leaning out from a point, dark at the root, lighter at the tip. Normals point up so
// the blades light like the lawn under them (no dark backsides).
export function tuftGeometry(seed) {
  const r = rng(seed);
  const pos = [], col = [], nor = [];
  const root = new Color('#2c4419'), tipA = new Color('#86ad4a'), tipB = new Color('#5f9a36'), tip = new Color();
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2, lean = 0.04 + r() * 0.1, hgt = 0.14 + r() * 0.2, w = 0.012 + r() * 0.01;
    const bx = Math.cos(a) * 0.03, bz = Math.sin(a) * 0.03, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    pos.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, bx + Math.cos(a) * lean, hgt, bz + Math.sin(a) * lean);
    tip.copy(tipA).lerp(tipB, r());
    col.push(root.r, root.g, root.b, root.r, root.g, root.b, tip.r, tip.g, tip.b);
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  return g;
}

function grassTufts(land, W, D, front, own) {
  const r = rng(land.seed + 7);
  const n = noise2(land.seed + 3);
  const geo = own(tuftGeometry(land.seed + 11));
  const mat = own(new MeshStandardMaterial({ vertexColors: true, roughness: 1, side: DoubleSide }));
  const lotN = 0, ringN = 5200; // the lawn inside the lot is planted by the engine (index.js plantLawn, avoids the house)
  const mesh = new InstancedMesh(geo, mat, lotN + ringN);
  mesh.name = 'tufts';
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.raycast = () => {};
  const d = new Object3D();
  let k = 0;
  const put = (x, y, z, s) => {
    d.position.set(x, y, z);
    d.rotation.set(0, r() * 6.28, 0);
    d.scale.set(s, s * (0.8 + r() * 0.5), s);
    d.updateMatrix();
    mesh.setMatrixAt(k++, d.matrix);
  };
  // Inside the lot: a 0.15..1.1 m strip along the sides and the back (never the street side, where the gates,
  // the walkway and the driveway reach the line).
  for (let i = 0, guard = 0; i < lotN && guard < lotN * 4; guard++) {
    const t = r(), inset = 0.15 + r() ** 2 * 0.55;
    const per = 2 * D + W;
    let x, z;
    const u = t * per;
    if (u < D) { x = -W / 2 + inset; z = -D / 2 + u; }
    else if (u < 2 * D) { x = W / 2 - inset; z = -D / 2 + (u - D); }
    else { x = -W / 2 + (u - 2 * D); z = -D / 2 + inset; }
    if (z > front - 2.2) continue;
    if (fbm(n, x / 3, z / 3, 2) < 0.38) continue; // clumpy, not a uniform hedge
    put(x, 0, z, 0.6 + r() * 0.35); // stays under the 0.45 m floor plinth if a house sits near the fence
    i++;
  }
  // Around the lot: clumps out to ~32 m, thinning with distance; keep the street, sidewalk and verge clear.
  for (let i = 0, guard = 0; i < ringN && guard < ringN * 6; guard++) {
    const x = (r() * 2 - 1) * (W / 2 + 30), z = (r() * 2 - 1) * (D / 2 + 30);
    if (Math.abs(x) < W / 2 + 0.1 && Math.abs(z) < D / 2 + 0.1) continue;
    if (z > front - 0.5 && z < front + 13) continue;
    const dist = Math.max(Math.abs(x) - W / 2, Math.abs(z) - D / 2);
    if (r() < dist / 34) continue;
    if (fbm(n, x / 5 + 20, z / 5, 3) < 0.45) continue;
    put(x, -SLAB, z, 0.9 + r() * 0.9);
    i++;
  }
  mesh.count = k;
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// Dominican neighbour houses: painted block houses with windows + rejas (facade texture, one bay per 3.2 m,
// one storey per 3 m), a front door, and one of three roofs: flat concrete with a parapet (often with a black
// tinaco), a terracotta hip roof, or a zinc gable roof.
const NB_PAINT = ['#efd9a6', '#cfe3cf', '#f1c6ab', '#bfd6e6', '#f3eee3', '#e7c9d6', '#f2e2b4', '#d9d2ea', '#f6efe0'];
function facadeUV(geo, w, d, H) {
  // BoxGeometry faces: +x, -x, +y, -y, +z, -z (4 vertices each). Whole bays so windows never cut at a corner.
  const uv = geo.attributes.uv;
  const bays = (len) => Math.max(1, Math.round(len / 3.2));
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      if (f === 2 || f === 3) { uv.setXY(i, 0.04, 0.04); continue; } // roof / underside: plain render
      const len = f < 2 ? d : w;
      uv.setXY(i, uv.getX(i) * bays(len), uv.getY(i) * (H / 3) - 1); // sunk 3 m -> v starts at -1
    }
  }
}
function neighborHouses(r, W, D, front, scenery, height, own) {
  const g = new Group();
  const fac = facade().map;
  const walls = new Map();
  const wallMat = (hex) => {
    if (!walls.has(hex)) walls.set(hex, own(new MeshStandardMaterial({ map: fac, color: hex, roughness: 0.92 })));
    return walls.get(hex);
  };
  const tileM = own(new MeshStandardMaterial({ color: 0xa9553a, roughness: 0.85 }));
  const zincM = own(new MeshStandardMaterial({ color: 0xa3abad, roughness: 0.5, metalness: 0.5 }));
  const slabM = own(new MeshStandardMaterial({ color: 0xd8d3c8, roughness: 0.95 }));
  const doorM = own(new MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.7 }));
  const tankM = own(new MeshStandardMaterial({ color: 0x1f2224, roughness: 0.55 }));
  const shadowMat = own(contactMat());
  const unitPlane = own(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const tankGeo = own(new CylinderGeometry(0.55, 0.55, 1.2, 14).translate(0, 0.6, 0));
  const doorGeo = own(new BoxGeometry(1.0, 2.15, 0.08));
  const n = scenery === 'countryside' ? 8 : 14;
  const placed = [];
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    let x, z;
    if (i < 6) { x = side * (W / 2 + 30 + (i >> 1) * 20 + r() * 6); z = -10 - r() * 30; }
    else { const ang = r() * Math.PI * 2, rad = 45 + r() * 110; x = Math.cos(ang) * rad; z = Math.sin(ang) * rad; }
    if (z > front - 2 && z < front + 12) z = front - 6;
    if (scenery === 'sea' && z < -NEAR + 15) continue;
    if (placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 16)) continue;
    if (Math.abs(x) < W / 2 + 8 && Math.abs(z) < D / 2 + 8) continue;
    placed.push([x, z]);
    const y = Math.abs(x) < NEAR - 4 && Math.abs(z) < NEAR - 4 ? -SLAB : height(x, z) - SLAB;
    const w = 8 + r() * 5, d = 7 + r() * 4, h = 3.0 * (r() > 0.7 ? 2 : 1);
    const rot = (r() - 0.5) * 0.12;
    const paint = NB_PAINT[(r() * NB_PAINT.length) | 0];
    const hg = new Group();
    hg.position.set(x, y, z);
    hg.rotation.y = rot;
    // Sunk 3 m into the ground so a slope never leaves it floating.
    const bg = own(new BoxGeometry(w, h + 3, d));
    facadeUV(bg, w, d, h + 3);
    const box = new Mesh(bg, wallMat(paint));
    box.position.y = (h - 3) / 2;
    box.castShadow = box.receiveShadow = true;
    hg.add(box);
    const door = new Mesh(doorGeo, doorM);
    door.position.set((r() - 0.5) * (w - 3), 1.07, d / 2 + 0.03);
    hg.add(door);
    const cs = new Mesh(unitPlane, shadowMat);
    cs.scale.set(w + 3, 1, d + 3);
    cs.position.set(x, y + 0.04, z);
    cs.rotation.y = rot;
    cs.userData.half = [w / 2, d / 2];
    cs.renderOrder = 1;
    g.add(cs);
    const kind = r();
    if (kind < 0.5) {
      // Flat concrete roof: slab edge + low parapet in the wall colour, often a tinaco.
      const slab = new Mesh(own(new BoxGeometry(w + 0.25, 0.22, d + 0.25)), slabM);
      slab.position.y = h + 0.11;
      const parGeo = own(new BoxGeometry(w + 0.25, 0.5, d + 0.25));
      { const uv = parGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.04, 0.04); } // plain render, no window
      const par = new Mesh(parGeo, wallMat(paint));
      par.position.y = h + 0.47;
      slab.castShadow = par.castShadow = true;
      hg.add(slab, par);
      if (r() > 0.35) {
        const tank = new Mesh(tankGeo, tankM);
        tank.position.set((r() - 0.5) * (w - 2), h + 0.72, -d / 2 + 1.2);
        tank.castShadow = true;
        hg.add(tank);
      }
    } else if (kind < 0.78) {
      // Terracotta hip roof with a small overhang.
      const cone = own(new ConeGeometry(Math.hypot(w, d) / 2 + 0.6, 2.0, 4, 1));
      cone.rotateY(Math.PI / 4);
      cone.scale(w / Math.hypot(w, d) * 1.414, 1, d / Math.hypot(w, d) * 1.414);
      const roof = new Mesh(cone, tileM);
      roof.position.y = h + 1.0;
      roof.castShadow = roof.receiveShadow = true;
      hg.add(roof);
    } else {
      // Zinc gable roof (ridge along the width).
      const rise = 1.5, half = d / 2 + 0.5;
      const shape = new Shape().moveTo(-half, 0).lineTo(half, 0).lineTo(0, rise).lineTo(-half, 0);
      const gable = own(new ExtrudeGeometry(shape, { depth: w + 0.6, bevelEnabled: false }));
      gable.translate(0, 0, -(w + 0.6) / 2);
      gable.rotateY(Math.PI / 2);
      const roof = new Mesh(gable, zincM);
      roof.position.y = h;
      roof.castShadow = roof.receiveShadow = true;
      hg.add(roof);
    }
    g.add(hg);
  }
  return g;
}

