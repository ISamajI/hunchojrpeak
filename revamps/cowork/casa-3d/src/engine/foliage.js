// Shared foliage look: clustered leaf canopies (instancing-friendly geometry) and a warm back-light rim that
// index.js drives from the time of day (strongest at golden hour, off at night).
import { Color, BufferGeometry, Float32BufferAttribute } from 'three';
import { leafCluster } from './textures.js';

export const FOLIAGE_RIM = { value: new Color(0, 0, 0) };

// Adds a view-dependent rim (light passing through leaf edges) to a MeshStandardMaterial.
export function addRim(material) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.rimCol = FOLIAGE_RIM;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimCol;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += rimCol * diffuseColor.rgb * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.2);');
  };
  material.customProgramCacheKey = () => 'foliageRim';
  return material;
}

// Leaf-card canopy (realism pass 2): each cluster is two crossed cards carrying leafCluster(), alpha-tested, with
// normals bent toward the canopy volume so light wraps across the crown (no flat, flickering cards). Each card is
// emitted with both windings (front side only) so back faces keep the outward normal instead of turning black.
// Vertex colours: per-card hue variation, darker underneath and inside (fake occlusion).
// spots = [[x, y, z, rx, ry, rz], ...] ellipsoid volumes to fill; palette = hex colours. Has uv (use the
// leafCluster map with alphaTest on the material).
export function canopyGeometry(r, spots, palette, { n = 22, size = [0.25, 0.5] } = {}) {
  const pos = [], nor = [], col = [], uv = [];
  const c = new Color(), dark = new Color(0x2a3520);
  const U = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1];
  for (const [cx, cy, cz, rx, ry, rz] of spots) {
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), d = 0.5 + 0.5 * Math.sqrt(r());
      const x = cx + Math.cos(th) * s * rx * d, y = cy + u * ry * d, z = cz + Math.sin(th) * s * rz * d;
      const half = (size[0] + r() * (size[1] - size[0])) * 1.7;
      const h = Math.min(1, Math.max(0, (y - (cy - ry)) / (2 * ry)));
      c.set(palette[(r() * palette.length) | 0]).lerp(dark, (1 - h) * 0.45 + (1 - d) * 0.4);
      c.multiplyScalar(0.9 + r() * 0.2);
      // Volume normal at the cluster centre.
      let vx = (x - cx) / rx, vy = (y - cy) / ry + 0.25, vz = (z - cz) / rz;
      const vl = Math.hypot(vx, vy, vz) || 1; vx /= vl; vy /= vl; vz /= vl;
      const yaw = r() * Math.PI, tilt = (r() - 0.5) * 0.9;
      for (let k = 0; k < 2; k++) {
        const a = yaw + k * Math.PI / 2;
        // Card axes: t (horizontal in the card), b (up-ish, tilted).
        const tx = Math.cos(a), tz = Math.sin(a);
        const bx = -Math.sin(a) * Math.sin(tilt), by = Math.cos(tilt), bz = Math.cos(a) * Math.sin(tilt);
        const nx = -tz * by, ny = tz * bx - tx * bz, nz = tx * by; // t x b
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
        for (const wind of [0, 1]) {
          const order = wind ? [0, 2, 1, 3, 5, 4] : [0, 1, 2, 3, 4, 5];
          for (const j of order) {
            const [p, q] = corners[j];
            pos.push(x + (tx * p + bx * q) * half, y + (by * q) * half, z + (tz * p + bz * q) * half);
            const sgn = wind ? -1 : 1;
            let mx = nx * sgn * 0.3 + vx * 0.7, my = ny * sgn * 0.3 + vy * 0.7, mz = nz * sgn * 0.3 + vz * 0.7;
            const ml = Math.hypot(mx, my, mz) || 1;
            nor.push(mx / ml, my / ml, mz / ml);
            col.push(c.r, c.g, c.b);
            uv.push(U[j * 2], U[j * 2 + 1]);
          }
        }
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}

// Material for leaf-card canopies: leafCluster() map, alpha cut-out, alpha-to-coverage where MSAA is on.
export function leafMaterial(Mat, opts = {}) {
  const m = new Mat({ vertexColors: true, roughness: 0.82, map: leafCluster().map, alphaTest: 0.42, ...opts });
  return addRim(m);
}
