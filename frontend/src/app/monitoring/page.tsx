"use client";

import { useEffect, useState } from "react";
import {
  fetchProfiles,
  updateProfile,
  testProfile7d,
  MonitoringProfile,
} from "@/lib/api";

export default function MonitoringPage() {
  const [profiles, setProfiles] = useState<MonitoringProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<MonitoringProfile | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [wilayahList, setWilayahList] = useState<string[]>([]);
  const [keywordList, setKeywordList] = useState<string[]>([]);
  const [sinonimList, setSinonimList] = useState<string[]>([]);
  const [pengecualianList, setPengecualianList] = useState<string[]>([]);
  const [kategoriList, setKategoriList] = useState<string[]>([]);
  const [ambangMultiplier, setAmbangMultiplier] = useState(3.0);

  const [newWilayah, setNewWilayah] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newPengecualian, setNewPengecualian] = useState("");

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const data = await fetchProfiles();
      setProfiles(data);
      if (data.length > 0) {
        selectProfile(data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectProfile = (p: MonitoringProfile) => {
    setActiveProfile(p);
    setWilayahList(p.rule.wilayah || []);
    setKeywordList(p.rule.keyword || []);
    setSinonimList(p.rule.sinonim || []);
    setPengecualianList(p.rule.pengecualian || []);
    setKategoriList(p.rule.kategori || []);
    setAmbangMultiplier(p.rule.ambang_multiplier || 3.0);
    setTestResult(null);
    setSaveMessage(null);
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleAddTag = (
    list: string[],
    setList: (val: string[]) => void,
    value: string,
    clearFn: () => void
  ) => {
    if (value.trim() && !list.includes(value.trim())) {
      setList([...list, value.trim()]);
      clearFn();
    }
  };

  const handleRemoveTag = (
    list: string[],
    setList: (val: string[]) => void,
    itemToRemove: string
  ) => {
    setList(list.filter((t) => t !== itemToRemove));
  };

  const handleSave = async () => {
    if (!activeProfile) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const updated = await updateProfile(activeProfile.id, {
        nama: activeProfile.nama,
        unit: activeProfile.unit,
        status: "aktif",
        rule: {
          wilayah: wilayahList,
          keyword: keywordList,
          sinonim: sinonimList,
          pengecualian: pengecualianList,
          kategori: kategoriList,
          ambang_multiplier: ambangMultiplier,
        },
      });
      setActiveProfile(updated);
      setSaveMessage(
        `Konfigurasi tersimpan dan diaktifkan sebagai versi v${updated.versi}.`
      );
      loadProfiles();
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan profil");
    } finally {
      setSaving(false);
    }
  };

  const handleRun7dTest = async () => {
    if (!activeProfile) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testProfile7d(activeProfile.id);
      setTestResult(result);
    } catch (err: any) {
      alert(err.message || "Gagal menguji profil");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="panel p-12 text-center">
        <div className="inline-block w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-bold text-slate-200">
          Memuat Aturan &amp; Profil Pemantauan...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-[#1E2A4A]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-mono font-bold tracking-widest uppercase text-sky-400">
            LISTENING STUDIO &bull; QUERY BUILDER
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
            Konfigurasi Profil &amp; Ambang Alert
          </h1>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Versi Aktif: v{activeProfile?.versi || 1}
        </div>
      </div>

      <section className="panel p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#1E2A4A]">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-sky-400">
              PROFIL AKTIF
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-white mt-0.5">
              {activeProfile?.nama || "Pemantauan Isu Publik & Layanan"}
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            ONLINE &bull; v{activeProfile?.versi || 1}
          </span>
        </div>

        {saveMessage && (
          <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {saveMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column: Wilayah, Kata kunci, Pengecualian */}
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-2">
                Wilayah Pantauan (Gazetteer)
              </label>
              <div className="flex flex-wrap gap-2 mb-2.5">
                {wilayahList.map((w) => (
                  <span
                    key={w}
                    className="inline-flex items-center bg-[#16203C] text-sky-300 text-xs font-semibold px-3 py-1.5 rounded-full border border-[#1E2A4A]"
                  >
                    {w}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(wilayahList, setWilayahList, w)}
                      className="ml-2 text-slate-400 hover:text-red-400 font-bold"
                      aria-label={`Hapus wilayah ${w}`}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tambah wilayah..."
                  value={newWilayah}
                  onChange={(e) => setNewWilayah(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    handleAddTag(
                      wilayahList,
                      setWilayahList,
                      newWilayah,
                      () => setNewWilayah("")
                    )
                  }
                  className="flex-1 text-xs bg-[#16203C] border border-[#1E2A4A] rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    handleAddTag(
                      wilayahList,
                      setWilayahList,
                      newWilayah,
                      () => setNewWilayah("")
                    )
                  }
                  className="px-3 py-2 bg-[#16203C] hover:bg-[#1E2A4A] text-slate-200 text-xs font-semibold rounded-lg border border-[#1E2A4A]"
                >
                  Tambah
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-2">
                Kata Kunci &amp; Sinyal Insiden
              </label>
              <div className="flex flex-wrap gap-2 mb-2.5">
                {keywordList.map((k) => (
                  <span
                    key={k}
                    className="inline-flex items-center bg-[#16203C] text-sky-300 text-xs font-semibold px-3 py-1.5 rounded-full border border-[#1E2A4A]"
                  >
                    {k}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(keywordList, setKeywordList, k)}
                      className="ml-2 text-slate-400 hover:text-red-400 font-bold"
                      aria-label={`Hapus kata kunci ${k}`}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tambah kata kunci insiden..."
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    handleAddTag(
                      keywordList,
                      setKeywordList,
                      newKeyword,
                      () => setNewKeyword("")
                    )
                  }
                  className="flex-1 text-xs bg-[#16203C] border border-[#1E2A4A] rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    handleAddTag(
                      keywordList,
                      setKeywordList,
                      newKeyword,
                      () => setNewKeyword("")
                    )
                  }
                  className="px-3 py-2 bg-[#16203C] hover:bg-[#1E2A4A] text-slate-200 text-xs font-semibold rounded-lg border border-[#1E2A4A]"
                >
                  Tambah
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-2">
                Pengecualian / Noise Filter
              </label>
              <div className="flex flex-wrap gap-2 mb-2.5">
                {pengecualianList.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center bg-[#16203C] text-red-300 text-xs font-semibold px-3 py-1.5 rounded-full border border-red-500/20"
                  >
                    {p}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(pengecualianList, setPengecualianList, p)}
                      className="ml-2 text-slate-400 hover:text-red-400 font-bold"
                      aria-label={`Hapus pengecualian ${p}`}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Contoh: banjir diskon, banjir order..."
                  value={newPengecualian}
                  onChange={(e) => setNewPengecualian(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    handleAddTag(
                      pengecualianList,
                      setPengecualianList,
                      newPengecualian,
                      () => setNewPengecualian("")
                    )
                  }
                  className="flex-1 text-xs bg-[#16203C] border border-[#1E2A4A] rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    handleAddTag(
                      pengecualianList,
                      setPengecualianList,
                      newPengecualian,
                      () => setNewPengecualian("")
                    )
                  }
                  className="px-3 py-2 bg-[#16203C] hover:bg-[#1E2A4A] text-slate-200 text-xs font-semibold rounded-lg border border-[#1E2A4A]"
                >
                  Tambah
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Kategori, Sumber data, Ambang alert */}
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-2">
                Kategori Masalah
              </label>
              <div className="flex flex-wrap gap-2">
                {kategoriList.map((kat) => (
                  <span
                    key={kat}
                    className="bg-[#16203C] text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-full border border-[#1E2A4A]"
                  >
                    {kat}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-2">
                Sumber Data Terhubung
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  "Antara News Terkini",
                  "Antara Metro",
                  "detikcom",
                  "CNN Indonesia",
                  "Situs Dishub DKI",
                  "BMKG Gempa Terkini",
                ].map((src) => (
                  <span
                    key={src}
                    className="bg-sky-500/10 text-sky-300 text-xs font-semibold px-3 py-1.5 rounded-full border border-sky-500/20"
                  >
                    {src}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="ambang-range"
                className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Ambang Deteksi Lonjakan (Anomali)
              </label>
              <div className="text-xs font-mono text-slate-200 mb-3">
                Lonjakan{" "}
                <strong className="text-sky-400 font-bold">
                  &ge; {ambangMultiplier}&times; baseline
                </strong>{" "}
                &rarr; Otomatis eskalasi HIGH ke analis piket
              </div>
              <input
                id="ambang-range"
                type="range"
                min="1.5"
                max="5.0"
                step="0.5"
                value={ambangMultiplier}
                onChange={(e) => setAmbangMultiplier(parseFloat(e.target.value))}
                className="w-full accent-sky-400 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1">
                <span>1,5&times;</span>
                <span className="text-sky-400 font-bold">3&times; baseline</span>
                <span>5&times;</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 pt-6 border-t border-[#1E2A4A] flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="min-h-[40px] px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 shadow-sm"
          >
            {saving ? "Menyimpan..." : "Simpan & Aktifkan"}
          </button>
          <button
            type="button"
            onClick={handleRun7dTest}
            disabled={testing}
            className="min-h-[40px] px-5 py-2.5 bg-[#16203C] hover:bg-[#1E2A4A] text-sky-400 text-xs font-bold rounded-lg border border-[#1E2A4A] transition-colors disabled:opacity-50"
          >
            {testing ? "Menguji Data 7 Hari..." : "Uji Retrospektif 7 Hari"}
          </button>
        </div>

        {/* Retrospective Test Result */}
        {testResult && (
          <div className="mt-6 p-4 bg-[#16203C] border border-[#1E2A4A] rounded-xl text-xs space-y-3">
            <div className="font-bold text-white text-xs font-mono uppercase tracking-wider">
              HASIL UJI RETROSPEKTIF 7 HARI (FR-03)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#10172E] p-3 rounded-lg border border-[#1E2A4A]">
                <span className="text-slate-400 block text-[11px]">Konten Diperiksa</span>
                <span className="font-black text-white text-base font-mono">
                  {testResult.total_historical_items_checked}
                </span>
              </div>
              <div className="bg-[#10172E] p-3 rounded-lg border border-[#1E2A4A]">
                <span className="text-slate-400 block text-[11px]">Cocok Kata Kunci</span>
                <span className="font-black text-sky-400 text-base font-mono">
                  {testResult.matches_found}
                </span>
              </div>
              <div className="bg-[#10172E] p-3 rounded-lg border border-[#1E2A4A]">
                <span className="text-slate-400 block text-[11px]">Noise Dieliminasi</span>
                <span className="font-black text-slate-200 text-base font-mono">
                  {testResult.exclusions_filtered}
                </span>
              </div>
              <div className="bg-[#10172E] p-3 rounded-lg border border-[#1E2A4A]">
                <span className="text-slate-400 block text-[11px]">Estimasi Tangkapan/Hari</span>
                <span className="font-black text-white text-base font-mono">
                  &plusmn;{testResult.estimated_daily_catch}
                </span>
              </div>
            </div>
            <p className="text-slate-300 font-medium leading-relaxed">
              {testResult.recommendation}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
