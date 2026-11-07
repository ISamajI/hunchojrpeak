// Collects many small geometries per material, applies meter-scale box UVs,
// and merges them into a few meshes (fast to render and to raycast).
import { BoxGeometry, CylinderGeometry, Mesh, Matrix4, Vector3, Quaternion, Euler, Group, BufferAttribute } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _s = new Vector3(1, 1, 1);
const _p = new Vector3();

export function mat4(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
  return new Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s);
}

// World-aligned UVs: project each vertex on the plane its normal faces most.
// `shift` = [du, dv] moves the horizontal faces' texture origin (tile layouts start at a room corner).
export function boxUV(geo, shift) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (ay >= ax && ay >= az) { uv[i * 2] = x + (shift ? shift[0] : 0); uv[i * 2 + 1] = z + (shift ? shift[1] : 0); }
    else if (ax >= az) { uv[i * 2] = z; uv[i * 2 + 1] = y; }
    else { uv[i * 2] = x; uv[i * 2 + 1] = y; }
  }
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
  return geo;
}

// RoundedBoxGeometry is slow to build; the same cushions and doors repeat on
// every rebuild, so keep one per size (to the millimeter) and hand out clones.
const rounded = new Map();
export function roundedBox(w, h, d, seg, r) {
  const k = [w, h, d, r].map((v) => Math.round(v * 1000)).join(',') + ',' + seg;
  let g = rounded.get(k);
  if (!g) {
    if (rounded.size > 400) rounded.clear();
    g = new RoundedBoxGeometry(w, h, d, seg, r);
    rounded.set(k, g);
  }
  return g.clone();
}

// `skip` makes a builder that accepts everything and builds an empty group:
// the house uses it for hidden interiors so exterior edits stay fast.
export function createBuilder({ skip = false } = {}) {
  const buckets = new Map(); // key -> { material, part, geos, keepUV, castShadow }

  function add(key, geo, matrix, { material, part, keepUV = false, shadow = true, noRay = false, uvShift = null } = {}) {
    if (skip) { geo.dispose(); return; }
    let b = buckets.get(key);
    if (!b) {
      b = { material, part: part ?? null, geos: [], keepUV, shadow, noRay, uvShift };
      buckets.set(key, b);
    }
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    if (matrix) g.applyMatrix4(matrix);
    if (!(b.keepUV || keepUV)) boxUV(g, b.uvShift);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    g.morphAttributes = {};
    b.geos.push(g);
  }

  return {
    skip,
    add,
    // Axis-aligned box given center + size, in the frame of `M` (optional).
    box(key, opts, w, h, d, x, y, z, M, ry = 0) {
      if (skip) return;
      const g = new BoxGeometry(w, h, d);
      const local = mat4(x, y, z, ry);
      add(key, g, M ? M.clone().multiply(local) : local, opts);
    },
    cyl(key, opts, rTop, rBot, h, x, y, z, M, seg = 16) {
      if (skip) return;
      const g = new CylinderGeometry(rTop, rBot, h, seg);
      const local = mat4(x, y, z);
      add(key, g, M ? M.clone().multiply(local) : local, opts);
    },
    // Box with rounded edges (cushions, mattresses, appliance bodies).
    // `r` is clamped so thin boards never turn inside out.
    rbox(key, opts, w, h, d, r, x, y, z, M, ry = 0, seg = 2) {
      if (skip) return;
      const rr = Math.max(0.002, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
      const g = roundedBox(w, h, d, seg, rr);
      const local = mat4(x, y, z, ry);
      add(key, g, M ? M.clone().multiply(local) : local, opts);
    },
    // Any geometry placed at x,y,z with yaw / pitch / roll, in the frame of `M`.
    geo(key, opts, g, x, y, z, M, ry = 0, rx = 0, rz = 0) {
      const local = mat4(x, y, z, ry, rx, rz);
      add(key, g, M ? M.clone().multiply(local) : local, opts);
    },
    build() {
      const group = new Group();
      for (const [key, b] of buckets) {
        if (!b.geos.length) continue;
        const merged = mergeGeometries(b.geos, false);
        for (const g of b.geos) g.dispose();
        if (!merged) continue;
        merged.computeBoundingSphere();
        const mesh = new Mesh(merged, b.material);
        mesh.name = key;
        mesh.castShadow = b.shadow;
        mesh.receiveShadow = true;
        mesh.userData.part = b.part;
        if (b.noRay) mesh.raycast = () => {};
        group.add(mesh);
      }
      buckets.clear();
      return group;
    },
  };
}
