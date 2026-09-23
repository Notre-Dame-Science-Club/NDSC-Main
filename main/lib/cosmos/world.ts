// @ts-nocheck
/**
 * lib/cosmos/world.ts
 *
 * Populates a THREE.Scene with everything the camera flies through:
 * the sky, the planet (with clouds, atmosphere, ring and moon), the
 * club's own mark rendered as a giant atom, an observatory ring, a
 * three-depth star field with near dust, and the lighting. Nothing here
 * touches the DOM or the render loop — `engine.ts` owns both.
 */
import * as THREE from "three";
import { TAU, mulberry32 } from "./math";
import { texSky, texPlanet, texClouds, texMoon, texRing, texGlow, texStar } from "./textures";

export type World = {
  sky?: THREE.Mesh;
  planet?: THREE.Group;
  planetSurf?: THREE.Mesh;
  clouds?: THREE.Mesh;
  ring?: THREE.Mesh;
  moon?: THREE.Mesh;
  moonOrbit?: { r: number; speed: number; incl: number; phase: number };
  core?: THREE.Group;
  nucleus?: THREE.Mesh;
  coreHalo?: THREE.Mesh;
  rings: THREE.Mesh[];
  electrons: { mesh: THREE.Mesh; ring: number; phase: number; speed: number; r: number }[];
  station?: THREE.Group;
  layers: THREE.Points[];
  dust?: THREE.Points;
  key?: THREE.DirectionalLight;
  corona?: THREE.Mesh;
  flare?: THREE.Mesh;
  coreLight?: THREE.PointLight;
};

/** Values above 1 survive because the scene renders into a half-float
 *  buffer — they are what the bloom pass in post.ts feeds on. */
const hdr = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b);

function tx(renderer: THREE.WebGLRenderer, el: HTMLCanvasElement, o: { wrap?: THREE.Wrapping; repeat?: [number, number]; aniso?: number; srgb?: boolean } = {}) {
  const t = new THREE.CanvasTexture(el);
  t.wrapS = t.wrapT = o.wrap || THREE.ClampToEdgeWrapping;
  if (o.repeat) t.repeat.set(o.repeat[0], o.repeat[1]);
  t.anisotropy = Math.min(o.aniso || 8, renderer.capabilities.getMaxAnisotropy());
  if (o.srgb !== false) t.encoding = THREE.sRGBEncoding;
  t.needsUpdate = true;
  return t;
}

export function buildSky(scene: THREE.Scene, renderer: THREE.WebGLRenderer, W: World) {
  const geo = new THREE.SphereGeometry(500, 48, 32);
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      map: tx(renderer, texSky(), { aniso: 8 }),
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      color: hdr(0.82, 0.86, 0.95),
    })
  );
  m.renderOrder = 0;
  scene.add(m);
  W.sky = m;
}

export function buildPlanet(scene: THREE.Scene, renderer: THREE.WebGLRenderer, W: World) {
  const t = texPlanet();
  const g = new THREE.Group();

  const surf = new THREE.Mesh(
    new THREE.SphereGeometry(34, 128, 88),
    new THREE.MeshStandardMaterial({
      map: tx(renderer, t.map, { aniso: 16 }),
      roughnessMap: tx(renderer, t.rough, { aniso: 8, srgb: false }),
      emissiveMap: tx(renderer, t.emissive, { aniso: 8 }),
      emissive: hdr(1.7, 1.02, 0.5),
      emissiveIntensity: 1,
      roughness: 1,
      metalness: 0.05,
    })
  );
  g.add(surf);
  W.planetSurf = surf;

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(34.5, 88, 60),
    new THREE.MeshStandardMaterial({ map: tx(renderer, texClouds(), { aniso: 8 }), transparent: true, opacity: 0.55, roughness: 1, metalness: 0, depthWrite: false })
  );
  g.add(clouds);
  W.clouds = clouds;

  /* The atmosphere is a back-faced shell with a fresnel ramp: visible only
     where the view grazes the limb, which is exactly where real air is
     thickest along the line of sight. A flat additive sphere washes the
     whole disc and the planet reads as a light bulb instead. */
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(36.6, 72, 50),
    new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(0x5ec0ff) }, uPower: { value: 3.3 } },
      vertexShader: `varying vec3 vN;varying vec3 vV;
        void main(){vN=normalize(normalMatrix*normal);
        vec4 mv=modelViewMatrix*vec4(position,1.0);vV=normalize(-mv.xyz);
        gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform vec3 uColor;uniform float uPower;varying vec3 vN;varying vec3 vV;
        void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),uPower);
        gl_FragColor=vec4(uColor*f*1.85,f);}`,
    })
  );
  g.add(atmo);

  /* A wide ring — real annulus geometry, not a texture on a flat plane, so
     it keeps a true edge when the rig passes near its plane. */
  const ringGeo = new THREE.RingGeometry(46, 78, 128, 1);
  const uv = ringGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const px = ringGeo.attributes.position.getX(i);
    const py = ringGeo.attributes.position.getY(i);
    const r = Math.hypot(px, py);
    uv.setXY(i, (r - 46) / 32, 0);
  }
  const ring = new THREE.Mesh(
    ringGeo,
    new THREE.MeshBasicMaterial({ map: tx(renderer, texRing(), { wrap: THREE.ClampToEdgeWrapping }), transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.62 })
  );
  ring.rotation.x = (Math.PI / 2) * 1.02;
  g.add(ring);
  W.ring = ring;

  const moon = new THREE.Mesh(new THREE.SphereGeometry(3.4, 40, 28), new THREE.MeshStandardMaterial({ map: tx(renderer, texMoon(), { aniso: 8 }), roughness: 0.96, metalness: 0.02 }));
  g.add(moon);
  W.moon = moon;
  W.moonOrbit = { r: 64, speed: 0.052, incl: 0.34, phase: 1.4 };

  g.position.set(-46, -26, -96);
  g.rotation.z = 0.34;
  scene.add(g);
  W.planet = g;
}

/** The club's own mark, rendered oversized and animated: a burning
 *  nucleus, three elliptical shells at 60° to each other, and a run of
 *  electrons on each — the exact geometry of the NDSC atom logo, just
 *  given room to breathe in 3-D. */
export function buildCore(scene: THREE.Scene, renderer: THREE.WebGLRenderer, W: World, T: { value: number }) {
  const g = new THREE.Group();

  const nucleus = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 3), new THREE.MeshBasicMaterial({ color: hdr(1.9, 3.2, 4.4), fog: false, toneMapped: false }));
  g.add(nucleus);
  W.nucleus = nucleus;

  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 22),
    new THREE.MeshBasicMaterial({ map: tx(renderer, texGlow("rgba(150,232,255,.92)", "rgba(40,150,220,.26)")), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.7 })
  );
  g.add(halo);
  W.coreHalo = halo;

  W.rings = [];
  W.electrons = [];
  const ringMat = () => new THREE.MeshBasicMaterial({ color: hdr(0.34, 1.05, 1.5), transparent: true, opacity: 0.62, depthWrite: false, fog: false, toneMapped: false, blending: THREE.AdditiveBlending });
  const tilts: [number, number, number][] = [[0, 0, 0], [Math.PI / 3, 0.3, 0], [-Math.PI / 3, -0.3, 0]];
  tilts.forEach((r, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7.6 + i * 0.55, 0.035, 8, 220), ringMat());
    ring.rotation.set(r[0], r[1], r[2]);
    ring.scale.set(1, 0.42, 1);
    g.add(ring);
    W.rings.push(ring);

    for (let k = 0; k < 2; k++) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), new THREE.MeshBasicMaterial({ color: hdr(2.6, 3.6, 4.6), fog: false, toneMapped: false }));
      const tr = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 3.4),
        new THREE.MeshBasicMaterial({ map: tx(renderer, texGlow("rgba(190,246,255,.9)", "rgba(60,170,230,.3)")), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.55 })
      );
      e.add(tr);
      g.add(e);
      W.electrons.push({ mesh: e, ring: i, phase: k * Math.PI + i * 1.1, speed: 0.55 + i * 0.16, r: 7.6 + i * 0.55 });
    }
  });

  g.position.set(0, 1.5, -26);
  scene.add(g);
  W.core = g;
}

/** A slow observatory ring on a wide orbit — gives the middle distance
 *  something man-made in it. */
export function buildStation(scene: THREE.Scene, W: World) {
  const g = new THREE.Group();
  const rnd = mulberry32(1919);
  const shell = new THREE.MeshStandardMaterial({ color: 0x8fa4b8, roughness: 0.42, metalness: 0.72 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b2530, roughness: 0.7, metalness: 0.3 });
  const lit = new THREE.MeshBasicMaterial({ color: hdr(1.6, 2.2, 2.9), fog: false, toneMapped: false });

  const R = 17;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    const mod = new THREE.Group();
    mod.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.62, 0.62), shell));
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 2.1), dark);
    fin.position.y = 0.1;
    mod.add(fin);
    if (i % 3 === 0) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), lit);
      lamp.position.set(0.8, 0.2, 0);
      mod.add(lamp);
    }
    mod.position.set(Math.cos(a) * R, (rnd() - 0.5) * 0.6, Math.sin(a) * R);
    mod.rotation.y = -a;
    g.add(mod);
  }
  const spine = new THREE.Mesh(new THREE.TorusGeometry(R, 0.06, 6, 180), dark);
  spine.rotation.x = Math.PI / 2;
  g.add(spine);

  g.position.set(0, 1.5, -26);
  g.rotation.x = 0.42;
  g.rotation.z = -0.18;
  scene.add(g);
  W.station = g;
}

/** Three depths of star sprite plus a near dust band the lens travels
 *  through — the single strongest cue that the camera is moving rather
 *  than the scene turning. */
export function buildField(scene: THREE.Scene, renderer: THREE.WebGLRenderer, W: World, T: { value: number }, low: boolean) {
  const starTex = tx(renderer, texStar());
  W.layers = [];
  const cfg: [number, number, number][] = low
    ? [[900, 120, 1.5], [600, 60, 2.4]]
    : [[1600, 160, 1.3], [1100, 80, 2.2], [700, 36, 3.4]];
  cfg.forEach(([N, spread, size], li) => {
    const rnd = mulberry32(31 + li * 77);
    const pos = new Float32Array(N * 3), seed = new Float32Array(N), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (rnd() - 0.5) * spread * 2;
      pos[i * 3 + 1] = (rnd() - 0.5) * spread * 1.2;
      pos[i * 3 + 2] = -spread * 1.6 + rnd() * spread * 2.2;
      seed[i] = rnd();
      const warm = rnd() > 0.85;
      col[i * 3] = warm ? 1.0 : 0.72;
      col[i * 3 + 1] = warm ? 0.78 : 0.88;
      col[i * 3 + 2] = warm ? 0.56 : 1.0;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    geo.setAttribute("aCol", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT: T, uTex: { value: starTex }, uSize: { value: 900 * size } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexShader: `attribute float aSeed;attribute vec3 aCol;uniform float uT;uniform float uSize;
        varying float vA;varying vec3 vC;
        void main(){vC=aCol;
        vec4 mv=modelViewMatrix*vec4(position,1.0);
        float tw=0.62+0.38*sin(uT*(0.5+aSeed*1.6)+aSeed*30.0);
        vA=tw*(0.35+aSeed*0.65);
        gl_PointSize=uSize*(0.004+aSeed*0.010)/max(-mv.z,1.0);
        gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform sampler2D uTex;uniform float uFade;varying float vA;varying vec3 vC;
        void main(){vec4 t=texture2D(uTex,gl_PointCoord);
        gl_FragColor=vec4(t.rgb*vC*1.4,t.a*vA);}`,
    });
    const p = new THREE.Points(geo, mat);
    p.frustumCulled = false;
    p.renderOrder = 2;
    scene.add(p);
    W.layers.push(p);
  });

  const N = low ? 260 : 520, rnd = mulberry32(808);
  const pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (rnd() - 0.5) * 46;
    pos[i * 3 + 1] = (rnd() - 0.5) * 30;
    pos[i * 3 + 2] = (rnd() - 0.5) * 60;
    seed[i] = rnd();
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  dg.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const dust = new THREE.Points(
    dg,
    new THREE.ShaderMaterial({
      uniforms: { uT: T, uTex: { value: starTex }, uSize: { value: 2000 } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexShader: `attribute float aSeed;uniform float uT;uniform float uSize;varying float vA;
        void main(){vec3 p=position;
        p.x+=sin(uT*0.22+aSeed*20.0)*1.4;
        p.y+=cos(uT*0.17+aSeed*14.0)*1.1;
        vec4 mv=modelViewMatrix*vec4(p,1.0);
        vA=(0.12+aSeed*0.3)*smoothstep(90.0,10.0,-mv.z);
        gl_PointSize=uSize*(0.003+aSeed*0.006)/max(-mv.z,0.8);
        gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform sampler2D uTex;varying float vA;
        void main(){vec4 t=texture2D(uTex,gl_PointCoord);
        gl_FragColor=vec4(t.rgb*vec3(.7,.86,1.0),t.a*vA);}`,
    })
  );
  dust.frustumCulled = false;
  dust.renderOrder = 3;
  scene.add(dust);
  W.dust = dust;
}

export function buildLights(scene: THREE.Scene, renderer: THREE.WebGLRenderer, W: World) {
  scene.add(new THREE.HemisphereLight(0x3a5c8c, 0x05080f, 0.34));

  const key = new THREE.DirectionalLight(0xfff2df, 3.1);
  key.position.set(-60, 26, 18);
  scene.add(key);
  W.key = key;

  const rim = new THREE.DirectionalLight(0x5ad8ff, 1.05);
  rim.position.set(40, -14, -44);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0x6a5aff, 0.4);
  fill.position.set(20, 10, 80);
  scene.add(fill);

  const corona = new THREE.Mesh(
    new THREE.PlaneGeometry(210, 210),
    new THREE.MeshBasicMaterial({ map: tx(renderer, texGlow("rgba(255,238,206,.9)", "rgba(255,176,96,.22)")), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.48 })
  );
  corona.position.set(-150, 58, -260);
  corona.renderOrder = 1;
  scene.add(corona);
  W.corona = corona;

  const flare = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 26),
    new THREE.MeshBasicMaterial({ map: tx(renderer, texGlow("rgba(255,255,255,.95)", "rgba(255,220,170,.3)")), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.7 })
  );
  flare.position.set(-150, 58, -260);
  flare.renderOrder = 1;
  scene.add(flare);
  W.flare = flare;

  const core = new THREE.PointLight(0x7fd8ff, 3.6, 110, 2);
  core.position.set(0, 1.5, -26);
  scene.add(core);
  W.coreLight = core;
}
