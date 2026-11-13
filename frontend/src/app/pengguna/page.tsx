"use client";

import { useEffect, useState } from "react";
import { UserPlus, Users, Shield } from "lucide-react";
import { AuthUser, createUserAccount, listUsers, updateUserAccount } from "@/lib/api";

export default function UsersManagementPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [nama, setNama] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("analis");
  const [scopeText, setScopeText] = useState("ID");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat pengguna");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const scopes = scopeText.split(",").map((s) => s.trim()).filter(Boolean);
      await createUserAccount({
        email,
        nama,
        password,
        role,
        wilayah_scope: scopes.length ? scopes : ["ID"],
      });
      setEmail("");
      setNama("");
      setPassword("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah pengguna");
    }
  };

  const toggleActive = async (u: AuthUser) => {
    await updateUserAccount(u.id, { is_active: !u.is_active });
    await load();
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/15 dark:bg-indigo-500/20 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Manajemen Pengguna & RBAC Wilayah</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Kelola peran analis, verifikator, eksekutif, serta cakupan kode wilayah Kemendagri</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div>
          <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Nama</label>
          <input required value={nama} onChange={(e) => setNama(e.target.value)} className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg placeholder:text-zinc-400 dark:placeholder:text-zinc-500" placeholder="Budi Santoso" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Email</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg placeholder:text-zinc-400 dark:placeholder:text-zinc-500" placeholder="budi@instansi.go.id" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Kata Sandi</label>
          <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg placeholder:text-zinc-400 dark:placeholder:text-zinc-500" placeholder="Minimal 8 karakter" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Peran</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <option value="analis">Analis</option>
            <option value="verifikator">Verifikator</option>
            <option value="eksekutif">Eksekutif</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Kode Wilayah</label>
          <input value={scopeText} onChange={(e) => setScopeText(e.target.value)} className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg placeholder:text-zinc-400 dark:placeholder:text-zinc-500" placeholder="ID atau 31.74" />
        </div>
        <button type="submit" className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg">
          <UserPlus className="w-4 h-4" />
          Tambah
        </button>
      </form>

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/70 border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
            <tr>
              <th className="text-left px-4 py-3">Pengguna</th>
              <th className="text-left px-4 py-3">Peran</th>
              <th className="text-left px-4 py-3">Cakupan Wilayah</th>
              <th className="text-left px-4 py-3">MFA</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-zinc-400">Memuat data pengguna...</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40">
                <td className="px-4 py-3">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">{u.nama}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-semibold uppercase">
                    <Shield className="w-3 h-3" /> {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-700 dark:text-zinc-300 font-mono">
                  {(u.wilayah_scope || ["ID"]).join(", ")}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                  {u.mfa_enabled ? "Aktif" : "Nonaktif"}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(u)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${u.is_active ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400"}`}
                  >
                    {u.is_active ? "Aktif" : "Nonaktif"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
