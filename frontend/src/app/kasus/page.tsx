"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchCases,
  updateCaseStatus,
  fetchIssues,
  fetchCurrentUser,
  onDataSynced,
  uploadCaseEvidence,
  downloadCaseEvidence,
  isStoredEvidenceUrl,
  CaseCard,
  IssueItem,
} from "@/lib/api";
import { fmtDateTime, parseUtc } from "@/lib/format";
import { ThreatLevelPill } from "@/components/RadarUi";
import { ErrorPanel, Modal, Notice } from "@/components/ui";

type CaseStatus = CaseCard["status"];

const COLUMNS: { status: CaseStatus; label: string; dot: string }[] = [
  { status: "menunggu", label: "Menunggu", dot: "bg-amber-400" },
  { status: "ditangani", label: "Ditangani", dot: "bg-sky-500" },
  { status: "selesai", label: "Selesai", dot: "bg-emerald-500" },
];

const inputCls =
  "w-full text-xs p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40";
const labelCls = "block font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1";

function deadlineMs(c: CaseCard): number {
  return parseUtc(c.tenggat)?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

/** "sisa 1j 20m" atau "lewat 3j 5m". */
function slaText(c: CaseCard, now: number): { text: string; overdue: boolean; soon: boolean } {
  const diff = deadlineMs(c) - now;
  const abs = Math.abs(diff);
  const hours = Math.floor(abs / 3_600_000);
  const mins = Math.floor((abs % 3_600_000) / 60_000);
  const span = hours >= 48 ? `${Math.floor(hours / 24)} hari` : `${hours}j ${mins}m`;
  if (diff <= 0) return { text: `lewat ${span}`, overdue: true, soon: false };
  return { text: `sisa ${span}`, overdue: false, soon: diff < 60 * 60_000 };
}

export default function PapanKasusPage() {
  const [cases, setCases] = useState<CaseCard[]>([]);
  const [issuesMap, setIssuesMap] = useState<Record<number, IssueItem>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [selectedCase, setSelectedCase] = useState<CaseCard | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newPic, setNewPic] = useState("");
  const [newStatus, setNewStatus] = useState<CaseStatus>("ditangani");
  const [buktiCatatan, setBuktiCatatan] = useState("");
  const [buktiUrl, setBuktiUrl] = useState("");
  const [buktiFiles, setBuktiFiles] = useState<File[]>([]);
  const [userNama, setUserNama] = useState("Pengguna tanpa login");

  useEffect(() => {
    fetchCurrentUser().then((res) => res.user && setUserNama(res.user.nama));
  }, []);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const [casesData, issuesData] = await Promise.all([fetchCases(), fetchIssues()]);
      setCases(casesData);
      const map: Record<number, IssueItem> = {};
      issuesData.forEach((i: IssueItem) => {
        map[i.id] = i;
      });
      setIssuesMap(map);
      return casesData as CaseCard[];
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memuat papan kasus";
      if (silent) setNotice({ tone: "error", text: `Pembaruan gagal: ${msg}` });
      else setLoadError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const openCase = (c: CaseCard) => {
    setSelectedCase(c);
    setNewPic(c.pic_nama || "");
    setNewStatus(c.status);
    setBuktiCatatan("");
    setBuktiUrl("");
    setBuktiFiles([]);
    setFormError(null);
  };

  useEffect(() => {
    // ?kasus=ID membuka langsung kasus yang ditautkan dari halaman detail isu.
    const target = Number(new URLSearchParams(window.location.search).get("kasus"));
    loadData().then((list) => {
      const c = target && list?.find((x) => x.id === target);
      if (c) openCase(c);
    });
    const off = onDataSynced(() => loadData(true));
    // Hitung mundur SLA diperbarui tiap 30 detik.
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      off();
      window.clearInterval(id);
    };
  }, [loadData]);

  const closeModal = () => {
    setSelectedCase(null);
    if (window.location.search.includes("kasus=")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    const hasExistingBukti = (selectedCase.bukti || []).length > 0;
    const addsBukti = !!(buktiCatatan.trim() || buktiUrl.trim() || buktiFiles.length);
    if (newStatus === "selesai" && !hasExistingBukti && !addsBukti) {
      setFormError("Kasus belum punya bukti. Isi catatan, tautan, atau lampirkan file sebelum menandai Selesai.");
      return;
    }
    setIsUpdating(true);
    setFormError(null);
    try {
      // File diunggah dulu: kalau gagal, status belum berubah dan pengguna bisa mencoba lagi.
      for (const f of buktiFiles) {
        await uploadCaseEvidence(selectedCase.id, f, userNama);
      }
      await updateCaseStatus(selectedCase.id, {
        pic_nama: newPic.trim() || selectedCase.pic_nama,
        status: newStatus,
        bukti_catatan: buktiCatatan.trim() || undefined,
        bukti_url: buktiUrl.trim() || undefined,
      });
      setNotice({ tone: "success", text: `Kasus #${selectedCase.id} diperbarui.` });
      closeModal();
      await loadData(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal memperbarui status kasus");
    } finally {
      setIsUpdating(false);
    }
  };

  const byStatus = useMemo(() => {
    const groups: Record<CaseStatus, CaseCard[]> = { menunggu: [], ditangani: [], selesai: [] };
    cases.forEach((c) => groups[c.status]?.push(c));
    groups.menunggu.sort((a, b) => deadlineMs(a) - deadlineMs(b));
    groups.ditangani.sort((a, b) => deadlineMs(a) - deadlineMs(b));
    groups.selesai.sort((a, b) => deadlineMs(b) - deadlineMs(a));
    return groups;
  }, [cases]);

  const activeCases = useMemo(
    () => [...byStatus.menunggu, ...byStatus.ditangani].sort((a, b) => deadlineMs(a) - deadlineMs(b)),
    [byStatus]
  );
  const overdueCount = activeCases.filter((c) => deadlineMs(c) <= now).length;
  const noPicCount = activeCases.filter((c) => !c.pic_nama).length;

  if (loadError) {
    return <ErrorPanel title="Papan kasus gagal dimuat" message={loadError} onRetry={() => loadData()} />;
  }

  const issueTitle = (c: CaseCard) => issuesMap[c.issue_id]?.judul || `Kasus #${c.id}`;

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
            Papan Kasus &amp; Tindak Lanjut Unit
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Kasus dibuat otomatis saat isu diverifikasi. Klik kartu untuk menetapkan PIC, mengubah status, atau menambah bukti.
          </p>
        </div>
        {!loading && (
          <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
            {activeCases.length} aktif
            {overdueCount > 0 && (
              <>
                {" "}
                &bull; <span className="font-bold text-red-600 dark:text-red-400">{overdueCount} lewat tenggat</span>
              </>
            )}
          </div>
        )}
      </div>

      {notice && <Notice tone={notice.tone} message={notice.text} onClose={() => setNotice(null)} />}

      {loading ? (
        <div className="panel py-12 text-center text-xs text-zinc-500 dark:text-zinc-400 font-mono bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
          Memuat papan kasus...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Perlu tindakan: kasus aktif, tenggat terdekat di atas */}
          <section className="lg:col-span-4 panel p-5 space-y-4 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
            <div className="pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-sm font-bold font-mono text-zinc-900 dark:text-white uppercase tracking-wider">
                Perlu tindakan
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Kasus aktif, diurutkan dari tenggat terdekat.
                {noPicCount > 0 && ` ${noPicCount} belum punya PIC.`}
              </p>
            </div>

            {activeCases.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">Tidak ada kasus aktif</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Semua kasus sudah selesai ditangani.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {activeCases.slice(0, 8).map((c) => {
                  const sla = slaText(c, now);
                  const issue = issuesMap[c.issue_id];
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => openCase(c)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          sla.overdue
                            ? "border-red-300 bg-red-50 hover:border-red-400 dark:border-red-500/40 dark:bg-red-500/10"
                            : "border-zinc-200 bg-zinc-50 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-600"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-snug">
                            {issueTitle(c)}
                          </span>
                          {issue && <ThreatLevelPill level={issue.level} score={issue.skor} />}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] font-mono">
                          <span
                            className={
                              sla.overdue
                                ? "font-bold text-red-600 dark:text-red-400"
                                : sla.soon
                                ? "font-bold text-amber-600 dark:text-amber-400"
                                : "text-zinc-500 dark:text-zinc-400"
                            }
                          >
                            {sla.text}
                          </span>
                          <span className="text-zinc-400">&bull;</span>
                          <span className={c.pic_nama ? "text-zinc-600 dark:text-zinc-300" : "font-bold text-amber-600 dark:text-amber-400"}>
                            {c.pic_nama ? `PIC: ${c.pic_nama}` : "Belum ada PIC"}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Kanban */}
          <section className="lg:col-span-8 panel p-5 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {COLUMNS.map((col) => (
                <div
                  key={col.status}
                  className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 space-y-3"
                >
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-xs font-bold font-mono uppercase text-zinc-700 dark:text-zinc-300">
                      {col.label} ({byStatus[col.status].length})
                    </h2>
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  </div>
                  <div className="space-y-2.5">
                    {byStatus[col.status].length === 0 ? (
                      <div className="text-[11px] text-zinc-400 text-center py-6 font-mono">Kosong</div>
                    ) : (
                      byStatus[col.status].map((c) => renderCaseCard(c))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      <Modal
        open={!!selectedCase}
        onClose={closeModal}
        title={selectedCase ? issueTitle(selectedCase) : ""}
        description={
          selectedCase
            ? `Kasus #${selectedCase.id} • ${selectedCase.unit} • tenggat ${fmtDateTime(selectedCase.tenggat)}`
            : undefined
        }
      >
        {selectedCase && (
          <form onSubmit={handleUpdate} className="space-y-4 text-xs font-mono">
            {formError && <Notice tone="error" message={formError} onClose={() => setFormError(null)} />}

            <div>
              <label htmlFor="pic-input" className={labelCls}>
                PIC lapangan / unit
              </label>
              <input
                id="pic-input"
                type="text"
                value={newPic}
                onChange={(e) => setNewPic(e.target.value)}
                placeholder="Nama petugas dan unitnya"
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="status-select" className={labelCls}>
                Status penanganan
              </label>
              <select
                id="status-select"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as CaseStatus)}
                className={`${inputCls} cursor-pointer`}
              >
                {COLUMNS.map((col) => (
                  <option key={col.status} value={col.status}>
                    {col.label}
                  </option>
                ))}
              </select>
              {newStatus === "selesai" && (selectedCase.bukti || []).length === 0 && (
                <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                  Status Selesai butuh minimal satu bukti penanganan.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="bukti-catatan" className={labelCls}>
                Catatan penanganan
              </label>
              <textarea
                id="bukti-catatan"
                rows={3}
                value={buktiCatatan}
                onChange={(e) => setBuktiCatatan(e.target.value)}
                placeholder="Tindakan yang sudah dilakukan di lapangan..."
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="bukti-url" className={labelCls}>
                Tautan bukti (opsional)
              </label>
              <input
                id="bukti-url"
                type="url"
                value={buktiUrl}
                onChange={(e) => setBuktiUrl(e.target.value)}
                placeholder="https://..."
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="bukti-file" className={labelCls}>
                Lampiran file (opsional)
              </label>
              <input
                id="bukti-file"
                type="file"
                multiple
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                onChange={(e) => setBuktiFiles(Array.from(e.target.files || []))}
                className="block w-full text-xs text-zinc-600 dark:text-zinc-400 file:mr-3 file:rounded-md file:border file:border-zinc-300 dark:file:border-zinc-700 file:bg-zinc-100 dark:file:bg-zinc-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-zinc-800 dark:file:text-zinc-200"
              />
              {buktiFiles.length > 0 && (
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {buktiFiles.length} file dipilih: {buktiFiles.map((f) => f.name).join(", ")}
                </p>
              )}
            </div>

            {(selectedCase.bukti || []).length > 0 && (
              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-1.5">
                <div className={labelCls}>Bukti tercatat ({selectedCase.bukti.length})</div>
                {selectedCase.bukti.map((b, i) => (
                  <div key={i} className="p-2 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px]">
                    <div className="text-zinc-500 dark:text-zinc-400">
                      {fmtDateTime(b.waktu)} &bull; {b.oleh}
                    </div>
                    <div className="text-zinc-800 dark:text-zinc-200">{b.catatan}</div>
                    {b.url &&
                      (isStoredEvidenceUrl(b.url) ? (
                        <button
                          type="button"
                          onClick={() =>
                            downloadCaseEvidence(b.url!, b.catatan.replace(/^Lampiran: /, "") || "bukti").catch((err) =>
                              setFormError(err instanceof Error ? err.message : "Gagal mengunduh bukti")
                            )
                          }
                          className="text-sky-600 dark:text-sky-400 hover:underline"
                        >
                          Unduh file
                        </button>
                      ) : (
                        <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-sky-600 dark:text-sky-400 hover:underline break-all">
                          {b.url}
                        </a>
                      ))}
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap justify-between items-center gap-2.5 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <Link
                href={`/isu/${selectedCase.issue_id}`}
                className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 hover:underline"
              >
                Buka berkas isu &rarr;
              </Link>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={closeModal}
                  className="min-h-[38px] px-4 py-2 border border-zinc-300 dark:border-zinc-800 rounded-md text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="min-h-[38px] px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-md text-xs font-bold disabled:opacity-50 shadow-xs"
                >
                  {isUpdating ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );

  function renderCaseCard(c: CaseCard) {
    const issue = issuesMap[c.issue_id];
    const sla = slaText(c, now);
    const buktiCount = (c.bukti || []).length;
    const isActive = c.status !== "selesai";

    return (
      <button
        key={c.id}
        type="button"
        onClick={() => openCase(c)}
        className={`w-full text-left bg-white dark:bg-[#09090B] rounded-lg p-3.5 border transition-colors cursor-pointer group shadow-2xs ${
          isActive && sla.overdue
            ? "border-red-300 dark:border-red-500/50 hover:border-red-500"
            : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-500"
        }`}
      >
        <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 group-hover:underline leading-snug">
          {issueTitle(c)}
        </div>

        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 font-mono space-y-0.5">
          {issue && (
            <div>
              <span
                className={
                  issue.level === "CRITICAL"
                    ? "text-red-500 font-bold"
                    : issue.level === "HIGH"
                    ? "text-orange-500 font-bold"
                    : "text-zinc-700 dark:text-zinc-300 font-bold"
                }
              >
                {issue.level}
              </span>{" "}
              &bull; {c.pic_nama ? c.pic_nama : <span className="text-amber-600 dark:text-amber-400">belum ada PIC</span>}
            </div>
          )}

          {isActive ? (
            <div
              className={
                sla.overdue
                  ? "font-bold text-red-600 dark:text-red-400"
                  : sla.soon
                  ? "font-bold text-amber-600 dark:text-amber-400"
                  : ""
              }
            >
              {sla.text}
            </div>
          ) : buktiCount > 0 ? (
            <div className="text-emerald-600 dark:text-emerald-400 font-bold">{buktiCount} bukti terlampir</div>
          ) : (
            <div className="text-amber-600 dark:text-amber-400 font-bold">Tanpa bukti</div>
          )}
        </div>
      </button>
    );
  }
}
