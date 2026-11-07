// Engine: owns the renderer, scene, lighting, cameras and interaction.
// Rebuilds the model from the store; see .squad/CONTRACT.md for the API.
import {
  TOUCH, MOUSE, WebGLRenderer, Scene, PerspectiveCamera, DirectionalLight, HemisphereLight, Vector3, Vector2, Color, Fog,
  PMREMGenerator, Raycaster, Plane, NeutralToneMapping, PCFShadowMap, SRGBColorSpace, Sprite, SpriteMaterial,
  Group, MathUtils, HalfFloatType, WebGLRenderTarget, PointLight, Mesh, PlaneGeometry, MeshBasicMaterial, BoxGeometry,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { createSkyDome, timeLook, sunDirection, GRADE_SHADER } from './skylook.js';
import { createReveal } from './reveal.js';
import { SLAB } from './land.js';
import { FOLIAGE_RIM } from './foliage.js';
import { createMaterialSet } from './materials.js';
import * as THREE from 'three';
import { buildHouse } from './house.js';
import { buildBuildHouse } from './buildgeo.js';
import { effectiveState, wallLen, uid as bUid, slabGrid, gridRects } from './buildmodel.js';
import { buildYard, buildItem, poolRect, setLanternsOn, palmCrownGeometry, frondMaterial } from './props.js';
import { buildLand, tuftGeometry } from './land.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { buildIndoorItem } from './indoor.js';
import { P, T, layoutHouse, roomName, roomLabels } from './layout.js';
import { labelCanvas, makeTexture } from './textures.js';
import { createPlanView } from './planview.js';
import { createPieceFx } from './piecefx.js';

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const EYE = 1.65;

export function createEngine(container, store) {
  const listeners = new Map();
  // The house as the lot sees it: in build mode its built footprint (see buildmodel.effectiveState).
  const eff = () => effectiveState(store.get());
  const effLot = () => effectiveState(store.get(), { lot: true });
  const emit = (ev, data) => (listeners.get(ev) ?? []).forEach((fn) => fn(data));

  // ---- renderer -----------------------------------------------------------------
  const mobile = Math.min(window.innerWidth, window.innerHeight) < 700 || matchMedia('(pointer: coarse)').matches;
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.75 : 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  // PCF honours shadow.radius (PCFSoft ignores it): softer fence / tree shadow edges.
  renderer.shadowMap.type = PCFShadowMap;
  renderer.localClippingEnabled = true;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
  renderer.domElement.setAttribute('tabindex', '0');
  renderer.domElement.setAttribute('aria-label', '3D view of the house');
  container.style.position ||= 'relative';
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.1, 4000);
  camera.position.set(22, 12, 28);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !REDUCED;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.minDistance = 4;
  controls.maxDistance = 140;
  controls.screenSpacePanning = false;

  // ---- sky + sun ("Plano": gradient dome, golden 16:30 default look; see skylook.js) ----
  const sky = createSkyDome();
  scene.add(sky.mesh);

  const sun = new DirectionalLight(0xffffff, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 2048 : 4096, mobile ? 2048 : 4096);
  // Tight frustum (fitted to the lot below) keeps texels small; normalBias stops acne on walls.
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = mobile ? 2.5 : 4;
  scene.add(sun, sun.target);
  const hemi = new HemisphereLight(0xcfe3f0, 0x8a8f6a, 0.55);
  scene.add(hemi);
  scene.fog = new Fog(0xf6ddb8, 60, 900);
  const FOG = { near: 80, far: 1500 };
  const HAZE = new Color('#a9c3a0');
  let lastDay = 1;

  const pmrem = new PMREMGenerator(renderer);
  const skyScene = new Scene();
  const skyForEnv = createSkyDome(sky.material);
  skyScene.add(skyForEnv.mesh);
  let envRT = null;

  let lastEnvTime = -1;
  let sceneTheme = null;
  const DARK_AT = 18.5 / 24;
  function applyTime(t, { env = true } = {}) {
    const hour = t * 24;
    const look = timeLook(hour);
    const dir = sunDirection(hour);
    sky.set(look, dir.glow);
    sun.color.copy(look.sun);
    sun.intensity = look.sunI;
    hemi.color.copy(look.hemiSky);
    hemi.groundColor.copy(look.hemiGround);
    hemi.intensity = look.hemiI;
    // Haze = horizon tinted toward the hazy green of the hills (REVAMP: fade to #A9C3A0).
    scene.fog.color.copy(look.horizon).lerp(HAZE, 0.6 * look.day);
    lastDay = Math.max(0, look.day);
    land?.tint?.(scene.fog.color, lastDay);
    // Leaves glow a little at their edges when the sun is low and warm.
    FOLIAGE_RIM.value.copy(look.sun).multiplyScalar(0.12 + 0.5 * look.warm * look.day);
    renderer.toneMappingExposure = look.exposure;
    grade.uniforms.warm.value = look.warm;
    sunDir.copy(dir.light);
    placeSun();
    if (env && Math.abs(t - lastEnvTime) > 0.004) {
      lastEnvTime = t;
      const next = pmrem.fromScene(skyScene, 0, 0.1, 2000);
      envRT?.dispose();
      envRT = next;
      scene.environment = envRT.texture;
    }
    // Inside (walk mode) the sun is shadowed out and the blue sky fill turns
    // white rooms icy; real rooms get warm light bounced off floors and walls.
    const inside = view === 'walk';
    scene.environmentIntensity = look.envI * (inside ? 0.6 : 1);
    if (inside) {
      hemi.color.setRGB(1, 0.93, 0.83);
      hemi.groundColor.setRGB(0.72, 0.6, 0.48);
      hemi.intensity = 0.35 + 0.6 * look.day;
      renderer.toneMappingExposure += 0.08;
    }
    const th = t >= DARK_AT ? 'dark' : 'light';
    if (th !== sceneTheme) { sceneTheme = th; emit('theme', th); }
    applyLights();
    invalidate();
  }
  const sunDir = new Vector3();
  const lightEye = new PerspectiveCamera(); // cameras look down -Z, like the shadow camera
  const corner = new Vector3();
  function placeSun() {
    const { land } = store.get();
    const h = eff().house;
    const center = new Vector3(h.offsetX, 0, h.offsetZ);
    sun.position.copy(center).addScaledVector(sunDir, 80);
    sun.target.position.copy(center);
    // Fit the shadow camera to the lot box (plus trees/roof height) seen from the sun.
    lightEye.position.copy(sun.position);
    lightEye.lookAt(center);
    lightEye.updateMatrixWorld();
    const inv = lightEye.matrixWorld.clone().invert();
    const hx = land.width / 2 + 6, hz = land.depth / 2 + 6, top = Math.max(10, P + h.floors * h.floorHeight + 5);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1]) {
      corner.set(sx * hx, sy * top, sz * hz).applyMatrix4(inv);
      x0 = Math.min(x0, corner.x); x1 = Math.max(x1, corner.x);
      y0 = Math.min(y0, corner.y); y1 = Math.max(y1, corner.y);
      z0 = Math.min(z0, corner.z); z1 = Math.max(z1, corner.z);
    }
    const sc = sun.shadow.camera;
    sc.left = x0; sc.right = x1; sc.bottom = y0; sc.top = y1;
    sc.near = Math.max(0.5, -z1 - 2);
    sc.far = -z0 + 2;
    sc.updateProjectionMatrix();
  }

  // ---- post-processing ------------------------------------------------------------
  const rt = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: mobile ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  let gtao = null;
  if (!mobile) {
    try {
      gtao = new GTAOPass(scene, camera, 1, 1);
      gtao.output = GTAOPass.OUTPUT.Default;
      gtao.blendIntensity = 1;
      gtao.updateGtaoMaterial({ radius: 1.0, distanceExponent: 1.5, thickness: 1.2, scale: 1, samples: 12 });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      composer.addPass(gtao);
    } catch (e) {
      gtao = null;
      console.warn('AO disabled', e);
    }
  }
  // Labels draw after AO so they stay crisp.
  const overlay = new Scene();
  const overlayPass = new RenderPass(overlay, camera);
  overlayPass.clear = false;
  overlayPass.clearDepth = true;
  composer.addPass(overlayPass);
  composer.addPass(new OutputPass());
  // Final grade in display space (shadow lift, warm highlights, 8% vignette); one cheap full-screen pass.
  const grade = new ShaderPass(GRADE_SHADER);
  composer.addPass(grade);

  // ---- model --------------------------------------------------------------------
  const world = new Group();
  scene.add(world);
  const itemMats = createMaterialSet();
  let houseMats = null, yardMats = null, house = null, yard = null, land = null;
  const items = new Map(); // id -> group
  const itemsGroup = new Group();
  world.add(itemsGroup);
  // Movable indoor furniture: house-local coordinates, follows the house offset.
  const indoor = new Map(); // id -> group
  const indoorGroup = new Group();
  indoorGroup.name = 'indoor';
  world.add(indoorGroup);
  let indoorMats = createMaterialSet();
  let indoorLook = '';
  // One warm point light per floor (no shadows), on at dusk/night.
  const lampGroup = new Group();
  world.add(lampGroup);
  let rooms = [];
  let highlightKey = null;
  const highlight = new Mesh(
    new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new MeshBasicMaterial({ color: 0x0b6e7f, transparent: true, opacity: 0.18, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  highlight.visible = false;
  highlight.renderOrder = 5;
  highlight.raycast = () => {};
  world.add(highlight);
  let segments = [];
  let cutLevel = null;
  let view = 'orbit';
  const dims = new Group();
  overlay.add(dims);
  let lang = document.documentElement.lang?.startsWith('en') ? 'en' : 'es';
  let uiTheme = 'light';
  const clipPlane = new Plane(new Vector3(0, -1, 0), 0);
  // Cut floor index, or null (nothing cut, or walking).
  const lvlNow = () => (cutLevel == null || view === 'walk' ? null : Math.min(cutLevel, store.get().house.floors - 1));
  // Plano view: exact room sizes, selected-room outline, drag handles while plan editing is on.
  const planView = createPlanView({
    overlay, camera, container, store,
    ctx: { view: () => view, level: lvlNow, rooms: () => rooms, lang: () => lang },
  });
  let lastRebuildMs = 0;
  const timing = { house: 0, yard: 0 };
  // v5 pieces: ghost, thumbnails, drop animation (see piecefx.js). hideIds = elements that are still falling in.
  const fx = createPieceFx({ renderer, world, store, invalidate: () => invalidate(), P, getEnv: () => scene.environment, reduced: REDUCED });
  let hideIds = null;

  function disposeGroup(g) {
    g?.traverse((o) => {
      if (o.geometry && !o.isSprite) o.geometry.dispose();
      if (o.isInstancedMesh) o.dispose();
      if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); }
    });
    g?.removeFromParent();
  }

  function rebuildLand() {
    const s = store.get();
    if (land) { land.group.removeFromParent(); land.dispose(); }
    land = buildLand(s, poolRect(effLot()), invalidate);
    world.add(land.group);
    land.tint?.(scene.fog.color, lastDay);
    if (lotMarksOn) buildLotMarks();
  }

  const retired = [];
  function rebuildHouse() {
    const t0 = performance.now();
    const s = viewState();
    const oldMats = houseMats;
    const oldYardMats = yardMats;
    for (const d of dimMats.values()) retired.push(d);
    dimMats.clear();
    yardMats = createMaterialSet();
    disposeGroup(house?.group);
    disposeGroup(house?.labelGroup);
    disposeGroup(yard?.group);
    houseMats = createMaterialSet();
    // Interiors are only built when someone can see them (cutaway, plan, walk).
    const buildMode = s.mode === 'build' && !!s.build;
    const interiorLevels = view === 'walk' ? null : cutLevel;
    const tH = performance.now();
    house = buildMode
      ? buildBuildHouse(s, houseMats, lang, { interiors: needInteriors(), interiorLevels, hide: hideIds })
      : buildHouse(s, houseMats, lang, { interiors: needInteriors() });
    timing.house = performance.now() - tH;
    house.hasInteriors = needInteriors();
    house.group.position.set(s.house.offsetX, 0, s.house.offsetZ);
    world.add(house.group);
    house.labelGroup.position.copy(house.group.position);
    overlay.add(house.labelGroup);
    const tY = performance.now();
    yard = buildYard(effLot(), yardMats, house);
    timing.yard = performance.now() - tY;
    world.add(yard.group);
    // Dispose the old sets only after the new ones have rendered once: freeing
    // them first drops the shared shader programs and forces a recompile.
    retired.push(oldMats, oldYardMats);
    const off = (seg) => ({ a: [seg.a[0] + s.house.offsetX, seg.a[1] + s.house.offsetZ], b: [seg.b[0] + s.house.offsetX, seg.b[1] + s.house.offsetZ], level: seg.level ?? 0 });
    segments = [...house.segments.map(off), ...yard.segments.map((x) => ({ ...x, level: -1 }))];
    indoorGroup.position.copy(house.group.position);
    lampGroup.position.copy(house.group.position);
    rooms = roomList(s);
    const labs = roomLabels(rooms, lang);
    for (const r of rooms) {
      r.label = labs.get(r.key) ?? roomName(r.type, lang);
      r.shortLabel = labs.short.get(r.key) ?? r.label;
      // Hand-built rooms without a type are named by their size.
      if (r.type === 'cuarto') { r.label = `${roomName('cuarto', lang)} ${Math.round(r.area)} m²`; r.shortLabel = roomName('cuarto', lang); }
    }
    // Label priority = area of the room the tag sits in.
    for (const sp of house.labelGroup.children) {
      const { x, z } = sp.position, lv = sp.userData.level;
      const r = rooms.find((q) => q.level === lv && x >= q.x0 - 0.2 && x <= q.x1 + 0.2 && z >= q.z0 - 0.2 && z <= q.z1 + 0.2);
      sp.userData.area = r ? (r.poly ? r.area : (r.x1 - r.x0) * (r.z1 - r.z0)) : 0;
    }
    placeContactAO();
    applyBuildHighlight();
    syncRemodel();
    scheduleLawn();
    buildLamps(s);
    syncIndoor();
    applyCutaway();
    updateDims();
    lastRebuildMs = performance.now() - t0;
    emit('stats', { ...house.stats });
    emit('rooms', getRooms());
  }
  // ---- Lawn (realism pass 2): dense, short grass tufts on every open bit of the lot. A 256 px top-down silhouette
  // of the house + yard (driveway, walkway, pool, beds, fences) masks where grass may grow, so it never pokes
  // through floors or paving. Replanted 180 ms after the last rebuild (drags rebuild many times a second).
  let lawn = null, lawnTimer = 0;
  const lawnRT = new WebGLRenderTarget(256, 256);
  const lawnCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const maskScene = new Scene();
  maskScene.overrideMaterial = new MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const lawnGeo = tuftGeometry(4242);
  const lawnMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
  function scheduleLawn() { clearTimeout(lawnTimer); lawnTimer = setTimeout(plantLawn, 180); }
  function plantLawn() {
    if (disposed) return;
    if (lawn) { lawn.removeFromParent(); lawn.dispose(); lawn = null; }
    const s = store.get();
    if (s.land.mode === 'photo' && s.land.photo && s.land.photoMode === 'ground') { invalidate(); return; }
    const W = s.land.width, D = s.land.depth;
    const res = 256, mw = res, mh = Math.max(32, Math.round((res * D) / W));
    lawnRT.setSize(mw, mh);
    lawnCam.left = -W / 2; lawnCam.right = W / 2; lawnCam.top = D / 2; lawnCam.bottom = -D / 2;
    lawnCam.position.set(0, 60, 0);
    lawnCam.up.set(0, 0, -1);
    lawnCam.lookAt(0, 0, 0);
    lawnCam.updateProjectionMatrix();
    const parts = [house?.group, yard?.group].filter(Boolean);
    const parents = parts.map((g) => g.parent);
    for (const g of parts) maskScene.add(g);
    const prevTarget = renderer.getRenderTarget(), prevClear = new Color(), prevAlpha = renderer.getClearAlpha();
    renderer.getClearColor(prevClear);
    const prevShadow = renderer.shadowMap.enabled;
    renderer.shadowMap.enabled = false;
    renderer.setRenderTarget(lawnRT);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(maskScene, lawnCam);
    const px = new Uint8Array(mw * mh * 4);
    renderer.readRenderTargetPixels(lawnRT, 0, 0, mw, mh, px);
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClear, prevAlpha);
    renderer.shadowMap.enabled = prevShadow;
    parts.forEach((g, i) => parents[i]?.add(g));
    // Row 0 = bottom of the image = the street side (+z). A pixel is blocked if it or a neighbour is painted.
    const blocked = (x, z) => {
      const cx = Math.floor(((x + W / 2) / W) * mw), cy = Math.floor(((D / 2 - z) / D) * mh);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const qx = cx + dx, qy = cy + dy;
        if (qx < 0 || qy < 0 || qx >= mw || qy >= mh) continue;
        if (px[(qy * mw + qx) * 4] > 40) return true;
      }
      return false;
    };
    const per = mobile ? 3 : 7;
    const N = Math.min(mobile ? 2600 : 7000, Math.round(W * D * per));
    const mesh = new THREE.InstancedMesh(lawnGeo, lawnMat, N);
    mesh.name = 'lawn';
    mesh.receiveShadow = true;
    mesh.raycast = () => {};
    const d = new THREE.Object3D();
    let rs = (s.land.seed * 9301 + 49297) % 233280 || 1;
    const rnd = () => ((rs = (rs * 9301 + 49297) % 233280) / 233280);
    let k = 0;
    for (let i = 0; i < N * 3 && k < N; i++) {
      const x = (rnd() - 0.5) * (W - 0.2), z = (rnd() - 0.5) * (D - 0.2);
      if (blocked(x, z)) continue;
      d.position.set(x, 0, z);
      d.rotation.set(0, rnd() * 6.283, 0);
      const sc = 0.45 + rnd() * 0.4;
      d.scale.set(sc * 1.2, sc * (0.8 + rnd() * 0.5), sc * 1.2);
      d.updateMatrix();
      mesh.setMatrixAt(k++, d.matrix);
    }
    mesh.count = k;
    mesh.instanceMatrix.needsUpdate = true;
    lawn = mesh;
    world.add(mesh);
    invalidate();
  }

  // ---- Remodel (Remodelar): "Hoy" (before) shows the frozen copy of the house as it is today, "Después" (after)
  // the plan. Marks on both: red = to tear down / to close up, green = new walls, openings and floors.
  let remodelView = 'after';
  let remodelMarks = true;
  const remodelGroup = new Group();
  remodelGroup.name = 'remodel';
  world.add(remodelGroup);
  const RM_RED = 0xd23b2f, RM_GREEN = 0x1f9d55;
  const rmFill = (c, o) => new MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  // Demolition hatch: world-space diagonal stripes, so every red piece reads "se tumba" at any size.
  const hatch = (m) => {
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
        .replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\n  float st = step(0.5, fract((vWp.x + vWp.y * 1.3 + vWp.z) * 2.2));\n  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), (1.0 - st) * 0.55);\n  diffuseColor.a = mix(diffuseColor.a * 0.55, min(1.0, diffuseColor.a * 1.5), st);');
    };
    m.customProgramCacheKey = () => 'rmHatch';
    return m;
  };
  const rmMats = {
    gone: hatch(rmFill(RM_RED, 0.55)), goneEdge: new THREE.LineBasicMaterial({ color: RM_RED, transparent: true, opacity: 0.95 }),
    neu: rmFill(RM_GREEN, 0.42), neuEdge: new THREE.LineBasicMaterial({ color: RM_GREEN, transparent: true, opacity: 0.95 }),
    shut: hatch(rmFill(RM_RED, 0.65)), open: rmFill(RM_GREEN, 0.3),
  };
  const remodelOn = () => store.get().mode === 'build' && !!store.get().remodel && !!store.get().build;
  function viewState() {
    const s = store.get();
    if (remodelView !== 'before' || !remodelOn()) return s;
    const base = s.remodel.base;
    return { ...s, build: base, house: { ...s.house, floors: base.levels.length, floorHeight: base.floorHeight } };
  }
  function clearRemodel() {
    for (const o of [...remodelGroup.children]) { o.geometry?.dispose(); o.removeFromParent(); }
  }
  function syncRemodel() {
    clearRemodel();
    if (!remodelOn() || !remodelMarks) { invalidate(); return; }
    const info = store.remodelInfo?.();
    if (!info) return;
    const s = store.get();
    const FH = s.build.floorHeight, FB = s.remodel.base.floorHeight ?? FH;
    remodelGroup.position.set(s.house.offsetX, 0, s.house.offsetZ);
    let fhNow = FH; // floor height of the side (today / plan) the mark belongs to
    const yOf = (lv) => P + lv * fhNow;
    const put = (geo, fill, edge, x, y, z, ang, level) => {
      const m = new Mesh(geo, fill);
      m.position.set(x, y, z);
      m.rotation.y = ang;
      m.renderOrder = 6;
      m.raycast = () => {};
      m.userData.level = level;
      remodelGroup.add(m);
      if (edge) {
        const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edge);
        l.position.copy(m.position);
        l.rotation.y = ang;
        l.renderOrder = 7;
        l.raycast = () => {};
        l.userData.level = level;
        remodelGroup.add(l);
      }
    };
    const wallBox = (p, level, fill, edge) => {
      const geo = new THREE.BoxGeometry(p.len + 0.02, p.h + 0.02, p.t + 0.06);
      put(geo, fill, edge, (p.x0 + p.x1) / 2, yOf(level) + p.h / 2, (p.z0 + p.z1) / 2, -Math.atan2(p.z1 - p.z0, p.x1 - p.x0), level);
    };
    const holeBox = (o, level, fill, edge) => {
      const hgt = o.h ?? 2.1;
      const geo = new THREE.BoxGeometry(o.w ?? 0.9, hgt, (o.t ?? 0.15) + 0.1);
      put(geo, fill, edge, o.x, yOf(level) + (o.kind === 'window' ? o.sill ?? 1 : 0) + hgt / 2, o.z, -o.ang, level);
    };
    const slabPlane = (sl, level, fill, edge) => {
      const geo = new THREE.BoxGeometry(sl.x1 - sl.x0, 0.04, sl.z1 - sl.z0);
      const y = level === 0 && sl.raised === false ? 0.03 : yOf(level) + 0.03;
      put(geo, fill, edge, (sl.x0 + sl.x1) / 2, y, (sl.z0 + sl.z1) / 2, 0, level);
    };
    for (const L of info.levels) {
      fhNow = FB; // today's pieces stand at today's floor heights
      for (const p of L.demolish) wallBox(p, L.level, rmMats.gone, rmMats.goneEdge);
      for (const o of L.closed) holeBox(o, L.level, rmMats.shut, rmMats.goneEdge);
      for (const sl of L.slabGone) slabPlane(sl, L.level, rmMats.gone, rmMats.goneEdge);
      fhNow = FH;
      for (const p of L.add) wallBox(p, L.level, rmMats.neu, rmMats.neuEdge);
      for (const o of L.opened) holeBox(o, L.level, rmMats.open, rmMats.neuEdge);
      for (const sl of L.slabNew) slabPlane(sl, L.level, rmMats.neu, rmMats.neuEdge);
    }
    applyRemodelCut();
    invalidate();
  }
  // Follow the cut level like the house does (marks of hidden floors hide; walls are cut at the same height).
  let rmClipped = false;
  function applyRemodelCut() {
    const F = viewState().house.floors;
    const lvl = cutLevel == null || view === 'walk' ? null : Math.min(cutLevel, F - 1);
    for (const o of remodelGroup.children) o.visible = lvl == null || o.userData.level <= lvl;
    if (rmClipped === (lvl != null)) return;
    rmClipped = lvl != null;
    for (const m of Object.values(rmMats)) { m.clippingPlanes = rmClipped ? [clipPlane] : null; m.needsUpdate = true; }
  }

  // Rooms of the current house (plan ids are the keys). w / d / x0.. are house-local meters.
  function getRooms() {
    return rooms.map((r) => ({
      key: r.key, id: r.key, type: r.type, level: r.level, band: r.band ?? null, name: roomName(r.type, lang), label: r.label ?? roomName(r.type, lang),
      area: r.poly ? r.area : Math.round((r.x1 - r.x0) * (r.z1 - r.z0) * 10) / 10, hidden: !!r.hidden,
      w: Math.round((r.x1 - r.x0) * 100) / 100, d: Math.round((r.z1 - r.z0) * 100) / 100,
    }));
  }

  // Rooms with stable keys `${level}:${type}:${n}`. Prefer house.js' list; else derive from the layout.
  function roomList(s) {
    if (Array.isArray(house?.rooms) && (house.rooms.length || s.mode === 'build')) return house.rooms;
    const out = [];
    for (const fl of layoutHouse(s.house)) {
      const n = {};
      for (const r of fl.rooms) {
        const i = n[r.type] ?? 0;
        n[r.type] = i + 1;
        out.push({ ...r, level: fl.level, key: r.key ?? `${fl.level}:${r.type}:${i}`, hidden: !!r.hidden });
      }
    }
    return out;
  }
  function roomAt(level, x, z) {
    return rooms.find((r) => r.level === level && x >= r.x0 - 0.12 && x <= r.x1 + 0.12 && z >= r.z0 - 0.12 && z <= r.z1 + 0.12) ?? null;
  }

  function buildLamps(s) {
    for (const l of [...lampGroup.children]) { l.dispose?.(); l.removeFromParent(); }
    const h = s.house;
    let spots = Array.isArray(house?.lights) ? house.lights : null;
    if (!spots) {
      // Fallback: the largest visible room on each floor, just under the ceiling.
      spots = [];
      for (let lvl = 0; lvl < h.floors; lvl++) {
        const big = rooms.filter((r) => r.level === lvl && !r.hidden).sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0))[0];
        if (big) spots.push({ level: lvl, x: (big.x0 + big.x1) / 2, y: P + lvl * h.floorHeight + h.floorHeight - 0.45, z: (big.z0 + big.z1) / 2 });
      }
    }
    const used = new Set();
    for (const sp of spots) {
      if (used.has(sp.level) || !Number.isFinite(sp.x + sp.y + sp.z)) continue;
      used.add(sp.level);
      const L = new PointLight(0xffc98a, 14, Math.max(h.width, h.depth) * 0.9, 1.6);
      L.castShadow = false;
      L.position.set(sp.x, sp.y, sp.z);
      L.userData.level = sp.level;
      lampGroup.add(L);
    }
    applyLights();
  }
  function lightsOn() {
    const { env } = store.get();
    return env.lightsOn === 'on' || (env.lightsOn !== 'off' && (env.time > 0.72 || env.time < 0.3));
  }
  function applyLights() {
    if (!house) return;
    const on = lightsOn();
    const lvl = view === 'walk' || cutLevel == null ? null : Math.min(cutLevel, store.get().house.floors - 1);
    // Lights of floors above a cutaway would glow on nothing.
    for (const L of lampGroup.children) L.visible = on && (lvl == null || L.userData.level <= lvl);
    house.setLightsOn?.(on);
    setLanternsOn(on);
    for (const g of indoor.values()) g.userData.setLit?.(on);
    invalidate();
  }

  // ---- indoor items ----------------------------------------------------------------
  function disposeIndoor(g) {
    const keep = new Set();
    for (const o of indoor.values()) if (o !== g) o.traverse((m) => m.material && [].concat(m.material).forEach((x) => keep.add(x)));
    g.traverse((m) => {
      if (m.material) for (const x of [].concat(m.material)) if (!keep.has(x)) x.dispose();
    });
    disposeGroup(g);
  }
  function syncIndoor() {
    const s = store.get();
    const I = s.interior;
    // Upholstery / wood changes restyle every piece: rebuild them with a fresh material set.
    const look = JSON.stringify({ ...I, items: undefined, rooms: undefined });
    if (look !== indoorLook) {
      for (const g of indoor.values()) disposeIndoor(g);
      indoor.clear();
      indoorMats.dispose();
      indoorMats = createMaterialSet();
      indoorLook = look;
    }
    const ids = new Set(I.items.map((i) => i.id));
    for (const [id, g] of indoor) if (!ids.has(id)) { disposeIndoor(g); indoor.delete(id); }
    const fh = s.house.floorHeight;
    for (const it of I.items) {
      let g = indoor.get(it.id);
      if (g && g.userData.type !== it.type) { disposeIndoor(g); indoor.delete(it.id); g = null; }
      if (!g) {
        try { g = buildIndoorItem(it, indoorMats, I); } catch (e) { console.warn('indoor item', it.type, e); g = null; }
        if (!g) continue;
        g.userData.type = it.type;
        g.userData.part ??= `indoor:${it.id}`;
        g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
        indoor.set(it.id, g);
        indoorGroup.add(g);
      }
      g.userData.level = it.level;
      g.position.set(it.x, P + it.level * fh, it.z);
      g.rotation.y = it.rot ?? 0;
    }
    applyIndoorView();
  }
  const clipList = [clipPlane];
  function applyIndoorView() {
    const walking = view === 'walk';
    const lvl = cutLevel == null ? null : Math.min(cutLevel, store.get().house.floors - 1);
    const planes = walking || lvl == null ? null : clipList;
    for (const g of indoor.values()) {
      g.visible = walking || (lvl != null && g.userData.level === lvl);
      g.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of [].concat(o.material)) {
          if (m.clippingPlanes === planes) continue;
          m.clippingPlanes = planes;
          m.clipShadows = true;
          m.needsUpdate = true;
        }
      });
    }
    applyLights();
    applyHighlight();
  }

  function applyHighlight() {
    const r = highlightKey && rooms.find((x) => x.key === highlightKey);
    const { house: h } = store.get();
    const lvl = cutLevel == null ? null : Math.min(cutLevel, h.floors - 1);
    highlight.visible = !!r && view !== 'walk' && lvl === r.level;
    highlight.material.opacity = view === 'top' ? 0.24 : 0.18;
    planView.setSelected(highlightKey);
    if (!r) return;
    highlight.position.set(h.offsetX + (r.x0 + r.x1) / 2, P + r.level * h.floorHeight + 0.07, h.offsetZ + (r.z0 + r.z1) / 2);
    highlight.scale.set(Math.max(0.1, r.x1 - r.x0 - 0.04), 1, Math.max(0.1, r.z1 - r.z0 - 0.04));
    invalidate();
  }

  function syncItems() {
    const list = store.get().yard.items;
    const ids = new Set(list.map((i) => i.id));
    for (const [id, g] of items) if (!ids.has(id)) { disposeGroup(g); items.delete(id); }
    for (const it of list) {
      let g = items.get(it.id);
      if (g && g.userData.type !== it.type) { disposeGroup(g); g = null; }
      if (!g) {
        g = buildItem(it, itemMats);
        if (!g) continue;
        g.userData.type = it.type;
        items.set(it.id, g);
        itemsGroup.add(g);
      }
      g.position.set(it.x, 0, it.z);
      g.rotation.y = it.rot ?? 0;
    }
  }

  // ---- cutaway / plan ----------------------------------------------------------------
  const needInteriors = () => cutLevel != null || view === 'walk';
  function applyCutaway() {
    if (!house) return;
    if (needInteriors() && (!house.hasInteriors || (house.interiorMax != null && (view === 'walk' || cutLevel == null || cutLevel > house.interiorMax)))) { rebuildHouse(); return; }
    const vh = viewState().house; // "Hoy" may have other floors / floor height than the plan
    const F = vh.floors;
    const walking = view === 'walk';
    const lvl = cutLevel == null || walking ? null : Math.min(cutLevel, F - 1);
    const fh = vh.floorHeight;
    clipPlane.constant = lvl == null ? 1e6 : P + lvl * fh + house.cut;
    for (const [name, g] of Object.entries(house.layers)) {
      const idx = +name.replace(/\D/g, '');
      if (name === 'roof') g.visible = lvl == null;
      else if (name.startsWith('f')) g.visible = lvl == null || idx <= lvl;
      // Walk mode shows every furnished interior; orbit only shows the cut floor's.
      else if (name.startsWith('in')) g.visible = walking || (lvl != null && idx === lvl);
      else if (name.startsWith('cap')) g.visible = lvl != null && idx === lvl;
      if (!name.startsWith('cap')) {
        // Build level view: floors below the one being built are dimmed.
        const dim = buildLevelOn && lvl != null && name.startsWith('f') && idx < lvl;
        g.traverse((o) => {
          if (!o.isMesh) return;
          setDim(o, dim);
          o.material.clippingPlanes = lvl == null ? null : [clipPlane];
          o.material.clipShadows = true;
          o.material.needsUpdate = true;
        });
      }
    }
    applyRemodelCut();
    // Yard props that share house materials (fence etc.) are not clipped.
    // The Plano view draws its own, bigger labels with exact sizes.
    house.labelGroup.visible = lvl != null && view !== 'top';
    house.labelGroup.children.forEach((sp) => { sp.userData.onLevel = sp.userData.level === lvl; sp.visible = sp.userData.onLevel; });
    dims.visible = view === 'top' && !planView.isEdit();
    planView.sync();
    applyIndoorView();
    invalidate();
  }

  function updateDims() {
    disposeGroup(dims);
    dims.clear();
    overlay.add(dims);
    const h = eff().house;
    const mk = (text, x, z) => {
      const t = makeTexture(labelCanvas(text, uiTheme === 'dark' ? { px: 48, bg: 'rgba(246,244,238,0.92)', color: '#1B1F1E' } : { px: 48, bg: 'rgba(27,31,30,0.86)', color: '#ffffff', line: 'rgba(255,255,255,0.85)' }));
      t.wrapS = t.wrapT = 1001;
      const sp = new Sprite(new SpriteMaterial({ map: t, depthTest: false, transparent: true }));
      const ht = 0.75;
      sp.scale.set((ht * t.image.width) / t.image.height, ht, 1);
      sp.position.set(x, 0.3, z);
      sp.renderOrder = 11;
      dims.add(sp);
    };
    const fmt = (v) => `${v.toFixed(1).replace('.0', '')} m`;
    mk(fmt(h.width), h.offsetX, h.offsetZ + h.depth / 2 + (h.porch ? 2.6 : 0) + 1.6);
    mk(fmt(h.depth), h.offsetX - h.width / 2 - (h.carport && h.carportSide === 'left' ? 3.6 : 0) - 1.8, h.offsetZ);
    dims.visible = view === 'top' && !planView.isEdit();
  }

  // ---- views ---------------------------------------------------------------------------
  let tween = null;
  function houseFrame() {
    const h = eff().house;
    const top = P + h.floors * h.floorHeight;
    const target = new Vector3(h.offsetX, Math.min(top * 0.45, 3.2), h.offsetZ + 1);
    const size = Math.max(h.width + (h.carport ? 3.6 : 0), h.depth + 3, top * 1.6);
    return { target, size, top };
  }
  function flyTo(pos, target, ms = 750) {
    if (REDUCED) ms = 0;
    tween = { from: camera.position.clone(), to: pos, tFrom: controls.target.clone(), tTo: target, start: performance.now(), ms };
    if (!ms) { camera.position.copy(pos); controls.target.copy(target); tween = null; }
    invalidateCam();
  }
  function aspectFit(size) {
    const inset = camera.view?.enabled ? camera.view.fullWidth - camera.view.width : 0;
    const a = Math.max(0.55, Math.min(1.6, camera.aspect * (1 - inset / Math.max(1, camera.view?.fullWidth ?? 1))));
    return size * (a < 1 ? 1.25 / a : 1);
  }
  function viewOrbit() {
    const { target, size } = houseFrame();
    const d = aspectFit(size) * 1.85 + 6;
    flyTo(target.clone().add(new Vector3(0.6, 0.22, 1).normalize().multiplyScalar(d)), target);
  }
  function viewFront() {
    const { target, size } = houseFrame();
    const d = aspectFit(size) * 1.6 + 5;
    flyTo(target.clone().add(new Vector3(0, 0.12, 1).normalize().multiplyScalar(d)), target);
  }
  function viewTop() {
    const l = store.get().land;
    const h = eff().house;
    if (planView.isEdit()) {
      // Plan editing: straight down, the cut floor's house fills the screen.
      const lvl = lvlNow() ?? 0;
      const t = new Vector3(h.offsetX, P + lvl * h.floorHeight, h.offsetZ);
      const inset = camera.view?.enabled ? camera.view.fullWidth - camera.view.width : 0;
      const a = Math.max(0.3, camera.aspect * (1 - inset / Math.max(1, camera.view?.fullWidth ?? 1)));
      // The sheet covers the bottom of the canvas: the depth must fit in what is left.
      const vis = Math.max(0.3, 1 - viewBottom / Math.max(1, container.clientHeight));
      const half = Math.max((h.depth / 2 + 1.7) / vis, (h.width / 2 + 1.7) / a);
      flyTo(t.clone().add(new Vector3(0, half / Math.tan(MathUtils.degToRad(camera.fov / 2)), 0.01)), t);
      return;
    }
    const size = Math.max(l.width * 0.75, h.width + 8, h.depth + 10);
    const d = aspectFit(size) * 1.6;
    const t = new Vector3(h.offsetX, 0, h.offsetZ + 1.2);
    flyTo(t.clone().add(new Vector3(0, d, 0.01)), t);
  }

  function setControlsFor(mode) {
    controls.enabled = mode !== 'walk';
    controls.enableRotate = mode !== 'top';
    controls.maxPolarAngle = mode === 'top' ? 0.0001 : Math.PI / 2 - 0.04;
    controls.minPolarAngle = 0;
  }

  // ---- walk mode ---------------------------------------------------------------------------
  const walk = { yaw: 0, pitch: 0, keys: new Set(), joy: { x: 0, y: 0 }, pos: new Vector3(), el: null, level: 0 };
  function buildJoystick() {
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:absolute;left:calc(var(--inset-left, 0px) + 20px);bottom:110px;width:128px;height:128px;border-radius:50%;background:rgba(255,255,255,.28);border:2px solid rgba(255,255,255,.75);box-shadow:0 4px 18px rgba(0,0,0,.18);touch-action:none;display:none;z-index:5;backdrop-filter:blur(2px)';
    const knob = document.createElement('div');
    knob.style.cssText = 'position:absolute;left:39px;top:39px;width:50px;height:50px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.25)';
    el.appendChild(knob);
    let active = null;
    const move = (e) => {
      if (active !== e.pointerId) return;
      const r = el.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const m = Math.hypot(dx, dy), max = 44;
      if (m > max) { dx = (dx / m) * max; dy = (dy / m) * max; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      walk.joy.x = dx / max;
      walk.joy.y = dy / max;
      invalidate();
    };
    const end = (e) => {
      if (active !== e.pointerId) return;
      active = null;
      knob.style.transform = '';
      walk.joy.x = walk.joy.y = 0;
    };
    el.addEventListener('pointerdown', (e) => { active = e.pointerId; el.setPointerCapture(e.pointerId); move(e); e.stopPropagation(); });
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    container.appendChild(el);
    return el;
  }
  walk.el = buildJoystick();

  function enterWalk() {
    const l = store.get().land;
    const h = eff().house;
    walk.pos.set(h.offsetX, 0, l.depth / 2 - 1.2);
    walk.yaw = 0;
    walk.pitch = 0.04;
    walk.level = 0;
    tween = null;
    // Walk-in: dolly from the gate to eye height along the drive, FOV 55 -> 70 (1.2 s).
    walk.intro = REDUCED ? null : { t0: performance.now() };
    if (walk.intro) { camera.fov = 55; camera.updateProjectionMatrix(); }
    walk.el.style.display = 'block';
    renderer.domElement.focus({ preventScroll: true });
  }

  function insideHouse(x, z) {
    const st = store.get();
    if (st.mode === 'build' && st.build) {
      // Built floors: standing on a raised ground slab lifts the eye by the plinth height.
      const lx = x - st.house.offsetX, lz = z - st.house.offsetZ;
      return st.build.levels[0].slabs.some((q) => q.raised !== false && lx >= q.x0 && lx <= q.x1 && lz >= q.z0 && lz <= q.z1);
    }
    const h = st.house;
    const lx = x - h.offsetX, lz = z - h.offsetZ;
    const porch = h.porch ? 2.6 : 0;
    return Math.abs(lx) < h.width / 2 && lz < h.depth / 2 + porch && lz > -h.depth / 2;
  }

  function collide(p, prev) {
    const R = 0.3;
    for (const s of segments) {
      if (s.level > 0 && s.level !== walk.level) continue;
      const [ax, az] = s.a, [bx, bz] = s.b;
      const dx = bx - ax, dz = bz - az;
      const L2 = dx * dx + dz * dz || 1e-6;
      let t = ((p.x - ax) * dx + (p.z - az) * dz) / L2;
      t = Math.max(0, Math.min(1, t));
      const cx = ax + t * dx, cz = az + t * dz;
      const ox = p.x - cx, oz = p.z - cz;
      const d = Math.hypot(ox, oz);
      if (d < R) {
        if (d < 1e-4) { p.x = prev.x; p.z = prev.z; continue; }
        p.x = cx + (ox / d) * R;
        p.z = cz + (oz / d) * R;
      }
    }
    const { land: l } = store.get();
    p.x = Math.max(-l.width / 2 - 8, Math.min(l.width / 2 + 8, p.x));
    p.z = Math.max(-l.depth / 2 - 8, Math.min(l.depth / 2 + 9, p.z));
  }

  function stepWalk(dt) {
    const k = walk.keys;
    let f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - walk.joy.y;
    let s = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    const turn = (k.has('ArrowLeft') ? 1 : 0) - (k.has('ArrowRight') ? 1 : 0) - walk.joy.x * 0.9;
    walk.yaw += turn * dt * 1.6;
    f = Math.max(-1, Math.min(1, f));
    const speed = 2.6;
    const prev = walk.pos.clone();
    const fwd = new Vector3(-Math.sin(walk.yaw), 0, -Math.cos(walk.yaw));
    const right = new Vector3(Math.cos(walk.yaw), 0, -Math.sin(walk.yaw));
    walk.pos.addScaledVector(fwd, f * speed * dt).addScaledVector(right, s * speed * dt);
    collide(walk.pos, prev);
    const floorY = insideHouse(walk.pos.x, walk.pos.z) ? P : 0;
    const eyeY = floorY + EYE;
    camera.position.set(walk.pos.x, MathUtils.lerp(camera.position.y || eyeY, eyeY, Math.min(1, dt * 8)), walk.pos.z);
    let intro = false;
    if (walk.intro) {
      const k = Math.min(1, (performance.now() - walk.intro.t0) / 1200);
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      camera.position.set(walk.pos.x, MathUtils.lerp(3.4, eyeY, e), walk.pos.z + 5.5 * (1 - e));
      camera.fov = 55 + 15 * e;
      camera.updateProjectionMatrix();
      if (k >= 1) walk.intro = null;
      intro = true;
    }
    const look = new Vector3(-Math.sin(walk.yaw) * Math.cos(walk.pitch), Math.sin(walk.pitch), -Math.cos(walk.yaw) * Math.cos(walk.pitch));
    camera.lookAt(camera.position.clone().add(look));
    return intro || f !== 0 || s !== 0 || turn !== 0;
  }

  window.addEventListener('keydown', (e) => {
    if (view !== 'walk' || document.querySelector('dialog[open]')) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      walk.keys.add(e.code);
      e.preventDefault();
      invalidate();
    }
  });
  window.addEventListener('keyup', (e) => walk.keys.delete(e.code));
  window.addEventListener('blur', () => walk.keys.clear());

  // ---- pointer: pick, drag items, walk look ----------------------------------------------
  const ray = new Raycaster();
  const ndc = new Vector2();
  const ground = new Plane(new Vector3(0, 1, 0), 0);
  let down = null;
  let dragging = null;

  function setNdc(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  function hitPart(e) {
    setNdc(e);
    const targets = [itemsGroup, indoorGroup, house?.group, yard?.group].filter(Boolean);
    const clipped = (obj) => house.group.getObjectById(obj.id) || indoorGroup.getObjectById(obj.id);
    const hits = ray.intersectObjects(targets, true).filter((h) => {
      if (!h.object.visible || h.object.isSprite) return false;
      let o = h.object;
      while (o) { if (!o.visible) return false; o = o.parent; }
      // Ignore clipped-away geometry.
      return clipPlane.constant > 1e5 || h.point.y <= clipPlane.constant + 0.01 || !clipped(h.object);
    });
    const { house: hs } = store.get();
    const lvl = cutLevel == null || view === 'walk' ? null : Math.min(cutLevel, hs.floors - 1);
    for (const h of hits) {
      let o = h.object;
      while (o && o.userData.part === undefined) o = o.parent;
      const part = o?.userData.part;
      if (part != null) return { part, object: h.object, point: h.point };
      // An untagged floor surface inside the cut floor still picks its room.
      if (lvl != null && house.group.getObjectById(h.object.id)) {
        const fy = P + lvl * hs.floorHeight;
        const r = h.point.y > fy - 0.1 && h.point.y < fy + 0.25 && roomAt(lvl, h.point.x - hs.offsetX, h.point.z - hs.offsetZ);
        if (r) return { part: `room:${r.key}`, object: h.object, point: h.point };
      }
    }
    return { part: null };
  }

  // ---- plan editing: pointer on the cut floor, handle drags ------------------------------------
  let planDrag = null;
  const floorPlane = new Plane(new Vector3(0, 1, 0), 0);
  // Pointer position on the cut floor in house-local meters, or null.
  // `lift` = height above the floor of the plane: handles are drawn at 1.6 m, so drags use that plane to stay under the finger.
  function floorPoint(e, lift = 0.05) {
    const { house: h } = store.get();
    const lvl = lvlNow() ?? 0;
    floorPlane.constant = -(P + lvl * h.floorHeight + lift);
    setNdc(e);
    const p = new Vector3();
    return ray.ray.intersectPlane(floorPlane, p) ? { x: p.x - h.offsetX, z: p.z - h.offsetZ } : null;
  }
  function roomUnder(e) {
    const pt = floorPoint(e), lvl = lvlNow();
    if (!pt || lvl == null) return null;
    return rooms.find((r) => r.level === lvl && !r.hidden && pt.x >= r.x0 && pt.x <= r.x1 && pt.z >= r.z0 && pt.z <= r.z1) ?? null;
  }
  function planApplyLive(t) {
    if (planDrag.last === t.value) return;
    planDrag.last = t.value;
    planDrag.live = true;
    if (t.kind === 'wall') store.moveWall(t.level, t.band, t.index, t.value, { commit: false });
    else store.setFrontDepth(t.value, { commit: false });
  }
  function finishPlanDrag() {
    const r = planView.end();
    if (r) {
      const ok = r.kind === 'wall' ? store.moveWall(r.level, r.band, r.index, r.value, { commit: true }) : store.setFrontDepth(r.value, { commit: true });
      if (!ok) store.commit();
    }
    planDrag = null;
    down = null;
    controls.enabled = view !== 'walk';
    el.style.cursor = '';
    emit('planDrag', { active: false });
  }

  const el = renderer.domElement;
  // Runs before OrbitControls: a press on a handle must not start a pan.
  el.addEventListener('pointerdown', (e) => {
    if (view === 'top' && planView.isEdit() && planView.hit(e.clientX, e.clientY)) controls.enabled = false;
  }, true);
  el.addEventListener('pointerdown', (e) => {
    if (e.__replay) return;
    if (tool) { down = null; return; }
    down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, yaw: walk.yaw, pitch: walk.pitch };
    if (view === 'walk') { el.setPointerCapture(e.pointerId); return; }
    if (view === 'top' && planView.isEdit()) {
      const hd = planView.hit(e.clientX, e.clientY);
      if (hd && planView.begin(hd)) {
        planDrag = { id: e.pointerId, live: false, last: null };
        controls.enabled = false;
        try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        el.style.cursor = hd.vertical ? 'ns-resize' : 'ew-resize';
        emit('planDrag', { active: true });
        return;
      }
    }
    const hit = hitPart(e);
    const isIndoor = hit.part?.startsWith('indoor:');
    if (hit.part?.startsWith('item:') || isIndoor) {
      const id = hit.part.slice(isIndoor ? 7 : 5);
      const g = (isIndoor ? indoor : items).get(id);
      if (g) {
        // Indoor pieces slide on their own floor's plane, in house-local coordinates.
        const plane = isIndoor ? new Plane(new Vector3(0, 1, 0), -g.position.y) : ground;
        const base = isIndoor ? indoorGroup.position : new Vector3();
        dragging = { id, g, indoor: isIndoor, plane, base, started: false, offset: new Vector3() };
        const p = new Vector3();
        if (ray.ray.intersectPlane(plane, p)) dragging.offset.copy(g.position).add(base).sub(p);
        dragging.offset.y = 0;
        controls.enabled = false;
        el.setPointerCapture(e.pointerId);
      }
    }
  });
  el.addEventListener('pointermove', (e) => {
    if (!down || e.pointerId !== down.id) return;
    if (view === 'walk') {
      walk.yaw = down.yaw + (e.clientX - down.x) * 0.0045;
      walk.pitch = Math.max(-0.9, Math.min(0.9, down.pitch + (e.clientY - down.y) * 0.0035));
      invalidate();
      return;
    }
    if (planDrag) {
      const pt = floorPoint(e, 1.6);
      const t = pt && planView.move(pt);
      // Cheap houses rebuild live while dragging; heavy ones show the ghost line and commit on release.
      if (t && lastRebuildMs < 110) planApplyLive(t);
      invalidate();
      return;
    }
    if (dragging) {
      if (!dragging.started && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) return;
      dragging.started = true;
      el.style.cursor = 'grabbing';
      setNdc(e);
      const p = new Vector3();
      if (!ray.ray.intersectPlane(dragging.plane, p)) return;
      p.add(dragging.offset);
      if (dragging.indoor) {
        const bd = store.itemBounds();
        p.sub(dragging.base);
        dragging.g.position.x = Math.max(bd.x0, Math.min(bd.x1, p.x));
        dragging.g.position.z = Math.max(bd.z0, Math.min(bd.z1, p.z));
      } else {
        const { land: l } = store.get();
        p.x = Math.max(-l.width / 2 + 0.6, Math.min(l.width / 2 - 0.6, p.x));
        p.z = Math.max(-l.depth / 2 + 0.6, Math.min(l.depth / 2 - 0.6, p.z));
        dragging.g.position.set(p.x, 0, p.z);
      }
      invalidate();
    }
  });
  el.addEventListener('pointerup', (e) => {
    if (!down || e.pointerId !== down.id) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 600;
    if (planDrag) { finishPlanDrag(); return; }
    if (!controls.enabled && !dragging && view !== 'walk') controls.enabled = true;
    if (dragging?.started) {
      const { id, g } = dragging;
      (dragging.indoor ? store.moveIndoorItem : store.moveItem)(id, g.position.x, g.position.z, { commit: true });
    } else if (moved < 8 && quick && view !== 'walk') {
      const rt = view === 'top' ? roomUnder(e) : null;
      if (rt) emit('roomTap', { id: rt.key, level: rt.level });
      if (rt && planView.isEdit()) emit('pick', { part: `room:${rt.key}` });
      else {
        const hit = hitPart(e);
        if (hit.part) flash(hit.object);
        emit('pick', { part: hit.part });
      }
    }
    if (dragging) { controls.enabled = view !== 'walk'; el.style.cursor = ''; }
    dragging = null;
    down = null;
  });
  el.addEventListener('pointercancel', (e) => {
    if (toolGesture === e.pointerId) { cancelToolGesture(e); return; }
    if (planDrag) { finishPlanDrag(); return; }
    if (dragging) { syncItems(); syncIndoor(); }
    dragging = null;
    down = null;
    controls.enabled = view !== 'walk';
  });
  el.addEventListener('pointermove', (e) => {
    if (down || view === 'walk' || e.pointerType !== 'mouse') return;
    hoverQueued = e;
    wake();
  });
  let hoverQueued = null;

  // ---- build tools (engine/buildtool.js plugs in through setTool; see CONTRACT.md "v4 build API") ----
  let tool = null, toolGesture = null, buildLevelOn = false;
  const pointers = new Map();
  const toolCtx = {
    THREE, scene, camera, canvas: renderer.domElement, controls, requestRender: () => invalidate(),
    store, P,
    // Pointer on the plane y = `y` (world height; levelY(level) for a floor). x / z are house-local, lx / lz lot-local.
    groundPoint(evt, y = 0) {
      setNdc(evt);
      const p = new Vector3();
      const pl = new Plane(new Vector3(0, 1, 0), -y);
      if (!ray.ray.intersectPlane(pl, p)) return null;
      const h = store.get().house;
      return { x: p.x - h.offsetX, z: p.z - h.offsetZ, lx: p.x, lz: p.z };
    },
    levelY: (level) => P + Math.max(0, Math.floor(+level || 0)) * store.get().house.floorHeight,
    // Pointer on the floor surface of a build level (v5 pieces): { x, z (house-local), lx, lz (lot-local) } | null.
    pointOnLevel: (evt, level) => toolCtx.groundPoint(evt, toolCtx.levelY(level)),
    // The build level whose floor is under the pointer (top-most hit of the house), else the current build level.
    levelUnder(evt) {
      const F = store.get().house.floors, FH = store.get().house.floorHeight;
      const cur = lvlNow() ?? 0;
      if (!house?.group) return cur;
      setNdc(evt);
      const hits = ray.intersectObject(house.group, true).filter((h) => h.object.visible && h.face && h.face.normal.y > 0.7);
      if (!hits.length) return cur;
      return Math.max(0, Math.min(F - 1, Math.floor((hits[0].point.y - P + 0.4) / FH)));
    },
    on: (ev, fn) => api.on(ev, fn),
    emit: (ev, data) => emit(ev, data),
    getView: () => view,
    setView: (m) => api.setView(m),
    setCutaway: (on) => api.setCutaway(on),
    highlightBuild: (id) => api.highlightBuild(id),
  };
  function cancelToolGesture(e) {
    if (toolGesture == null) return;
    toolGesture = null;
    try { tool?.cancel?.(e, toolCtx); } catch (err) { console.warn('tool cancel', err); }
    controls.enabled = view !== 'walk';
    invalidate();
  }
  // Runs before OrbitControls: the tool may consume a press (then the camera stays still for that gesture).
  el.addEventListener('pointerdown', (e) => {
    if (e.__replay) return;
    pointers.set(e.pointerId, { pointerId: e.pointerId, pointerType: e.pointerType, clientX: e.clientX, clientY: e.clientY });
    if (!tool || view === 'walk') return;
    if (pointers.size > 1) {
      // A second finger always belongs to the camera: drop the tool gesture and hand the first finger to the controls.
      if (toolGesture != null) {
        const first = pointers.get(toolGesture);
        cancelToolGesture(e);
        if (first) {
          const ev = new PointerEvent('pointerdown', { pointerId: first.pointerId, pointerType: first.pointerType, clientX: first.clientX, clientY: first.clientY, button: 0, buttons: 1, isPrimary: true, bubbles: true, cancelable: true });
          ev.__replay = true;
          el.dispatchEvent(ev);
        }
      }
      return;
    }
    if (e.button !== 0) return;
    let used = false;
    try { used = tool.pointerdown?.(e, toolCtx) === true; } catch (err) { console.warn('tool pointerdown', err); }
    if (used) {
      toolGesture = e.pointerId;
      controls.enabled = false;
      try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      invalidate();
    }
  }, true);
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (toolGesture === e.pointerId && e.type === 'pointerup') {
      toolGesture = null;
      try { tool?.pointerup?.(e, toolCtx); } catch (err) { console.warn('tool pointerup', err); }
      controls.enabled = view !== 'walk';
      invalidate();
    }
  };
  el.addEventListener('pointerup', endPointer, true);
  el.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); }, true);
  el.addEventListener('pointermove', (e) => {
    if (!tool || view === 'walk' || (pointers.size > 1 && toolGesture == null)) return;
    const pt = pointers.get(e.pointerId);
    if (pt) { pt.clientX = e.clientX; pt.clientY = e.clientY; }
    if (toolGesture != null && toolGesture !== e.pointerId) return;
    try { tool.pointermove?.(e, toolCtx); } catch (err) { console.warn('tool pointermove', err); }
  });
  window.addEventListener('keydown', (e) => {
    if (!tool?.keydown || document.querySelector('dialog[open]')) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    try { tool.keydown(e, toolCtx); } catch (err) { console.warn('tool keydown', err); }
  });

  // Dimmed copies of the materials of floors below the build level.
  const dimMats = new Map();
  const dimOf = (m) => {
    let d = dimMats.get(m);
    if (!d) {
      d = m.clone();
      d.transparent = true;
      d.opacity = m.transparent ? Math.min(m.opacity, 0.35) : 0.42;
      d.depthWrite = true;
      d.userData.dim = true;
      dimMats.set(m, d);
    }
    return d;
  };
  function setDim(o, on) {
    o.userData.origMat ??= o.material;
    const want = on ? dimOf(o.userData.origMat) : o.userData.origMat;
    if (o.material !== want) o.material = want;
  }

  // Selection highlight for a build element (wall, opening, slab, stairs, fence), by id.
  let buildHiId = null;
  const buildHi = new Group();
  buildHi.name = 'buildHi';
  buildHi.renderOrder = 6;
  world.add(buildHi);
  // Teal accent: 12-20% fill + a crisp edge (REVAMP "Highlights").
  const hiMat = new MeshBasicMaterial({ color: 0x0b6e7f, transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const hiEdge = new THREE.LineBasicMaterial({ color: 0x0b6e7f, transparent: true, opacity: 0.95, depthTest: false });
  function applyBuildHighlight() {
    for (const c of [...buildHi.children]) { c.geometry?.dispose(); c.children[0]?.geometry?.dispose(); c.removeFromParent(); }
    const st = store.get();
    if (!buildHiId || !st.build) { invalidate(); return; }
    const b = st.build, FH = b.floorHeight;
    const box = (w, hh, d, x, y, z, ry = 0) => {
      const m = new Mesh(new BoxGeometry(w, hh, d), hiMat);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      m.raycast = () => {};
      m.renderOrder = 6;
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), hiEdge);
      edge.raycast = () => {};
      edge.renderOrder = 7;
      m.add(edge);
      buildHi.add(m);
    };
    // Highlight boxes are house-local; fences (lot-local) are shifted back by the offset.
    const hi = new Set(Array.isArray(buildHiId) ? buildHiId : [buildHiId]);
    const ox = st.house.offsetX, oz = st.house.offsetZ;
    buildHi.position.set(ox, 0, oz);
    for (let li = 0; li < b.levels.length; li++) {
      const L = b.levels[li], y0 = P + li * FH;
      for (const w of L.walls) {
        const len = wallLen(w), cx = (w.x0 + w.x1) / 2, cz = (w.z0 + w.z1) / 2, ry = Math.atan2(-(w.z1 - w.z0), w.x1 - w.x0);
        if (hi.has(w.id)) { box(len + w.t, (w.h ?? FH) + 0.04, w.t + 0.05, cx, y0 + (w.h ?? FH) / 2, cz, ry); continue; }
        for (const o of w.openings) if (hi.has(o.id)) {
          const dx = (w.x1 - w.x0) / len, dz = (w.z1 - w.z0) / len;
          box(o.w + 0.1, o.h + 0.1, w.t + 0.08, w.x0 + dx * o.at, y0 + o.sill + o.h / 2, w.z0 + dz * o.at, ry);
        }
      }
      for (const sl of L.slabs) if (hi.has(sl.id)) box(sl.x1 - sl.x0, 0.06, sl.z1 - sl.z0, (sl.x0 + sl.x1) / 2, (li === 0 ? (sl.raised === false ? 0.1 : P) : y0) + 0.07, (sl.z0 + sl.z1) / 2);
      for (const stp of L.stairs) if (hi.has(stp.id)) {
        const n = Math.max(12, Math.ceil(FH / 0.185)), len = stp.len ?? n * 0.27;
        const fx = -Math.sin(stp.rot), fz = -Math.cos(stp.rot);
        box(stp.w + 0.1, FH / 2, len, stp.x + fx * len / 2, y0 + FH / 4, stp.z + fz * len / 2, stp.rot);
      }
      for (const c of L.columns ?? []) if (hi.has(c.id)) {
        const own = L.slabs.find((q) => c.x >= q.x0 && c.x <= q.x1 && c.z >= q.z0 && c.z <= q.z1);
        const base = li === 0 ? (own ? (own.raised === false ? 0.1 : P) : 0) : y0;
        const ht = c.h ?? (y0 + FH - base);
        box(c.s + 0.14, ht + 0.04, c.s + 0.14, c.x, base + ht / 2, c.z);
      }
    }
    for (const f of b.fences) if (hi.has(f.id)) {
      const len = Math.hypot(f.x1 - f.x0, f.z1 - f.z0);
      box(len + 0.1, f.h + 0.1, 0.5, (f.x0 + f.x1) / 2 - ox, (f.h + 0.1) / 2, (f.z0 + f.z1) / 2 - oz, Math.atan2(-(f.z1 - f.z0), f.x1 - f.x0));
    }
    invalidate();
  }

  function flash(obj) {
    const m = obj.material;
    if (!m || !m.emissive) return;
    const prev = m.emissive.getHex();
    m.emissive.setHex(0x0a4f5b);
    invalidate();
    setTimeout(() => { m.emissive?.setHex(prev); invalidate(); }, 400);
  }

  // ---- render loop (on demand) -----------------------------------------------------------
  // Frames are drawn only when something changed. The rAF loop itself stops after 2 s idle and any
  // invalidate() / pointer move wakes it. Camera-only changes skip the shadow-map update.
  let disposed = false;
  // ?fast in the URL turns the still-frame refinement off (slow devices, tests).
  const REDUCED_REFINE = /[?&]fast\b/.test(location.search);
  let dirty = 2;
  let shadowDirty = true;
  let raf = 0;
  let lastActive = performance.now();
  let frames = 0;
  renderer.shadowMap.autoUpdate = false;
  function wake() {
    if (!raf && !disposed) { lastT = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function invalidate() { dirty = Math.max(dirty, 2); shadowDirty = true; wake(); }
  function invalidateCam() { dirty = Math.max(dirty, 2); wake(); }
  controls.addEventListener('change', invalidateCam);

  let lastT = performance.now();
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    let busy = false;
    if (hoverQueued) {
      const hd = view === 'top' && planView.isEdit() ? planView.hit(hoverQueued.clientX, hoverQueued.clientY) : null;
      if (hd) el.style.cursor = hd.vertical ? 'ns-resize' : 'ew-resize';
      else {
        const hit = hitPart(hoverQueued);
        el.style.cursor = hit.part?.startsWith('item:') || hit.part?.startsWith('indoor:') ? 'grab' : hit.part ? 'pointer' : '';
      }
      hoverQueued = null;
    }
    if (tween) {
      const k = Math.min(1, (now - tween.start) / tween.ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      camera.position.lerpVectors(tween.from, tween.to, e);
      controls.target.lerpVectors(tween.tFrom, tween.tTo, e);
      if (k >= 1) tween = null;
      dirty = 2;
      busy = true;
    }
    if (view === 'walk') {
      if (stepWalk(dt)) { dirty = 2; busy = true; }
    } else if (controls.update()) { dirty = Math.max(dirty, 1); busy = true; }
    if (reveal.step(now)) { dirty = 2; shadowDirty = true; busy = true; }
    if (fx.stepAnim(now)) { dirty = Math.max(dirty, 1); shadowDirty = true; busy = true; }
    // Card thumbnails draw into a corner of the canvas; the main frame below paints over them in the same task.
    if (fx.runThumbs()) { dirty = Math.max(dirty, 1); busy = true; }
    if (dirty > 0) {
      // Water only ripples while the view is being redrawn anyway (it never keeps the loop awake).
      const waters = [];
      if (land?.water) waters.push(land.water.material);
      const pool = yard?.group.getObjectByName('water');
      if (pool) waters.push(pool.material);
      for (const w of waters) { w.normalMap.offset.x += dt * 0.01; w.normalMap.offset.y += dt * 0.007; }
      // Fog starts past the subject whatever the zoom (top views sit high above the lot).
      const camD = camera.position.distanceTo(view === 'walk' ? camera.position : controls.target);
      scene.fog.near = FOG.near + camD;
      scene.fog.far = FOG.far + camD;
      if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
      planView.onCamera();
      scaleRoomLabels();
      composer.render(dt);
      frames++;
      dirty--;
      busy = true;
      accCount = 0;
      stillSince = now;
      for (const m of retired.splice(0)) m?.dispose();
    } else if (!busy && accCount < ACC_N && view !== 'walk' && !screenshotting && now - stillSince > 140 && !REDUCED_REFINE) {
      planView.onCamera();
      accumulateStep(accCount, ACC_N);
      accCount++;
      busy = true;
    }
    if (busy || dirty > 0) lastActive = now;
    // (invalidate() during this frame may already have queued the next one.)
    if (!raf && now - lastActive < 2000) raf = requestAnimationFrame(frame);
  }

  // ---- Still-frame refinement (realism pass 2) ---------------------------------------------------------------
  // When nothing moves, the engine keeps rendering for a moment and averages the frames, each with a sub-pixel
  // camera jitter and the sun moved inside a small disk (an area light). The average is a progressive render:
  // soft, physically-sized penumbras and clean, anti-aliased edges (foliage cards, fences, thin trims) like an
  // offline renderer. Any change shows the normal frame again at once. Also used by screenshot() for photos.
  const ACC_N = mobile ? 10 : 28;
  const accA = new WebGLRenderTarget(1, 1, { type: HalfFloatType }), accB = accA.clone();
  let accRead = accA, accWrite = accB, accCount = 0, stillSince = 0;
  const quadVS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const accQuad = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { tNew: { value: null }, tAcc: { value: null }, w: { value: 1 } },
    vertexShader: quadVS,
    // The composer output is display-encoded (sRGB); average in linear light or fine detail (grass) goes dark.
    fragmentShader: 'uniform sampler2D tNew, tAcc; uniform float w; varying vec2 vUv; vec3 lin(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); } void main() { gl_FragColor = vec4(mix(texture2D(tAcc, vUv).rgb, lin(texture2D(tNew, vUv).rgb), w), 1.0); }',
    depthTest: false, depthWrite: false,
  }));
  const showQuad = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: quadVS,
    fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; vec3 enc(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); } void main() { gl_FragColor = vec4(enc(texture2D(tDiffuse, vUv).rgb), 1.0); }',
    depthTest: false, depthWrite: false,
  }));
  const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  const accSize = new Vector2(), sunU = new Vector3(), sunV = new Vector3(), sunBase = new Vector3();
  // One progressive sample: jittered render, blended into the running average, average shown on screen.
  function accumulateStep(i, total) {
    renderer.getDrawingBufferSize(accSize);
    if (accA.width !== accSize.x || accA.height !== accSize.y) { accA.setSize(accSize.x, accSize.y); accB.setSize(accSize.x, accSize.y); }
    // Sub-pixel jitter (Halton 2,3) on top of the current view offset.
    const jx = (halton(i + 1, 2) - 0.5) * 2 / accSize.x, jy = (halton(i + 1, 3) - 0.5) * 2 / accSize.y;
    camera.updateProjectionMatrix();
    camera.projectionMatrix.elements[8] += jx;
    camera.projectionMatrix.elements[9] += jy;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    // Sun inside a disk ~1.3 deg wide (sun + bright circumsolar sky): soft penumbras that widen with distance.
    sunBase.copy(sun.position);
    sunU.copy(sunDir).cross(Math.abs(sunDir.y) < 0.95 ? THREE.Object3D.DEFAULT_UP : new Vector3(1, 0, 0)).normalize();
    sunV.copy(sunDir).cross(sunU).normalize();
    const a = halton(i + 1, 5) * Math.PI * 2, rr = Math.sqrt(halton(i + 1, 7)) * 80 * Math.tan(0.0115);
    sun.position.addScaledVector(sunU, Math.cos(a) * rr).addScaledVector(sunV, Math.sin(a) * rr);
    sun.updateMatrixWorld();
    renderer.shadowMap.needsUpdate = true;
    composer.renderToScreen = false;
    composer.render(0);
    composer.renderToScreen = true;
    sun.position.copy(sunBase);
    sun.updateMatrixWorld();
    camera.updateProjectionMatrix();
    const m = accQuad.material.uniforms;
    m.tNew.value = composer.readBuffer.texture;
    m.tAcc.value = accRead.texture;
    m.w.value = i === 0 ? 1 : 1 / (i + 1);
    renderer.setRenderTarget(accWrite);
    accQuad.render(renderer);
    [accRead, accWrite] = [accWrite, accRead];
    renderer.setRenderTarget(null);
    showQuad.material.uniforms.tDiffuse.value = accRead.texture;
    showQuad.render(renderer);
    shadowDirty = true; // the next normal frame re-renders the shadow from the real sun
    return i + 1 >= total;
  }

  let screenshotting = false;
  let viewBottom = 0;
  // Cutaway name tags keep a readable size (>= ~12 px text) when the house is far away.
  const lblPos = new Vector3();
  // Labels never stack: the bigger room keeps its tag, overlapping ones hide; all hide when the camera is far.
  const lblNdc = new Vector3();
  let labelStats = { shown: 0, hidden: 0, overlaps: 0, far: false };
  function scaleRoomLabels() {
    const g = house?.labelGroup;
    if (!g?.visible) return;
    const W = Math.max(1, container.clientWidth), H = Math.max(1, container.clientHeight);
    const unit = (2 * Math.tan(MathUtils.degToRad(camera.fov / 2))) / H;
    const hs = store.get().house;
    const frameD = aspectFit(Math.max(hs.width, hs.depth)) * 1.45 + 3;
    const far = camera.position.distanceTo(controls.target) > Math.max(28, frameD * 1.6);
    const list = [];
    for (const sp of g.children) {
      if (!sp.userData.onLevel) { sp.visible = false; continue; }
      const k = sp.userData.aspect ?? (sp.userData.aspect = sp.scale.x / sp.scale.y);
      sp.getWorldPosition(lblPos);
      const dist = camera.position.distanceTo(lblPos);
      const hgt = Math.max(0.55, 21 * unit * dist);
      sp.scale.set(hgt * k, hgt, 1);
      lblNdc.copy(lblPos).project(camera);
      const ph = hgt / (unit * Math.max(0.01, dist)), pw = ph * k;
      const cx = (lblNdc.x + 1) * 0.5 * W, cy = (1 - lblNdc.y) * 0.5 * H;
      list.push({ sp, area: sp.userData.area ?? 0, x0: cx - pw / 2 - 3, x1: cx + pw / 2 + 3, y0: cy - ph / 2 - 2, y1: cy + ph / 2 + 2, behind: lblNdc.z > 1 });
    }
    list.sort((a, b) => b.area - a.area);
    const kept = [];
    let hidden = 0;
    for (const L of list) {
      const hit = far || L.behind || kept.some((o) => L.x0 < o.x1 && L.x1 > o.x0 && L.y0 < o.y1 && L.y1 > o.y0);
      L.sp.visible = !hit;
      if (hit) hidden++; else kept.push(L);
    }
    let overlaps = 0;
    for (let i = 0; i < kept.length; i++) for (let j = i + 1; j < kept.length; j++) {
      const a = kept[i], b = kept[j];
      if (a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0) overlaps++;
    }
    labelStats = { shown: kept.length, hidden, overlaps, far };
  }
  function resize() {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    gtao?.setSize(w, h);
    camera.aspect = w / h;
    // Shift the picture right so the house centers in the area not covered by the side panel.
    const inset = parseFloat(getComputedStyle(container).getPropertyValue('--inset-left')) || 0;
    // Left inset (side panel) and bottom inset (phone sheet): the picture is shifted so the target sits in the free area.
    const li = inset > 0 && inset < w * 0.6 ? inset : 0, bi = viewBottom > 0 && viewBottom < h * 0.8 ? viewBottom : 0;
    if (li || bi) camera.setViewOffset(w + li, h, 0, bi / 2, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    // The plan editor keeps the whole floor in frame when the window or phone orientation changes.
    if (view === 'top' && planView.isEdit() && !screenshotting) viewTop();
    invalidate();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // ---- contact shadow, lot marks, reveal ("Plano" scene, REVAMP sections 5-6) ----------------
  // Cheap contact AO: a soft dark falloff around the house footprint (25%), drawn on the lot.
  const aoMat = new THREE.ShaderMaterial({
    uniforms: { halfSize: { value: new Vector2(5, 5) }, margin: { value: 1.4 }, strength: { value: 0.25 } },
    vertexShader: 'varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec2 halfSize; uniform float margin, strength; varying vec2 vP; void main() { float r = length(max(abs(vP) - halfSize, 0.0)); float k = 1.0 - clamp(r / margin, 0.0, 1.0); gl_FragColor = vec4(0.0, 0.0, 0.0, strength * k * k); }',
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const aoMesh = new Mesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), aoMat);
  aoMesh.raycast = () => {};
  aoMesh.renderOrder = 1;
  aoMesh.name = 'contactAO';
  world.add(aoMesh);
  function placeContactAO() {
    const h = eff().house;
    const m = aoMat.uniforms.margin.value;
    aoMat.uniforms.halfSize.value.set(h.width / 2, h.depth / 2);
    aoMesh.scale.set(h.width + 2 * m, 1, h.depth + 2 * m);
    aoMesh.position.set(h.offsetX, 0.004, h.offsetZ);
  }

  // Lot marks (Diseñar / Terreno): teal 4 cm boundary, corner posts, lot size in metres (mono).
  let lotMarksOn = false;
  const lotMarks = new Group();
  lotMarks.name = 'lotMarks';
  lotMarks.visible = false;
  world.add(lotMarks);
  const lotLabels = new Group();
  overlay.add(lotLabels);
  const accent = { light: 0x0b6e7f, dark: 0x5cc4d3 };
  const markMat = new MeshBasicMaterial({ color: accent.light, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  function buildLotMarks() {
    for (const c of [...lotMarks.children]) { c.geometry?.dispose(); c.removeFromParent(); }
    for (const c of [...lotLabels.children]) { c.material.map?.dispose(); c.material.dispose(); c.removeFromParent(); }
    if (!lotMarksOn) { lotMarks.visible = lotLabels.visible = false; invalidate(); return; }
    const { width: W, depth: D } = store.get().land;
    const t = 0.04;
    for (const [w, d, x, z] of [[W + t, t, 0, -D / 2], [W + t, t, 0, D / 2], [t, D, -W / 2, 0], [t, D, W / 2, 0]]) {
      const m = new Mesh(new BoxGeometry(w, 0.006, d), markMat);
      m.position.set(x, 0.006, z);
      m.raycast = () => {};
      lotMarks.add(m);
    }
    for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) {
      const m = new Mesh(new BoxGeometry(0.07, 0.5, 0.07), markMat);
      m.position.set(x, 0.25, z);
      m.castShadow = true;
      m.raycast = () => {};
      lotMarks.add(m);
    }
    const fmt = (v) => `${(+v).toFixed(1).replace('.0', '')} m`;
    const tag = (text, x, z) => {
      const tx = makeTexture(labelCanvas(text, { px: 40, font: 600, color: '#07505D' }));
      tx.wrapS = tx.wrapT = 1001;
      const sp = new Sprite(new SpriteMaterial({ map: tx, depthTest: false, transparent: true }));
      sp.scale.set((0.8 * tx.image.width) / tx.image.height, 0.8, 1);
      sp.position.set(x, 0.6, z);
      sp.renderOrder = 9;
      lotLabels.add(sp);
    };
    tag(fmt(W), 0, D / 2 + 0.6);
    tag(fmt(D), W / 2 + 0.9, 0);
    lotMarks.visible = lotLabels.visible = true;
    invalidate();
  }

  const reveal = createReveal({
    world, store, P, reduced: REDUCED, canvas: renderer.domElement, emit,
    invalidate: () => invalidate(),
    applyTime: (t, o) => applyTime(t, o),
    getHouse: () => ({ house, yard, items: itemsGroup }),
    // Full house, outside view, no plan editing.
    prepare() {
      if (view === 'walk' || view === 'top') api.setView('orbit');
      buildLevelOn = false;
      if (cutLevel != null) { cutLevel = null; applyCutaway(); }
    },
    camHigh() {
      const { target, size } = houseFrame();
      const d = aspectFit(size) * 1.85 + 6;
      flyTo(target.clone().add(new Vector3(0.75, 0.95, 1).normalize().multiplyScalar(d * 1.1)), target, 500);
    },
    camRest(ms) {
      const { target, size } = houseFrame();
      const d = aspectFit(size) * 1.85 + 6;
      flyTo(target.clone().add(new Vector3(0.6, 0.22, 1).normalize().multiplyScalar(d)), target, ms);
    },
  });

  // ---- store wiring -------------------------------------------------------------------
  let lastPoolKey = JSON.stringify(poolRect(effLot()));
  let lastLot = [store.get().land.width, store.get().land.depth];
  let pending = new Set();
  let scheduled = false;
  function schedule(path) {
    pending.add(path || '*');
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(flush);
  }
  function flush() {
    scheduled = false;
    const paths = [...pending];
    pending = new Set();
    const has = (pre) => paths.some((p) => p === '*' || p === 'undo' || p === 'commit' || p === pre || p.startsWith(pre + '.') || pre.startsWith(p + '.'));
    const onlyTime = paths.every((p) => p === 'env' || p.startsWith('env.'));
    if (onlyTime) { applyTime(store.get().env.time); return; }
    if (paths.every((p) => p === 'name')) return;
    const s = store.get();
    const poolKey = JSON.stringify(poolRect(effLot()));
    const landChanged = has('land') || paths.includes('*') || poolKey !== lastPoolKey || s.land.width !== lastLot[0] || s.land.depth !== lastLot[1];
    lastPoolKey = poolKey;
    lastLot = [s.land.width, s.land.depth];
    // Moving/adding furniture (yard or indoor) never rebuilds the house; other interior edits do.
    const yardStatic = paths.some((p) => p === 'yard' || (p.startsWith('yard.') && !p.startsWith('yard.items')));
    const interiorStatic = paths.some((p) => p === 'interior' || (p.startsWith('interior.') && !p.startsWith('interior.items')));
    // Any edit to the plan while "Hoy" is on screen switches back to "Después" (edits never touch today's copy).
    if (remodelView === 'before' && (has('build') || !remodelOn())) { remodelView = 'after'; emit('remodelView', remodelView); }
    const houseChanged = has('house') || has('build') || has('mode') || has('remodel') || yardStatic || interiorStatic;
    if (landChanged) rebuildLand();
    if (houseChanged || landChanged) rebuildHouse();
    else if (has('interior.items')) syncIndoor();
    if (has('yard.items') || has('yard')) syncItems();
    if (has('env') || paths.includes('*')) applyTime(store.get().env.time);
    else placeSun();
    if (paths.includes('*') && view !== 'walk') (view === 'top' ? viewTop : view === 'front' ? viewFront : viewOrbit)();
    invalidate();
  }
  store.subscribe((_s, path) => schedule(path));

  // Room labels follow the page language.
  new MutationObserver(() => {
    const next = document.documentElement.lang?.startsWith('en') ? 'en' : 'es';
    if (next !== lang) { lang = next; rebuildHouse(); }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  // ---- boot -------------------------------------------------------------------------------
  resize();
  rebuildLand();
  rebuildHouse();
  syncItems();
  applyTime(store.get().env.time);
  viewOrbit();
  if (tween) { camera.position.copy(tween.to); controls.target.copy(tween.tTo); tween = null; }
  wake();
  queueMicrotask(() => emit('ready', {}));

  const api = {
    on(ev, fn) {
      if (!listeners.has(ev)) listeners.set(ev, []);
      listeners.get(ev).push(fn);
      if (ev === 'stats' && house) fn({ ...house.stats });
      if (ev === 'rooms' && house) fn(getRooms());
      return () => listeners.set(ev, listeners.get(ev).filter((f) => f !== fn));
    },
    setView(mode) {
      const prev = view;
      view = ['orbit', 'top', 'front', 'walk'].includes(mode) ? mode : 'orbit';
      setControlsFor(view);
      walk.el.style.display = view === 'walk' ? 'block' : 'none';
      camera.fov = view === 'walk' ? 70 : 40;
      camera.updateProjectionMatrix();
      if (view !== 'walk') walk.intro = null;
      if ((prev === 'walk') !== (view === 'walk')) applyTime(store.get().env.time, { env: false });
      if (view === 'walk') { cutLevel = null; enterWalk(); }
      else if (view === 'top') { if (cutLevel == null) cutLevel = 0; viewTop(); }
      else {
        if (prev === 'top') cutLevel = null;
        if (prev === 'walk') { camera.up.set(0, 1, 0); }
        view === 'front' ? viewFront() : viewOrbit();
      }
      applyCutaway();
    },
    getView: () => view,
    // ---- remodel API (CONTRACT.md "Remodel API") ----
    setRemodelView(v) {
      const next = v === 'before' && remodelOn() ? 'before' : 'after';
      if (next === remodelView) return;
      remodelView = next;
      emit('remodelView', remodelView);
      rebuildHouse();
      invalidate();
    },
    getRemodelView: () => remodelView,
    setRemodelMarks(on) { remodelMarks = !!on; syncRemodel(); },
    getRemodelMarks: () => remodelMarks,
    // ---- revamp scene API (CONTRACT.md "Revamp scene API") ----
    reveal: (opts) => reveal.play(opts ?? {}),
    isRevealing: () => reveal.running(),
    setTheme(t) {
      uiTheme = t === 'dark' ? 'dark' : 'light';
      const c = accent[uiTheme];
      hiMat.color.setHex(c);
      hiEdge.color.setHex(c);
      highlight.material.color.setHex(c);
      markMat.color.setHex(c);
      fx.setAccent(c);
      updateDims();
      invalidate();
    },
    getSceneTheme: () => sceneTheme,
    setLotMarks(on) {
      lotMarksOn = !!on;
      buildLotMarks();
    },
    invalidate: () => invalidate(),
    // Interior step: cut the house open at `level` and look down into it at ~55°.
    viewInterior(level = 0) {
      const h = eff().house;
      const lvl = Math.max(0, Math.min(h.floors - 1, Math.floor(+level || 0)));
      view = 'orbit';
      setControlsFor(view);
      walk.el.style.display = 'none';
      camera.fov = 40;
      camera.up.set(0, 1, 0);
      camera.updateProjectionMatrix();
      cutLevel = lvl;
      applyCutaway();
      const target = new Vector3(h.offsetX, P + lvl * h.floorHeight + 0.4, h.offsetZ);
      const d = aspectFit(Math.max(h.width, h.depth)) * 1.45 + 3;
      const el = MathUtils.degToRad(55), az = MathUtils.degToRad(28);
      const dir = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      flyTo(target.clone().addScaledVector(dir, d), target);
      return lvl;
    },
    getRooms,
    // Plan editing in the Plano view: partition + hall-wall handles. Turn on together with setView('top').
    setPlanEdit(on) {
      planView.setEdit(!!on);
      // One finger / left mouse pans the plan (handles and taps are handled before the controls see them).
      controls.touches.ONE = on ? TOUCH.PAN : TOUCH.ROTATE;
      controls.mouseButtons.LEFT = on ? MOUSE.PAN : MOUSE.ROTATE;
      if (view === 'top') { viewTop(); applyCutaway(); }
      invalidate();
    },
    getPlanEdit: () => planView.isEdit(),
    // Pixels at the bottom of the canvas covered by the phone sheet: the camera centres + fits the house above it.
    setViewInset({ bottom = 0 } = {}) {
      viewBottom = Math.max(0, +bottom || 0);
      resize();
      if (view !== 'top' || !planView.isEdit()) invalidate();
    },
    // Zoom the Plano view toward the centre of the visible area (factor > 1 zooms in).
    zoomPlan(factor = 1.25) {
      const f = Math.max(0.2, Math.min(5, +factor || 1));
      const off = camera.position.clone().sub(controls.target);
      const d = Math.max(controls.minDistance, Math.min(controls.maxDistance, off.length() / f));
      flyTo(controls.target.clone().add(off.setLength(d)), controls.target.clone(), 250);
    },
    // Floor shown in the cutaway / Plano view; refits the Plano camera.
    setLevel(level) {
      const lvl = Math.max(0, Math.min(store.get().house.floors - 1, Math.floor(+level || 0)));
      if (view === 'walk') return lvl;
      cutLevel = lvl;
      applyCutaway();
      if (view === 'top') viewTop();
      return lvl;
    },
    getLevel: () => lvlNow(),
    // ---- build mode hooks ----
    // The tool = { pointerdown(e, ctx) -> true to consume, pointermove, pointerup, cancel?, keydown?, dispose() }.
    // While a tool is set one finger / the left mouse pans, and two fingers always drive the camera.
    toolContext: () => toolCtx,
    setTool(t) {
      if (tool && tool !== t) {
        cancelToolGesture();
        try { tool.dispose?.(); } catch (err) { console.warn('tool dispose', err); }
      }
      tool = t ?? null;
      toolGesture = null;
      const on = !!tool || planView.isEdit();
      controls.touches.ONE = on ? TOUCH.PAN : TOUCH.ROTATE;
      controls.mouseButtons.LEFT = on ? MOUSE.PAN : MOUSE.ROTATE;
      controls.mouseButtons.RIGHT = on && tool ? MOUSE.ROTATE : MOUSE.PAN;
      controls.enabled = view !== 'walk';
      el.style.cursor = tool ? 'crosshair' : '';
      invalidate();
    },
    getTool: () => tool,
    // ---- pieces (v5, see CONTRACT.md "v5 pieces API") ----
    pieceGhost: (pieceId, placement) => fx.pieceGhost(pieceId, placement ?? null),
    pieceThumb: (pieceId) => fx.pieceThumb(pieceId),
    // Placed elements settle in (0.4 m drop, 250 ms). Skipped with reduced motion or when rebuilds are slow.
    dropAnim(ids) {
      if (lastRebuildMs > 220) return false;
      return fx.dropAnim(ids, {
        onHide: (set) => { hideIds = set; schedule('build'); },
        onDone: () => { hideIds = null; rebuildHouse(); invalidate(); },
      });
    },
    // Cut the house open at `level` (floors above hidden, floors below dimmed) and tilt the camera ~55° over it.
    // null leaves the build view (full house). { fly: false } keeps the camera where it is.
    setBuildLevel(level, { fly = true } = {}) {
      if (level == null) {
        buildLevelOn = false;
        if (view !== 'top' && view !== 'walk') cutLevel = null;
        applyCutaway();
        return null;
      }
      const F = store.get().house.floors;
      const lvl = Math.max(0, Math.min(F - 1, Math.floor(+level || 0)));
      buildLevelOn = true;
      if (view === 'walk') return lvl;
      cutLevel = lvl;
      applyCutaway();
      if (fly && view !== 'top') {
        const h = eff().house, st = store.get();
        const t = new Vector3(h.offsetX, P + lvl * st.house.floorHeight + 0.3, h.offsetZ);
        const d = aspectFit(Math.max(h.width, h.depth, 6)) * 1.5 + 4;
        const off = camera.position.clone().sub(controls.target);
        let az = Math.atan2(off.x, off.z);
        if (!Number.isFinite(az) || off.length() < 0.1) az = 0.5;
        const el2 = MathUtils.degToRad(55);
        flyTo(t.clone().add(new Vector3(Math.sin(az) * Math.cos(el2), Math.sin(el2), Math.cos(az) * Math.cos(el2)).multiplyScalar(d)), t);
      }
      return lvl;
    },
    getBuildLevel: () => (buildLevelOn ? lvlNow() : null),
    highlightBuild(id) {
      buildHiId = Array.isArray(id) ? (id.length ? id.filter((x) => typeof x === 'string') : null) : typeof id === 'string' && id ? id : null;
      applyBuildHighlight();
    },
    highlightRoom(key) {
      highlightKey = typeof key === 'string' && key ? key : null;
      applyHighlight();
      invalidate();
    },
    setCutaway(on) {
      cutLevel = on === false || on == null ? null : on === true ? 0 : Math.max(0, Math.floor(on));
      if (view === 'walk' && cutLevel != null) api.setView('orbit');
      applyCutaway();
    },
    resetCamera() {
      if (view === 'walk') enterWalk();
      else (view === 'top' ? viewTop : view === 'front' ? viewFront : viewOrbit)();
    },
    async screenshot({ width, height, type = 'png', quality = 0.8 } = {}) {
      const w0 = container.clientWidth, h0 = container.clientHeight;
      const w = width ?? Math.min(2400, w0 * 2), h = height ?? Math.round((w * h0) / w0);
      const pr = renderer.getPixelRatio();
      const dimsVis = dims.visible;
      screenshotting = true;
      renderer.setPixelRatio(1);
      composer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      gtao?.setSize(w, h);
      camera.aspect = w / h;
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
      // The photo is a progressive render too (soft shadows, clean edges).
      const shots = REDUCED_REFINE ? 1 : mobile ? 8 : 20;
      if (shots > 1) { for (let i = 0; i < shots; i++) accumulateStep(i, shots); }
      else composer.render(0);
      const url = renderer.domElement.toDataURL(type === 'jpeg' ? 'image/jpeg' : 'image/png', quality);
      renderer.setPixelRatio(pr);
      composer.setPixelRatio(pr);
      dims.visible = dimsVis;
      resize();
      composer.render(0);
      screenshotting = false;
      return url;
    },
    loadPhoto(file) {
      return new Promise((resolve, reject) => {
        if (!file || !file.type?.startsWith('image/')) { reject(new Error('not an image')); return; }
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          const max = 1024;
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * k);
          c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          resolve(c.toDataURL('image/jpeg', 0.72));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('could not read image')); };
        img.src = url;
      });
    },
    dispose() {
      clearRemodel();
      for (const m of Object.values(rmMats)) m.dispose();
      disposed = true;
      cancelAnimationFrame(raf);
      reveal.dispose();
      ro.disconnect();
      controls.dispose();
      tool?.dispose?.();
      for (const g of indoor.values()) disposeIndoor(g);
      indoorMats.dispose();
      planView.dispose();
      fx.dispose();
      highlight.geometry.dispose();
      highlight.material.dispose();
      renderer.dispose();
      walk.el.remove();
      renderer.domElement.remove();
    },
    // For tests / debugging.
    _debug: { timing, buildHi, get tool() { return tool; }, scene, camera, renderer, controls, indoor, lamps: lampGroup, highlight, planView, get lastRebuildMs() { return lastRebuildMs; }, get house() { return house; }, get cutLevel() { return cutLevel; }, get frames() { return frames; }, labelStats: () => labelStats, get raf() { return raf; } },
  };
  return api;
}
