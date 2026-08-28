"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import "./cosmic-journey.css";

interface Chapter {
  kicker: string;
  title: string;
  text: string;
  fog: string;
}

const CHAPTERS: Chapter[] = [
  {
    kicker: "01 — THE COSMOS",
    title: "Every Idea Begins in the Stars",
    text: "Science starts with looking up. A spiral of a hundred billion suns — and curiosity enough to ask why.",
    fog: "#050a1c",
  },
  {
    kicker: "02 — WORLDS",
    title: "From One World to the Next",
    text: "Planets form from the same dust that forms us. Each one a closed experiment, spinning through the dark.",
    fog: "#160c26",
  },
  {
    kicker: "03 — GRAVITY",
    title: "Where Light Cannot Escape",
    text: "A black hole bends spacetime until even light loses the race. The limit of physics as we know it.",
    fog: "#0c0603",
  },
  {
    kicker: "04 — SPACETIME",
    title: "A Shortcut Through the Universe",
    text: "A wormhole — two distant points folded together. Theoretical, elegant, and still worth chasing.",
    fog: "#07011a",
  },
  {
    kicker: "05 — DENSITY",
    title: "A Star Collapsed to Its Core",
    text: "A neutron star packs a sun's mass into a city-sized sphere, spinning and sweeping the dark with light.",
    fog: "#001414",
  },
  {
    kicker: "06 — NDSC",
    title: "Into a Future Built on Physics",
    text: "From galaxies to atoms — the same curiosity, closer to home. Since 1955, NDSC has kept looking.",
    fog: "#020f08",
  },
];

const SPACING = 30;
const N = CHAPTERS.length;

export function CosmicJourney() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x050a1c, 6, 34);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
    camera.position.set(0, 0, 8);

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.PointLight(0xffffff, 1.1, 60);
    key.position.set(4, 4, 10);
    scene.add(key);

    // ---------- background starfield (whole journey) ----------
    const bgStarGeo = new THREE.BufferGeometry();
    const bgCount = 1800;
    const bgPos = new Float32Array(bgCount * 3);
    for (let i = 0; i < bgCount; i++) {
      bgPos[i * 3] = (Math.random() - 0.5) * 160;
      bgPos[i * 3 + 1] = (Math.random() - 0.5) * 160;
      bgPos[i * 3 + 2] = (Math.random() - 0.5) * (SPACING * N + 60) - 20;
    }
    bgStarGeo.setAttribute("position", new THREE.BufferAttribute(bgPos, 3));
    const bgStars = new THREE.Points(
      bgStarGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.7 })
    );
    scene.add(bgStars);

    type Updater = (t: number, dt: number) => void;
    const dynamics: Updater[] = [];

    // ---------- chapter 0: galaxy ----------
    function buildGalaxy() {
      const g = new THREE.Group();
      const count = 4200;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      const cIn = new THREE.Color("#bcd7ff");
      const cOut = new THREE.Color("#5b2bd6");
      const arms = 3;
      for (let i = 0; i < count; i++) {
        const r = Math.pow(Math.random(), 1.5) * 9;
        const arm = i % arms;
        const angle = (arm / arms) * Math.PI * 2 + r * 0.9 + (Math.random() - 0.5) * 0.5;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const y = (Math.random() - 0.5) * 0.6 * (1 - r / 10);
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
        const c = cIn.clone().lerp(cOut, Math.min(1, r / 9));
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
      }
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({
        size: 0.11,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const points = new THREE.Points(geo, mat);
      points.rotation.x = 0.4;
      g.add(points);

      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 24, 24),
        new THREE.MeshBasicMaterial({ color: 0xdfe9ff })
      );
      g.add(core);

      dynamics.push((_t, dt) => {
        points.rotation.y += dt * 0.05;
      });
      return g;
    }

    // ---------- chapter 1: planet ----------
    function buildPlanet() {
      const g = new THREE.Group();
      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(2.6, 48, 48),
        new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x081c3d, emissiveIntensity: 0.5, roughness: 0.75, metalness: 0.15 })
      );
      g.add(planet);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(3.6, 4.8, 72),
        new THREE.MeshBasicMaterial({ color: 0x7dd3fc, side: THREE.DoubleSide, transparent: true, opacity: 0.45 })
      );
      ring.rotation.x = Math.PI / 2.4;
      g.add(ring);

      const moon = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 20, 20),
        new THREE.MeshStandardMaterial({ color: 0xcbd5e1 })
      );
      g.add(moon);

      dynamics.push((t) => {
        planet.rotation.y = t * 0.15;
        moon.position.set(Math.cos(t * 0.4) * 5.6, Math.sin(t * 0.25) * 0.8, Math.sin(t * 0.4) * 5.6);
      });
      return g;
    }

    // ---------- chapter 2: black hole ----------
    function buildBlackHole() {
      const g = new THREE.Group();
      const hole = new THREE.Mesh(new THREE.SphereGeometry(1.7, 40, 40), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      g.add(hole);

      const bandDefs = [
        { r0: 2.0, r1: 2.7, color: 0xfff2c8, speed: 1.4 },
        { r0: 2.8, r1: 3.6, color: 0xffb35c, speed: 1.0 },
        { r0: 3.7, r1: 4.7, color: 0xff6a3d, speed: 0.65 },
      ];
      const bands: { mesh: THREE.Mesh; speed: number }[] = [];
      bandDefs.forEach((b) => {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(b.r0, b.r1, 96),
          new THREE.MeshBasicMaterial({ color: b.color, side: THREE.DoubleSide, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        ring.rotation.x = Math.PI / 2.15;
        g.add(ring);
        bands.push({ mesh: ring, speed: b.speed });
      });

      dynamics.push((_t, dt) => {
        bands.forEach((b) => (b.mesh.rotation.z += dt * b.speed));
        hole.rotation.y += dt * 0.1;
      });
      return g;
    }

    // ---------- chapter 3: wormhole ----------
    function buildWormhole() {
      const g = new THREE.Group();
      const count = 16;
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const radius = 3.2 + Math.sin(t * Math.PI) * 1.1;
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(radius, 0.06, 8, 40),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.72 - t * 0.25, 0.8, 0.55 + t * 0.15),
            transparent: true,
            opacity: 0.85,
          })
        );
        ring.position.z = -10 + i * 1.3;
        ring.rotation.z = i * 0.25;
        g.add(ring);
      }
      dynamics.push((_t, dt) => {
        g.rotation.z += dt * 0.15;
      });
      return g;
    }

    // ---------- chapter 4: neutron star ----------
    function buildNeutronStar() {
      const g = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0xeaffff })
      );
      g.add(core);

      const beamGroup = new THREE.Group();
      [1, -1].forEach((dir) => {
        const beam = new THREE.Mesh(
          new THREE.ConeGeometry(1.1, 9, 24, 1, true),
          new THREE.MeshBasicMaterial({ color: 0x7ef9ff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
        );
        beam.position.y = dir * 4.6;
        beam.rotation.x = dir > 0 ? Math.PI : 0;
        beamGroup.add(beam);
      });
      g.add(beamGroup);

      const sparkGeo = new THREE.BufferGeometry();
      const sc = 260;
      const sPos = new Float32Array(sc * 3);
      for (let i = 0; i < sc; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 1.4 + Math.random() * 2.2;
        sPos[i * 3] = Math.cos(a) * r;
        sPos[i * 3 + 1] = (Math.random() - 0.5) * 2;
        sPos[i * 3 + 2] = Math.sin(a) * r;
      }
      sparkGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
      const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0x8ff7ff, size: 0.05, transparent: true, opacity: 0.8 }));
      g.add(sparks);

      dynamics.push((_t, dt) => {
        beamGroup.rotation.z += dt * 2.2;
        sparks.rotation.y += dt * 0.3;
      });
      return g;
    }

    // ---------- chapter 5: quantum / futuristic ----------
    function buildQuantum() {
      const g = new THREE.Group();
      const nucleus = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 32, 32),
        new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0b4a52, emissiveIntensity: 0.8 })
      );
      g.add(nucleus);

      const orbits = [
        { tiltX: 0.3, tiltZ: 0.1, r: 2.6, speed: 0.6, color: 0x60a5fa },
        { tiltX: -0.5, tiltZ: 0.4, r: 2.6, speed: 0.45, color: 0xa78bfa },
        { tiltX: 0.2, tiltZ: -0.6, r: 2.6, speed: 0.75, color: 0x34d399 },
      ];
      const electrons: { mesh: THREE.Mesh; tiltX: number; tiltZ: number; r: number; speed: number; phase: number }[] = [];
      orbits.forEach((o) => {
        const ringMesh = new THREE.Mesh(
          new THREE.TorusGeometry(o.r, 0.015, 8, 80),
          new THREE.MeshBasicMaterial({ color: o.color, transparent: true, opacity: 0.35 })
        );
        ringMesh.rotation.x = o.tiltX;
        ringMesh.rotation.z = o.tiltZ;
        g.add(ringMesh);

        const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), new THREE.MeshBasicMaterial({ color: o.color }));
        g.add(e);
        electrons.push({ mesh: e, ...o, phase: Math.random() * Math.PI * 2 });
      });

      dynamics.push((t) => {
        electrons.forEach((e) => {
          const a = t * e.speed + e.phase;
          const x = Math.cos(a) * e.r;
          const z = Math.sin(a) * e.r;
          const v = new THREE.Vector3(x, 0, z);
          v.applyEuler(new THREE.Euler(e.tiltX, 0, e.tiltZ));
          e.mesh.position.copy(v);
        });
        g.rotation.y = t * 0.05;
      });
      return g;
    }

    const builders = [buildGalaxy, buildPlanet, buildBlackHole, buildWormhole, buildNeutronStar, buildQuantum];
    builders.forEach((build, i) => {
      const grp = build();
      grp.position.z = -i * SPACING;
      scene.add(grp);
    });

    const fogColors = CHAPTERS.map((c) => new THREE.Color(c.fog));

    // ---------- resize ----------
    function resize() {
      if (!wrap) return;
      const w = wrap.clientWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);

    // ---------- scroll progress ----------
    let progress = 0;
    function onScroll() {
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const total = wrap.offsetHeight - window.innerHeight;
      const scrolled = -rect.top;
      progress = Math.min(1, Math.max(0, total > 0 ? scrolled / total : 0));
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // ---------- pointer parallax ----------
    let mx = 0;
    let my = 0;
    function onMove(e: MouseEvent) {
      if (!wrap) return;
      const r = wrap.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width) * 2 - 1;
      my = ((e.clientY - r.top) / r.height) * 2 - 1;
    }
    window.addEventListener("mousemove", onMove);

    // ---------- animation loop ----------
    const clock = new THREE.Clock();
    let raf: number;
    function loop() {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      const chapterFloat = progress * (N - 1);
      const targetZ = -chapterFloat * SPACING;
      camera.position.z += (targetZ - camera.position.z) * 0.09;
      camera.position.y += (Math.sin(t * 0.15) * 0.35 - camera.position.y) * 0.05;
      camera.rotation.y += (mx * 0.08 - camera.rotation.y) * 0.04;
      camera.rotation.x += (-my * 0.06 - camera.rotation.x) * 0.04;

      const lo = Math.max(0, Math.min(N - 1, Math.floor(chapterFloat)));
      const hi = Math.min(N - 1, lo + 1);
      const frac = chapterFloat - lo;
      const mixed = fogColors[lo].clone().lerp(fogColors[hi], frac);
      if (scene.fog && "color" in scene.fog) {
        (scene.fog as THREE.Fog).color.copy(mixed);
      }
      renderer.setClearColor(mixed);

      dynamics.forEach((fn) => fn(t, dt));

      textRefs.current.forEach((el, i) => {
        if (!el) return;
        const dist = Math.abs(chapterFloat - i);
        const opacity = Math.max(0, 1 - dist * 1.2);
        el.style.opacity = opacity.toFixed(3);
        el.style.transform = `translateY(${dist * 26}px)`;
        el.style.pointerEvents = opacity > 0.5 ? "auto" : "none";
      });
      dotRefs.current.forEach((el, i) => {
        if (!el) return;
        const active = Math.round(chapterFloat) === i;
        el.style.background = active ? "#7dd3fc" : "rgba(255,255,255,0.25)";
        el.style.transform = active ? "scale(1.4)" : "scale(1)";
      });

      renderer.render(scene, camera);
    }
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMove);
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
    };
  }, []);

  return (
    <div className="cosmic-journey">
      <div className="cj-intro">
        <span className="cj-eyebrow">SCROLL TO BEGIN</span>
        <h2 className="cj-intro-title">
          A Story Told in <span className="cj-accent">Six Parts</span>
        </h2>
        <p className="cj-intro-sub">
          Galaxy, planet, black hole, wormhole, neutron star — and a future built on physics.
        </p>
        <div className="cj-arrow">↓</div>
      </div>

      <div ref={wrapRef} className="cj-scroll-track" style={{ height: `${N * 100}vh` }}>
        <div className="cj-sticky">
          <canvas ref={canvasRef} className="cj-canvas" />

          <div className="cj-text-layer">
            {CHAPTERS.map((c, i) => (
              <div key={c.kicker} ref={(el) => { textRefs.current[i] = el; }} className="cj-chapter-text">
                <div className="cj-kicker">{c.kicker}</div>
                <h3 className="cj-title">{c.title}</h3>
                <p className="cj-desc">{c.text}</p>
              </div>
            ))}
          </div>

          <div className="cj-dots">
            {CHAPTERS.map((c, i) => (
              <span key={c.kicker} ref={(el) => { dotRefs.current[i] = el; }} className="cj-dot" />
            ))}
          </div>
        </div>
      </div>

      <div className="cj-outro">
        <p className="cj-outro-text">END OF JOURNEY · NDSC EST. 1955</p>
      </div>
    </div>
  );
}
