"use client";

import { useEffect, useState } from "react";
import { KeyRound, Pencil, Shield, UserPlus } from "lucide-react";
import { AuthUser, createUserAccount, listUsers, updateUserAccount } from "@/lib/api";
import { fmtRelative } from "@/lib/format";
import { ConfirmDialog, ErrorPanel, Modal, Notice } from "@/components/ui";

// Sama dengan VALID_ROLES di backend/app/services/auth.py.
const ROLES: { id: string; label: string; hint: string }[] = [
  { id: "analis", label: "Analis", hint: "Meninjau isu dan menulis catatan" },
  { id: "verifikator", label: "Verifikator", hint: "Memutuskan verifikasi, koreksi, tolak" },
  { id: "eksekutif", label: "Eksekutif", hint: "Membaca dashboard, alert, dan laporan" },
  { id: "admin", label: "Admin", hint: "Semua akses, termasuk kelola pengguna" },
];

const inputCls =
  "w-full min-h-[38px] px-2.5 py-1.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-800 rounded-md placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40";
const labelCls = "block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1";

function parseScopes(text: string): string[] {
  const list = text.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : ["ID"];
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const [email, setEmail] = useState("");
  const [nama, setNama] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("analis");
  const [scopeText, setScopeText] = useState("ID");
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [editNama, setEditNama] = useState("");
  const [editRole, setEditRole] = useState("analis");
  const [editScope, setEditScope] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [toggling, setToggling] = useState<AuthUser | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setUsers(await listUsers());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Gagal memuat pengguna");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setNotice({ tone: "error", text: "Kata sandi minimal 8 karakter." });
      return;
    }
    setCreating(true);
    setNotice(null);
    try {
      await createUserAccount({ email, nama, password, role, wilayah_scope: parseScopes(scopeText) });
      setNotice({ tone: "success", text: `${nama} ditambahkan sebagai ${role}.` });
      setEmail("");
      setNama("");
      setPassword("");
      await load();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Gagal menambah pengguna" });
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (u: AuthUser) => {
    setEditing(u);
    setEditNama(u.nama);
    setEditRole(u.role);
    setEditScope((u.wilayah_scope || ["ID"]).join(", "));
    setEditPassword("");
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (editPassword && editPassword.length < 8) {
      setEditError("Kata sandi baru minimal 8 karakter.");
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      await updateUserAccount(editing.id, {
        nama: editNama.trim(),
        role: editRole,
        wilayah_scope: parseScopes(editScope),
        ...(editPassword ? { password: editPassword } : {}),
      });
      setNotice({
        tone: "success",
        text: `Data ${editNama.trim()} diperbarui${editPassword ? ", termasuk kata sandi" : ""}.`,
      });
      setEditing(null);
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Gagal memperbarui pengguna");
    } finally {
      setSaving(false);
    }
  };

  const confirmToggle = async () => {
    if (!toggling) return;
    setToggleBusy(true);
    try {
      await updateUserAccount(toggling.id, { is_active: !toggling.is_active });
      setNotice({
        tone: "success",
        text: `${toggling.nama} ${toggling.is_active ? "dinonaktifkan" : "diaktifkan kembali"}.`,
      });
      await load();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Gagal mengubah status pengguna" });
    } finally {
      setToggleBusy(false);
      setToggling(null);
    }
  };

  if (loadError) {
    return (
      <ErrorPanel
        title="Daftar pengguna gagal dimuat"
        message={loadError}
        hint="Halaman ini hanya bisa dibuka oleh admin."
        onRetry={load}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
          Pengguna &amp; Hak Akses
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Kelola peran dan cakupan kode wilayah Kemendagri tiap pengguna.
        </p>
      </div>

      {notice && <Notice tone={notice.tone} message={notice.text} onClose={() => setNotice(null)} />}

      <form
        onSubmit={handleCreate}
        className="panel bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 p-4 space-y-3"
      >
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Tambah pengguna</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label htmlFor="new-nama" className={labelCls}>Nama</label>
            <input id="new-nama" required value={nama} onChange={(e) => setNama(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="new-email" className={labelCls}>Email</label>
            <input id="new-email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="nama@instansi.go.id" />
          </div>
          <div>
            <label htmlFor="new-password" className={labelCls}>Kata sandi</label>
            <input id="new-password" required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="Minimal 8 karakter" />
          </div>
          <div>
            <label htmlFor="new-role" className={labelCls}>Peran</label>
            <select id="new-role" value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-scope" className={labelCls}>Kode wilayah</label>
            <input id="new-scope" value={scopeText} onChange={(e) => setScopeText(e.target.value)} className={inputCls} placeholder="ID, 31, 31.74" />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-bold rounded-md disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" aria-hidden="true" />
            {creating ? "Menyimpan..." : "Tambah"}
          </button>
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {ROLES.find((r) => r.id === role)?.hint}. Kode wilayah dipisah koma: <code>ID</code> seluruh Indonesia,{" "}
          <code>31</code> satu provinsi, <code>31.74</code> satu kota/kabupaten.
        </p>
      </form>

      <div className="panel bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/70 border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
            <tr>
              <th className="text-left px-4 py-3">Pengguna</th>
              <th className="text-left px-4 py-3">Peran</th>
              <th className="text-left px-4 py-3">Cakupan wilayah</th>
              <th className="text-left px-4 py-3">Login terakhir</th>
              <th className="text-left px-4 py-3">MFA</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3"><span className="sr-only">Aksi</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">Memuat data pengguna...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">Belum ada pengguna.</td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className={`hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 ${u.is_active ? "" : "opacity-60"}`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">{u.nama}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-semibold capitalize">
                      <Shield className="w-3 h-3" aria-hidden="true" /> {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-700 dark:text-zinc-300 font-mono">
                    {(u.wilayah_scope || ["ID"]).join(", ")}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                    {u.last_login_at ? fmtRelative(u.last_login_at) : "Belum pernah"}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">{u.mfa_enabled ? "Aktif" : "Nonaktif"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        u.is_active
                          ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800"
                      }`}
                    >
                      {u.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Ubah
                    </button>
                    <button
                      type="button"
                      onClick={() => setToggling(u)}
                      className={`ml-1 px-2.5 py-1.5 rounded-md text-xs font-semibold ${
                        u.is_active
                          ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                          : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                      }`}
                    >
                      {u.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Ubah ${editing.nama}` : ""}
        description={editing?.email}
      >
        <form onSubmit={handleSaveEdit} className="space-y-3">
          {editError && <Notice tone="error" message={editError} onClose={() => setEditError(null)} />}
          <div>
            <label htmlFor="edit-nama" className={labelCls}>Nama</label>
            <input id="edit-nama" required value={editNama} onChange={(e) => setEditNama(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="edit-role" className={labelCls}>Peran</label>
            <select id="edit-role" value={editRole} onChange={(e) => setEditRole(e.target.value)} className={inputCls}>
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}: {r.hint}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-scope" className={labelCls}>Kode wilayah</label>
            <input id="edit-scope" value={editScope} onChange={(e) => setEditScope(e.target.value)} className={inputCls} placeholder="ID, 31, 31.74" />
          </div>
          <div>
            <label htmlFor="edit-password" className={labelCls}>
              <KeyRound className="inline w-3 h-3 mr-1" aria-hidden="true" />
              Kata sandi baru (kosongkan bila tidak diganti)
            </label>
            <input
              id="edit-password"
              type="password"
              autoComplete="new-password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              className={inputCls}
              placeholder="Minimal 8 karakter"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="min-h-[36px] px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[36px] px-4 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-bold disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toggling}
        title={toggling?.is_active ? `Nonaktifkan ${toggling?.nama}?` : `Aktifkan ${toggling?.nama}?`}
        description={
          toggling?.is_active
            ? "Pengguna tidak bisa masuk lagi sampai diaktifkan kembali. Riwayat audit tetap tersimpan."
            : "Pengguna bisa masuk kembali dengan kata sandi lamanya."
        }
        confirmLabel={toggling?.is_active ? "Ya, nonaktifkan" : "Ya, aktifkan"}
        tone={toggling?.is_active ? "danger" : "default"}
        busy={toggleBusy}
        onCancel={() => setToggling(null)}
        onConfirm={confirmToggle}
      />
    </div>
  );
}
