// "Plano" sky + time-of-day look (REVAMP section 5): a two-stop gradient dome with a soft sun glow, keyframed
// light colours from 6:00 to 19:30 (golden 16:30 is the hero look), moonlight after dusk, and the final colour
// grade shader (shadow lift, warm highlights, light vignette).
import { Mesh, SphereGeometry, ShaderMaterial, BackSide, Color, Vector3, MathUtils } from 'three';

// hour -> look. Colours are sRGB hex (converted to linear by Color).
const KEYS = [
  [5.0, { z: '#24365a', h: '#8a8aa0', sun: '#ff9a5a', sunI: 0.0, hs: '#7d8db0', hg: '#3e4038', hi: 0.38, exp: 0.82, env: 0.2 }],
  [6.0, { z: '#5d7fac', h: '#efc6a2', sun: '#ffac6a', sunI: 1.44, hs: '#b4c3dc', hg: '#6a6854', hi: 0.49, exp: 0.88, env: 0.28 }],
  [7.5, { z: '#5f9bd1', h: '#e4e6e2', sun: '#ffdcb4', sunI: 3.5, hs: '#c8dbea', hg: '#848866', hi: 0.62, exp: 0.93, env: 0.34 }],
  [12.5, { z: '#327fd6', h: '#cde2f0', sun: '#fff6ea', sunI: 5.1, hs: '#c6dcf0', hg: '#8a8f6a', hi: 0.7, exp: 0.95, env: 0.4 }],
  [15.0, { z: '#357fd0', h: '#d3e3ee', sun: '#fff1dc', sunI: 5.0, hs: '#c8dcef', hg: '#8a8f6a', hi: 0.68, exp: 0.95, env: 0.4 }],
  [16.5, { z: '#3b7cc8', h: '#dfe4e2', sun: '#ffeacb', sunI: 4.8, hs: '#c9dbec', hg: '#8a8f6a', hi: 0.66, exp: 0.95, env: 0.38 }],
  [17.8, { z: '#4f78ab', h: '#f2c896', sun: '#ffbd80', sunI: 3.36, hs: '#c4d0de', hg: '#7e7c60', hi: 0.62, exp: 0.9, env: 0.32 }],
  [18.5, { z: '#46638f', h: '#eda97e', sun: '#ff9f5a', sunI: 1.92, hs: '#a2aec6', hg: '#5e5c4c', hi: 0.51, exp: 0.84, env: 0.26 }],
  [19.1, { z: '#1d2b48', h: '#4e5a76', sun: '#7c9bd6', sunI: 0.7, hs: '#4a5a7c', hg: '#2c2d2a', hi: 0.55, exp: 0.82, env: 0.2 }],
  [24.0, { z: '#1d2b48', h: '#4e5a76', sun: '#7c9bd6', sunI: 0.7, hs: '#4a5a7c', hg: '#2c2d2a', hi: 0.55, exp: 0.82, env: 0.2 }],
].map(([h, k]) => [h, { z: new Color(k.z), h: new Color(k.h), sun: new Color(k.sun), hs: new Color(k.hs), hg: new Color(k.hg), sunI: k.sunI, hi: k.hi, exp: k.exp, env: k.env }]);

const out = { zenith: new Color(), horizon: new Color(), sun: new Color(), hemiSky: new Color(), hemiGround: new Color(), sunI: 0.0, hemiI: 0, exposure: 1, envI: 0.4, day: 1, warm: 0 };
export function timeLook(hour) {
  const hr = MathUtils.clamp(hour, KEYS[0][0], KEYS[KEYS.length - 1][0]);
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] < hr) i++;
  const [h0, a] = KEYS[i], [h1, b] = KEYS[i + 1];
  const k = MathUtils.smoothstep(hr, h0, h1);
  out.zenith.lerpColors(a.z, b.z, k);
  out.horizon.lerpColors(a.h, b.h, k);
  out.sun.lerpColors(a.sun, b.sun, k);
  out.hemiSky.lerpColors(a.hs, b.hs, k);
  out.hemiGround.lerpColors(a.hg, b.hg, k);
  out.sunI = MathUtils.lerp(a.sunI, b.sunI, k);
  out.hemiI = MathUtils.lerp(a.hi, b.hi, k);
  out.exposure = MathUtils.lerp(a.exp, b.exp, k);
  out.envI = MathUtils.lerp(a.env, b.env, k);
  out.day = 1 - MathUtils.smoothstep(hr, 18.4, 19.1) - (1 - MathUtils.smoothstep(hr, 5.5, 7));
  // Golden-hour amount for the grade: peaks ~16:30-18:30.
  out.warm = MathUtils.smoothstep(hr, 14.5, 16.5) * (1 - MathUtils.smoothstep(hr, 18.4, 19.1)) + (1 - MathUtils.smoothstep(hr, 6.5, 8.5)) * 0.6;
  return out;
}

// Sun path: east at dawn, high at ~12:30, ~28 degrees at 16:30 (warm raking light), set at ~18:50.
// After dusk the key light becomes the moon (high in the south-east), so the scene keeps soft shadows.
const MOON = new Vector3(0.45, 0.72, 0.53).normalize();
const res = { light: new Vector3(), glow: new Vector3(), el: 0 };
export function sunDirection(hour) {
  const s = Math.max(0, Math.sin((Math.PI * (hour - 6)) / 13));
  const el = Math.max(1.5, 72 * s ** 1.6);
  const az = 90 + ((hour - 6) / 13) * 180; // east -> south -> west
  const phi = MathUtils.degToRad(90 - el), theta = MathUtils.degToRad(az);
  // Front of the house (+z) faces south.
  res.glow.set(Math.sin(theta) * Math.sin(phi), Math.cos(phi), -Math.cos(theta) * Math.sin(phi));
  const toMoon = MathUtils.smoothstep(hour, 18.7, 19.15) + (1 - MathUtils.smoothstep(hour, 5.4, 5.9));
  res.light.copy(res.glow).lerp(MOON, Math.min(1, toMoon)).normalize();
  res.el = el;
  return res;
}

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // on the far plane
}`;
const FRAG = /* glsl */ `
uniform vec3 zenith, horizon, ground, sunDir, sunCol;
uniform float glow, cloudLight;
varying vec3 vDir;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm5(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(horizon, zenith, pow(smoothstep(-0.02, 0.9, h), 0.62));
  col = mix(col, ground, smoothstep(0.0, -0.18, h));
  float s = max(dot(d, sunDir), 0.0);
  // Trade-wind cumulus: fbm on a flat cloud layer (direction projected to a plane), thinning to the horizon,
  // lit warm on the sun side with a silver edge, greyer underneath.
  if (h > 0.0) {
    vec2 cp = d.xz / (h + 0.08) * 0.9 + vec2(3.1, 7.4);
    float n = fbm5(cp);
    // Puffy trade-wind cumulus: crisp edges, bright white tops, soft grey bellies.
    float cov = smoothstep(0.53, 0.64, n) * smoothstep(0.015, 0.14, h) * (1.0 - smoothstep(0.8, 1.0, h) * 0.6);
    float body = fbm5(cp * 2.6 + 11.0);
    vec3 lit = mix(vec3(1.0), sunCol, 0.18) * 1.06;
    vec3 shade = mix(horizon, zenith, 0.3) * 0.86;
    vec3 cc = mix(shade, lit, smoothstep(0.3, 0.75, body + (n - 0.58) * 1.2)) * cloudLight;
    cc += sunCol * glow * pow(s, 10.0) * 0.3;
    col = mix(col, cc, cov * 0.97);
  }
  col += sunCol * glow * (0.22 * pow(s, 6.0) + 0.35 * pow(s, 64.0) + 2.5 * smoothstep(0.9994, 0.9997, s));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

// Gradient dome. Pass a material to share it (the PMREM env copy uses the same uniforms).
export function createSkyDome(material = null) {
  const mat = material ?? new ShaderMaterial({
    uniforms: {
      zenith: { value: new Color('#6fa3c9') }, horizon: { value: new Color('#f6ddb8') }, ground: { value: new Color('#9cb59a') },
      sunDir: { value: new Vector3(0, 1, 0) }, sunCol: { value: new Color('#ffe2b8') }, glow: { value: 1 }, cloudLight: { value: 1 },
    },
    vertexShader: VERT, fragmentShader: FRAG, side: BackSide, depthWrite: false, fog: false,
  });
  const mesh = new Mesh(new SphereGeometry(1000, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.raycast = () => {};
  mesh.name = 'skyDome';
  const gtmp = new Color();
  return {
    mesh, material: mat,
    set(look, sunDir) {
      const u = mat.uniforms;
      u.zenith.value.copy(look.zenith);
      u.horizon.value.copy(look.horizon);
      // Below the horizon: a hazy green-grey that fades into the horizon colour.
      u.ground.value.copy(gtmp.set('#9cb59a').lerp(look.horizon, 0.55).multiplyScalar(0.35 + 0.65 * Math.max(0.15, look.day)));
      u.sunDir.value.copy(sunDir);
      u.sunCol.value.copy(look.sun);
      u.glow.value = MathUtils.smoothstep(sunDir.y, -0.04, 0.05) * Math.max(0.25, look.day);
      u.cloudLight.value = 0.22 + 0.78 * Math.max(0, Math.min(1, look.day));
    },
  };
}

// Final colour grade (display space, after OutputPass): lift shadows toward #2A3A4A by 6%, gently warm the
// highlights (more at golden hour), 8% vignette.
export const GRADE_SHADER = {
  uniforms: { tDiffuse: { value: null }, lift: { value: new Color('#2a3a4a') }, liftAmt: { value: 0.03 }, warm: { value: 0.5 }, vig: { value: 0.08 }, vib: { value: 0.32 }, con: { value: 1.07 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse; uniform vec3 lift; uniform float liftAmt, warm, vig, vib, con;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  c.rgb = mix(c.rgb, lift + c.rgb * 0.7, liftAmt * (1.0 - l) * (1.0 - l));
  c.rgb += vec3(0.022, 0.010, -0.012) * (0.4 + warm) * smoothstep(0.5, 1.0, l);
  // Vibrance (boosts muted colours more than already-saturated ones) + a gentle S-contrast: the bright,
  // clean look of a sunny Caribbean photo.
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
  c.rgb = mix(vec3(l), c.rgb, 1.0 + vib * (1.0 - (mx - mn)));
  c.rgb = clamp((c.rgb - 0.5) * con + 0.5, 0.0, 1.0);
  vec2 d = vUv - 0.5;
  c.rgb *= 1.0 - vig * smoothstep(0.15, 0.55, dot(d, d) * 2.0);
  gl_FragColor = c;
}`,
};
