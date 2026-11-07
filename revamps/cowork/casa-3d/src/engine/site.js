// Pure site math shared by the store and the engine (no three.js).

// Where the pool goes: behind the house if there's room, else on the open side.
export function poolRect(state) {
  const { land, house: h, yard } = state;
  if (!yard.pool) return null;
  const backSpace = h.offsetZ - h.depth / 2 - (-land.depth / 2);
  const w = Math.min(8, Math.max(5, h.width * 0.6)), d = 3.6;
  if (backSpace > d + 2.4) {
    const cz = -land.depth / 2 + 1.2 + d / 2 + Math.max(0, (backSpace - d - 2.4) / 2) * 0.5;
    return { x: h.offsetX, z: cz, w, d };
  }
  const side = h.carport && h.carportSide === 'right' ? -1 : 1;
  const sideSpace = land.width / 2 - (side * h.offsetX + h.width / 2) - (h.carport && ((h.carportSide === 'right') === (side > 0)) ? 3.6 : 0);
  if (sideSpace > 4.6) return { x: h.offsetX + side * (h.width / 2 + sideSpace / 2), z: h.offsetZ, w: d, d: Math.min(w, h.depth) };
  return null;
}

// Covered parking spot under the marquesina, in world coordinates.
export function carportSpot(h) {
  if (!h.carport) return null;
  const s = h.carportSide === 'left' ? -1 : 1;
  const zFront = h.depth / 2 + (h.porch ? 2.6 : 0.6);
  return { x: h.offsetX + s * (h.width / 2 + 1.8), z: h.offsetZ + zFront - 3.1 };
}
