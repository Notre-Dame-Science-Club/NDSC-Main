"use client";

import { useRef, useState, MouseEvent, ReactNode } from "react";

interface Card3DProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  glowColor?: string;
  intensity?: number;
  onClick?: () => void;
}

export function Card3D({
  children,
  className = "",
  style = {},
  glowColor = "rgba(59, 130, 246, 0.4)",
  intensity = 1,
  onClick,
}: Card3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const card = cardRef.current;
    const rect = card.getBoundingClientRect();

    // Calculate mouse position relative to card center (-0.5 to 0.5)
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    // Apply 3D rotation based on mouse position
    const rotateY = x * 15 * intensity; // Max 15deg rotation on Y axis
    const rotateX = -y * 15 * intensity; // Max 15deg rotation on X axis (inverted)

    // Calculate light position for gradient effect
    const lightX = 50 + x * 50; // 0-100%
    const lightY = 50 + y * 50; // 0-100%

    // Apply transforms
    card.style.transform = `
      perspective(1000px)
      rotateX(${rotateX}deg)
      rotateY(${rotateY}deg)
      translateZ(10px)
      scale3d(1.02, 1.02, 1.02)
    `;

    // Dynamic glow effect that follows mouse
    card.style.boxShadow = `
      0 20px 40px rgba(0, 0, 0, 0.3),
      0 0 30px ${glowColor},
      ${x * 20}px ${y * 20}px 40px ${glowColor}
    `;

    // Update shine overlay position
    const shine = card.querySelector('.card-3d-shine') as HTMLElement;
    if (shine) {
      shine.style.background = `
        radial-gradient(
          circle at ${lightX}% ${lightY}%,
          rgba(255, 255, 255, 0.15) 0%,
          transparent 50%
        )
      `;
    }
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;

    const card = cardRef.current;

    // Reset transforms with smooth transition
    card.style.transform = `
      perspective(1000px)
      rotateX(0deg)
      rotateY(0deg)
      translateZ(0px)
      scale3d(1, 1, 1)
    `;

    card.style.boxShadow = 'none';

    // Reset shine
    const shine = card.querySelector('.card-3d-shine') as HTMLElement;
    if (shine) {
      shine.style.background = 'transparent';
    }

    setIsHovered(false);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  return (
    <div
      ref={cardRef}
      className={`card-3d-wrapper ${className}`}
      style={{
        ...style,
        transformStyle: "preserve-3d",
        transition: "transform 0.1s ease-out, box-shadow 0.3s ease",
        willChange: "transform",
        position: "relative",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      onClick={onClick}
    >
      {/* Shine overlay that follows mouse */}
      <div
        className="card-3d-shine pointer-events-none absolute inset-0 rounded-[inherit] transition-all duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          mixBlendMode: "overlay",
        }}
      />

      {/* Card content */}
      <div
        className="card-3d-content"
        style={{
          transform: "translateZ(20px)",
          transformStyle: "preserve-3d",
        }}
      >
        {children}
      </div>

      {/* 3D depth layers */}
      <div
        className="card-3d-layer pointer-events-none absolute inset-0 rounded-[inherit] border border-white/5"
        style={{
          transform: "translateZ(5px)",
          opacity: isHovered ? 0.6 : 0,
          transition: "opacity 0.3s ease",
        }}
      />
    </div>
  );
}

// Simpler variant for stats cards
export function StatCard3D({
  children,
  className = "",
  style = {},
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const card = cardRef.current;
    const rect = card.getBoundingClientRect();

    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    const rotateY = x * 8; // Gentler rotation for stats
    const rotateX = -y * 8;

    card.style.transform = `
      perspective(800px)
      rotateX(${rotateX}deg)
      rotateY(${rotateY}deg)
      translateZ(8px)
    `;

    card.style.boxShadow = `
      0 10px 30px rgba(0, 0, 0, 0.2),
      0 0 20px rgba(59, 130, 246, 0.2)
    `;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;

    const card = cardRef.current;
    card.style.transform = `
      perspective(800px)
      rotateX(0deg)
      rotateY(0deg)
      translateZ(0px)
    `;
    card.style.boxShadow = 'none';
  };

  return (
    <div
      ref={cardRef}
      className={className}
      style={{
        ...style,
        transformStyle: "preserve-3d",
        transition: "transform 0.1s ease-out, box-shadow 0.2s ease",
        transitionDelay: `${delay}s`,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
}
