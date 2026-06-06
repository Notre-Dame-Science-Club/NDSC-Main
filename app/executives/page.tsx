"use client";
import { useState, useEffect, useMemo, useRef } from "react";

/* ══════════════════════════════════════════════════════════════
   TYPE
══════════════════════════════════════════════════════════════ */
type Executive = {
  id: string;
  full_name: string;
  position: string;
  panel: string;
  dept: string;
  photo_url: string;
  facebook_url: string;
  linkedin_url: string;
  email: string;
  whatsapp: string;
  instagram_url: string;
  github_url: string;
  x_url: string;
  display_order: number;
  session_year: string;
  is_active: boolean;
};

/* ══════════════════════════════════════════════════════════════
   SOCIAL ICONS
══════════════════════════════════════════════════════════════ */
const FbIcon  = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>;
const IgIcon  = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>;
const LiIcon  = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>;
const WaIcon  = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.9-2-.9-.3-.1-.5-.1-.7.2-.2.3-.7.9-.8 1.1-.2.2-.3.2-.6 0-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.6c.1-.2.1-.3.2-.5 0-.2 0-.4-.1-.5-.1-.2-.6-1.6-.9-2.1-.2-.5-.5-.4-.7-.4h-.6c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.3.2-.7.2-1.2.1-1.4 0-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2z"/></svg>;
const MailIcon= () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>;
const GhIcon  = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>;
const XIcon   = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;

function getSocials(exec: Executive) {
  return [
    exec.facebook_url  && { href: exec.facebook_url,  icon: <FbIcon />,   color: "#1877f2", label: "Facebook"  },
    exec.instagram_url && { href: exec.instagram_url, icon: <IgIcon />,   color: "#e1306c", label: "Instagram" },
    exec.linkedin_url  && { href: exec.linkedin_url,  icon: <LiIcon />,   color: "#0a66c2", label: "LinkedIn"  },
    exec.github_url    && { href: exec.github_url,    icon: <GhIcon />,   color: "#e8f4ff", label: "GitHub"    },
    exec.x_url         && { href: exec.x_url,         icon: <XIcon />,    color: "#e8f4ff", label: "X"         },
    exec.whatsapp && {
      href: exec.whatsapp.startsWith("http") ? exec.whatsapp : `https://wa.me/${exec.whatsapp.replace(/\D/g,"")}`,
      icon: <WaIcon />, color: "#25d366", label: "WhatsApp",
    },
    exec.email && { href: `mailto:${exec.email}`, icon: <MailIcon />, color: "#00d4ff", label: "Email" },
  ].filter(Boolean) as { href: string; icon: React.ReactNode; color: string; label: string }[];
}

/* ══════════════════════════════════════════════════════════════
   MOVING GALAXY BACKGROUND
══════════════════════════════════════════════════════════════ */
function GalaxyBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;

    type Star = { x: number; y: number; r: number; a: number; twinkleSpeed: number; vx: number; vy: number };
    const stars: Star[] = [];

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = document.body.scrollHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 320; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.6 + 0.2,
        a: Math.random(),
        twinkleSpeed: Math.random() * 0.012 + 0.004,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
      });
    }

    let t = 0;
    const draw = () => {
      t++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Moving nebula blobs
      const nb1x = canvas.width  * (0.3 + 0.1 * Math.sin(t * 0.003));
      const nb1y = canvas.height * (0.2 + 0.05 * Math.cos(t * 0.002));
      const g1 = ctx.createRadialGradient(nb1x, nb1y, 0, nb1x, nb1y, canvas.width * 0.35);
      g1.addColorStop(0, "rgba(0,80,160,0.07)");
      g1.addColorStop(1, "transparent");
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const nb2x = canvas.width  * (0.7 + 0.08 * Math.cos(t * 0.0025));
      const nb2y = canvas.height * (0.6 + 0.06 * Math.sin(t * 0.0018));
      const g2 = ctx.createRadialGradient(nb2x, nb2y, 0, nb2x, nb2y, canvas.width * 0.28);
      g2.addColorStop(0, "rgba(0,40,100,0.05)");
      g2.addColorStop(1, "transparent");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Stars — move + twinkle
      stars.forEach(s => {
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < 0) s.x = canvas.width;
        if (s.x > canvas.width) s.x = 0;
        if (s.y < 0) s.y = canvas.height;
        if (s.y > canvas.height) s.y = 0;

        s.a = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.x));

        // Glow
        const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3.5);
        glow.addColorStop(0, `rgba(0,212,255,${s.a * 0.55})`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,230,255,${s.a * 0.9})`;
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
        opacity: 0.85,
      }}
    />
  );
}

/* ══════════════════════════════════════════════════════════════
   DETAIL POPUP
══════════════════════════════════════════════════════════════ */
function DetailPopup({ exec, onClose }: { exec: Executive; onClose: () => void }) {
  const socials = getSocials(exec);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9999] px-4"
      style={{ background: "rgba(0,4,12,0.88)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 760,
          borderRadius: 18,
          overflow: "hidden",
          background: "linear-gradient(135deg, #060f1e 0%, #0b1c33 100%)",
          border: "1px solid rgba(0,212,255,0.3)",
          boxShadow: "0 32px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,212,255,0.08), 0 0 60px rgba(0,212,255,0.06)",
          animation: "popupIn 0.28s cubic-bezier(.4,0,.2,1)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Glow top */}
        <div style={{ position:"absolute", top:0, left:0, right:0, height:1, background:"linear-gradient(90deg,transparent,#00d4ff,transparent)", opacity:0.6 }} />

        {/* Close */}
        <button onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
          style={{ background:"rgba(255,255,255,0.07)", color:"#cce8f4", border:"1px solid rgba(255,255,255,0.1)", fontSize:15 }}>
          ✕
        </button>

        {/* Session badge */}
        {exec.session_year && (
          <div style={{
            position:"absolute", top:16, left:16, zIndex:10,
            padding:"3px 12px", borderRadius:20,
            background:"rgba(0,212,255,0.12)", color:"#00d4ff",
            border:"1px solid rgba(0,212,255,0.3)",
            fontFamily:"'Orbitron',sans-serif", fontSize:11,
            letterSpacing:"0.06em", fontWeight:700,
          }}>
            {exec.session_year}
          </div>
        )}

        {/* NDSC logo blurred bg watermark */}
        <div style={{
          position:"absolute", inset:0, zIndex:1,
          display:"flex", alignItems:"center", justifyContent:"flex-end",
          paddingRight:"2rem", overflow:"hidden", pointerEvents:"none",
        }}>
          <img
            src="/images/ndsc-logo.png"
            alt=""
            style={{
              width: 260, height: 260,
              objectFit: "contain",
              opacity: 0.055,
              filter: "blur(3px)",
              transform: "rotate(-12deg)",
              userSelect: "none",
            }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </div>

        <div className="exec-popup-inner" style={{ display:"flex", flexDirection:"row", position:"relative", zIndex:2, flexWrap:"wrap" }}>
          {/* Photo */}
          <div className="exec-popup-photo" style={{ width:220, flexShrink:0, position:"relative", minHeight:280 }}>
            {exec.photo_url ? (
              <img src={exec.photo_url} alt={exec.full_name}
                style={{
                  position:"absolute", inset:0, width:"100%", height:"100%",
                  objectFit:"cover", objectPosition:"top",
                }} />
            ) : (
              <div style={{
                position:"absolute", inset:0,
                background:"linear-gradient(135deg,#0a1a30,#0f2a4a)",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <span style={{ fontSize:60, color:"rgba(0,212,255,0.15)" }}>👤</span>
              </div>
            )}
            {/* fade right edge */}
            <div style={{ position:"absolute", top:0, right:0, bottom:0, width:48,
              background:"linear-gradient(270deg,#060f1e,transparent)" }} />
          </div>

          {/* Info */}
          <div className="exec-popup-info" style={{
            flex:1, padding:"2rem 2rem 2rem 1.5rem",
            display:"flex", flexDirection:"column", justifyContent:"center", gap:6,
          }}>
            <h2 style={{
              fontFamily:"'Gilroy','Montserrat','Poppins',sans-serif",
              fontWeight:800,
              fontSize:"clamp(1.5rem,3.5vw,2.1rem)",
              color:"#ffffff", lineHeight:1.1, letterSpacing:"0.01em",
            }}>
              {exec.full_name}
            </h2>
            <p style={{
              fontFamily:"'Poppins',sans-serif", fontWeight:700,
              fontSize:"clamp(1rem,2.5vw,1.2rem)", color:"#00d4ff",
              letterSpacing:"0.01em",
            }}>
              {exec.position}
            </p>
            {exec.dept && (
              <p style={{ fontFamily:"'Poppins',sans-serif", fontSize:"0.88rem",
                color:"rgba(150,190,220,0.6)", marginBottom:4 }}>
                {exec.dept}
              </p>
            )}

            {/* Role description placeholder */}
            <p style={{
              fontFamily:"'Poppins',sans-serif", fontSize:"0.82rem",
              color:"rgba(140,180,210,0.45)", lineHeight:1.55,
              borderTop:"1px solid rgba(0,212,255,0.08)", paddingTop:10,
              marginTop:2,
            }}>
              {/* Add a `description` field to executives table to show here */}
              {(exec as any).description || ""}
            </p>

            {socials.length > 0 && (
              <div style={{ marginTop:8 }}>
                <p style={{
                  fontFamily:"'Orbitron',sans-serif", fontSize:10,
                  color:"rgba(90,130,160,0.55)", letterSpacing:"0.08em",
                  textTransform:"uppercase", marginBottom:8,
                }}>
                  Connect
                </p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {socials.map((s, i) => (
                    <a key={i} href={s.href} target="_blank" rel="noopener noreferrer"
                      title={s.label}
                      style={{
                        width:36, height:36, borderRadius:"50%",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        background:"rgba(255,255,255,0.06)",
                        border:"1px solid rgba(255,255,255,0.11)",
                        color:s.color, transition:"transform 0.2s, background 0.2s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform="scale(1.15)"; e.currentTarget.style.background=`${s.color}22`; }}
                      onMouseLeave={e => { e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.background="rgba(255,255,255,0.06)"; }}>
                      {s.icon}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes popupIn {
          from { opacity:0; transform:scale(0.93) translateY(18px); }
          to   { opacity:1; transform:scale(1)    translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   EC CARD — rectangular 3/4.5
   Photo: top 75%, FULLY VISIBLE, no overlay on photo
   Info:  bottom 25%, solid dark bg with name/pos/dept
══════════════════════════════════════════════════════════════ */
function ECCard({ exec, onClick }: { exec: Executive; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const socials = getSocials(exec);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "3 / 3.15",
        borderRadius: 18,
        overflow: "hidden",
        cursor: "pointer",
        background: "#060f1e",
        border: `1px solid ${hov ? "rgba(0,212,255,0.55)" : "rgba(0,212,255,0.13)"}`,
        boxShadow: hov
          ? "0 28px 70px rgba(0,0,0,0.7), 0 0 0 2px rgba(0,212,255,0.45), 0 0 50px rgba(0,212,255,0.22), 0 0 90px rgba(0,212,255,0.1)"
          : "0 8px 28px rgba(0,0,0,0.55)",
        transform: hov ? "translateY(-7px) scale(1.035)" : "none",
        transition: "all 0.32s cubic-bezier(.4,0,.2,1)",
      }}
    >
      {/* ── PHOTO SECTION — top 72% ── */}
      <div style={{ position:"absolute", top:0, left:0, right:0, bottom:"28%", overflow:"hidden" }}>
        {exec.photo_url ? (
          <img
            src={exec.photo_url}
            alt={exec.full_name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top center",
              display: "block",
              transform: hov ? "scale(1.05)" : "scale(1)",
              transition: "transform 0.65s ease",
            }}
          />
        ) : (
          <div style={{ width:"100%", height:"100%", background:"linear-gradient(160deg,#091828,#0e2540)",
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(0,212,255,0.18)" strokeWidth="1">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
        )}
        {/* Top hover glow line */}
        <div style={{
          position:"absolute", top:0, left:0, right:0, height:2,
          background:"linear-gradient(90deg,transparent,#00d4ff,transparent)",
          opacity: hov ? 1 : 0, transition:"opacity 0.4s",
        }} />
      </div>

      {/* ── INFO SECTION — bottom 28% — solid dark bg ── */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: "28%",
        background: "linear-gradient(180deg, #060f1e 0%, #040c18 100%)",
        borderTop: `1px solid ${hov ? "rgba(0,212,255,0.25)" : "rgba(0,212,255,0.07)"}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0.3rem 0.4rem",
        transition: "border-color 0.3s",
        overflow: "hidden",
      }}>

        {/* SOCIALS — shown on hover, replaces name/post/dept */}
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          opacity: hov ? 1 : 0,
          transform: hov ? "translateY(0)" : "translateY(8px)",
          transition: "all 0.3s ease",
          pointerEvents: hov ? "auto" : "none",
          padding: "0.3rem",
        }}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:5, justifyContent:"center" }}>
            {socials.map((s, i) => (
              <a key={i} href={s.href} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{
                  width: 26, height: 26, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  color: s.color,
                  transition: "transform 0.2s, background 0.2s",
                  flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.2)"; e.currentTarget.style.background = `${s.color}22`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}>
                <span style={{ transform:"scale(0.85)", display:"flex" }}>{s.icon}</span>
              </a>
            ))}
          </div>
        </div>

        {/* NAME + POST + DEPT group — hidden on hover */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          opacity: hov ? 0 : 1,
          transform: hov ? "translateY(-6px)" : "translateY(0)",
          transition: "all 0.3s ease",
          pointerEvents: hov ? "none" : "auto",
          gap: 1,
        }}>
          {/* Name */}
          <div className="exec-card-name" style={{
            width: "83%",
            textAlign: "center",
            fontFamily: "'Gilroy','Montserrat','Poppins',sans-serif",
            fontWeight: 800,
            fontSize: "clamp(1.1rem, 2.8vw, 1.6rem)",
            color: "#ffffff",
            lineHeight: 1.2,
            letterSpacing: "0.01em",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            maxWidth: "95%",
            whiteSpace: "normal",
          }}>
            {exec.full_name}
          </div>

          {/* Position — 93% of name size */}
          <div className="exec-card-pos" style={{
            width: "95%",
            textAlign: "center",
            fontFamily: "'Poppins',sans-serif",
            fontWeight: 700,
            fontSize: "clamp(0.98rem, 2.5vw, 1.49rem)",
            color: "#00d4ff",
            lineHeight: 1.2,
            letterSpacing: "0.01em",
            textShadow: "0 0 10px rgba(0,212,255,0.35)",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            maxWidth: "95%",
            whiteSpace: "normal",
          }}>
            {exec.position}
          </div>

          {/* Dept — 92% of position size, forced single line with ellipsis */}
          {exec.dept && (
            <div className="exec-card-dept" style={{
              width: "95%",
              textAlign: "center",
              fontFamily: "'Poppins',sans-serif",
              fontWeight: 400,
              fontSize: "clamp(0.82rem, 2vw, 1.37rem)",
              color: "rgba(130,175,210,0.6)",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "95%",
            }}>
              {exec.dept}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SESSION SELECTOR
   Arrow → = go toward newer (lower index in desc-sorted array)
   Arrow ← = go toward older (higher index)
   Click on year pill → show that session
   Arrow scrolls which pills are visible (window of 4)
══════════════════════════════════════════════════════════════ */
function SessionSelector({
  years,
  selected,
  onSelect,
}: { years: string[]; selected: string; onSelect: (y: string) => void }) {
  // years sorted desc: index 0 = newest
  const [windowStart, setWindowStart] = useState(0);
  const WINDOW = 4;
  const totalYears = years.length;

  // touch / trackpad state
  const touchStartX = useRef(0);
  const touchLastX  = useRef(0);
  const wheelAcc    = useRef(0);
  const wheelTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canGoNewer = windowStart > 0;
  const canGoOlder = windowStart + WINDOW < totalYears;
  const visibleYears = years.slice(windowStart, windowStart + WINDOW);

  const shiftWindow = (dir: "newer" | "older") => {
    if (dir === "newer" && canGoNewer) setWindowStart(w => Math.max(0, w - 1));
    if (dir === "older" && canGoOlder) setWindowStart(w => Math.min(totalYears - WINDOW, w + 1));
  };

  useEffect(() => {
    const idx = years.indexOf(selected);
    if (idx < windowStart) setWindowStart(idx);
    else if (idx >= windowStart + WINDOW) setWindowStart(Math.max(0, idx - WINDOW + 1));
  }, [selected, years, windowStart]);

  if (years.length === 0) return null;

  /* ── touch handlers ── */
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchLastX.current  = e.touches[0].clientX;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    touchLastX.current = e.touches[0].clientX;
  };
  const onTouchEnd = () => {
    const delta = touchStartX.current - touchLastX.current;
    if (Math.abs(delta) > 40) {
      // swipe left (finger moves left) = go older; swipe right = go newer
      if (delta > 0) shiftWindow("older");
      else            shiftWindow("newer");
    }
  };

  /* ── wheel / trackpad horizontal scroll ── */
  const onWheel = (e: React.WheelEvent) => {
    // horizontal trackpad OR Ctrl+wheel (pinch treated as zoom on some devices — skip)
    const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (!horizontal && !e.ctrlKey) return;
    e.preventDefault();
    const delta = e.ctrlKey ? e.deltaY : e.deltaX;
    wheelAcc.current += delta;
    if (wheelTimer.current) clearTimeout(wheelTimer.current);
    wheelTimer.current = setTimeout(() => { wheelAcc.current = 0; }, 300);
    if (Math.abs(wheelAcc.current) > 60) {
      if (wheelAcc.current > 0) shiftWindow("older");
      else                       shiftWindow("newer");
      wheelAcc.current = 0;
    }
  };

  const ArrowBtn = ({ dir }: { dir: "newer" | "older" }) => {
    const disabled = dir === "newer" ? !canGoNewer : !canGoOlder;
    return (
      <button
        onClick={() => shiftWindow(dir)}
        disabled={disabled}
        style={{
          width: 40, height: 40, borderRadius: "50%",
          border: `1px solid ${disabled ? "rgba(255,255,255,0.07)" : "rgba(0,212,255,0.4)"}`,
          background: disabled ? "rgba(255,255,255,0.02)" : "rgba(0,212,255,0.08)",
          color: disabled ? "rgba(255,255,255,0.18)" : "#00d4ff",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, flexShrink: 0, transition: "all 0.2s",
        }}
        onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.2)"; }}
        onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.08)"; }}
      >
        {dir === "newer" ? "←" : "→"}
      </button>
    );
  };

  return (
    <div
      style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:28, userSelect:"none" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
    >
      {/* ← newer */}
      <ArrowBtn dir="newer" />

      <div style={{ display:"flex", gap:8 }}>
        {visibleYears.map(y => (
          <button key={y} onClick={() => onSelect(y)}
            style={{
              padding: "8px 16px",
              borderRadius: 12,
              border: `1px solid ${selected === y ? "rgba(0,212,255,0.65)" : "rgba(255,255,255,0.08)"}`,
              background: selected === y
                ? "linear-gradient(135deg,rgba(0,212,255,0.22),rgba(0,100,190,0.18))"
                : "rgba(255,255,255,0.03)",
              color: selected === y ? "#00d4ff" : "rgba(160,195,215,0.5)",
              fontFamily: "'Poppins',sans-serif",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
              boxShadow: selected === y ? "0 0 18px rgba(0,212,255,0.18)" : "none",
              transform: selected === y ? "scale(1.06)" : "scale(1)",
              transition: "all 0.22s ease",
              whiteSpace: "nowrap",
            }}>
            {y}
          </button>
        ))}
      </div>

      {/* → older */}
      <ArrowBtn dir="older" />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CROSS-SESSION FILTER PANEL
   Special feature: filter by position across ALL sessions
   with optional year range restriction
══════════════════════════════════════════════════════════════ */
type CrossFilter = {
  position: string;
  dept: string;
  yearFrom: string;
  yearTo: string;
};

function CrossSessionFilter({
  executives,
  allYears,
  onResults,
  onClose,
}: {
  executives: Executive[];
  allYears: string[];
  onResults: (list: Executive[]) => void;
  onClose: () => void;
}) {
  const [cf, setCf] = useState<CrossFilter>({ position:"all", dept:"all", yearFrom:"all", yearTo:"all" });

  const allPositions = useMemo(() => {
    const s = new Set(executives.filter(e => e.panel === "committee").map(e => e.position));
    return ["all", ...Array.from(s).sort()];
  }, [executives]);

  const allDepts = useMemo(() => {
    const s = new Set(executives.filter(e => e.panel === "committee" && e.dept).map(e => e.dept));
    return ["all", ...Array.from(s).sort()];
  }, [executives]);

  const apply = () => {
    let list = executives.filter(e => e.panel === "committee");
    if (cf.position !== "all") list = list.filter(e => e.position === cf.position);
    if (cf.dept !== "all") list = list.filter(e => e.dept === cf.dept);
    if (cf.yearFrom !== "all") list = list.filter(e => e.session_year >= cf.yearFrom);
    if (cf.yearTo   !== "all") list = list.filter(e => e.session_year <= cf.yearTo);
    // Sort: newest session first, then display_order
    list.sort((a, b) => b.session_year.localeCompare(a.session_year) || a.display_order - b.display_order);
    onResults(list);
  };

  const sel = (field: keyof CrossFilter, val: string) => setCf(prev => ({ ...prev, [field]: val }));

  const sty = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(0,212,255,0.2)",
    color: "#c8e8f8",
    borderRadius: 10,
    padding: "9px 14px",
    fontFamily: "'Poppins',sans-serif",
    fontSize: 13,
    outline: "none",
    width: "100%",
  };

  return (
    <div style={{
      background: "linear-gradient(135deg,#060f1e,#091828)",
      border: "1px solid rgba(0,212,255,0.25)",
      borderRadius: 16,
      padding: "1.5rem",
      marginBottom: "1.5rem",
      boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
      position: "relative",
    }}>
      <button onClick={onClose} style={{ position:"absolute", top:14, right:14, background:"none", border:"none",
        color:"rgba(0,212,255,0.5)", fontSize:18, cursor:"pointer" }}>✕</button>

      <p style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:13,
        color:"#00d4ff", marginBottom:"1rem", letterSpacing:"0.05em", textTransform:"uppercase" }}>
        🔍 Search Across All Sessions
      </p>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12 }}>
        <div>
          <label style={{ fontFamily:"'Poppins',sans-serif", fontSize:11, color:"rgba(0,212,255,0.6)",
            display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>
            Position
          </label>
          <select aria-label="Filter by position" value={cf.position} onChange={e => sel("position", e.target.value)} style={sty}>
            {allPositions.map(p => <option key={p} value={p} style={{ background:"#060f1e" }}>{p === "all" ? "All Positions" : p}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontFamily:"'Poppins',sans-serif", fontSize:11, color:"rgba(0,212,255,0.6)",
            display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>
            Department
          </label>
          <select aria-label="Filter by department" value={cf.dept} onChange={e => sel("dept", e.target.value)} style={sty}>
            {allDepts.map(d => <option key={d} value={d} style={{ background:"#060f1e" }}>{d === "all" ? "All Depts" : d}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontFamily:"'Poppins',sans-serif", fontSize:11, color:"rgba(0,212,255,0.6)",
            display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>
            From Session
          </label>
          <select aria-label="From session year" value={cf.yearFrom} onChange={e => sel("yearFrom", e.target.value)} style={sty}>
            <option value="all" style={{ background:"#060f1e" }}>All Time</option>
            {[...allYears].reverse().map(y => <option key={y} value={y} style={{ background:"#060f1e" }}>{y}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontFamily:"'Poppins',sans-serif", fontSize:11, color:"rgba(0,212,255,0.6)",
            display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>
            To Session
          </label>
          <select aria-label="To session year" value={cf.yearTo} onChange={e => sel("yearTo", e.target.value)} style={sty}>
            <option value="all" style={{ background:"#060f1e" }}>Present</option>
            {allYears.map(y => <option key={y} value={y} style={{ background:"#060f1e" }}>{y}</option>)}
          </select>
        </div>
      </div>

      <button
        onClick={apply}
        style={{
          marginTop: "1rem",
          padding: "10px 28px",
          borderRadius: 10,
          background: "linear-gradient(135deg,#00b8e0,#0077aa)",
          color: "#fff",
          fontFamily: "'Poppins',sans-serif",
          fontWeight: 700,
          fontSize: 13,
          border: "none",
          cursor: "pointer",
          letterSpacing: "0.04em",
          boxShadow: "0 4px 20px rgba(0,212,255,0.25)",
        }}
      >
        Apply Filter
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MODERATOR CARD — circle photo, Gilroy font, big
══════════════════════════════════════════════════════════════ */
function ModCard({ exec, onClick }: { exec: Executive; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  // All same size — big
  const imgSize = 200;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        cursor: "pointer",
        width: 240,
        transition: "transform 0.3s ease",
        transform: hov ? "translateY(-6px)" : "none",
      }}
    >
      {/* Circle photo */}
      <div style={{
        width: imgSize,
        height: imgSize,
        borderRadius: "50%",
        overflow: "hidden",
        border: `3px solid ${hov ? "#00d4ff" : "rgba(0,212,255,0.3)"}`,
        boxShadow: hov
          ? "0 0 36px rgba(0,212,255,0.5), 0 0 72px rgba(0,212,255,0.18), 0 8px 30px rgba(0,0,0,0.5)"
          : "0 4px 24px rgba(0,0,0,0.45)",
        transition: "all 0.32s ease",
        flexShrink: 0,
        marginBottom: "1.1rem",
      }}>
        {exec.photo_url ? (
          <img src={exec.photo_url} alt={exec.full_name}
            style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"top",
              transform: hov ? "scale(1.06)" : "scale(1)", transition:"transform 0.5s ease" }} />
        ) : (
          <div style={{ width:"100%", height:"100%", background:"linear-gradient(135deg,#0a1a30,#0f2a4a)",
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize: imgSize*0.38, color:"rgba(0,212,255,0.18)" }}>👤</span>
          </div>
        )}
      </div>

      {/* Name */}
      <h3 style={{
        fontFamily: "'Gilroy','Montserrat','Poppins',sans-serif",
        fontWeight: 800,
        fontSize: "clamp(1.1rem,2.8vw,1.4rem)",
        color: hov ? "#ffffff" : "#e4f2ff",
        textAlign: "center",
        lineHeight: 1.15,
        letterSpacing: "0.02em",
        marginBottom: "0.35rem",
        transition: "color 0.25s",
        textShadow: hov ? "0 0 24px rgba(0,212,255,0.35)" : "none",
      }}>
        {exec.full_name}
      </h3>

      {/* Position */}
      <p style={{
        fontFamily: "'Poppins',sans-serif",
        fontWeight: 700,
        fontSize: "clamp(0.82rem,2vw,1rem)",
        color: "#00d4ff",
        textAlign: "center",
        marginBottom: exec.dept ? "0.18rem" : 0,
        letterSpacing: "0.01em",
      }}>
        {exec.position}
      </p>

      {exec.dept && (
        <p style={{
          fontFamily: "'Poppins',sans-serif",
          fontSize: "clamp(0.7rem,1.6vw,0.82rem)",
          color: "rgba(140,185,215,0.55)",
          textAlign: "center",
        }}>
          {exec.dept}
        </p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function ExecutivesPage() {
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"committee" | "moderators">("committee");
  const [selectedYear, setSelectedYear] = useState("");
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("all");
  const [showCrossFilter, setShowCrossFilter] = useState(false);
  const [crossResults, setCrossResults] = useState<Executive[] | null>(null);
  const [popup, setPopup] = useState<Executive | null>(null);

  useEffect(() => {
    fetch("/api/admin/executives")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          const active = d.filter((e: Executive) => e.is_active);
          setExecutives(active);
          const years = [...new Set(
            active.filter((e: Executive) => e.panel === "committee").map((e: Executive) => e.session_year)
          )].sort((a, b) => b.localeCompare(a));
          if (years.length > 0) setSelectedYear(years[0]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // All committee session years sorted desc
  const committeeYears = useMemo(() =>
    [...new Set(executives.filter(e => e.panel === "committee").map(e => e.session_year))]
      .sort((a, b) => b.localeCompare(a)),
    [executives]
  );

  // Dept list for current session
  const deptList = useMemo(() => {
    const all = executives
      .filter(e => e.panel === "committee" && e.session_year === selectedYear && e.dept)
      .map(e => e.dept);
    return ["all", ...Array.from(new Set(all))];
  }, [executives, selectedYear]);

  // Normal session search
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return executives.filter(e =>
      e.panel === "committee" &&
      e.session_year === selectedYear &&
      (e.full_name.toLowerCase().includes(q) ||
       e.position.toLowerCase().includes(q) ||
       (e.dept && e.dept.toLowerCase().includes(q)))
    );
  }, [search, executives, selectedYear]);

  // Normal committee members for current session
  const committeeMembers = useMemo(() => {
    let list = executives
      .filter(e => e.panel === "committee" && e.session_year === selectedYear)
      .sort((a, b) => a.display_order - b.display_order);
    if (filterDept !== "all") list = list.filter(e => e.dept === filterDept);
    return list;
  }, [executives, selectedYear, filterDept]);

  // What to display
  const displayList = crossResults !== null
    ? crossResults
    : search.trim()
      ? searchResults
      : committeeMembers;

  // Moderators
  const currentModerators = useMemo(() =>
    executives.filter(e => e.panel === "moderators" && e.is_active)
      .sort((a, b) => a.display_order - b.display_order),
    [executives]
  );
  const formerModerators = useMemo(() =>
    executives.filter(e => e.panel === "former_moderators")
      .sort((a, b) => a.display_order - b.display_order),
    [executives]
  );

  return (
    <div className="exec-page-root" style={{ minHeight:"100vh", paddingTop:72, background:"var(--bg)", position:"relative" }}>
      {/* Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800;900&family=Montserrat:wght@700;800;900&family=Orbitron:wght@700;900&display=swap" rel="stylesheet" />

      <style>{`
        @font-face {
          font-family: 'Gilroy';
          src: url('https://db.onlinewebfonts.com/t/bd86c5e428d0bdc2ddc2c3b36ee5b9aa.woff2') format('woff2');
          font-weight: 800;
          font-display: swap;
        }

        /* Exact column counts */
        .exec-grid {
          display: grid;
          gap: 1.4rem;
          grid-template-columns: repeat(3, 1fr);
        }
        @media (max-width: 639px) {
          .exec-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }
          /* Mobile: name 2× desktop base, post 1.2× */
          .exec-card-name {
            font-size: clamp(2rem, 7vw, 2.8rem) !important;
          }
          .exec-card-pos {
            font-size: clamp(1.6rem, 5.5vw, 2.3rem) !important;
          }
          .exec-card-dept {
            font-size: clamp(1.3rem, 4.5vw, 1.9rem) !important;
          }
        }
        @media (min-width: 640px) and (max-width: 1023px) {
          .exec-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        /* Mobile navbar fix: ensure page doesn't overflow horizontally */
        @media (max-width: 639px) {
          body { overflow-x: hidden; }
          .exec-page-root { padding-left: 0 !important; padding-right: 0 !important; }
          .exec-page-inner { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
          /* Popup on mobile: stack vertically */
          .exec-popup-inner { flex-direction: column !important; }
          .exec-popup-photo { width: 100% !important; min-height: 200px !important; }
          .exec-popup-info  { padding: 1.2rem !important; }
        }

        @keyframes fadeUp {
          from { opacity:0; transform:translateY(22px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
      `}</style>

      <GalaxyBg />

      <div style={{ position:"relative", zIndex:10 }}>

        {/* ── Top Tab Buttons ── */}
        <div style={{ display:"flex", justifyContent:"center", gap:12, paddingTop:40, paddingBottom:4, paddingLeft:16, paddingRight:16 }}>
          {([
            { id:"committee",  label:"Executive Committee" },
            { id:"moderators", label:"Chief Patron & Moderators" },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setActiveView(t.id)}
              style={{
                padding: "10px 22px",
                borderRadius: 14,
                border: `1px solid ${activeView === t.id ? "rgba(0,212,255,0.55)" : "rgba(255,255,255,0.08)"}`,
                background: activeView === t.id ? "rgba(0,212,255,0.14)" : "rgba(255,255,255,0.03)",
                color: activeView === t.id ? "#00d4ff" : "rgba(150,190,215,0.45)",
                fontFamily: "'Poppins',sans-serif",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                letterSpacing: "0.03em",
                boxShadow: activeView === t.id ? "0 0 22px rgba(0,212,255,0.14)" : "none",
                transition: "all 0.22s",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Page Title ── */}
        <div style={{ textAlign:"center", padding:"1.5rem 1rem 0.5rem" }}>
          <h1 style={{
            fontFamily: "'Gilroy','Montserrat','Poppins',sans-serif",
            fontWeight: 800,
            fontSize: "clamp(1.9rem,5.5vw,3.4rem)",
            letterSpacing: "0.04em",
            lineHeight: 1.1,
            color: "#ffffff",
            textShadow: "0 0 50px rgba(0,212,255,0.18)",
          }}>
            {activeView === "committee"
              ? <>Meet the Executive <span style={{ color:"#00d4ff" }}>Committee</span></>
              : <>Meet the Chief Patron, Founder <span style={{ color:"#00d4ff" }}>&amp; Moderators</span></>
            }
          </h1>
          <p style={{ marginTop:8, fontFamily:"'Poppins',sans-serif", fontSize:13,
            color:"rgba(130,175,205,0.5)" }}>
            {activeView === "committee"
              ? "The dedicated team steering Notre Dame Science Club forward."
              : "The visionaries and guardians who have shaped the legacy of NDSC."
            }
          </p>
        </div>

        {/* ══ COMMITTEE VIEW ══════════════════════════════════════ */}
        {activeView === "committee" && (
          <div className="exec-page-inner" style={{ maxWidth:1200, margin:"0 auto", padding:"1.5rem 1.25rem 5rem" }}>

            {/* Session Selector */}
            {!loading && committeeYears.length > 0 && !crossResults && (
              <SessionSelector
                years={committeeYears}
                selected={selectedYear}
                onSelect={y => { setSelectedYear(y); setFilterDept("all"); setSearch(""); }}
              />
            )}

            {/* Cross Session Filter Panel */}
            {showCrossFilter && (
              <CrossSessionFilter
                executives={executives}
                allYears={committeeYears}
                onResults={res => { setCrossResults(res); setShowCrossFilter(false); }}
                onClose={() => setShowCrossFilter(false)}
              />
            )}

            {/* Search + Filters Row */}
            {!crossResults && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:20, alignItems:"center" }}>
                {/* Search */}
                <div style={{ position:"relative", flex:"1 1 220px", maxWidth:360 }}>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search in this session..."
                    style={{
                      width:"100%", padding:"10px 16px 10px 38px",
                      borderRadius:12, outline:"none",
                      background:"rgba(255,255,255,0.04)",
                      border:"1px solid rgba(255,255,255,0.09)",
                      color:"#cce8f8",
                      fontFamily:"'Poppins',sans-serif", fontSize:13,
                    }}
                  />
                  <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)",
                    fontSize:13, color:"rgba(0,212,255,0.45)" }}>🔍</span>
                  {search && (
                    <button onClick={() => setSearch("")}
                      style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
                        background:"none", border:"none", color:"rgba(200,220,235,0.35)", cursor:"pointer" }}>
                      ✕
                    </button>
                  )}
                </div>

                {/* Dept Filter for current session */}
                {deptList.length > 2 && (
                  <select aria-label="Filter by department" value={filterDept} onChange={e => setFilterDept(e.target.value)}
                    style={{
                      padding:"10px 14px", borderRadius:12,
                      background:"rgba(255,255,255,0.04)",
                      border:`1px solid ${filterDept !== "all" ? "rgba(0,212,255,0.45)" : "rgba(255,255,255,0.09)"}`,
                      color: filterDept !== "all" ? "#00d4ff" : "rgba(150,190,215,0.5)",
                      fontFamily:"'Poppins',sans-serif", fontSize:13, outline:"none",
                    }}>
                    {deptList.map(d => <option key={d} value={d} style={{ background:"#060f1e" }}>{d === "all" ? "All Departments" : d}</option>)}
                  </select>
                )}

                {/* Cross-session search button */}
                <button
                  onClick={() => { setShowCrossFilter(true); setCrossResults(null); setSearch(""); }}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 12,
                    background: "linear-gradient(135deg,rgba(0,212,255,0.12),rgba(0,100,180,0.1))",
                    border: "1px solid rgba(0,212,255,0.4)",
                    color: "#00d4ff",
                    fontFamily: "'Poppins',sans-serif",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    letterSpacing: "0.03em",
                    whiteSpace: "nowrap",
                  }}>
                  🌐 All Sessions
                </button>
              </div>
            )}

            {/* Cross results banner */}
            {crossResults !== null && (
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20,
                padding:"10px 16px", borderRadius:12,
                background:"rgba(0,212,255,0.08)", border:"1px solid rgba(0,212,255,0.25)" }}>
                <span style={{ fontFamily:"'Poppins',sans-serif", fontSize:13, color:"#00d4ff", fontWeight:700 }}>
                  🌐 Showing {crossResults.length} results across all sessions
                </span>
                <button onClick={() => { setCrossResults(null); setSearch(""); }}
                  style={{ marginLeft:"auto", background:"none", border:"none",
                    color:"rgba(0,212,255,0.6)", cursor:"pointer", fontSize:13 }}>
                  Clear ✕
                </button>
              </div>
            )}

            {/* Cards */}
            {loading ? (
              <div style={{ textAlign:"center", padding:"6rem 0", color:"rgba(0,212,255,0.4)", fontFamily:"'Poppins',sans-serif" }}>
                Loading...
              </div>
            ) : displayList.length === 0 ? (
              <div style={{ textAlign:"center", padding:"6rem 0", color:"rgba(150,190,215,0.3)", fontFamily:"'Poppins',sans-serif" }}>
                <div style={{ fontSize:44, marginBottom:12 }}>👥</div>
                {search.trim() ? "No results found." : "No executives for this session yet."}
              </div>
            ) : (
              <div className="exec-grid">
                {displayList.map((exec, i) => (
                  <div key={exec.id} style={{ animation:`fadeUp 0.38s ease both`, animationDelay:`${Math.min(i,12)*0.042}s` }}>
                    <ECCard exec={exec} onClick={() => setPopup(exec)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ MODERATORS VIEW ════════════════════════════════════ */}
        {activeView === "moderators" && (
          <div style={{ maxWidth:900, margin:"0 auto", padding:"2rem 1.25rem 5rem" }}>
            {loading ? (
              <div style={{ textAlign:"center", padding:"6rem 0", color:"rgba(0,212,255,0.4)", fontFamily:"'Poppins',sans-serif" }}>Loading...</div>
            ) : (
              <>
                {currentModerators.length > 0 ? (
                  <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:"3rem 4rem", marginBottom:"3rem" }}>
                    {currentModerators.map(exec => (
                      <ModCard key={exec.id} exec={exec} onClick={() => setPopup(exec)} />
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign:"center", padding:"5rem 0", color:"rgba(150,190,215,0.3)", fontFamily:"'Poppins',sans-serif" }}>
                    <div style={{ fontSize:44, marginBottom:12 }}>👥</div>No moderators added yet.
                  </div>
                )}

                {formerModerators.length > 0 && (
                  <>
                    <div style={{
                      textAlign:"center",
                      borderTop:"1px solid rgba(0,212,255,0.1)",
                      paddingTop:"3rem",
                      marginBottom:"2.5rem",
                    }}>
                      <h2 style={{
                        fontFamily:"'Gilroy','Montserrat','Poppins',sans-serif",
                        fontWeight:800,
                        fontSize:"clamp(1.4rem,4vw,2.2rem)",
                        color:"rgba(160,200,225,0.75)",
                        letterSpacing:"0.05em",
                      }}>
                        Former Moderators
                      </h2>
                      <p style={{ marginTop:6, fontFamily:"'Poppins',sans-serif", fontSize:13,
                        color:"rgba(120,160,190,0.4)" }}>
                        Those who have guided us through the years
                      </p>
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:"3rem 4rem" }}>
                      {formerModerators.map(exec => (
                        <ModCard key={exec.id} exec={exec} onClick={() => setPopup(exec)} />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {popup && <DetailPopup exec={popup} onClose={() => setPopup(null)} />}
    </div>
  );
}
