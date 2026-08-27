"use client";
import { useEffect, useRef, useState } from "react";

const QUOTES = [
  { q: "That's one small step for man, one giant leap for mankind.", a: "Neil Armstrong" },
  { q: "Somewhere, something incredible is waiting to be known.", a: "Carl Sagan" },
  { q: "Earth is the cradle of humanity, but mankind cannot stay in the cradle forever.", a: "Konstantin Tsiolkovsky" },
  { q: "The universe is under no obligation to make sense to you.", a: "Neil deGrasse Tyson" },
  { q: "Science in Human Welfare — the noble mission continues.", a: "NDSC Motto" },
  { q: "Every orbit begins with someone brave enough to leave the ground.", a: "Anonymous" },
  { q: "Across the sea of space, the stars are other suns.", a: "Carl Sagan" },
  { q: "The cosmos is within us. We are made of star-stuff.", a: "Carl Sagan" },
];

export default function SpaceRocket() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rocketRef = useRef<HTMLDivElement>(null);
  const [currentQuote, setCurrentQuote] = useState(QUOTES[0]);
  const [showBubble, setShowBubble] = useState(false);
  const [bubblePos, setBubblePos] = useState({ x: 0, y: 0, above: false });
  const animationRef = useRef<number>();
  const positionRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, angle: 0 });
  const isExitingRef = useRef(false);
  const reentryTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!containerRef.current || !rocketRef.current) return;

    const container = containerRef.current;
    const rocket = rocketRef.current;
    const ROCKET_SIZE = 60;
    const SPEED = 0.8;
    const REENTRY_DELAY = 2000; // 2 seconds gap before reentry

    // Initialize position randomly
    const initPosition = () => {
      const containerRect = container.getBoundingClientRect();
      const edges = ['top', 'right', 'bottom', 'left'];
      const edge = edges[Math.floor(Math.random() * edges.length)];

      let x, y, vx, vy;

      switch (edge) {
        case 'top':
          x = Math.random() * containerRect.width;
          y = -ROCKET_SIZE;
          vx = (Math.random() - 0.5) * SPEED * 2;
          vy = SPEED + Math.random() * SPEED * 0.5;
          break;
        case 'right':
          x = containerRect.width + ROCKET_SIZE;
          y = Math.random() * containerRect.height;
          vx = -(SPEED + Math.random() * SPEED * 0.5);
          vy = (Math.random() - 0.5) * SPEED * 2;
          break;
        case 'bottom':
          x = Math.random() * containerRect.width;
          y = containerRect.height + ROCKET_SIZE;
          vx = (Math.random() - 0.5) * SPEED * 2;
          vy = -(SPEED + Math.random() * SPEED * 0.5);
          break;
        case 'left':
        default:
          x = -ROCKET_SIZE;
          y = Math.random() * containerRect.height;
          vx = SPEED + Math.random() * SPEED * 0.5;
          vy = (Math.random() - 0.5) * SPEED * 2;
          break;
      }

      positionRef.current = {
        x,
        y,
        vx,
        vy,
        angle: Math.atan2(vy, vx) * 180 / Math.PI + 90
      };
      isExitingRef.current = false;
    };

    const lerpAngle = (a: number, b: number, t: number) => {
      let diff = ((b - a + 540) % 360) - 180;
      return a + diff * t;
    };

    const checkIfOutOfBounds = () => {
      if (isExitingRef.current) return false;

      const containerRect = container.getBoundingClientRect();
      const { x, y } = positionRef.current;
      const margin = ROCKET_SIZE * 2;

      const outOfBounds =
        x < -margin ||
        x > containerRect.width + margin ||
        y < -margin ||
        y > containerRect.height + margin;

      if (outOfBounds) {
        isExitingRef.current = true;
        rocket.style.opacity = '0';

        // Schedule reentry
        reentryTimeoutRef.current = setTimeout(() => {
          initPosition();
          rocket.style.opacity = '1';
          rocket.style.transition = 'opacity 0.8s ease-in';
          setTimeout(() => {
            rocket.style.transition = '';
          }, 800);
        }, REENTRY_DELAY);

        return true;
      }
      return false;
    };

    let lastTime = performance.now();
    const animate = (time: number) => {
      if (isExitingRef.current) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const deltaTime = Math.min((time - lastTime) / 16.667, 3);
      lastTime = time;

      const pos = positionRef.current;
      pos.x += pos.vx * deltaTime;
      pos.y += pos.vy * deltaTime;

      const targetAngle = Math.atan2(pos.vy, pos.vx) * 180 / Math.PI + 90;
      pos.angle = lerpAngle(pos.angle, targetAngle, 0.08);

      rocket.style.transform = `translate(${pos.x}px, ${pos.y}px) rotate(${pos.angle}deg)`;

      checkIfOutOfBounds();

      animationRef.current = requestAnimationFrame(animate);
    };

    initPosition();
    rocket.style.transition = 'opacity 0.8s ease-in';
    rocket.style.opacity = '1';
    setTimeout(() => {
      rocket.style.transition = '';
    }, 800);

    animationRef.current = requestAnimationFrame(animate);

    // Handle window resize
    const handleResize = () => {
      if (isExitingRef.current) return;
      const containerRect = container.getBoundingClientRect();
      const { x, y } = positionRef.current;

      // If rocket is now out of bounds after resize, trigger exit
      if (x > containerRect.width || y > containerRect.height) {
        checkIfOutOfBounds();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (reentryTimeoutRef.current) clearTimeout(reentryTimeoutRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleRocketClick = () => {
    if (!rocketRef.current || isExitingRef.current) return;

    // Pick random quote
    const newQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    setCurrentQuote(newQuote);

    // Calculate bubble position
    const { x, y } = positionRef.current;
    const BUBBLE_WIDTH = 280;
    const BUBBLE_HEIGHT = 120;
    const GAP = 20;

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const spaceAbove = y;
    const spaceBelow = containerRect.height - y - 60;
    const placeAbove = spaceAbove > BUBBLE_HEIGHT + GAP || spaceAbove > spaceBelow;

    let bubbleX = x + 30 - BUBBLE_WIDTH / 2;
    bubbleX = Math.max(16, Math.min(bubbleX, containerRect.width - BUBBLE_WIDTH - 16));

    const bubbleY = placeAbove
      ? Math.max(16, y - BUBBLE_HEIGHT - GAP)
      : Math.min(containerRect.height - BUBBLE_HEIGHT - 16, y + 60 + GAP);

    setBubblePos({ x: bubbleX, y: bubbleY, above: placeAbove });
    setShowBubble(true);

    // Auto-hide after 4 seconds
    setTimeout(() => setShowBubble(false), 4000);
  };

  return (
    <>
      <div
        ref={containerRef}
        className="fixed inset-0 z-[1]"
        style={{ overflow: 'hidden', pointerEvents: 'none' }}
      >
        {/* Rocket */}
        <div
          ref={rocketRef}
          onClick={handleRocketClick}
          className="absolute cursor-pointer"
          style={{
            width: 60,
            height: 120,
            opacity: 0,
            transition: 'opacity 0.3s ease',
            pointerEvents: 'auto', // Enable pointer events only for the rocket
          }}
        >
          {/* Pulse ring on click */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-2 pointer-events-none opacity-0"
            style={{ borderColor: 'var(--blue)' }}
            key={showBubble ? 'pulse' : 'idle'}
          />

          <svg
            viewBox="0 0 120 240"
            className="w-full h-full drop-shadow-lg hover:drop-shadow-2xl transition-all duration-300"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(var(--blue-rgb), 0.4))',
            }}
          >
            <defs>
              <linearGradient id="ndscRocketHull" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--blue)" />
                <stop offset="50%" stopColor="var(--blue2)" />
                <stop offset="100%" stopColor="var(--blue)" stopOpacity="0.7" />
              </linearGradient>
              <linearGradient id="ndscRocketTrail" x1="0.5" y1="0" x2="0.5" y2="1">
                <stop offset="0%" stopColor="var(--blue)" stopOpacity="0.6" />
                <stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Exhaust trail */}
            <g className="animate-pulse" style={{ transformOrigin: '50% 85%' }}>
              <path
                d="M54,187 L66,187 L62,225 L58,225 Z"
                fill="url(#ndscRocketTrail)"
              />
            </g>

            {/* Rocket fins */}
            <path d="M47,147 C35,155 25,170 20,185 C32,183 43,174 50,160 Z" fill="var(--blue2)" opacity="0.8" />
            <path d="M73,147 C85,155 95,170 100,185 C88,183 77,174 70,160 Z" fill="var(--blue2)" opacity="0.8" />

            {/* Main hull */}
            <path
              d="M60,3
                 C50,3 42,37 40,65
                 L47,175
                 C47,181 51,186 56,189
                 L64,189
                 C69,186 73,181 73,175
                 L80,65
                 C78,37 70,3 60,3 Z"
              fill="url(#ndscRocketHull)"
              stroke="rgba(var(--blue-rgb), 0.3)"
              strokeWidth="1"
            />

            {/* Window */}
            <circle cx="60" cy="115" r="8" fill="rgba(0,0,0,0.3)" />
            <circle cx="60" cy="115" r="6" fill="rgba(var(--blue-rgb), 0.2)" />

            {/* Detail line */}
            <line x1="46" y1="115" x2="74" y2="115" stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
          </svg>
        </div>

        {/* Speech Bubble */}
        <div
          className="absolute px-5 py-4 rounded-2xl border max-w-[280px] transition-all duration-300 pointer-events-none"
          style={{
            left: `${bubblePos.x}px`,
            top: `${bubblePos.y}px`,
            background: 'rgba(var(--bg2-rgb, 5, 13, 26), 0.97)',
            borderColor: 'rgba(var(--blue-rgb), 0.35)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6), 0 0 24px rgba(var(--blue-rgb), 0.15)',
            opacity: showBubble ? 1 : 0,
            transform: showBubble ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(10px)',
          }}
        >
          {/* Tail */}
          <div
            className="absolute w-3 h-3 rotate-45"
            style={{
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              background: 'rgba(var(--bg2-rgb, 5, 13, 26), 0.97)',
              ...(bubblePos.above
                ? {
                    bottom: '-6px',
                    borderRightWidth: '1px',
                    borderRightStyle: 'solid',
                    borderRightColor: 'rgba(var(--blue-rgb), 0.35)',
                    borderBottomWidth: '1px',
                    borderBottomStyle: 'solid',
                    borderBottomColor: 'rgba(var(--blue-rgb), 0.35)',
                  }
                : {
                    top: '-6px',
                    borderLeftWidth: '1px',
                    borderLeftStyle: 'solid',
                    borderLeftColor: 'rgba(var(--blue-rgb), 0.35)',
                    borderTopWidth: '1px',
                    borderTopStyle: 'solid',
                    borderTopColor: 'rgba(var(--blue-rgb), 0.35)',
                  }
              ),
            }}
          />

          <p
            className="text-sm italic leading-relaxed mb-2"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--white)',
            }}
          >
            "{currentQuote.q}"
          </p>
          <p
            className="text-xs text-right"
            style={{
              color: 'var(--muted)',
              letterSpacing: '0.02em',
            }}
          >
            — {currentQuote.a}
          </p>
        </div>
      </div>
    </>
  );
}
