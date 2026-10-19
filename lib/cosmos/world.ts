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
import { texSky, texMoon, texRing, texGlow, texStar } from "./textures";

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
  glints?: THREE.Points;
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

/** Real Earth imagery lives in /public/textures/earth (served from the site
 *  root, so nothing here depends on where the project folder sits).
 *  Equirectangular maps: RepeatWrapping on S so the 0°/360° longitude seam
 *  samples across the edge instead of clamping to a visible line. */
const EARTH_TEX_DIR = "/textures/earth";
const textureLoader = new THREE.TextureLoader();

function txUrl(renderer: THREE.WebGLRenderer, file: string, o: { aniso?: number; srgb?: boolean } = {}) {
  const t = textureLoader.load(`${EARTH_TEX_DIR}/${file}`);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = Math.min(o.aniso || 8, renderer.capabilities.getMaxAnisotropy());
  if (o.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildSky(scene: THREE.Scene, renderer: THREE.WebGLRenderer, W: World, T: { value: number }) {
  const geo = new THREE.SphereGeometry(500, 48, 32);
  /* The baked sky is sampled as-is, then every pixel that is star-bright is
     modulated by a slow per-cell sine so the painted stars breathe. Cells
     are ~3 texels wide so a star twinkles as a whole; the swing is kept
     small (about 25%) so it reads as faint life, not flicker. */
  const m = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms: { uMap: { value: tx(renderer, texSky(), { aniso: 8 }) }, uT: T, uTint: { value: new THREE.Color(0.82, 0.86, 0.95) } },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec2 vUv;
        void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform sampler2D uMap;uniform float uT;uniform vec3 uTint;varying vec2 vUv;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){
          vec3 c=texture2D(uMap,vUv).rgb;
          float l=dot(c,vec3(0.2126,0.7152,0.0722));
          float star=smoothstep(0.28,0.62,l);
          vec2 cell=floor(vUv*vec2(2048.0,1024.0)/3.0);
          float h=hash(cell);
          float tw=sin(uT*(0.45+h*1.5)+h*40.0)*0.5+0.5;
          float k=1.0+star*(tw-0.5)*0.55;
          gl_FragColor=vec4(c*uTint*k,1.0);
        }`,
    })
  );
  m.renderOrder = 0;
  scene.add(m);
  W.sky = m;
}

export function buildPlanet(scene: THREE.Scene, renderer: THREE.WebGLRenderer, W: World) {
  const g = new THREE.Group();

  /* Real Earth: NASA Blue Marble day map, a roughness map baked from the
     land/ocean mask (glossy sea, matte land) and the city-lights night map. */
  const surfMat = new THREE.MeshStandardMaterial({
    map: txUrl(renderer, "earth_day_2048.jpg", { aniso: 16 }),
    roughnessMap: txUrl(renderer, "earth_roughness_2048.jpg", { aniso: 8, srgb: false }),
    emissiveMap: txUrl(renderer, "earth_lights_2048.jpg", { aniso: 8 }),
    emissive: hdr(1.5, 1.15, 0.75),
    emissiveIntensity: 1,
    roughness: 1,
    metalness: 0.05,
  });
  /* City lights should only glow on the night side. Mask the emissive term
     by the key light's direction (first directional light, view space). */
  surfMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      #if NUM_DIR_LIGHTS > 0
        float sunDot = dot(normalize(normal), directionalLights[0].direction);
        totalEmissiveRadiance *= 1.0 - smoothstep(-0.12, 0.18, sunDot);
      #endif`
    );
  };

  const surf = new THREE.Mesh(new THREE.SphereGeometry(34, 128, 88), surfMat);
  g.add(surf);
  W.planetSurf = surf;

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(34.5, 88, 60),
    new THREE.MeshStandardMaterial({ map: txUrl(renderer, "earth_clouds_1024.png", { aniso: 8 }), transparent: true, opacity: 0.85, roughness: 1, metalness: 0, depthWrite: false })
  );
  g.add(clouds);
  W.clouds = clouds;

  /* Atmosphere, in two soft layers, neither with a hard edge (a hard edge
     is what makes it read as a glass cover):
     1. an outer haze whose brightness is a function of the view ray's
        closest approach to the planet centre — exponential falloff with
        altitude, fading to exactly zero well before the shell's own edge,
        so there is no silhouette line to see;
     2. a thin inner limb glow on a shell just above the cloud deck, ramped
        by fresnel so it dissolves into the disc instead of ending in a line.
     Both are brighter on the sunlit side and almost vanish on the night side. */
  const PLANET_POS = new THREE.Vector3(-46, -26, -96);
  const sunDir = new THREE.Vector3(-60, 26, 18).normalize();
  const hazeVS = `varying vec3 vW;
    void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(52, 96, 64),
    new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uC: { value: PLANET_POS }, uSun: { value: sunDir }, uR: { value: 34.6 }, uE: { value: 52.0 } },
      vertexShader: hazeVS,
      fragmentShader: `uniform vec3 uC;uniform vec3 uSun;uniform float uR;uniform float uE;varying vec3 vW;
        void main(){
          vec3 rd=normalize(vW-cameraPosition);
          vec3 oc=uC-cameraPosition;
          float t=dot(oc,rd);
          vec3 p=cameraPosition+rd*t;
          float d=length(p-uC);
          float h=max(d-uR,0.0);
          float g=exp(-h/2.6)*0.85+exp(-h/7.5)*0.22;
          g*=1.0-smoothstep(uE-14.0,uE-1.0,d);
          vec3 n=normalize(p-uC);
          float lit=smoothstep(-0.35,0.55,dot(n,uSun));
          vec3 col=mix(vec3(0.18,0.46,0.95),vec3(0.42,0.78,1.0),exp(-h/1.6));
          float a=g*(0.12+0.88*lit);
          gl_FragColor=vec4(col*a*1.5,a);
        }`,
    })
  );
  g.add(haze);

  const limb = new THREE.Mesh(
    new THREE.SphereGeometry(35.05, 96, 64),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uSun: { value: sunDir } },
      vertexShader: `varying vec3 vN;varying vec3 vV;varying vec3 vWN;
        void main(){vN=normalize(normalMatrix*normal);
        vec4 mv=modelViewMatrix*vec4(position,1.0);vV=normalize(-mv.xyz);
        vWN=normalize(mat3(modelMatrix)*normal);
        gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform vec3 uSun;varying vec3 vN;varying vec3 vV;varying vec3 vWN;
        void main(){
          float f=1.0-max(dot(normalize(vN),normalize(vV)),0.0);
          float rim=(pow(f,3.2)+pow(f,6.0)*0.35)*(1.0-smoothstep(0.86,1.0,f));
          float lit=smoothstep(-0.3,0.5,dot(normalize(vWN),uSun));
          float a=rim*(0.1+0.9*lit);
          gl_FragColor=vec4(vec3(0.34,0.68,1.0)*a*0.9,a);
        }`,
    })
  );
  g.add(limb);

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
    ? [[600, 120, 1.2], [350, 60, 1.8]]
    : [[1000, 160, 1.1], [600, 80, 1.7], [320, 36, 2.4]];
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
        gl_PointSize=clamp(uSize*(0.004+aSeed*0.010)/max(-mv.z,1.0),1.0,6.0);
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

  /* Glint stars: a sparse set that sit as faint dots, then each, on its own
     slow cycle, flares into a small four-point plus for ~1.5 s and fades
     back. The plus is drawn analytically in the fragment shader (two thin
     crossed streaks + a hot core), so there is no texture and the cost is
     ~40 tiny sprites. */
  {
    const G = low ? 22 : 40, gr = mulberry32(5150);
    const pos = new Float32Array(G * 3), seed = new Float32Array(G);
    for (let i = 0; i < G; i++) {
      const th = gr() * TAU, ph = Math.acos(1 - 2 * gr()), R = 420;
      pos[i * 3] = R * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = R * Math.cos(ph) * 0.8;
      pos[i * 3 + 2] = R * Math.sin(ph) * Math.sin(th);
      seed[i] = gr();
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    gg.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const glints = new THREE.Points(
      gg,
      new THREE.ShaderMaterial({
        uniforms: { uT: T, uPR: { value: 1 } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        vertexShader: `attribute float aSeed;uniform float uT;uniform float uPR;varying float vG;varying float vS;
          void main(){
            float cyc=7.0+aSeed*11.0;
            float t=fract((uT+aSeed*97.0)/cyc);
            // quick rise, ~1.5s hold-and-fade
            vG=smoothstep(0.0,0.025,t)*(1.0-smoothstep(0.05,0.15,t));
            vS=aSeed;
            gl_PointSize=(6.0+vG*46.0)*uPR;
            gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `varying float vG;varying float vS;
          void main(){
            vec2 p=gl_PointCoord*2.0-1.0;
            float r=length(p);
            float core=exp(-r*r*40.0);
            float h=exp(-abs(p.y)*34.0)*pow(max(1.0-abs(p.x),0.0),1.6);
            float v=exp(-abs(p.x)*34.0)*pow(max(1.0-abs(p.y),0.0),1.6);
            float plus=(h+v)*vG;
            float dot_=core*(0.35+0.65*vG);
            vec3 col=mix(vec3(0.75,0.9,1.0),vec3(1.0,0.86,0.7),step(0.8,vS));
            float a=clamp(dot_+plus,0.0,1.0);
            gl_FragColor=vec4(col*a*1.6,a);}`,
      })
    );
    glints.frustumCulled = false;
    glints.renderOrder = 2;
    scene.add(glints);
    W.glints = glints;
  }

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

export function buildLights(scene: THREE.Scene, renderer: THREE.WebGLRenderer, W: World, T: { value: number }) {
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

  /* The sun is one billboard shader instead of two flat glow sprites (which
     read as a lit orb). Layers, all HDR so the bloom pass does the rest:
       - a small photosphere disc with limb darkening and slow granulation,
       - a power-law glare (1/r, the way a real lens bright-source falls
         off — long tail, no visible edge),
       - faint corona streamers: low-order angular harmonics that drift,
         deliberately NOT a 4-point cross,
       - a subtle slow breathing so it feels alive. */
  const sun = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.ShaderMaterial({
      uniforms: { uT: T },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec2 vP;
        void main(){vP=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform float uT;varying vec2 vP;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        void main(){
          float r=length(vP);
          float a=atan(vP.y,vP.x);
          float rd=0.02*300.0/220.0;
          float breathe=1.0+0.035*sin(uT*0.5)+0.02*sin(uT*1.3+1.0);
          // photosphere
          float disc=1.0-smoothstep(rd*0.55,rd*1.35,r);
          float mu=sqrt(max(1.0-(r*r)/(rd*rd*1.8),0.0));
          float limb=0.38+0.62*pow(mu,0.55);
          float gran=0.5;
          if(disc>0.0){gran=vnoise(vP/rd*5.0+vec2(uT*0.05,-uT*0.04))*0.6+vnoise(vP/rd*11.0-uT*0.07)*0.4;}
          vec3 surf=mix(vec3(1.5,0.62,0.2),vec3(2.1,1.35,0.7),mu)*limb*(0.7+0.6*gran);
          // glare: long 1/r tail, warm near the disc, cooling outward
          float glare=0.0095*0.733/(r+0.022*0.733);
          vec3 gcol=mix(vec3(1.0,0.72,0.42),vec3(0.8,0.62,0.5),smoothstep(0.0,0.5,r));
          // soft inner halo
          float halo=exp(-r*7.5*0.733)*0.3+exp(-r*26.0*0.733)*0.9;
          // corona streamers
          float st=0.5+0.28*sin(a*5.0+uT*0.06)+0.22*sin(a*9.0-uT*0.045+1.7);
          st=pow(clamp(st,0.0,1.0),2.0);
          float streak=st*exp(-r*5.5)*0.2/(1.0+r*10.0);
          // wide ambient scatter
          float amb=exp(-r*2.6)*0.05;
          vec3 col=surf*disc*1.0
                  +gcol*(glare*breathe+halo*breathe+streak)
                  +vec3(1.0,0.78,0.55)*amb;
          float edge=1.0-smoothstep(0.78,1.0,r);
          col*=edge;
          gl_FragColor=vec4(col,1.0);
        }`,
    })
  );
  sun.position.set(-150, 58, -260);
  sun.renderOrder = 1;
  scene.add(sun);
  W.corona = sun;

  const core = new THREE.PointLight(0x7fd8ff, 3.6, 110, 2);
  core.position.set(0, 1.5, -26);
  scene.add(core);
  W.coreLight = core;
}
