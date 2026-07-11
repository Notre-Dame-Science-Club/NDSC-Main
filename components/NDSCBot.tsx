"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRobot, faTimes, faPaperPlane } from "@fortawesome/free-solid-svg-icons";

const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL ||
  "https://ndsc-ai-bot.foysalmahmud1627.workers.dev/chat";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "About NDSC?",
  "Departments of NDSC",
  "How to become a member?",
  "What is AUDRI?",
  "Current leadership and Developers?",
  "History of NDSC?",
  "Achievements?",
];

const BOT_ICON = <FontAwesomeIcon icon={faRobot} />;

// ── Convert **bold** markdown → <strong> and preserve newlines ──
function parseMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
}

/* ── Typing dots ── */
function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center", height: 16 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 5, height: 5, borderRadius: "50%",
            background: "var(--blue)",
            display: "inline-block",
            animation: `ndscBotDot 1.1s ease-in-out ${i * 0.18}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

/* ── Blinking cursor shown while streaming ── */
function StreamCursor() {
  return (
    <span style={{
      display: "inline-block",
      width: 2, height: "1em",
      background: "var(--blue, #00d4ff)",
      marginLeft: 2,
      verticalAlign: "text-bottom",
      animation: "ndscCursorBlink 0.7s step-end infinite",
    }} />
  );
}

/* ── Message bubble ── */
function Bubble({ msg, streaming }: { msg: Msg; streaming?: boolean }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 10,
    }}>
      {!isUser && (
        <div style={{
          width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
          background: "rgba(0,212,255,0.15)",
          border: "1px solid rgba(0,212,255,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginRight: 8, marginTop: 2,
          fontSize: 11, color: "var(--blue)",
          fontFamily: "'Share Tech Mono',monospace",
        }}>{BOT_ICON}</div>
      )}
      <div style={{
        maxWidth: "78%",
        padding: "9px 13px",
        borderRadius: isUser ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
        background: isUser ? "rgba(0,212,255,0.18)" : "rgba(255,255,255,0.04)",
        border: isUser
          ? "1px solid rgba(0,212,255,0.4)"
          : "1px solid rgba(255,255,255,0.08)",
        fontSize: 13,
        lineHeight: 1.65,
        color: "var(--white, #f0f6ff)",
        fontFamily: "'Poppins',sans-serif",
        wordBreak: "break-word",
      }}>
        {isUser ? (
          <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
        ) : (
          <>
            <span
              dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
              style={{ display: "inline" }}
            />
            {streaming && <StreamCursor />}
          </>
        )}
      </div>
    </div>
  );
}

export default function NDSCBot() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "I am NDSC's AI Assistant. Ask me anything about Notre Dame Science Club!" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Msg = { role: "user", content: trimmed };
    setMsgs((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Build history to send (last 10 messages + new user msg)
    const historyToSend = [...msgs, userMsg]
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyToSend }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const contentType = res.headers.get("content-type") || "";

      // ── SSE streaming path ──
      if (contentType.includes("text/event-stream")) {
        // Add empty assistant bubble to stream into
        setMsgs((prev) => [...prev, { role: "assistant", content: "" }]);
        setLoading(false);
        setStreaming(true);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine === "data: [DONE]") continue;
            if (trimmedLine.startsWith("data: ")) {
              try {
                const payload = JSON.parse(trimmedLine.slice(6));
                if (payload.token) {
                  fullText += payload.token;
                  setMsgs((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      role: "assistant",
                      content: fullText,
                    };
                    return updated;
                  });
                  await new Promise((r) => setTimeout(r, 18));
                }
              } catch (_) {}
            }
          }
        }

        setStreaming(false);

      // ── Fallback: plain JSON path (non-streaming models) ──
      } else {
        const data = await res.json();
        const reply = data.reply || data.content || "Sorry, no response received.";
        setMsgs((prev) => [...prev, { role: "assistant", content: reply }]);
        setLoading(false);
      }

    } catch (_) {
      setMsgs((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again shortly." },
      ]);
      setLoading(false);
      setStreaming(false);
    }
  }, [loading, msgs]);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  return (
    <>
      <style>{`
        @keyframes ndscBotDot{0%,80%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}
        @keyframes ndscBotFadeIn{from{opacity:0;transform:translateY(18px) scale(.96)}to{opacity:1;transform:none}}
        @keyframes ndscBotPulseRing{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.55);opacity:0}}
        @keyframes ndscCursorBlink{0%,100%{opacity:1}50%{opacity:0}}
        .ndsc-bubble-bot strong{color:#93c5fd;font-weight:600}
      `}</style>

      {/* ════ FLOATING BUTTON ════ */}
      <div style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 1002,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10,
      }}>
        {!open && (
          <div style={{
            position: "absolute", bottom: 0, right: 0,
            width: 56, height: 56, borderRadius: "50%",
            border: "2px solid rgba(0,212,255,0.6)",
            animation: "ndscBotPulseRing 1.8s ease-out infinite",
            pointerEvents: "none",
          }} />
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close AI assistant" : "Open AI assistant"}
          style={{
            width: 56, height: 56, borderRadius: "50%",
            background: open ? "rgba(0,212,255,0.15)" : "rgba(0,212,255,0.9)",
            border: "2px solid rgba(0,212,255,0.8)",
            boxShadow: "0 0 28px rgba(0,212,255,0.45)",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: open ? 20 : 22,
            color: open ? "var(--blue, #00d4ff)" : "#000",
            transition: "all .3s cubic-bezier(0.22,1,0.36,1)",
            flexShrink: 0,
          }}
        >
          {open ? <FontAwesomeIcon icon={faTimes} /> : BOT_ICON}
        </button>
      </div>

      {/* ════ MODAL ════ */}
      {open && (
        <div style={{
          position: "fixed", bottom: 90, right: 24, zIndex: 1001,
          width: "min(420px, calc(100vw - 32px))",
          height: "min(560px, calc(100vh - 120px))",
          borderRadius: 20,
          border: "1.5px solid rgba(0,212,255,0.3)",
          background: "rgba(1,8,20,0.97)",
          boxShadow: "0 0 60px rgba(0,212,255,0.12), 0 24px 60px rgba(0,0,0,0.7)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          animation: "ndscBotFadeIn .3s cubic-bezier(0.22,1,0.36,1)",
          backdropFilter: "blur(12px)",
        }}>

          {/* Header */}
          <div style={{
            padding: "14px 16px 12px",
            borderBottom: "1px solid rgba(0,212,255,0.12)",
            background: "rgba(0,212,255,0.04)",
            display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              background: "rgba(0,212,255,0.12)",
              border: "1.5px solid rgba(0,212,255,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, color: "var(--blue, #00d4ff)",
            }}>{BOT_ICON}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0, fontSize: 13, fontWeight: 700,
                color: "var(--white, #f0f6ff)",
                fontFamily: "'Poppins',sans-serif",
              }}>NDSC AI Assistant</p>
              <p style={{
                margin: 0, fontSize: 10, letterSpacing: "0.2em",
                color: "var(--blue, #00d4ff)",
                fontFamily: "'Share Tech Mono',monospace",
              }}>
                <span style={{
                  display: "inline-block", width: 6, height: 6,
                  borderRadius: "50%", background: "#22c55e",
                  marginRight: 5, verticalAlign: "middle",
                }} />
                ONLINE
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "rgba(0,212,255,0.5)", fontSize: 16, padding: 4,
                lineHeight: 1, flexShrink: 0,
              }}
              aria-label="Close"
            ><FontAwesomeIcon icon={faTimes} /></button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "14px 14px 4px",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(0,212,255,0.25) transparent",
          }}>
            {msgs.map((m, i) => (
              <Bubble
                key={i}
                msg={m}
                streaming={streaming && i === msgs.length - 1 && m.role === "assistant"}
              />
            ))}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(0,212,255,0.12)",
                  border: "1px solid rgba(0,212,255,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, color: "var(--blue, #00d4ff)",
                }}>{BOT_ICON}</div>
                <div style={{
                  padding: "9px 14px",
                  borderRadius: "4px 14px 14px 14px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}>
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {msgs.length <= 1 && !loading && (
            <div style={{ padding: "0 12px 8px", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  style={{
                    padding: "5px 11px", borderRadius: 20,
                    border: "1px solid rgba(0,212,255,0.3)",
                    background: "rgba(0,212,255,0.06)",
                    color: "rgba(0,212,255,0.9)", fontSize: 11,
                    fontFamily: "'Share Tech Mono',monospace",
                    letterSpacing: "0.05em", cursor: "pointer",
                    transition: "all .2s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.15)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.06)"; }}
                >{s}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: "10px 12px 14px",
            borderTop: "1px solid rgba(0,212,255,0.1)",
            background: "rgba(0,212,255,0.02)", flexShrink: 0,
          }}>
            <div
              style={{
                display: "flex", gap: 8, alignItems: "flex-end",
                border: "1px solid rgba(0,212,255,0.25)",
                borderRadius: 14, padding: "8px 10px 8px 14px",
                background: "rgba(0,212,255,0.04)", transition: "border-color .2s",
              }}
              onFocusCapture={(e) => (e.currentTarget.style.borderColor = "rgba(0,212,255,0.55)")}
              onBlurCapture={(e) => (e.currentTarget.style.borderColor = "rgba(0,212,255,0.25)")}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Ask a question..."
                rows={1}
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  resize: "none", fontSize: 13, lineHeight: 1.55,
                  color: "var(--white, #f0f6ff)",
                  fontFamily: "'Poppins',sans-serif",
                  maxHeight: 90, overflowY: "auto", scrollbarWidth: "none",
                }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 90) + "px";
                }}
              />
              <button
                onClick={() => send(input)}
                disabled={loading || streaming || !input.trim()}
                aria-label="Send message"
                style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: input.trim() && !loading && !streaming
                    ? "rgba(0,212,255,0.9)"
                    : "rgba(0,212,255,0.12)",
                  border: "none",
                  cursor: input.trim() && !loading && !streaming ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: input.trim() && !loading && !streaming ? "#000" : "rgba(0,212,255,0.4)",
                  fontSize: 14, transition: "all .25s",
                }}
              ><FontAwesomeIcon icon={faPaperPlane} /></button>
            </div>
            <p style={{
              margin: "6px 0 0", fontSize: 10,
              color: "rgba(0,212,255,0.3)",
              fontFamily: "'Share Tech Mono',monospace",
              letterSpacing: "0.18em", textAlign: "center",
            }}>NDSC AI · ENTER TO SEND · SHIFT+ENTER FOR NEW LINE</p>
          </div>
        </div>
      )}
    </>
  );
}
