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
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
        <p className="text-sm font-semibold text-slate-700">
          Memuat parameter profil monitoring...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold tracking-wider uppercase text-blue-700">
          Monitoring
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">
          Atur wilayah, kata kunci, dan ambang alert
        </h1>
      </div>

      {/* Main Card matching Slide 10 */}
      <section className="bg-white rounded-xl border border-slate-200/90 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-100 mb-6">
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
            Profil:{" "}
            {activeProfile?.nama || "Kesiapsiagaan Banjir - Jakarta Selatan"}
          </h2>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            Aktif &middot; v{activeProfile?.versi || 3}
          </span>
        </div>

        {saveMessage && (
          <div className="mb-6 p-3.5 bg-emerald-50 border border-emerald-300 rounded-lg text-sm text-emerald-900 font-semibold">
            {saveMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column: Wilayah, Kata kunci, Pengecualian */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-2">
                Wilayah
              </label>
              <div className="flex flex-wrap gap-2 mb-2.5">
                {wilayahList.map((w) => (
                  <span
                    key={w}
                    className="inline-flex items-center bg-[#EFF6FF] text-[#1E3A8A] text-xs font-bold px-3 py-1.5 rounded-full border border-blue-200"
                  >
                    {w}
                    <button
                      type="button"
                      onClick={() =>
                        handleRemoveTag(wilayahList, setWilayahList, w)
                      }
                      className="ml-2 text-blue-700 hover:text-red-700 font-bold"
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
                  placeholder="Tambah wilayah pantauan..."
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
                  className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-2 focus:border-blue-600 focus:outline-none"
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
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300"
                >
                  Tambah
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-500 mb-2">
                Kata kunci
              </label>
              <div className="flex flex-wrap gap-2 mb-2.5">
                {keywordList.map((k) => (
                  <span
                    key={k}
                    className="inline-flex items-center bg-[#EFF6FF] text-[#1E3A8A] text-xs font-bold px-3 py-1.5 rounded-full border border-blue-200"
                  >
                    {k}
                    <button
                      type="button"
                      onClick={() =>
                        handleRemoveTag(keywordList, setKeywordList, k)
                      }
                      className="ml-2 text-blue-700 hover:text-red-700 font-bold"
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
                  className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-2 focus:border-blue-600 focus:outline-none"
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
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300"
                >
                  Tambah
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-500 mb-2">
                Pengecualian
              </label>
              <div className="flex flex-wrap gap-2 mb-2.5">
                {pengecualianList.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-300"
                  >
                    {p}
                    <button
                      type="button"
                      onClick={() =>
                        handleRemoveTag(
                          pengecualianList,
                          setPengecualianList,
                          p
                        )
                      }
                      className="ml-2 text-slate-500 hover:text-red-700 font-bold"
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
                  className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-2 focus:border-blue-600 focus:outline-none"
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
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300"
                >
                  Tambah
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Kategori, Sumber data, Ambang alert */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-2">
                Kategori
              </label>
              <div className="flex flex-wrap gap-2">
                {kategoriList.map((kat) => (
                  <span
                    key={kat}
                    className="bg-[#EFF6FF] text-[#1E3A8A] text-xs font-bold px-3.5 py-1.5 rounded-full border border-blue-200"
                  >
                    {kat}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-500 mb-2">
                Sumber data
              </label>
              <div className="flex flex-wrap gap-2">
                {["Media online", "RSS", "Situs resmi", "Pengaduan"].map(
                  (src) => (
                    <span
                      key={src}
                      className="bg-[#EFF6FF] text-[#1E3A8A] text-xs font-bold px-3.5 py-1.5 rounded-full border border-blue-200"
                    >
                      {src}
                    </span>
                  )
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="ambang-range"
                className="block text-sm font-medium text-slate-500 mb-1.5"
              >
                Ambang alert
              </label>
              <div className="text-sm font-medium text-slate-900 mb-3">
                Lonjakan{" "}
                <strong className="font-extrabold">
                  &ge; {ambangMultiplier}&times; baseline
                </strong>{" "}
                &rarr; HIGH ke analis piket
              </div>
              <input
                id="ambang-range"
                type="range"
                min="1.5"
                max="5.0"
                step="0.5"
                value={ambangMultiplier}
                onChange={(e) =>
                  setAmbangMultiplier(parseFloat(e.target.value))
                }
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>1,5&times;</span>
                <span>3&times; baseline</span>
                <span>5&times;</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons matching Slide 10 */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="min-h-[44px] px-5 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan & aktifkan"}
          </button>
          <button
            type="button"
            onClick={handleRun7dTest}
            disabled={testing}
            className="min-h-[44px] px-5 py-2.5 bg-white hover:bg-blue-50 text-[#2563EB] text-sm font-bold rounded-lg border-2 border-[#2563EB] transition-colors disabled:opacity-50"
          >
            {testing ? "Menguji Data 7 Hari..." : "Uji dengan data 7 hari"}
          </button>
        </div>

        {testResult && (
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div className="font-bold text-slate-900 text-sm mb-2">
              Hasil Uji Retrospektif 7 Hari (FR-03)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Konten Diperiksa</span>
                <span className="font-extrabold text-slate-900 text-base">
                  {testResult.total_historical_items_checked}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Cocok Kata Kunci</span>
                <span className="font-extrabold text-blue-700 text-base">
                  {testResult.matches_found}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">
                  Dieliminasi Pengecualian
                </span>
                <span className="font-extrabold text-slate-900 text-base">
                  {testResult.exclusions_filtered}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Estimasi Isu/Hari</span>
                <span className="font-extrabold text-slate-900 text-base">
                  &plusmn;{testResult.estimated_daily_catch}
                </span>
              </div>
            </div>
            <p className="mt-3 text-slate-700 font-medium">
              {testResult.recommendation}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
