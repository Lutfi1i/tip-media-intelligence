"use client";

import { useEffect, useState } from "react";
import {
  fetchProfiles,
  updateProfile,
  testProfile7d,
  MonitoringProfile,
} from "@/lib/api";
import { ErrorPanel, Notice } from "@/components/ui";

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      setLoadError(err instanceof Error ? err.message : "Gagal memuat profil pemantauan");
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
    setList: (l: string[]) => void,
    val: string,
    clear: () => void
  ) => {
    const trimmed = val.trim();
    if (!trimmed || list.includes(trimmed)) return;
    setList([...list, trimmed]);
    clear();
  };

  const handleRemoveTag = (
    list: string[],
    setList: (l: string[]) => void,
    item: string
  ) => {
    setList(list.filter((x) => x !== item));
  };

  const handleSave = async () => {
    if (!activeProfile) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const updated = await updateProfile(activeProfile.id, {
        nama: activeProfile.nama,
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
        `Konfigurasi profil berhasil diperbarui ke versi v${updated.versi}. Aturan langsung aktif pada pipeline ingest.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyimpan profil");
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
      setErrorMsg(err.message || "Gagal menguji profil");
    } finally {
      setTesting(false);
    }
  };

  if (loadError) {
    return <ErrorPanel title="Profil pemantauan gagal dimuat" message={loadError} onRetry={loadProfiles} />;
  }

  if (loading) {
    return (
      <div className="panel p-16 text-center bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
        <div className="inline-block w-8 h-8 border-2 border-zinc-900 dark:border-white border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100">
          Memuat Aturan &amp; Profil Pemantauan...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-mono font-bold tracking-widest uppercase text-zinc-500 dark:text-zinc-400">
            Aturan pemantauan
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mt-0.5">
            Konfigurasi Profil &amp; Ambang Alert
          </h1>
        </div>
        <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
          Versi Aktif: v{activeProfile?.versi || 1}
        </div>
      </div>

      <section className="panel p-6 sm:p-8 space-y-6 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-500 dark:text-zinc-400">
              PROFIL AKTIF
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white mt-0.5 font-mono">
              {activeProfile?.nama || "Pemantauan Isu Publik & Layanan"}
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            ONLINE &bull; v{activeProfile?.versi || 1}
          </span>
        </div>

        {saveMessage && <Notice tone="success" message={saveMessage} onClose={() => setSaveMessage(null)} />}
        {errorMsg && <Notice tone="error" message={errorMsg} onClose={() => setErrorMsg(null)} />}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column: Wilayah, Kata kunci, Pengecualian */}
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                Wilayah Pantauan (Gazetteer)
              </label>
              <div className="flex flex-wrap gap-2 mb-2.5">
                {wilayahList.map((w) => (
                  <span
                    key={w}
                    className="inline-flex items-center bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 text-xs font-mono font-semibold px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-800"
                  >
                    {w}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(wilayahList, setWilayahList, w)}
                      className="ml-2 text-zinc-400 hover:text-red-500 font-bold"
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
                  className="flex-1 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none font-mono"
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
                  className="px-3 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-md text-xs font-mono font-bold"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                Kata Kunci Utama &amp; Sinonim
              </label>
              <div className="flex flex-wrap gap-2 mb-2.5">
                {keywordList.map((k) => (
                  <span
                    key={k}
                    className="inline-flex items-center bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 text-xs font-mono font-semibold px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-800"
                  >
                    {k}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(keywordList, setKeywordList, k)}
                      className="ml-2 text-zinc-400 hover:text-red-500 font-bold"
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
                  placeholder="Tambah kata kunci..."
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
                  className="flex-1 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none font-mono"
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
                  className="px-3 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-md text-xs font-mono font-bold"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                Pengecualian / Noise Filter
              </label>
              <div className="flex flex-wrap gap-2 mb-2.5">
                {pengecualianList.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 text-xs font-mono font-semibold px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-800"
                  >
                    {p}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(pengecualianList, setPengecualianList, p)}
                      className="ml-2 text-zinc-400 hover:text-red-500 font-bold"
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
                  placeholder="Tambah kata kunci noise (contoh: banjir diskon)..."
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
                  className="flex-1 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none font-mono"
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
                  className="px-3 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-md text-xs font-mono font-bold"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Kategori, Sumber data, Ambang alert */}
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                Kategori Masalah
              </label>
              <div className="flex flex-wrap gap-2">
                {kategoriList.map((kat) => (
                  <span
                    key={kat}
                    className="bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 text-xs font-mono font-semibold px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-800"
                  >
                    {kat}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
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
                    className="bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 text-xs font-mono font-semibold px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-800"
                  >
                    {src}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="ambang-range"
                className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                Ambang Deteksi Lonjakan (Anomali)
              </label>
              <div className="text-xs font-mono text-zinc-800 dark:text-zinc-200 mb-3">
                Lonjakan{" "}
                <strong className="text-zinc-900 dark:text-white font-bold">
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
                className="w-full accent-zinc-900 dark:accent-white cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-zinc-400 mt-1">
                <span>1,5&times;</span>
                <span className="text-zinc-900 dark:text-white font-bold">3&times; baseline</span>
                <span>5&times;</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-3 font-mono">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="min-h-[40px] px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-bold rounded-md transition-colors disabled:opacity-50 shadow-xs"
          >
            {saving ? "Menyimpan..." : "Simpan & Aktifkan"}
          </button>
          <button
            type="button"
            onClick={handleRun7dTest}
            disabled={testing}
            className="min-h-[40px] px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-bold rounded-md border border-zinc-300 dark:border-zinc-800 transition-colors disabled:opacity-50"
          >
            {testing ? "Menguji Data 7 Hari..." : "Uji Retrospektif 7 Hari"}
          </button>
        </div>

        {/* Retrospective Test Result */}
        {testResult && (
          <div className="mt-6 p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono space-y-3">
            <div className="font-bold text-zinc-900 dark:text-white text-xs uppercase tracking-wider">
              HASIL UJI RETROSPEKTIF 7 HARI (FR-03)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white dark:bg-black p-3 rounded-md border border-zinc-200 dark:border-zinc-800">
                <span className="text-zinc-400 block text-[11px]">Konten Diperiksa</span>
                <span className="font-black text-zinc-900 dark:text-white text-base">
                  {testResult.total_historical_items_checked}
                </span>
              </div>
              <div className="bg-white dark:bg-black p-3 rounded-md border border-zinc-200 dark:border-zinc-800">
                <span className="text-zinc-400 block text-[11px]">Cocok Kata Kunci</span>
                <span className="font-black text-zinc-900 dark:text-white text-base">
                  {testResult.matches_found}
                </span>
              </div>
              <div className="bg-white dark:bg-black p-3 rounded-md border border-zinc-200 dark:border-zinc-800">
                <span className="text-zinc-400 block text-[11px]">Noise Dieliminasi</span>
                <span className="font-black text-zinc-900 dark:text-white text-base">
                  {testResult.exclusions_filtered}
                </span>
              </div>
              <div className="bg-white dark:bg-black p-3 rounded-md border border-zinc-200 dark:border-zinc-800">
                <span className="text-zinc-400 block text-[11px]">Estimasi Tangkapan/Hari</span>
                <span className="font-black text-zinc-900 dark:text-white text-base">
                  &plusmn;{testResult.estimated_daily_catch}
                </span>
              </div>
            </div>
            <p className="text-zinc-700 dark:text-zinc-300 font-medium leading-relaxed">
              {testResult.recommendation}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
