// @ts-nocheck
/**
 * lib/cosmos/rig.ts
 *
 * One waypoint per homepage chapter, flown on a Catmull-Rom spline so the
 * move between two sections is a curve rather than a cut. The scroll sets
 * the *target* progress; a damped follow sets what is actually drawn,
 * which is what makes a flicked scroll glide instead of snapping.
 *
 * The waypoint list is exported so a page can add or remove chapters
 * without touching the engine — `engine.ts` just reads `CAM.length`.
 */
import * as THREE from "three";
import { clamp, lerp, smooth } from "./math";

export type CamPoint = { p: [number, number, number]; t: [number, number, number]; fov: number };

/** index → chapter:
 *  0 hero · 1 legacy/founder · 2 departments · 3 activities (station)
 *  4 leaders · 5 media · 6 audri · 7 join · 8 footer               */
export const CAM: CamPoint[] = [
  { p: [0, 3.0, 26], t: [0, 2.0, -26], fov: 40 },
  { p: [-14, 5.5, 12], t: [-8, 0.5, -34], fov: 46 },
  { p: [9, 1.0, -6], t: [0, 3.0, -30], fov: 38 },
  { p: [16, 2.5, -20], t: [4, -1.0, -40], fov: 42 },
  { p: [-6, -4.5, -14], t: [-18, -6.0, -62], fov: 44 },
  { p: [-22, -8.0, -46], t: [-40, -14.0, -80], fov: 40 },
  { p: [6, -2.0, -70], t: [-30, -18.0, -100], fov: 44 },
  { p: [2, 8.0, -34], t: [-8, -10.0, -82], fov: 42 },
  { p: [0, 14, -52], t: [0, 0.0, -96], fov: 46 },
];

export type Rig = {
  prog: number;
  smooth: number;
  mx: number; my: number; tmx: number; tmy: number;
  intro: number;
  focus: number; focusAmt: number;
};

export function createRig(): Rig {
  return { prog: 0, smooth: 0, mx: 0, my: 0, tmx: 0, tmy: 0, intro: 0, focus: -1, focusAmt: 0 };
}

export function createCurves(points: CamPoint[]) {
  const curveP = new THREE.CatmullRomCurve3(points.map((c) => new THREE.Vector3(...c.p)), false, "catmullrom", 0.4);
  const curveT = new THREE.CatmullRomCurve3(points.map((c) => new THREE.Vector3(...c.t)), false, "catmullrom", 0.4);
  return { curveP, curveT };
}

const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _d = new THREE.Vector3();

/** Every waypoint is composed for a wide frame. On a tall one the same
 *  numbers crop the core in half, so the rig steps back along its own view
 *  axis and opens up instead of letting the sides fall away. */
export function aspectFix(vpW: number, vpH: number) {
  return clamp((1.6 - vpW / vpH) / 1.05, 0, 1);
}

export function applyCamera(
  camera: THREE.PerspectiveCamera,
  rig: Rig,
  curves: { curveP: THREE.CatmullRomCurve3; curveT: THREE.CatmullRomCurve3 },
  points: CamPoint[],
  vpW: number,
  vpH: number
) {
  const N = points.length - 1;
  const u = clamp(rig.smooth / N, 0, 1);
  curves.curveP.getPoint(u, _p);
  curves.curveT.getPoint(u, _t);
  const i = clamp(Math.floor(rig.smooth), 0, N - 1);
  const f = clamp(rig.smooth - i, 0, 1);
  let fov = lerp(points[i].fov, points[i + 1].fov, f);

  const nf = aspectFix(vpW, vpH);
  if (nf > 0) {
    _d.subVectors(_p, _t).normalize();
    _p.addScaledVector(_d, nf * 10);
    _p.y += nf * 1.4;
    fov *= 1 + nf * 0.38;
  }
  const io = 1 - rig.intro;
  _p.z += io * 16;
  _p.y += io * 2.2;
  fov += io * 9;

  const par = 1 - smooth(0, 1.6, rig.smooth) * 0.5;
  _p.x += rig.mx * 1.5 * par;
  _p.y += rig.my * 0.9 * par;
  _t.x -= rig.mx * 0.4 * par;
  _t.y -= rig.my * 0.25 * par;

  camera.position.copy(_p);
  camera.lookAt(_t);
  if (Math.abs(camera.fov - fov) > 1e-4) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}

/** Maps a set of section elements (one per chapter, in DOM order) to
 *  scroll-Y anchors, and a scroll-Y value back to a fractional chapter
 *  index — the number `applyCamera` above interpolates on. */
export function makeScrollMapper(sections: HTMLElement[]) {
  let anchors: number[] = [];
  let maxScroll = 1;

  function measure() {
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    anchors = sections.map((el, i) => {
      if (i === 0) return 0;
      if (i === sections.length - 1) return maxScroll;
      return clamp(el.offsetTop + el.offsetHeight * 0.5 - window.innerHeight * 0.5, 0, maxScroll);
    });
    for (let i = 1; i < anchors.length; i++) anchors[i] = Math.max(anchors[i], anchors[i - 1] + 1);
  }

  function progressFor(y: number) {
    if (!anchors.length) return 0;
    if (y <= anchors[0]) return 0;
    for (let i = 0; i < anchors.length - 1; i++) {
      if (y <= anchors[i + 1]) return i + (y - anchors[i]) / (anchors[i + 1] - anchors[i]);
    }
    return anchors.length - 1;
  }

  measure();
  return { measure, progressFor, get anchors() { return anchors; } };
}
