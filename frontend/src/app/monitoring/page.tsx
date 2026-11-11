"use client";

import { useEffect, useState } from "react";
import { Sliders, Plus, X, Check, Play, RefreshCw, AlertCircle, History } from "lucide-react";
import { fetchProfiles, testProfile7d, MonitoringProfile } from "@/lib/api";

export default function MonitoringPage() {
  const [profiles, setProfiles] = useState<MonitoringProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<MonitoringProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Form State
  const [wilayahList, setWilayahList] = useState<string[]>([]);
  const [keywordList, setKeywordList] = useState<string[]>([]);
  const [sinonimList, setSinonimList] = useState<string[]>([]);
  const [pengecualianList, setPengecualianList] = useState<string[]>([]);
  const [kategoriList, setKategoriList] = useState<string[]>([]);
  const [sources, setSources] = useState({
    media_online: true,
    rss: true,
    situs_resmi: true,
    pengaduan: true,
  });
  const [ambangMultiplier, setAmbangMultiplier] = useState(3.0);

  // New tag inputs
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

  const handleAddTag = (list: string[], setList: (val: string[]) => void, value: string, clearFn: () => void) => {
    if (value.trim() && !list.includes(value.trim())) {
      setList([...list, value.trim()]);
      clearFn();
    }
  };

  const handleRemoveTag = (list: string[], setList: (val: string[]) => void, itemToRemove: string) => {
    setList(list.filter((t) => t !== itemToRemove));
  };

  const handleSave = async () => {
    if (!activeProfile) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/v1/profiles/${activeProfile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });
      const updated = await response.json();
      setActiveProfile(updated);
      setSaveMessage(`Profil berhasil disimpan sebagai versi v${updated.versi}`);
      loadProfiles();
    } catch (err) {
      console.error(err);
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
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Memuat konfigurasi monitoring...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Atur Wilayah, Kata Kunci, dan Ambang Alert
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            app.tipmedia.id/monitoring/banjir-jaksel &bull; Pengaturan parameter operasional dan filter AI
          </p>
        </div>
        <div className="mt-3 sm:mt-0 flex items-center space-x-2">
          <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded font-semibold border border-slate-200">
            Data Simulasi
          </span>
        </div>
      </div>

      {/* Main Settings Card - Slide 10 Mockup */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 mb-6 gap-3">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Profil Terpilih
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-0.5">
              Profil: {activeProfile?.nama || "Kesiapsiagaan Banjir - Jakarta Selatan"}
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
              Aktif &bull; v{activeProfile?.versi || 3}
            </span>
          </div>
        </div>

        {saveMessage && (
          <div className="mb-6 p-3 bg-emerald-50 border border-emerald-300 rounded text-sm text-emerald-900 font-medium flex items-center">
            <Check className="w-4 h-4 mr-2 text-emerald-600" />
            {saveMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column: Wilayah, Kata Kunci, Pengecualian */}
          <div className="space-y-6">
            {/* Wilayah */}
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">
                Wilayah Cakupan
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {wilayahList.map((w) => (
                  <span
                    key={w}
                    className="inline-flex items-center bg-blue-100 text-blue-900 text-xs font-medium px-2.5 py-1 rounded border border-blue-200"
                  >
                    {w}
                    <button
                      onClick={() => handleRemoveTag(wilayahList, setWilayahList, w)}
                      className="ml-1.5 hover:text-red-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex mt-1">
                <input
                  type="text"
                  placeholder="Tambah kecamatan / kelurahan..."
                  value={newWilayah}
                  onChange={(e) => setNewWilayah(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    handleAddTag(wilayahList, setWilayahList, newWilayah, () => setNewWilayah(""))
                  }
                  className="flex-1 text-xs border border-slate-300 rounded-l px-3 py-1.5 focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    handleAddTag(wilayahList, setWilayahList, newWilayah, () => setNewWilayah(""))
                  }
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 rounded-r border border-l-0 border-slate-300"
                >
                  Tambah
                </button>
              </div>
            </div>

            {/* Kata Kunci */}
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">
                Kata Kunci
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {keywordList.map((k) => (
                  <span
                    key={k}
                    className="inline-flex items-center bg-blue-100 text-blue-900 text-xs font-medium px-2.5 py-1 rounded border border-blue-200"
                  >
                    {k}
                    <button
                      onClick={() => handleRemoveTag(keywordList, setKeywordList, k)}
                      className="ml-1.5 hover:text-red-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex mt-1">
                <input
                  type="text"
                  placeholder="Tambah kata kunci pantauan..."
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    handleAddTag(keywordList, setKeywordList, newKeyword, () => setNewKeyword(""))
                  }
                  className="flex-1 text-xs border border-slate-300 rounded-l px-3 py-1.5 focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    handleAddTag(keywordList, setKeywordList, newKeyword, () => setNewKeyword(""))
                  }
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 rounded-r border border-l-0 border-slate-300"
                >
                  Tambah
                </button>
              </div>
            </div>

            {/* Pengecualian */}
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">
                Pengecualian (Stopwords / False Alarm Guard)
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {pengecualianList.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-1 rounded border border-slate-300"
                  >
                    {p}
                    <button
                      onClick={() => handleRemoveTag(pengecualianList, setPengecualianList, p)}
                      className="ml-1.5 hover:text-red-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex mt-1">
                <input
                  type="text"
                  placeholder="Misal: banjir diskon, banjir order..."
                  value={newPengecualian}
                  onChange={(e) => setNewPengecualian(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    handleAddTag(pengecualianList, setPengecualianList, newPengecualian, () =>
                      setNewPengecualian("")
                    )
                  }
                  className="flex-1 text-xs border border-slate-300 rounded-l px-3 py-1.5 focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    handleAddTag(pengecualianList, setPengecualianList, newPengecualian, () =>
                      setNewPengecualian("")
                    )
                  }
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 rounded-r border border-l-0 border-slate-300"
                >
                  Tambah
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Kategori, Sumber Data, Ambang Alert */}
          <div className="space-y-6">
            {/* Kategori */}
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">
                Kategori Taksonomi
              </label>
              <div className="flex flex-wrap gap-2">
                {kategoriList.map((kat) => (
                  <span
                    key={kat}
                    className="bg-indigo-50 text-indigo-900 text-xs font-semibold px-2.5 py-1 rounded border border-indigo-200"
                  >
                    {kat}
                  </span>
                ))}
              </div>
            </div>

            {/* Sumber Data */}
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">
                Sumber Data Terhubung
              </label>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <label className="flex items-center space-x-2 bg-slate-50 p-2.5 rounded border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sources.media_online}
                    onChange={(e) => setSources({ ...sources, media_online: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-800">Media online</span>
                </label>
                <label className="flex items-center space-x-2 bg-slate-50 p-2.5 rounded border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sources.rss}
                    onChange={(e) => setSources({ ...sources, rss: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-800">RSS Resmi</span>
                </label>
                <label className="flex items-center space-x-2 bg-slate-50 p-2.5 rounded border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sources.situs_resmi}
                    onChange={(e) => setSources({ ...sources, situs_resmi: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-800">Situs resmi (BPBD)</span>
                </label>
                <label className="flex items-center space-x-2 bg-slate-50 p-2.5 rounded border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sources.pengaduan}
                    onChange={(e) => setSources({ ...sources, pengaduan: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-800">Kanal pengaduan warga</span>
                </label>
              </div>
            </div>

            {/* Ambang Alert */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <label className="block text-sm font-bold text-slate-900 mb-1">
                Ambang Alert Deteksi Dini
              </label>
              <div className="text-xs text-slate-600 mb-3">
                Lonjakan &ge; <span className="font-bold text-blue-700">{ambangMultiplier}x baseline</span> normal &rarr; HIGH ke analis piket
              </div>
              <input
                type="range"
                min="1.5"
                max="5.0"
                step="0.5"
                value={ambangMultiplier}
                onChange={(e) => setAmbangMultiplier(parseFloat(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                <span>1.5x (Sensitif)</span>
                <span>3.0x (Standar MVP)</span>
                <span>5.0x (Ketat)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons - Slide 10 Mockup */}
        <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-md shadow-sm transition-colors disabled:opacity-50"
          >
            {saving ? "Menyimpan Versi..." : "Simpan & aktifkan"}
          </button>
          <button
            onClick={handleRun7dTest}
            disabled={testing}
            className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-800 text-sm font-semibold rounded-md border border-slate-300 shadow-sm transition-colors disabled:opacity-50 inline-flex items-center"
          >
            <Play className="w-3.5 h-3.5 mr-2 text-slate-600" />
            {testing ? "Menganalisis 7 Hari..." : "Uji dengan data 7 hari"}
          </button>
        </div>

        {/* Test Result Display - FR-03 */}
        {testResult && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs">
            <div className="font-bold text-blue-900 text-sm mb-1 flex items-center">
              <Check className="w-4 h-4 mr-1.5 text-blue-600" />
              Hasil Uji Retrospektif 7 Hari (FR-03)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-slate-700">
              <div className="bg-white p-2.5 rounded border border-blue-100">
                <span className="text-slate-500 block">Konten Dianalisis</span>
                <span className="font-bold text-slate-900 text-sm">{testResult.total_historical_items_checked}</span>
              </div>
              <div className="bg-white p-2.5 rounded border border-blue-100">
                <span className="text-slate-500 block">Kandidat Cocok</span>
                <span className="font-bold text-blue-700 text-sm">{testResult.matches_found}</span>
              </div>
              <div className="bg-white p-2.5 rounded border border-blue-100">
                <span className="text-slate-500 block">Tersaring Pengecualian</span>
                <span className="font-bold text-slate-900 text-sm">{testResult.exclusions_filtered}</span>
              </div>
              <div className="bg-white p-2.5 rounded border border-blue-100">
                <span className="text-slate-500 block">Tangkapan Harian Est.</span>
                <span className="font-bold text-slate-900 text-sm">&plusmn; {testResult.estimated_daily_catch} isu/hari</span>
              </div>
            </div>
            <p className="mt-3 text-blue-950 font-medium">{testResult.recommendation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
