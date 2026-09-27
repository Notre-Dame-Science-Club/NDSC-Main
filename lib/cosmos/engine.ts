// @ts-nocheck
/**
 * lib/cosmos/engine.ts
 *
 * The one entry point components/cosmos/CosmosCanvas.tsx calls. Everything
 * else in lib/cosmos/ is a pure builder; this file is the only place that
 * owns a THREE.WebGLRenderer, a requestAnimationFrame loop, and the
 * window/scroll listeners — so it is also the only place with a
 * `dispose()` that has to undo all of it.
 *
 * `intensity`:
 *   'full' — the whole scene (planet, ring, moon, station, dense field,
 *            full bloom chain). Used for the "cosmos" theme model.
 *   'dim'  — a quieter star field only, no planet/core geometry, a third
 *            of the particle count, bloom left on but gentler. Used for
 *            the plain "dark" theme so it still has some depth without
 *            competing with page content.
 *   'off'  — engine never initializes; the caller should not even mount
 *            <CosmosCanvas> (used for the "light" theme).
 */
import * as THREE from "three";
import { damp, clamp } from "./math";
import { buildSky, buildPlanet, buildCore, buildStation, buildField, buildLights } from "./world";
import type { World } from "./world";
import { createPost, renderPost, resizePost, disposePost } from "./post";
import type { Post } from "./post";
import { CAM, createRig, createCurves, applyCamera, makeScrollMapper } from "./rig";
import type { CamPoint, Rig } from "./rig";

export type Intensity = "full" | "dim" | "off";

export type EngineHandle = {
  dispose: () => void;
  setFocus: (on: boolean) => void;
  setPointer: (nx: number, ny: number) => void;
};

export type EngineOptions = {
  canvas: HTMLCanvasElement;
  intensity: Intensity;
  /** One element per chapter, in scroll order — the camera rig maps
   *  scroll position against these. Omit for a fixed, non-scroll-driven
   *  view (e.g. the 'dim' backdrop on non-homepage pages). */
  sections?: HTMLElement[];
  reducedMotion: boolean;
  dprCap?: number;
};

export function bootCosmos(opts: EngineOptions): EngineHandle {
  const { canvas, intensity, reducedMotion } = opts;
  if (intensity === "off") return { dispose: () => {}, setFocus: () => {}, setPointer: () => {} };

  const low = intensity === "dim";
  const wantPost = true;
  const dprCap = opts.dprCap ?? (low ? 1.6 : 1.9);

  const vpW = () => document.documentElement.clientWidth || window.innerWidth;
  const vpH = () => document.documentElement.clientHeight || window.innerHeight;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !wantPost, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.setSize(vpW(), vpH(), true);
  renderer.outputEncoding = wantPost ? THREE.LinearEncoding : THREE.sRGBEncoding;
  renderer.toneMapping = wantPost ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x03060e, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, vpW() / vpH(), 0.2, 900);
  scene.add(camera);

  const W: World = { rings: [], electrons: [], layers: [] };
  const T = { value: 0 };

  buildSky(scene, renderer, W);
  buildField(scene, renderer, W, T, low);
  buildLights(scene, renderer, W);
  if (!low) {
    buildPlanet(scene, renderer, W);
    buildCore(scene, renderer, W, T);
    buildStation(scene, W);
  }

  const post: Post = createPost(renderer, wantPost && !low ? true : wantPost);

  // ── camera rig ──────────────────────────────────────────────────────
  const points: CamPoint[] = opts.sections && opts.sections.length ? CAM.slice(0, opts.sections.length) : CAM.slice(0, 1);
  const curves = createCurves(points.length > 1 ? points : [points[0], points[0]]);
  const rig: Rig = createRig();
  const scrollMap = opts.sections && opts.sections.length ? makeScrollMapper(opts.sections) : null;

  let running = true;
  let tPrev = performance.now();
  let clock = 0;
  let fadeIn = 0;
  const introT0 = performance.now();
  let frameId = 0;

  // Adaptive resolution: if a device can't hold frame time, trade pixel
  // density for frame rate rather than let the whole page judder. Reads
  // the *true* (unclamped) frame time so a real slowdown is never masked
  // by the dt clamp below.
  const perf = { scale: 1, acc: 0, n: 0, locked: reducedMotion };

  function resize() {
    const w = vpW(), h = vpH();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap) * perf.scale);
    renderer.setSize(w, h, true);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const pw = renderer.domElement.width, ph = renderer.domElement.height;
    resizePost(renderer, post, pw, ph);
    W.layers.forEach((p) => { (p.material as THREE.ShaderMaterial).uniforms.uSize.value = h * renderer.getPixelRatio() * 1.3; });
    if (W.dust) (W.dust.material as THREE.ShaderMaterial).uniforms.uSize.value = h * renderer.getPixelRatio() * 2.4;
    scrollMap?.measure();
  }

  function updateWorld(dt: number) {
    T.value = clock;
    rig.focusAmt = damp(rig.focusAmt, rig.focus >= 0 ? 1 : 0, 5, dt);
    const f = rig.focusAmt;

    if (W.planet) W.planet.rotation.y += dt * 0.018;
    if (W.clouds) W.clouds.rotation.y += dt * 0.006;
    if (W.ring) W.ring.rotation.z += dt * 0.004;
    if (W.moon && W.moonOrbit) {
      const o = W.moonOrbit, a = clock * o.speed + o.phase;
      W.moon.position.set(Math.cos(a) * o.r, Math.sin(a * 0.7) * o.r * o.incl * 0.3, Math.sin(a) * o.r);
      W.moon.rotation.y += dt * 0.02;
    }

    if (W.core) {
      W.core.rotation.y += dt * 0.09;
      W.rings.forEach((r, i) => { r.rotation.z += dt * (0.05 + i * 0.03) * (i % 2 ? -1 : 1); });
      const b = 1 + 0.06 * Math.sin(clock * 1.7) + 0.04 * Math.sin(clock * 2.9);
      W.nucleus!.scale.setScalar(b * (1 + f * 0.16));
      W.coreHalo!.quaternion.copy(camera.quaternion);
      (W.coreHalo!.material as THREE.MeshBasicMaterial).opacity = 0.62 + f * 0.2 + Math.sin(clock * 0.8) * 0.05;
      W.electrons.forEach((e) => {
        const a = clock * e.speed + e.phase;
        const r = W.rings[e.ring];
        const v = new THREE.Vector3(Math.cos(a) * e.r, 0, Math.sin(a) * e.r);
        v.multiply(new THREE.Vector3(1, 0.42, 1));
        v.applyEuler(r.rotation);
        e.mesh.position.copy(v);
        e.mesh.children[0].quaternion.copy(camera.quaternion);
      });
    }
    if (W.coreLight) W.coreLight.intensity = 3.6 * (1 + f * 0.4) * (1 + Math.sin(clock * 0.6) * 0.06);
    if (W.station) W.station.rotation.y -= dt * 0.035;
    if (W.corona) W.corona.quaternion.copy(camera.quaternion);
    if (W.flare) W.flare.quaternion.copy(camera.quaternion);
    W.layers.forEach((p, i) => { p.rotation.y = clock * 0.004 * (i + 1); });
  }

  function render() {
    renderer.setRenderTarget(post.enabled ? post.scene! : null);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    if (post.enabled) renderPost(renderer, post, clock, fadeIn);
  }

  function frame(now: number) {
    if (!running) return;
    const raw = (now - tPrev) / 1000 || 0;
    const dt = Math.min(raw, 0.05);
    tPrev = now;
    clock += dt;
    fadeIn = clamp((now - introT0) / 800, 0, 1);

    if (!perf.locked && clock > 2.2) {
      perf.acc += raw;
      perf.n++;
      if (perf.n >= 40 || perf.acc > 0.9) {
        const avg = perf.acc / perf.n;
        perf.acc = 0;
        perf.n = 0;
        if (avg > 0.023 && perf.scale > 0.55) {
          perf.scale = Math.max(0.55, perf.scale * (avg > 0.05 ? 0.64 : 0.85));
          resize();
        } else if (avg < 0.0138 && perf.scale < 1) {
          perf.scale = Math.min(1, perf.scale + 0.08);
          resize();
        }
      }
    }

    if (scrollMap) {
      rig.prog = scrollMap.progressFor(window.scrollY);
      rig.smooth = reducedMotion ? rig.prog : damp(rig.smooth, rig.prog, 4.6, dt);
    } else {
      rig.smooth = 0;
    }
    rig.mx = damp(rig.mx, rig.tmx, 2.4, dt);
    rig.my = damp(rig.my, rig.tmy, 2.4, dt);
    rig.intro = clamp((now - introT0) / 2600, 0, 1);

    applyCamera(camera, rig, curves, points.length > 1 ? points : [points[0], points[0]], vpW(), vpH());
    updateWorld(dt);
    render();
    frameId = requestAnimationFrame(frame);
  }

  const onResize = () => resize();
  const onVisibility = () => {
    if (document.hidden) { running = false; cancelAnimationFrame(frameId); }
    else if (!running) { running = true; tPrev = performance.now(); frameId = requestAnimationFrame(frame); }
  };

  resize();
  if (reducedMotion) {
    // Paint one frame and stop — the scene still reads, nothing moves.
    rig.intro = 1;
    fadeIn = 1;
    applyCamera(camera, rig, curves, points.length > 1 ? points : [points[0], points[0]], vpW(), vpH());
    updateWorld(0);
    render();
  } else {
    frameId = requestAnimationFrame(frame);
  }

  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

  return {
    dispose() {
      running = false;
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      disposePost(post);
      scene.traverse((obj: any) => {
        obj.geometry?.dispose?.();
        const m = obj.material;
        if (Array.isArray(m)) m.forEach((mm) => mm?.dispose?.());
        else m?.dispose?.();
      });
      renderer.dispose();
    },
    setFocus(on: boolean) {
      rig.focus = on ? 1 : -1;
    },
    setPointer(nx: number, ny: number) {
      rig.tmx = nx;
      rig.tmy = ny;
    },
  };
}
