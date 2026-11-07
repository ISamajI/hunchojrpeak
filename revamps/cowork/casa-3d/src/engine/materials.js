// Material factory. Every rebuild asks for materials by key; the set is
// disposed together when the model is rebuilt.
import { MeshStandardMaterial, MeshPhysicalMaterial, Color, DoubleSide } from 'three';
import * as T from './textures.js';
import { floorTexSet, usesLegacyTexture, floorSwatch } from './floortex.js';
import { normalizeFloor, toneTint } from './floors.js';

export { floorSwatch };

// Texture tile size in meters for world-space UVs.
const TILE = {
  stucco: 2.2, block: 1.6, stone: 1.2, roofTile: 1.3, metal: 1.0, concrete: 3, roofSlab: 4, floorTile: 1.2, pavers: 2, wood: 1.2, grass: 4, sand: 4, poolTile: 1.2, foliage: 1.5,
  brick: 1.2, chainlink: 0.5, porcelain: 1.2, marble: 1.6, marbleTile: 1.6, granite: 1.0, woodPlank: 1.2, polished: 3, terracotta: 1.2, wallTile: 0.6, fabric: 0.5, rattan: 0.2,
};

// Porch / galería floors (state.js OUT_FLOORS).
const OUT_FLOOR = { tile: 'ceramica', terracotta: 'terracota', concrete: 'cemento' };
// Countertops (state.js COUNTERS).
const COUNTER_TEX = { blanco: ['marble', '#ffffff', 0.25, true], granito: ['granite', '#ffffff', 1], marmol: ['marble', '#ffffff', 1] };
export const WOOD_HEX = { claro: '#c49a6c', medio: '#a47551', oscuro: '#5e3b26' };
export const woodHex = (v) => WOOD_HEX[v] ?? (/^#[0-9a-f]{6}$/i.test(v ?? '') ? v : WOOD_HEX.medio);
const hexOr = (v, d) => (/^#[0-9a-f]{6}$/i.test(v ?? '') ? v : d);

// Darken the lowest ~40 cm of exterior walls (splash dirt), by world height.
function addGrime(m) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vGrimeY;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGrimeY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGrimeY;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= mix(0.74, 1.0, smoothstep(0.08, 0.95, vGrimeY));');
  };
  m.customProgramCacheKey = () => 'grime';
  return m;
}

// Tiled textures are shared by every material set and never disposed, so a
// rebuild reuses the GPU uploads instead of re-sending every canvas.
const sharedTex = new Map();
function texSet(name) {
  if (!sharedTex.has(name)) {
    const out = {};
    for (const [k, t] of Object.entries(T[name]())) {
      const c = t.clone();
      c.needsUpdate = true;
      c.repeat.set(1 / TILE[name], 1 / TILE[name]);
      out[k] = c;
    }
    sharedTex.set(name, out);
  }
  return sharedTex.get(name);
}

// Bumped per material set: floor texture sets older than a few builds can be evicted.
let epoch = 0;

const _hsl = {};
function desat(hex, k) {
  const c = new Color(hex);
  c.getHSL(_hsl);
  return `#${c.setHSL(_hsl.h, _hsl.s * k, _hsl.l).getHexString()}`;
}

export function createMaterialSet() {
  epoch++;
  const owned = [];
  const cache = new Map();

  function std(key, make) {
    if (!cache.has(key)) {
      const m = make();
      owned.push(m);
      cache.set(key, m);
    }
    return cache.get(key);
  }

  const api = {
    // soft = interior paint: same plaster grain but a much flatter normal, so
    // lamps raking across a wall or ceiling don't turn it into rough rock.
    paint(color, finish = 'smooth', { grime = false, soft = false } = {}) {
      return std(`paint:${color}:${finish}:${grime}:${soft}`, () => {
        const tx = texSet(finish === 'block' ? 'block' : 'stucco');
        const ns = soft ? 0.12 : 0.6;
        const m = new MeshStandardMaterial({ color: new Color(color), roughness: 0.95, ...tx, normalScale: { x: ns, y: ns } });
        return grime ? addGrime(m) : m;
      });
    },
    // Interior floor finish: a FLOORS id (porch floors) or a spec from floors.js
    // ({ id, kind, tone, pattern, size }). Tone shifts the texture colour.
    floor(input) {
      const spec = typeof input === 'string' ? normalizeFloor({ floor: input }) : input.kind ? input : normalizeFloor(input);
      return std(`floor:${spec.id}:${spec.tone}:${spec.pattern}:${spec.size}`, () => {
        const tx = usesLegacyTexture(spec) ? texSet('polished') : floorTexSet(spec, epoch).maps;
        const [r, g, b] = toneTint(spec.kind, spec.tone);
        const m = new MeshStandardMaterial({ roughness: 1, ...tx, normalScale: { x: 1, y: 1 } });
        m.color.setRGB(r, g, b);
        return m;
      });
    },
    outFloor(id) { return api.floor(OUT_FLOOR[id] ?? 'ceramica'); },
    counter(id) {
      const [name, color, rough, white] = COUNTER_TEX[id] ?? COUNTER_TEX.granito;
      // White quartz = the marble slab, washed out to near-plain white.
      return white ? std('counter:white', () => new MeshStandardMaterial({ color: new Color('#f4f2ee'), roughness: 0.22 })) : api.textured(name, color, { roughness: rough });
    },
    // Double-sided so tall pieces cut by the cutaway plane still read as solid.
    wood(tone) { return api.textured('wood', woodHex(tone), { roughness: 0.9, side: DoubleSide }); },
    fabric(color) { return api.textured('fabric', hexOr(color, '#b9b1a4'), { roughness: 1, normalScale: 0.5 }); },
    // Light sources: shared emissive materials the house toggles with setLightsOn().
    bulb(color = '#fff1d6') {
      return std(`bulb:${color}`, () => new MeshStandardMaterial({ color: new Color(color), emissive: new Color('#ffd9a0'), emissiveIntensity: 0, roughness: 0.4 }));
    },
    clearGlass() {
      return std('clearGlass', () => new MeshPhysicalMaterial({ color: 0xdfeeee, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false, envMapIntensity: 1.2, side: DoubleSide }));
    },
    mirror() {
      return std('mirror', () => new MeshStandardMaterial({ color: 0x9aa6ad, roughness: 0.04, metalness: 1, envMapIntensity: 1 }));
    },
    plain(color, { roughness = 0.7, metalness = 0, side } = {}) {
      return std(`plain:${color}:${roughness}:${metalness}:${side}`, () => new MeshStandardMaterial({ color: new Color(color), roughness, metalness, ...(side !== undefined && { side }) }));
    },
    textured(name, color = '#ffffff', { roughness = 0.85, metalness = 0, side, normalScale = 1 } = {}) {
      return std(`tex:${name}:${color}:${roughness}:${metalness}:${side}`, () => {
        const tx = texSet(name);
        return new MeshStandardMaterial({ color: new Color(color), roughness, metalness, ...(side !== undefined && { side }), ...tx, normalScale: { x: normalScale, y: normalScale } });
      });
    },
    roof(material, color) {
      // Tiles read 10% less saturated (REVAMP: calm, architectural).
      if (material === 'tile') return api.textured('roofTile', desat(color, 0.9), { roughness: 0.8, side: DoubleSide });
      if (material === 'metal') return api.textured('metal', color, { roughness: 0.42, metalness: 0.55, side: DoubleSide });
      return api.textured('roofSlab', color, { roughness: 0.9, side: DoubleSide, normalScale: 0.5 });
    },
    // kind 'window' gets its own instance so lit windows can glow without
    // making railings and doors glow too.
    glass(kind = 'plain') {
      return std(`glass:${kind}`, () => new MeshPhysicalMaterial({ color: 0x3a5260, roughness: 0.05, metalness: 0.1, envMapIntensity: 1.8, clearcoat: 1, clearcoatRoughness: 0.05, emissive: new Color('#ffb866'), emissiveIntensity: 0 }));
    },
    // Chain-link fence mesh (alpha-tested, double sided).
    chainlink() {
      return std('chainlink', () => new MeshStandardMaterial({ ...texSet('chainlink'), alphaTest: 0.4, side: DoubleSide, roughness: 0.45, metalness: 0.7, color: new Color('#aeb4ba') }));
    },
    water() {
      return std('water', () => {
        const n = T.water().normalMap.clone();
        n.needsUpdate = true;
        n.repeat.set(0.5, 0.5);
        owned.push(n);
        return new MeshPhysicalMaterial({ color: 0x5fd0e6, roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.78, normalMap: n, normalScale: { x: 0.35, y: 0.35 }, envMapIntensity: 1.4, clearcoat: 1 });
      });
    },
    dispose() {
      for (const o of owned) o.dispose();
      owned.length = 0;
      cache.clear();
    },
  };
  return api;
}
