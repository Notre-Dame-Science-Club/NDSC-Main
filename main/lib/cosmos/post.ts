// @ts-nocheck
/**
 * lib/cosmos/post.ts
 *
 * Bright pass → four blur levels → additive upsample → composite (ACES,
 * a chromatic split at the edges, a cold-shadow/warm-highlight grade,
 * vignette, grain). This chain is the difference between "three.js is on
 * the page" and something that reads as filmed.
 */
import * as THREE from "three";

const QUAD_VS = "varying vec2 vUv;\nvoid main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}";

export type Post = {
  cam: THREE.OrthographicCamera;
  quad: THREE.Mesh;
  qScene: THREE.Scene;
  up: THREE.ShaderMaterial;
  scene?: THREE.WebGLRenderTarget;
  levels: { a: THREE.WebGLRenderTarget; b: THREE.WebGLRenderTarget; w: number; h: number }[];
  bright?: THREE.ShaderMaterial;
  blur?: THREE.ShaderMaterial;
  comp?: THREE.ShaderMaterial;
  enabled: boolean;
};

export function createPost(renderer: THREE.WebGLRenderer, enabled: boolean): Post {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), undefined as any);
  quad.frustumCulled = false;
  const qScene = new THREE.Scene();
  qScene.add(quad);
  const up = new THREE.ShaderMaterial({
    uniforms: { tS: { value: null }, uAmt: { value: 1 } },
    vertexShader: QUAD_VS,
    fragmentShader: "uniform sampler2D tS;uniform float uAmt;varying vec2 vUv;\nvoid main(){gl_FragColor=vec4(texture2D(tS,vUv).rgb*uAmt,1.0);}",
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const post: Post = { cam, quad, qScene, up, levels: [], enabled };
  if (!enabled) return post;

  const w = renderer.domElement.width, h = renderer.domElement.height;
  const O = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false };
  post.scene = new THREE.WebGLRenderTarget(w, h, { ...O, depthBuffer: true });
  let lw = Math.max(2, w >> 1), lh = Math.max(2, h >> 1);
  for (let i = 0; i < 4; i++) {
    post.levels.push({ a: new THREE.WebGLRenderTarget(lw, lh, O), b: new THREE.WebGLRenderTarget(lw, lh, O), w: lw, h: lh });
    lw = Math.max(2, lw >> 1);
    lh = Math.max(2, lh >> 1);
  }
  post.bright = new THREE.ShaderMaterial({
    uniforms: { tS: { value: null }, uThr: { value: 0.8 }, uKnee: { value: 0.45 } },
    vertexShader: QUAD_VS,
    fragmentShader: `uniform sampler2D tS;uniform float uThr;uniform float uKnee;varying vec2 vUv;
      void main(){vec3 c=texture2D(tS,vUv).rgb;
      float l=dot(c,vec3(0.2126,0.7152,0.0722));
      float k=smoothstep(uThr,uThr+uKnee,l);
      gl_FragColor=vec4(c*k,1.0);}`,
  });
  post.blur = new THREE.ShaderMaterial({
    uniforms: { tS: { value: null }, uDir: { value: new THREE.Vector2(1, 0) } },
    vertexShader: QUAD_VS,
    fragmentShader: `uniform sampler2D tS;uniform vec2 uDir;varying vec2 vUv;
      void main(){vec3 c=texture2D(tS,vUv).rgb*0.2270270270;
      c+=texture2D(tS,vUv+uDir*1.3846153846).rgb*0.3162162162;
      c+=texture2D(tS,vUv-uDir*1.3846153846).rgb*0.3162162162;
      c+=texture2D(tS,vUv+uDir*3.2307692308).rgb*0.0702702703;
      c+=texture2D(tS,vUv-uDir*3.2307692308).rgb*0.0702702703;
      gl_FragColor=vec4(c,1.0);}`,
  });
  post.comp = new THREE.ShaderMaterial({
    uniforms: {
      tS: { value: null }, tB: { value: null }, uRes: { value: new THREE.Vector2(w, h) },
      uT: { value: 0 }, uBloom: { value: 0.5 }, uCA: { value: 1 }, uGrain: { value: 0.016 },
      uVig: { value: 1 }, uExp: { value: 0.9 }, uFade: { value: 1 }, uSat: { value: 1.1 },
    },
    vertexShader: QUAD_VS,
    fragmentShader: `uniform sampler2D tS;uniform sampler2D tB;uniform vec2 uRes;
      uniform float uT,uBloom,uCA,uGrain,uVig,uExp,uFade,uSat;
      varying vec2 vUv;
      vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
      void main(){
      vec2 d=vUv-0.5;float r2=dot(d,d);
      float ca=uCA*(0.26+r2*2.4)*0.0012;
      vec3 c;
      c.r=texture2D(tS,vUv+d*ca).r;
      c.g=texture2D(tS,vUv).g;
      c.b=texture2D(tS,vUv-d*ca).b;
      c+=texture2D(tB,vUv).rgb*uBloom;
      c*=uExp;
      c=aces(c);
      float l=dot(c,vec3(0.2126,0.7152,0.0722));
      c=mix(vec3(l),c,uSat);
      c=mix(c,c*vec3(0.80,0.98,1.16),smoothstep(0.55,0.0,l)*0.75);
      c=mix(c,c*vec3(1.05,0.99,0.95),smoothstep(0.55,1.0,l)*0.30);
      float v=smoothstep(1.24,0.24,length(d*vec2(1.0,0.94))*1.42);
      c*=mix(1.0,v,uVig);
      float g=fract(sin(dot(vUv*uRes+uT*137.0,vec2(12.9898,78.233)))*43758.5453);
      c+=(g-0.5)*uGrain;
      c*=uFade;
      vec3 e=pow(max(c,0.0),vec3(1.0/2.2));
      e=clamp((e-0.26)*1.12+0.26,0.0,1.0);
      gl_FragColor=vec4(e,1.0);}`,
  });
  return post;
}

function pass(renderer: THREE.WebGLRenderer, post: Post, mat: THREE.Material, target: THREE.WebGLRenderTarget | null, additive = false) {
  post.quad.material = mat;
  renderer.setRenderTarget(target);
  if (!additive) renderer.clear(true, false, false);
  renderer.render(post.qScene, post.cam);
}

export function renderPost(renderer: THREE.WebGLRenderer, post: Post, clock: number, fadeIn: number) {
  if (!post.enabled || !post.scene || !post.bright || !post.blur || !post.comp) return;
  const L = post.levels;
  post.bright.uniforms.tS.value = post.scene.texture;
  pass(renderer, post, post.bright, L[0].a);
  for (let i = 0; i < L.length; i++) {
    if (i > 0) {
      post.up.blending = THREE.NoBlending;
      post.up.uniforms.uAmt.value = 1;
      post.up.uniforms.tS.value = L[i - 1].a.texture;
      pass(renderer, post, post.up, L[i].a);
    }
    post.blur.uniforms.tS.value = L[i].a.texture;
    post.blur.uniforms.uDir.value.set(1 / L[i].w, 0);
    pass(renderer, post, post.blur, L[i].b);
    post.blur.uniforms.tS.value = L[i].b.texture;
    post.blur.uniforms.uDir.value.set(0, 1 / L[i].h);
    pass(renderer, post, post.blur, L[i].a);
  }
  post.up.blending = THREE.AdditiveBlending;
  post.up.uniforms.uAmt.value = 0.56;
  for (let i = L.length - 1; i > 0; i--) {
    post.up.uniforms.tS.value = L[i].a.texture;
    pass(renderer, post, post.up, L[i - 1].a, true);
  }
  post.comp.uniforms.tS.value = post.scene.texture;
  post.comp.uniforms.tB.value = L[0].a.texture;
  post.comp.uniforms.uT.value = clock;
  post.comp.uniforms.uFade.value = fadeIn;
  pass(renderer, post, post.comp, null);
}

export function resizePost(renderer: THREE.WebGLRenderer, post: Post, w: number, h: number) {
  if (!post.enabled || !post.scene || !post.comp) return;
  post.scene.setSize(w, h);
  post.comp.uniforms.uRes.value.set(w, h);
  let lw = Math.max(2, w >> 1), lh = Math.max(2, h >> 1);
  post.levels.forEach((L) => {
    L.a.setSize(lw, lh);
    L.b.setSize(lw, lh);
    L.w = lw;
    L.h = lh;
    lw = Math.max(2, lw >> 1);
    lh = Math.max(2, lh >> 1);
  });
}

export function disposePost(post: Post) {
  post.scene?.dispose();
  post.levels.forEach((L) => { L.a.dispose(); L.b.dispose(); });
}
