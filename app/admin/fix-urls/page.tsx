"use client";
import { useState } from "react";
import { Wrench, Loader2, Search, Zap, XCircle, CheckCircle2, AlertTriangle, Info } from "lucide-react";

const S = {
  bg: "var(--bg)", card: "var(--surface-deep)", border: "var(--border)",
  accent: "var(--blue)", text: "var(--white)", muted: "var(--muted)",
  success: "var(--cat-teal)", danger: "var(--danger-soft)", warn: "var(--cat-amber)",
};

type TableReport = { scanned: number; fixed: number; errors: string[] };
type Report = Record<string, TableReport>;

export default function FixUrlsPage() {
  const [status, setStatus] = useState<"idle" | "scanning" | "fixing" | "done">("idle");
  const [result, setResult] = useState<{ dry_run: boolean; message: string; report: Report } | null>(null);
  const [error, setError] = useState("");

  const run = async (dryRun: boolean) => {
    setStatus(dryRun ? "scanning" : "fixing");
    setError("");
    try {
      const res = await fetch("/api/admin/fix-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: dryRun }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data);
      setStatus("done");
    } catch (e: any) {
      setError(e.message);
      setStatus("idle");
    }
  };

  const totalFixed = result
    ? Object.values(result.report).reduce((s, r) => s + r.fixed, 0)
    : 0;

  return (
    <div className="p-6 max-w-3xl mx-auto" style={{ color: S.text, fontFamily: "'Poppins',sans-serif" }}>
      <h1 className="text-2xl font-black mb-2 flex items-center gap-2" style={{ fontFamily: "'Orbitron',sans-serif", color: S.accent }}>
        <Wrench size={22} /> Fix Upload URLs
      </h1>
      <p className="text-sm mb-6" style={{ color: S.muted }}>
        Database এর সব broken upload URL গুলো fix করবে।<br />
        <span style={{ color: S.warn }}>পুরোনো format:</span>{" "}
        <code style={{ fontSize: 11 }}>uploads.ndscbd.net/uploads/covers/file.jpg</code>
        <br />
        <span style={{ color: S.success }}>নতুন সঠিক format:</span>{" "}
        <code style={{ fontSize: 11 }}>uploads.ndscbd.net/covers/file.jpg</code>
      </p>

      {/* Step 1 */}
      <div className="rounded-xl border p-5 mb-4" style={{ borderColor: S.border, background: S.card }}>
        <h2 className="font-bold mb-2 text-sm tracking-wider" style={{ color: S.accent }}>
          STEP 1 — Scan (Dry Run)
        </h2>
        <p className="text-xs mb-4" style={{ color: S.muted }}>
          কতগুলো record fix করতে হবে সেটা দেখবে। কোনো data change হবে না।
        </p>
        <button
          onClick={() => run(true)}
          disabled={status === "scanning" || status === "fixing"}
          className="px-5 py-2 rounded-lg text-sm font-bold transition-all"
          style={{
            background: status === "scanning" ? "rgba(var(--blue-rgb), 0.2)" : "rgba(var(--blue-rgb), 0.1)",
            border: `1px solid ${S.accent}`, color: S.accent,
            opacity: status === "fixing" ? 0.4 : 1,
            cursor: status === "fixing" ? "not-allowed" : "pointer",
          }}
        >
          <span className="inline-flex items-center gap-2">
            {status === "scanning" ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {status === "scanning" ? "Scanning..." : "Scan Now"}
          </span>
        </button>
      </div>

      {/* Step 2 */}
      <div className="rounded-xl border p-5 mb-6" style={{ borderColor: S.border, background: S.card }}>
        <h2 className="font-bold mb-2 text-sm tracking-wider" style={{ color: S.warn }}>
          STEP 2 — Apply Fix
        </h2>
        <p className="text-xs mb-4" style={{ color: S.muted }}>
          সব broken URLs database এ permanently fix করবে। Scan করার পরে এটা করো।
        </p>
        <button
          onClick={() => run(false)}
          disabled={status === "scanning" || status === "fixing"}
          className="px-5 py-2 rounded-lg text-sm font-bold transition-all"
          style={{
            background: status === "fixing" ? "rgba(var(--cat-amber-rgb), 0.3)" : "rgba(var(--cat-amber-rgb), 0.1)",
            border: `1px solid ${S.warn}`, color: S.warn,
            opacity: status === "scanning" ? 0.4 : 1,
            cursor: status === "scanning" ? "not-allowed" : "pointer",
          }}
        >
          <span className="inline-flex items-center gap-2">
            {status === "fixing" ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {status === "fixing" ? "Fixing..." : "Apply Fix to Database"}
          </span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg p-4 mb-4 text-sm flex items-center gap-2" style={{ background: "rgba(255,71,87,0.1)", border: `1px solid ${S.danger}`, color: S.danger }}>
          <XCircle size={16} /> {error}
        </div>
      )}

      {/* Results */}
      {result && status === "done" && (
        <div className="rounded-xl border p-5" style={{ borderColor: result.dry_run ? S.accent : S.success, background: S.card }}>
          <div className="flex items-center gap-3 mb-4">
            <span style={{ color: result.dry_run ? S.accent : S.success }}>{result.dry_run ? <Search size={24} /> : <CheckCircle2 size={24} />}</span>
            <div>
              <p className="font-bold text-sm" style={{ color: result.dry_run ? S.accent : S.success }}>
                {result.dry_run ? "Scan Complete" : "Fix Applied!"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: S.muted }}>{result.message}</p>
            </div>
          </div>

          <div className="space-y-3">
            {Object.entries(result.report).map(([table, r]) => (
              <div key={table} className="rounded-lg p-4" style={{ background: "var(--bg)", border: `1px solid ${S.border}` }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs tracking-widest" style={{ fontFamily: "'Share Tech Mono',monospace", color: S.accent }}>
                    {table}
                  </span>
                  <div className="flex gap-3 text-xs">
                    <span style={{ color: S.muted }}>Scanned: <b style={{ color: S.text }}>{r.scanned}</b></span>
                    <span style={{ color: r.fixed > 0 ? S.warn : S.muted }}>
                      {result.dry_run ? "Would fix" : "Fixed"}: <b style={{ color: r.fixed > 0 ? S.warn : S.muted }}>{r.fixed}</b>
                    </span>
                  </div>
                </div>
                {r.errors.length > 0 && (
                  <div className="mt-2 text-xs" style={{ color: S.danger }}>
                    {r.errors.map((e, i) => <div key={i} className="flex items-center gap-1"><AlertTriangle size={11} /> {e}</div>)}
                  </div>
                )}
                {r.fixed === 0 && r.errors.length === 0 && (
                  <p className="text-xs mt-1 flex items-center gap-1" style={{ color: S.success }}><CheckCircle2 size={12} /> All URLs are correct</p>
                )}
              </div>
            ))}
          </div>

          {result.dry_run && totalFixed > 0 && (
            <div className="mt-4 p-3 rounded-lg text-xs text-center" style={{ background: "rgba(var(--cat-amber-rgb), 0.08)", border: `1px solid ${S.warn}`, color: S.warn }}>
              {totalFixed}টি record fix করা দরকার। Step 2 এ "Apply Fix" button চাপো।
            </div>
          )}
          {!result.dry_run && (
            <div className="mt-4 p-3 rounded-lg text-xs text-center flex items-center justify-center gap-2" style={{ background: "rgba(var(--cat-teal-rgb), 0.08)", border: `1px solid ${S.success}`, color: S.success }}>
              <CheckCircle2 size={14} /> সব URLs database এ fix হয়ে গেছে। এখন website এ সব ছবি দেখা যাবে।
            </div>
          )}
        </div>
      )}

      <div className="mt-8 p-4 rounded-lg text-xs" style={{ background: "rgba(var(--blue-rgb), 0.04)", border: `1px solid rgba(var(--blue-rgb), 0.15)`, color: S.muted }}>
        <p className="font-bold mb-1 flex items-center gap-1.5" style={{ color: S.accent }}><Info size={13} /> এই fix কী কী করে?</p>
        <ul className="space-y-1 list-none">
          <li>• <code>activity_sessions</code> → cover_image_url, pdf_url, gallery_urls</li>
          <li>• <code>executives</code> → photo_url</li>
          <li>• <code>publications</code> → cover_image_url, pdf_url</li>
          <li>• <code>science_media</code> → thumbnail_url (যদি থাকে)</li>
        </ul>
      </div>
    </div>
  );
}
