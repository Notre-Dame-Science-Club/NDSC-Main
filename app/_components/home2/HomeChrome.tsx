"use client";

import { useEffect, useRef } from "react";

export type Chapter = { id: string; label: string };

/**
 * Everything on the new homepage that needs to react to scroll or pointer
 * position but isn't part of the cosmos WebGL scene itself:
 *
 *   - fades each [data-rv] element in once it enters the viewport
 *   - builds the small progress rail on the right edge and keeps it in
 *     sync with which chapter is on screen
 *   - fades the hero's cue/chip row out as the page leaves the hero
 *   - drives the custom cursor dot on hover-capable devices
 *   - splits leadership quotes into words for the staggered reveal
 *
 * One component, mounted once at the foot of the homepage, rather than
 * scattering these effects across every section component — they all
 * read/write the same handful of DOM nodes and are cheaper to coordinate
 * in one place.
 */
export default function HomeChrome({ chapters }: { chapters: Chapter[] }) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // ── word-split the leadership quotes, once, before anything observes them
    document.querySelectorAll(".ch-leader-card q").forEach((q) => {
      if ((q as HTMLElement).dataset.split) return;
      (q as HTMLElement).dataset.split = "1";
      const words = (q.textContent || "").trim().split(/\s+/);
      q.innerHTML = words.map((w, i) => `<span class="qword" style="--wd:${i * 26}ms">${w}</span>`).join(" ");
    });

    // ── reveal-on-scroll
    const items = Array.from(document.querySelectorAll<HTMLElement>(".cosmos-home [data-rv]"));
    const groups = new Map<Element | null, HTMLElement[]>();
    items.forEach((el) => {
      const key = el.parentElement;
      const arr = groups.get(key) || [];
      arr.push(el);
      groups.set(key, arr);
    });
    groups.forEach((arr) => arr.forEach((el, i) => (el.dataset.rvd = String(i * 90))));

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          const d = parseFloat((entry.target as HTMLElement).dataset.rvd || "0");
          setTimeout(() => entry.target.classList.add("rv-in"), reduceMotion ? 0 : d);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.04 }
    );
    items.forEach((el) => { if (!el.closest("#ch-hero")) io.observe(el); });

    // The hero is visible on load, before any scroll — it needs its own
    // cascade instead of an IntersectionObserver, which would fire
    // immediately anyway and skip the staggered feel every other chapter
    // gets on first scroll into view.
    const heroItems = Array.from(document.querySelectorAll<HTMLElement>("#ch-hero [data-rv]"));
    const heroTimer = setTimeout(() => {
      heroItems.forEach((el, i) => setTimeout(() => el.classList.add("rv-in"), reduceMotion ? 0 : 120 + i * 95));
    }, reduceMotion ? 0 : 340);

    // ── the progress rail
    let anchors: number[] = [];
    let activeIdx = -1;
    const dots = railRef.current ? Array.from(railRef.current.children) as HTMLButtonElement[] : [];
    const measure = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      anchors = chapters.map((ch, i) => {
        const el = document.getElementById(ch.id);
        if (!el) return maxScroll;
        if (i === 0) return 0;
        if (i === chapters.length - 1) return maxScroll;
        return Math.min(Math.max(el.offsetTop + el.offsetHeight * 0.5 - window.innerHeight * 0.5, 0), maxScroll);
      });
      for (let i = 1; i < anchors.length; i++) anchors[i] = Math.max(anchors[i], anchors[i - 1] + 1);
    };
    const progressFor = (y: number) => {
      if (!anchors.length) return 0;
      if (y <= anchors[0]) return 0;
      for (let i = 0; i < anchors.length - 1; i++) if (y <= anchors[i + 1]) return i;
      return anchors.length - 1;
    };

    // ── hero exit fade
    const heroSeq = [
      { el: document.querySelector<HTMLElement>(".ch-hero-cue"), at: 0.0, span: 0.28, shift: true },
      ...Array.from(document.querySelectorAll<HTMLElement>(".ch-chip")).map((el, i) => ({ el, at: 0.1 + i * 0.09, span: 0.3, shift: true })),
      { el: document.querySelector<HTMLElement>(".ch-hero-side"), at: 0.55, span: 0.34, shift: false },
    ].filter((o) => o.el) as { el: HTMLElement; at: number; span: number; shift: boolean }[];

    const smooth = (e0: number, e1: number, x: number) => {
      const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
      return t * t * (3 - 2 * t);
    };

    let heroOn = false;
    const applyHeroExit = () => {
      const t = Math.min(1, Math.max(0, window.scrollY / Math.max(1, window.innerHeight * 0.6)));
      if (t <= 0) {
        if (!heroOn) return;
        heroSeq.forEach((o) => { o.el.style.opacity = ""; o.el.style.transform = ""; o.el.style.transition = ""; });
        heroOn = false;
        return;
      }
      heroOn = true;
      heroSeq.forEach((o) => {
        o.el.style.transition = "none";
        const a = 1 - smooth(o.at, o.at + o.span, t);
        o.el.style.opacity = a.toFixed(3);
        if (o.shift) o.el.style.transform = `translate3d(0,${((1 - a) * 16).toFixed(1)}px,0)`;
      });
    };

    const onScroll = () => {
      const idx = progressFor(window.scrollY);
      if (idx !== activeIdx) {
        activeIdx = idx;
        dots.forEach((d, i) => d.classList.toggle("on", i === idx));
      }
      applyHeroExit();
    };
    const onResize = () => { measure(); onScroll(); };

    measure();
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    dots.forEach((d, i) => {
      d.addEventListener("click", () => window.scrollTo({ top: anchors[i], behavior: reduceMotion ? "auto" : "smooth" }));
    });

    // ── cursor dot
    const coarse = window.matchMedia("(hover: none)").matches;
    let raf = 0;
    const cursor = cursorRef.current;
    if (cursor && !coarse) {
      let x = window.innerWidth / 2, y = window.innerHeight / 2, tx = x, ty = y;
      const onPointer = (e: PointerEvent) => { tx = e.clientX; ty = e.clientY; };
      window.addEventListener("pointermove", onPointer, { passive: true });
      const overEls = () => document.querySelectorAll<HTMLElement>(".cosmos-home [data-cursor]");
      const onEnter = () => cursor.classList.add("act");
      const onLeave = () => cursor.classList.remove("act");
      overEls().forEach((el) => { el.addEventListener("mouseenter", onEnter); el.addEventListener("mouseleave", onLeave); });
      const tick = () => {
        x += (tx - x) * 0.18; y += (ty - y) * 0.18;
        cursor.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => {
        io.disconnect();
        clearTimeout(heroTimer);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
        window.removeEventListener("pointermove", onPointer);
        cancelAnimationFrame(raf);
      };
    }

    return () => {
      io.disconnect();
      clearTimeout(heroTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="ch-rail" ref={railRef} aria-hidden="true">
        {chapters.map((ch) => (
          <button key={ch.id} type="button" title={ch.label} aria-label={ch.label}>
            <i />
          </button>
        ))}
      </div>
      <div className="cur-dot" ref={cursorRef} />
    </>
  );
}
