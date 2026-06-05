"use client";
import { useState, useEffect, useCallback } from "react";

type ActivityType = {
  id: string; name: string; slug: string; icon: string;
  description: string; display_order: number;
};
type ActivityVersion = {
  id: string; activity_type_id: string; version_number: number;
  version_label: string; year_start: number; year_end: number | null;
  description: string;
};
type ActivitySession = {
  id: string; activity_version_id: string | null; activity_type_id: string | null;
  title: string; slug: string; session_date: string; location: string;
  description: string; cover_image_url: string; youtube_url: string;
  pdf_url: string; gallery_urls: string[]; is_published: boolean;
};

const S = { background: "#050d1a", border: "#0f2a4a", card: "#071220",
  accent: "#00d4ff", text: "#e8f4ff", muted: "#6a8faf", danger: "#ff4757" };

const ICON_OPTIONS = ["🔬","🎤","☀️","📚","🏆","📡","🧪","💡","🌍","🎯","🧬","⚗️","🔭","🎓"];

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: S.card, border: `1px solid ${S.border}` }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 style={{ fontFamily: "'Orbitron',sans-serif", color: S.accent, fontSize: 16 }}>{title}</h3>
          <button onClick={onClose} style={{ color: S.muted, fontSize: 20 }} className="hover:text-white">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-xs mb-1.5 font-medium" style={{ color: S.muted }}>{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1";
const inputStyle = { background: "#050d1a", border: `1px solid ${S.border}`, color: S.text } as React.CSSProperties;

async function uploadFile(file: File, folder: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!data.url) throw new Error(data.error || "Upload failed");
  return data.url;
}

function TypeForm({ initial, onSave, onClose }: {
  initial?: Partial<ActivityType>; onSave: () => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name || "", slug: initial?.slug || "",
    icon: initial?.icon || "🔬", description: initial?.description || "",
    display_order: initial?.display_order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleSave = async () => {
    setSaving(true); setErr("");
    try {
      const method = initial?.id ? "PUT" : "POST";
      const body = initial?.id ? { id: initial.id, ...form } : form;
      const res = await fetch("/api/admin/activity-types", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSave();
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <Modal title={initial?.id ? "Edit Type" : "New Activity Type"} onClose={onClose}>
      <Field label="Name">
        <input className={inputCls} style={inputStyle}
          value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
      </Field>
      <Field label="Slug (e.g. workshops)">
        <input className={inputCls} style={inputStyle}
          value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} />
      </Field>
      <Field label="Icon">
        <div className="flex flex-wrap gap-2">
          {ICON_OPTIONS.map(ic => (
            <button key={ic} onClick={() => setForm(p => ({ ...p, icon: ic }))}
              className="w-9 h-9 rounded-lg text-xl flex items-center justify-center"
              style={{ background: form.icon === ic ? S.accent + "30" : S.background,
                border: `1px solid ${form.icon === ic ? S.accent : S.border}` }}>
              {ic}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Description">
        <textarea className={inputCls} style={{ ...inputStyle, resize: "vertical" }} rows={3}
          value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
      </Field>
      <Field label="Display Order">
        <input type="number" className={inputCls} style={inputStyle}
          value={form.display_order} onChange={e => setForm(p => ({ ...p, display_order: +e.target.value }))} />
      </Field>
      {err && <p className="text-xs mb-3" style={{ color: S.danger }}>{err}</p>}
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm"
          style={{ background: S.background, border: `1px solid ${S.border}`, color: S.muted }}>Cancel</button>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: S.accent, color: "#000" }}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

function VersionForm({ typeId, initial, onSave, onClose }: {
  typeId: string; initial?: Partial<ActivityVersion>; onSave: () => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    activity_type_id: typeId,
    version_number: initial?.version_number ?? 1,
    version_label: initial?.version_label || "",
    year_start: initial?.year_start ?? new Date().getFullYear(),
    year_end: initial?.year_end ?? null as number | null,
    description: initial?.description || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleSave = async () => {
    setSaving(true); setErr("");
    try {
      const method = initial?.id ? "PUT" : "POST";
      const body = initial?.id ? { id: initial.id, ...form } : form;
      const res = await fetch("/api/admin/activity-versions", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSave();
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <Modal title={initial?.id ? "Edit Version" : "New Version"} onClose={onClose}>
      <Field label="Version Number (e.g. 2 for v2.0)">
        <input type="number" step="0.1" className={inputCls} style={inputStyle}
          value={form.version_number}
          onChange={e => setForm(p => ({ ...p, version_number: +e.target.value }))} />
      </Field>
      <Field label="Version Label (e.g. 2.0)">
        <input className={inputCls} style={inputStyle}
          value={form.version_label} onChange={e => setForm(p => ({ ...p, version_label: e.target.value }))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Year Start">
          <input type="number" className={inputCls} style={inputStyle}
            value={form.year_start} onChange={e => setForm(p => ({ ...p, year_start: +e.target.value }))} />
        </Field>
        <Field label="Year End (optional)">
          <input type="number" className={inputCls} style={inputStyle}
            value={form.year_end ?? ""} onChange={e => setForm(p => ({ ...p, year_end: e.target.value ? +e.target.value : null }))} />
        </Field>
      </div>
      <Field label="Description">
        <textarea className={inputCls} style={{ ...inputStyle, resize: "vertical" }} rows={2}
          value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
      </Field>
      {err && <p className="text-xs mb-3" style={{ color: S.danger }}>{err}</p>}
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm"
          style={{ background: S.background, border: `1px solid ${S.border}`, color: S.muted }}>Cancel</button>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: S.accent, color: "#000" }}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

function SessionForm({ typeId, versionId, versions, initial, onSave, onClose }: {
  typeId: string;
  versionId?: string | null;
  versions: ActivityVersion[];
  initial?: Partial<ActivitySession>;
  onSave: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    activity_type_id: typeId,
    activity_version_id: initial?.activity_version_id || versionId || "",
    title: initial?.title || "",
    session_date: initial?.session_date?.slice(0, 10) || "",
    location: initial?.location || "",
    description: initial?.description || "",
    cover_image_url: initial?.cover_image_url || "",
    youtube_url: initial?.youtube_url || "",
    pdf_url: initial?.pdf_url || "",
    gallery_urls: initial?.gallery_urls || [] as string[],
    is_published: initial?.is_published ?? false,
  });
  const [uploading, setUploading] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, field: string, folder: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(field);
    try {
      const url = await uploadFile(file, folder);
      setForm(p => ({ ...p, [field]: url }));
    } catch (ex: any) { setErr(ex.message); }
    setUploading("");
  };

  const handleGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading("gallery");
    try {
      const urls = await Promise.all(files.map(f => uploadFile(f, "gallery")));
      setForm(p => ({ ...p, gallery_urls: [...p.gallery_urls, ...urls] }));
    } catch (ex: any) { setErr(ex.message); }
    setUploading("");
  };

  const handleSave = async () => {
    setSaving(true); setErr("");
    try {
      const payload: any = {
        activity_type_id: form.activity_type_id,
        title: form.title,
        session_date: form.session_date || null,
        location: form.location,
        description: form.description,
        cover_image_url: form.cover_image_url,
        youtube_url: form.youtube_url,
        pdf_url: form.pdf_url,
        gallery_urls: form.gallery_urls,
        is_published: form.is_published,
      };
      // only send version if selected
      if (form.activity_version_id) {
        payload.activity_version_id = form.activity_version_id;
      }
      if (initial?.id) payload.id = initial.id;

      const method = initial?.id ? "PUT" : "POST";
      const res = await fetch("/api/admin/activity-sessions", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSave();
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <Modal title={initial?.id ? "Edit Session" : "New Session"} onClose={onClose}>
      <Field label="Title">
        <input className={inputCls} style={inputStyle}
          value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
      </Field>

      <Field label="Version (optional — leave blank if no version)">
        <select className={inputCls} style={inputStyle}
          value={form.activity_version_id}
          onChange={e => setForm(p => ({ ...p, activity_version_id: e.target.value }))}>
          <option value="">— No version (direct session) —</option>
          {versions.map(v => (
            <option key={v.id} value={v.id}>
              v{v.version_number} — {v.version_label || `Version ${v.version_number}`}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input type="date" className={inputCls} style={inputStyle}
            value={form.session_date} onChange={e => setForm(p => ({ ...p, session_date: e.target.value }))} />
        </Field>
        <Field label="Location">
          <input className={inputCls} style={inputStyle}
            value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
        </Field>
      </div>

      <Field label="Description">
        <textarea className={inputCls} style={{ ...inputStyle, resize: "vertical" }} rows={3}
          value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
      </Field>

      <Field label="Cover Image">
        <div className="flex gap-2 items-center">
          {form.cover_image_url && (
            <img src={form.cover_image_url} className="h-12 w-20 object-cover rounded" alt="cover" />
          )}
          <input type="file" accept="image/*" onChange={e => handleFile(e, "cover_image_url", "covers")}
            className="text-xs" style={{ color: S.muted }} />
          {uploading === "cover_image_url" && <span className="text-xs" style={{ color: S.accent }}>Uploading…</span>}
        </div>
      </Field>

      <Field label="YouTube URL">
        <input className={inputCls} style={inputStyle} placeholder="https://youtube.com/watch?v=..."
          value={form.youtube_url} onChange={e => setForm(p => ({ ...p, youtube_url: e.target.value }))} />
      </Field>

      <Field label="PDF">
        <div className="flex gap-2 items-center">
          {form.pdf_url && <a href={form.pdf_url} target="_blank" className="text-xs underline" style={{ color: S.accent }}>View PDF</a>}
          <input type="file" accept=".pdf" onChange={e => handleFile(e, "pdf_url", "pdfs")}
            className="text-xs" style={{ color: S.muted }} />
          {uploading === "pdf_url" && <span className="text-xs" style={{ color: S.accent }}>Uploading…</span>}
        </div>
      </Field>

      <Field label="Gallery Images">
        <input type="file" accept="image/*" multiple onChange={handleGallery}
          className="text-xs" style={{ color: S.muted }} />
        {uploading === "gallery" && <span className="text-xs ml-2" style={{ color: S.accent }}>Uploading…</span>}
        {form.gallery_urls.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {form.gallery_urls.map((url, i) => (
              <div key={i} className="relative">
                <img src={url} className="h-14 w-20 object-cover rounded" alt="" />
                <button onClick={() => setForm(p => ({ ...p, gallery_urls: p.gallery_urls.filter((_, j) => j !== i) }))}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs"
                  style={{ background: S.danger, color: "#fff" }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </Field>

      <Field label="">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_published}
            onChange={e => setForm(p => ({ ...p, is_published: e.target.checked }))} />
          <span className="text-sm" style={{ color: S.text }}>Published (visible on website)</span>
        </label>
      </Field>

      {err && <p className="text-xs mb-3" style={{ color: S.danger }}>{err}</p>}
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm"
          style={{ background: S.background, border: `1px solid ${S.border}`, color: S.muted }}>Cancel</button>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: S.accent, color: "#000" }}>
          {saving ? "Saving…" : "Save Session"}
        </button>
      </div>
    </Modal>
  );
}

export default function ActivitiesAdminPage() {
  const [types, setTypes] = useState<ActivityType[]>([]);
  const [versions, setVersions] = useState<ActivityVersion[]>([]);
  const [sessions, setSessions] = useState<ActivitySession[]>([]);

  const [selType, setSelType] = useState<ActivityType | null>(null);
  const [selVersion, setSelVersion] = useState<ActivityVersion | null>(null);

  const [modal, setModal] = useState<"type" | "version" | "session" | null>(null);
  const [editing, setEditing] = useState<any>(null);

  const loadTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/activity-types");
      const data = await res.json();
      setTypes(Array.isArray(data) ? data : []);
    } catch { setTypes([]); }
  }, []);

  const loadVersions = useCallback(async (typeId: string) => {
    try {
      const res = await fetch(`/api/admin/activity-versions?type_id=${typeId}`);
      const data = await res.json();
      setVersions(Array.isArray(data) ? data : []);
    } catch { setVersions([]); }
  }, []);

  const loadSessions = useCallback(async (typeId: string) => {
    try {
      const res = await fetch(`/api/admin/activity-sessions?type_id=${typeId}`);
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch { setSessions([]); }
  }, []);

  useEffect(() => { loadTypes(); }, [loadTypes]);

  const selectType = (t: ActivityType) => {
    setSelType(t);
    setSelVersion(null);
    loadVersions(t.id);
    loadSessions(t.id);
  };

  const del = async (endpoint: string, id: string, reload: () => void) => {
    if (!confirm("Delete this item?")) return;
    await fetch(endpoint, { method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }) });
    reload();
  };

  const btnPrimary = { background: S.accent, color: "#000", padding: "6px 14px",
    borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" };
  const btnGhost = { background: "transparent", border: `1px solid ${S.border}`,
    color: S.muted, padding: "5px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer" };

  return (
    <div style={{ color: S.text }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "'Orbitron',sans-serif", color: S.accent, fontSize: 20 }}>Activities</h1>
          <p className="text-xs mt-0.5" style={{ color: S.muted }}>Type → Version (optional) → Session</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4" style={{ minHeight: "70vh" }}>

        {/* COLUMN 1: Types */}
        <div className="rounded-xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm" style={{ color: S.text }}>Activity Types</h2>
            <button style={btnPrimary} onClick={() => { setEditing(null); setModal("type"); }}>+ New</button>
          </div>
          <div className="space-y-2">
            {types.map(t => (
              <div key={t.id}
                className="rounded-lg p-3 cursor-pointer flex items-center gap-3"
                style={{ background: selType?.id === t.id ? S.accent + "18" : S.background,
                  border: `1px solid ${selType?.id === t.id ? S.accent : S.border}` }}
                onClick={() => selectType(t)}>
                <span className="text-xl">{t.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.name}</p>
                  <p className="text-xs truncate" style={{ color: S.muted }}>/{t.slug}</p>
                </div>
                <div className="flex gap-1">
                  <button style={btnGhost} onClick={e => { e.stopPropagation(); setEditing(t); setModal("type"); }}>✏️</button>
                  <button style={{ ...btnGhost, color: S.danger }}
                    onClick={e => { e.stopPropagation(); del("/api/admin/activity-types", t.id, loadTypes); }}>🗑</button>
                </div>
              </div>
            ))}
            {types.length === 0 && <p className="text-xs py-4 text-center" style={{ color: S.muted }}>No types yet</p>}
          </div>
        </div>

        {/* COLUMN 2: Versions */}
        <div className="rounded-xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm" style={{ color: S.text }}>
              {selType ? `${selType.name} — Versions` : "Versions"}
            </h2>
            {selType && (
              <button style={btnPrimary} onClick={() => { setEditing(null); setModal("version"); }}>+ New</button>
            )}
          </div>
          {!selType && <p className="text-xs py-4 text-center" style={{ color: S.muted }}>← Select a type</p>}
          <div className="space-y-2">
            {versions.map(v => (
              <div key={v.id}
                className="rounded-lg p-3 cursor-pointer flex items-center gap-3"
                style={{ background: selVersion?.id === v.id ? S.accent + "18" : S.background,
                  border: `1px solid ${selVersion?.id === v.id ? S.accent : S.border}` }}
                onClick={() => setSelVersion(v)}>
                <div className="text-center min-w-[40px] rounded-lg py-1"
                  style={{ background: S.accent + "20", color: S.accent, fontSize: 12, fontWeight: 700 }}>
                  v{v.version_number}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{v.version_label || `Version ${v.version_number}`}</p>
                  <p className="text-xs" style={{ color: S.muted }}>
                    {v.year_start}{v.year_end ? ` – ${v.year_end}` : " – present"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button style={btnGhost} onClick={e => { e.stopPropagation(); setEditing(v); setModal("version"); }}>✏️</button>
                  <button style={{ ...btnGhost, color: S.danger }}
                    onClick={e => { e.stopPropagation(); del("/api/admin/activity-versions", v.id, () => selType && loadVersions(selType.id)); }}>🗑</button>
                </div>
              </div>
            ))}
            {selType && versions.length === 0 && (
              <p className="text-xs py-4 text-center" style={{ color: S.muted }}>No versions yet — sessions can still be added directly</p>
            )}
          </div>
        </div>

        {/* COLUMN 3: Sessions */}
        <div className="rounded-xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm" style={{ color: S.text }}>
              {selType ? `${selType.name} — Sessions` : "Sessions"}
            </h2>
            {selType && (
              <button style={btnPrimary} onClick={() => { setEditing(null); setModal("session"); }}>+ New</button>
            )}
          </div>
          {!selType && <p className="text-xs py-4 text-center" style={{ color: S.muted }}>← Select a type</p>}
          <div className="space-y-2">
            {sessions.map(s => (
              <div key={s.id} className="rounded-lg p-3"
                style={{ background: S.background, border: `1px solid ${S.border}` }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                      {s.session_date ? new Date(s.session_date).toLocaleDateString("en-BD") : "No date"}
                      {s.location && ` · ${s.location}`}
                    </p>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {s.activity_version_id && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: S.accent + "22", color: S.accent }}>
                          v{versions.find(v => v.id === s.activity_version_id)?.version_number || "?"}
                        </span>
                      )}
                      {s.youtube_url && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#ff000022", color: "#ff6b6b" }}>▶ YT</span>}
                      {s.pdf_url && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#e67e2222", color: "#e67e22" }}>📄 PDF</span>}
                      {s.gallery_urls?.length > 0 && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#2ecc7122", color: "#2ecc71" }}>🖼 {s.gallery_urls.length}</span>}
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: s.is_published ? "#00d4ff22" : "#6a8faf22",
                          color: s.is_published ? S.accent : S.muted }}>
                        {s.is_published ? "Live" : "Draft"}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button style={btnGhost} onClick={() => { setEditing(s); setModal("session"); }}>✏️</button>
                    <button style={{ ...btnGhost, color: S.danger }}
                      onClick={() => del("/api/admin/activity-sessions", s.id, () => selType && loadSessions(selType.id))}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
            {selType && sessions.length === 0 && (
              <p className="text-xs py-4 text-center" style={{ color: S.muted }}>No sessions yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === "type" && (
        <TypeForm initial={editing}
          onSave={() => { setModal(null); loadTypes(); }}
          onClose={() => setModal(null)} />
      )}
      {modal === "version" && selType && (
        <VersionForm typeId={selType.id} initial={editing}
          onSave={() => { setModal(null); loadVersions(selType.id); }}
          onClose={() => setModal(null)} />
      )}
      {modal === "session" && selType && (
        <SessionForm
          typeId={selType.id}
          versionId={selVersion?.id || null}
          versions={versions}
          initial={editing}
          onSave={() => { setModal(null); loadSessions(selType.id); }}
          onClose={() => setModal(null)} />
      )}
    </div>
  );
}
