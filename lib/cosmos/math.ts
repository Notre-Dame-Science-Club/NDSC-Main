/**
 * lib/cosmos/math.ts
 *
 * Deterministic randomness and easing for the whole cosmos scene.
 * Everything here is pure (no THREE, no DOM) so it is trivial to unit-test
 * and safe to import into worker code later if the scene ever moves off
 * the main thread.
 */

export const TAU = Math.PI * 2;

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const sat = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (e0: number, e1: number, x: number) => {
  const t = sat((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
/** Frame-rate independent damping — the same ease at 60fps and at 144. */
export const damp = (cur: number, to: number, rate: number, dt: number) =>
  lerp(cur, to, 1 - Math.exp(-rate * dt));

/** A small, fast, seedable PRNG (mulberry32). Same seed → same sequence,
 *  every time, on every device — the whole scene depends on this for a sky
 *  that doesn't reshuffle itself on refresh. */
export function mulberry32(seed: number) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Classic 2-D gradient (Perlin-style) noise, built once per seed. */
export function noise2D(seed: number) {
  const rnd = mulberry32(seed);
  const p = new Uint8Array(256);
  const perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const G = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  return function (x: number, y: number) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const X = xi & 255;
    const Y = yi & 255;
    const xf = x - xi;
    const yf = y - yi;
    const u = fade(xf);
    const v = fade(yf);
    const g = (h: number, dx: number, dy: number) => {
      const q = G[h & 7];
      return q[0] * dx + q[1] * dy;
    };
    const aa = perm[perm[X] + Y];
    const ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y];
    const bb = perm[perm[X + 1] + Y + 1];
    return lerp(
      lerp(g(aa, xf, yf), g(ba, xf - 1, yf), u),
      lerp(g(ab, xf, yf - 1), g(bb, xf - 1, yf - 1), u),
      v
    );
  };
}

/** Fractal Brownian motion: several octaves of the noise above, summed at
 *  falling amplitude. This is what gives the planet's continents and the
 *  nebula their layered, natural-looking detail instead of flat blobs. */
export function fbm(
  n: (x: number, y: number) => number,
  x: number,
  y: number,
  oct = 4,
  lac = 2,
  gain = 0.5
) {
  let a = 0.5;
  let f = 1;
  let s = 0;
  let m = 0;
  for (let i = 0; i < oct; i++) {
    s += a * n(x * f, y * f);
    m += a;
    a *= gain;
    f *= lac;
  }
  return s / m; // -1 … 1
}
