// @ts-nocheck
/**
 * lib/cosmos/textures.ts
 *
 * Every surface in the scene is painted at runtime onto a 2-D canvas and
 * uploaded as a texture — no image files ship with the site for this. That
 * keeps the bundle small and means the sky/planet/rings are reproducible
 * from a seed rather than being static art that goes stale.
 *
 * @ts-nocheck: this file is procedural pixel-pushing (canvas 2D, typed
 * arrays, lots of positional tuples) where TypeScript's benefit is low and
 * its ceremony is high. The public surface (what each function returns) is
 * documented in comments instead.
 */
import { TAU, lerp, sat, smooth, mulberry32, noise2D, fbm } from "./math";

export function cvs(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/* ─────────────────────────────────────────── the sky
   A wide equirectangular canvas hung on the inside of a sphere: a cold
   galactic band across one diagonal (brightest at its spine, thinning at
   the edges), two nebular clouds at opposing colour temperatures, and a
   star population that thins toward the poles the way a real sky does. */
export function texSky() {
  const W = 2048, H = 1024;
  const c = cvs(W, H);
  const x = c.getContext("2d")!;
  const n = noise2D(4242);
  const rnd = mulberry32(4242);

  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#03060e");
  g.addColorStop(0.42, "#061024");
  g.addColorStop(0.62, "#081428");
  g.addColorStop(1, "#03060e");
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);

  for (let i = 0; i < 900; i++) {
    const t = rnd();
    const bx = t * W;
    const spine = H * 0.52 + Math.sin(t * Math.PI * 1.1) * H * 0.16;
    const spread = H * (0.06 + 0.09 * Math.abs(fbm(n, t * 3, 0.5, 3, 2, 0.5)));
    const by = spine + (rnd() + rnd() - 1) * spread * 3;
    const r = 18 + rnd() * rnd() * 120;
    const a = 0.018 + rnd() * 0.03;
    const gg = x.createRadialGradient(bx, by, 0, bx, by, r);
    gg.addColorStop(0, `rgba(150,186,230,${a.toFixed(3)})`);
    gg.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = gg;
    x.beginPath();
    x.arc(bx, by, r, 0, TAU);
    x.fill();
  }

  const clouds: [number, number, string][] = [
    [0.24, 0.34, "rgba(56,132,220,ALPHA)"],
    [0.78, 0.6, "rgba(150,84,220,ALPHA)"],
    [0.52, 0.22, "rgba(226,120,60,ALPHA)"],
  ];
  clouds.forEach(([cx, cy, col], ci) => {
    for (let i = 0; i < 26; i++) {
      const a = rnd() * TAU;
      const off = rnd() * 0.22;
      const px = (cx + Math.cos(a) * off) * W;
      const py = (cy + Math.sin(a) * off * 0.6) * H;
      const r = W * (0.04 + rnd() * 0.1);
      const gg = x.createRadialGradient(px, py, 0, px, py, r);
      gg.addColorStop(0, col.replace("ALPHA", (ci === 2 ? 0.014 : 0.028).toFixed(3)));
      gg.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = gg;
      x.beginPath();
      x.arc(px, py, r, 0, TAU);
      x.fill();
    }
  });

  for (let i = 0; i < 2600; i++) {
    const sx = rnd() * W, sy = rnd() * H;
    const pole = 1 - Math.abs(sy / H - 0.5) * 1.5;
    if (rnd() > pole * 0.9 + 0.25) continue;
    const r = 0.4 + rnd() * rnd() * 1.5;
    const warm = rnd() > 0.86;
    x.fillStyle = (warm ? "rgba(255,214,176," : "rgba(206,232,255,") + (0.2 + rnd() * 0.7).toFixed(2) + ")";
    x.beginPath();
    x.arc(sx, sy, r, 0, TAU);
    x.fill();
  }
  for (let i = 0; i < 26; i++) {
    const sx = rnd() * W, sy = H * 0.2 + rnd() * H * 0.6, r = 1.6 + rnd() * 1.6;
    const gg = x.createRadialGradient(sx, sy, 0, sx, sy, r * 9);
    gg.addColorStop(0, "rgba(225,244,255,.85)");
    gg.addColorStop(0.25, "rgba(150,200,255,.18)");
    gg.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = gg;
    x.beginPath();
    x.arc(sx, sy, r * 9, 0, TAU);
    x.fill();
    x.fillStyle = "rgba(225,244,255,.35)";
    x.fillRect(sx - r * 7, sy - 0.4, r * 14, 0.8);
    x.fillRect(sx - 0.4, sy - r * 7, 0.8, r * 14);
  }
  return c;
}

/* ─────────────────────────────────────────── the planet
   A day map (continents, coasts, poles, oceans), a roughness map (glassy
   water vs. rough rock), and an emissive map (night-side city light that
   follows the coastlines instead of scattering uniformly). Height comes
   from three fbm calls at falling amplitude — continents, coastal detail,
   fine terrain — because one octave count alone gives either mush or
   static; layering separate calls is what an actual heightmap does. */
export function texPlanet() {
  const W = 2048, H = 1024;
  const c = cvs(W, H), x = c.getContext("2d")!;
  const n = noise2D(77), n2 = noise2D(931), n3 = noise2D(4471), rnd = mulberry32(77);
  const im = x.createImageData(W, H), d = im.data;
  const rgh = cvs(W, H), rx = rgh.getContext("2d")!;
  const rim = rx.createImageData(W, H), rd = rim.data;

  for (let j = 0; j < H; j++) {
    const lat = j / H;
    for (let i = 0; i < W; i++) {
      const u = i / W;
      const a = u * TAU;
      const nx = Math.cos(a) * 2.0, ny = Math.sin(a) * 2.0;
      let h = fbm(n, nx + lat * 2.4, ny + lat * 1.6, 5, 2.05, 0.5);
      h += 0.3 * fbm(n2, nx * 3.4, ny * 3.4 + lat * 3.6, 5, 2.2, 0.5);
      h += 0.1 * fbm(n3, nx * 9, ny * 9 + lat * 7, 3, 2.3, 0.5);
      const cap = smooth(0.4, 0.5, Math.abs(lat - 0.5));
      const shoreline = smooth(0.0, 0.035, h);
      const land = h > 0.0;
      let r, g, b, rough;
      if (land) {
        const e = sat(h * 2.6);
        const arid = sat(fbm(n2, nx * 1.6 + 9, ny * 1.6, 3, 2.1, 0.5) * 0.5 + 0.5);
        const forest = [22, 58, 34], savanna = [104, 96, 46], rock = [78, 70, 62], snow = [214, 220, 226];
        const base = [lerp(forest[0], savanna[0], arid), lerp(forest[1], savanna[1], arid), lerp(forest[2], savanna[2], arid)];
        r = lerp(base[0], rock[0], sat(e * 1.3 - 0.25));
        g = lerp(base[1], rock[1], sat(e * 1.3 - 0.25));
        b = lerp(base[2], rock[2], sat(e * 1.3 - 0.25));
        r = lerp(r, snow[0], sat(e * 1.6 - 0.62)); g = lerp(g, snow[1], sat(e * 1.6 - 0.62)); b = lerp(b, snow[2], sat(e * 1.6 - 0.62));
        rough = lerp(0.86, 0.55, sat(e * 1.6 - 0.62));
      } else {
        const depth = sat(-h * 3.0);
        r = lerp(18, 3, depth); g = lerp(64, 20, depth); b = lerp(108, 58, depth);
        rough = 0.18;
      }
      r = lerp(r, 240, shoreline * 0.6); g = lerp(g, 246, shoreline * 0.6); b = lerp(b, 250, shoreline * 0.6);
      if (cap > 0) { r = lerp(r, 228, cap); g = lerp(g, 238, cap); b = lerp(b, 248, cap); rough = lerp(rough, 0.5, cap); }
      const k = (j * W + i) * 4;
      d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255;
      rd[k] = rd[k + 1] = rd[k + 2] = rough * 255; rd[k + 3] = 255;
    }
  }
  x.putImageData(im, 0, 0);
  rx.putImageData(rim, 0, 0);

  x.globalCompositeOperation = "overlay";
  x.globalAlpha = 0.16;
  const detail = cvs(512, 256), dx = detail.getContext("2d")!;
  const dim = dx.createImageData(512, 256), dd = dim.data, dr = mulberry32(203);
  for (let i = 0; i < 512 * 256; i++) { const v = 128 + (dr() - 0.5) * 70; dd[i * 4] = dd[i * 4 + 1] = dd[i * 4 + 2] = v; dd[i * 4 + 3] = 255; }
  dx.putImageData(dim, 0, 0);
  x.drawImage(detail, 0, 0, W, H);
  x.globalAlpha = 1; x.globalCompositeOperation = "source-over";

  const e = cvs(W, H), ex = e.getContext("2d")!;
  ex.fillStyle = "#000"; ex.fillRect(0, 0, W, H);
  for (let i = 0; i < 7000; i++) {
    const u = rnd(), lat = 0.5 + (rnd() + rnd() - 1) * 0.4;
    const a = u * TAU, nx = Math.cos(a) * 2.0, ny = Math.sin(a) * 2.0;
    let h = fbm(n, nx + lat * 2.4, ny + lat * 1.6, 5, 2.05, 0.5);
    h += 0.3 * fbm(n2, nx * 3.4, ny * 3.4 + lat * 3.6, 5, 2.2, 0.5);
    if (h <= 0.01 || h > 0.5) continue;
    const px = u * W, py = lat * H, r = 0.5 + rnd() * rnd() * 3.6;
    const gg = ex.createRadialGradient(px, py, 0, px, py, r * 3);
    gg.addColorStop(0, `rgba(255,208,140,${(0.5 + rnd() * 0.5).toFixed(2)})`);
    gg.addColorStop(0.35, "rgba(255,172,96,.2)");
    gg.addColorStop(1, "rgba(0,0,0,0)");
    ex.fillStyle = gg; ex.beginPath(); ex.arc(px, py, r * 3, 0, TAU); ex.fill();
  }
  return { map: c, emissive: e, rough: rgh };
}

export function texClouds() {
  const W = 1024, H = 512, c = cvs(W, H), x = c.getContext("2d")!;
  const n = noise2D(515);
  const im = x.createImageData(W, H), d = im.data;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const a = (i / W) * TAU, lat = j / H;
    const v = fbm(n, Math.cos(a) * 2.4 + lat * 3, Math.sin(a) * 2.4 + lat * 2, 5, 2.2, 0.55);
    const band = 0.55 + 0.45 * Math.sin(lat * Math.PI * 3.2);
    const al = sat((v * 0.5 + 0.5 - 0.52) * 3.4) * band;
    const k = (j * W + i) * 4;
    d[k] = d[k + 1] = d[k + 2] = 255; d[k + 3] = al * 210;
  }
  x.putImageData(im, 0, 0);
  return c;
}

/** A cratered moon on its own smaller shell. */
export function texMoon() {
  const W = 512, H = 256, c = cvs(W, H), x = c.getContext("2d")!;
  const n = noise2D(660), rnd = mulberry32(660);
  const im = x.createImageData(W, H), d = im.data;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const a = (i / W) * TAU, lat = j / H;
    const nx = Math.cos(a) * 2.2, ny = Math.sin(a) * 2.2;
    const h = fbm(n, nx + lat * 2, ny + lat * 2, 5, 2.1, 0.5) * 0.5 + 0.5;
    const v = lerp(96, 168, h);
    const k = (j * W + i) * 4; d[k] = d[k + 1] = v * 0.98; d[k + 2] = v; d[k + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  for (let i = 0; i < 340; i++) {
    const px = rnd() * W, py = rnd() * H, r = 1 + rnd() * rnd() * 14;
    const g = x.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r);
    g.addColorStop(0, "rgba(255,255,255,.16)"); g.addColorStop(0.6, "rgba(0,0,0,.22)"); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill();
  }
  return c;
}

/** A wide dust-and-ice ring — density bands from 1-D fbm along the radius,
 *  not a flat tinted disc, so it keeps a texture even seen close to edge-on. */
export function texRing() {
  const W = 512, H = 32, c = cvs(W, H), x = c.getContext("2d")!;
  const n = noise2D(303);
  for (let i = 0; i < W; i++) {
    const t = i / W;
    const band = fbm(n, t * 14, 0, 4, 2.2, 0.5) * 0.5 + 0.5;
    const gap = Math.pow(Math.sin(t * 38), 2) > 0.94 ? 0 : 1;
    const a = sat(band * gap) * sat(1 - Math.abs(t - 0.5) * 2.05);
    x.fillStyle = `rgba(${lerp(200, 232, band)},${lerp(190, 224, band)},${lerp(176, 214, band)},${(a * 0.8).toFixed(3)})`;
    x.fillRect(i, 0, 1, H);
  }
  return c;
}

/** Soft round falloff — glows, haze, the sun. */
export function texGlow(inner?: string, mid?: string) {
  const S = 256, c = cvs(S, S), x = c.getContext("2d")!;
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner || "rgba(255,255,255,1)");
  g.addColorStop(0.26, mid || "rgba(255,255,255,.36)");
  g.addColorStop(0.6, "rgba(255,255,255,.06)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return c;
}

/** A star sprite: a hard core inside a wide faint bloom. Almost all of the
 *  light is spent in the first eighth of the radius — a smooth ramp over
 *  the whole radius instead gives an evenly lit blob with no centre. */
export function texStar() {
  const S = 64, c = cvs(S, S), x = c.getContext("2d")!;
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.08, "rgba(226,244,255,.9)");
  g.addColorStop(0.2, "rgba(150,206,255,.34)");
  g.addColorStop(0.5, "rgba(80,150,220,.06)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return c;
}

export function grainDataURL() {
  const S = 180, c = cvs(S, S), x = c.getContext("2d")!;
  const im = x.createImageData(S, S), d = im.data, r = mulberry32(9);
  for (let i = 0; i < S * S; i++) { const v = 110 + r() * 90; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  x.putImageData(im, 0, 0);
  return c.toDataURL("image/png");
}
