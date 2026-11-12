"""Laporan Social Pulse (HTML siap cetak / simpan PDF dari peramban).

Isi diambil dari fungsi analitik yang sama dengan dashboard, sehingga angka di laporan
sama dengan yang dilihat analis. Template memakai autoescape karena memuat teks
postingan dari internet.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from jinja2 import Environment
from sqlalchemy.orm import Session

from backend.app.models import Report
from backend.app.services.social_pulse_service import (
    get_agency_board,
    get_period_comparison,
    get_platform_metrics,
    get_social_brief,
    get_social_pulse_overview,
    get_social_trends,
)

_ENV = Environment(autoescape=True)

TEMPLATE = _ENV.from_string("""<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ judul }}</title>
<style>
  :root { --ink:#0F172A; --muted:#64748B; --line:#E2E8F0; --soft:#F8FAFC; --accent:#A21CAF; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: var(--ink);
         background: #fff; margin: 0; padding: 32px; line-height: 1.5; font-size: 13px; }
  .wrap { max-width: 960px; margin: 0 auto; }
  header { border-bottom: 2px solid var(--ink); padding-bottom: 14px; margin-bottom: 22px; }
  .brand { font-size: 11px; font-weight: 700; letter-spacing: .08em; color: var(--accent); text-transform: uppercase; }
  h1 { font-size: 22px; margin: 4px 0; }
  h2 { font-size: 15px; margin: 26px 0 10px; border-bottom: 1px solid var(--line); padding-bottom: 6px; }
  .meta { color: var(--muted); font-size: 12px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .kpi { background: var(--soft); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
  .kpi .l { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .kpi .v { font-size: 20px; font-weight: 800; }
  .kpi .s { font-size: 11px; color: var(--muted); }
  ul.brief { padding-left: 18px; margin: 0; }
  ul.brief li { margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted);
       border-bottom: 1px solid var(--line); padding: 6px 8px; }
  td { border-bottom: 1px solid var(--line); padding: 6px 8px; vertical-align: top; }
  td.n { text-align: right; font-variant-numeric: tabular-nums; }
  .tag { display: inline-block; border: 1px solid var(--line); border-radius: 10px; padding: 0 6px; font-size: 10px; margin: 1px 2px 1px 0; }
  .note { color: var(--muted); font-size: 11px; }
  .actions { margin-bottom: 18px; }
  .actions button { background: var(--ink); color: #fff; border: 0; border-radius: 6px; padding: 8px 14px; font-weight: 600; cursor: pointer; }
  footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid var(--line); color: var(--muted); font-size: 11px; }
  @media (max-width: 640px) { body { padding: 16px; } .kpis { grid-template-columns: repeat(2, 1fr); } }
  @media print {
    body { padding: 0; font-size: 11px; }
    .actions { display: none; }
    h2 { break-after: avoid; }
    tr, .kpi, li { break-inside: avoid; }
    @page { margin: 14mm; }
  }
</style>
</head>
<body><div class="wrap">
<div class="actions"><button onclick="window.print()">Cetak / Simpan PDF</button></div>
<header>
  <div class="brand">TIP Media Intelligence · RADAR Social Pulse</div>
  <h1>{{ judul }}</h1>
  <div class="meta">Cakupan: {{ scope_name }} · Periode: {{ period.label }} · Disusun {{ dibuat }} WIB</div>
</header>

<h2>Ringkasan</h2>
<ul class="brief">{% for p in brief.points %}<li>{{ p.text }}</li>{% endfor %}</ul>

<h2>Angka utama</h2>
<div class="kpis">
  <div class="kpi"><div class="l">Konten medsos</div><div class="v">{{ cmp.summary_a.mentions }}</div>
    <div class="s">pembanding {{ cmp.summary_b.mentions }}</div></div>
  <div class="kpi"><div class="l">Negatif</div><div class="v">{{ cmp.summary_a.negative_pct }}%</div>
    <div class="s">pembanding {{ cmp.summary_b.negative_pct }}%</div></div>
  <div class="kpi"><div class="l">Akun unik</div><div class="v">{{ cmp.summary_a.accounts }}</div>
    <div class="s">pembanding {{ cmp.summary_b.accounts }}</div></div>
  <div class="kpi"><div class="l">Tayangan tercatat</div><div class="v">{{ fmt(cmp.summary_a.views) }}</div>
    <div class="s">pembanding {{ fmt(cmp.summary_b.views) }}</div></div>
</div>
<p class="note">Pembanding: {{ cmp.period_b.label }}.{% if cmp.note %} {{ cmp.note }}{% endif %}</p>

<h2>Topik teratas</h2>
{% if trends %}
<table><thead><tr><th>#</th><th>Topik</th><th>Konten</th><th>Laju</th><th>Kategori / Instansi</th><th>Negatif</th><th>Status analis</th></tr></thead><tbody>
{% for t in trends %}<tr>
  <td>{{ t.rank }}</td><td><strong>{{ t.topic }}</strong>{% if t.coordination.flagged %}<br><span class="note">indikasi teks kembar</span>{% endif %}</td>
  <td class="n">{{ t.mention_count }}</td><td>{{ t.velocity_status }}</td>
  <td>{% for c in t.categories %}<span class="tag">{{ c.label }}</span>{% endfor %}{% for a in t.agencies %}<span class="tag">{{ a.label }}</span>{% endfor %}</td>
  <td class="n">{{ t.sentiment_pct.negatif }}%</td>
  <td>{% if t.analyst_note %}{{ t.analyst_note.status_label }}<br><span class="note">{{ t.analyst_note.aktor }}{% if t.analyst_note.catatan %}: {{ t.analyst_note.catatan }}{% endif %}</span>{% else %}<span class="note">belum ada</span>{% endif %}</td>
</tr>{% endfor %}
</tbody></table>
{% else %}<p class="note">Tidak ada topik pada periode ini.</p>{% endif %}

<h2>Instansi yang disebut</h2>
{% if agencies %}
<table><thead><tr><th>Instansi</th><th>Sebutan</th><th>Share of voice</th><th>Negatif</th><th>Emosi dominan</th><th>Topik</th></tr></thead><tbody>
{% for a in agencies %}<tr>
  <td>{{ a.label }}</td><td class="n">{{ a.mention_count }}</td><td class="n">{{ a.share_of_voice_pct }}%</td>
  <td class="n">{{ a.negative_count }}</td><td>{{ a.emotions[0].label if a.emotions else "-" }}</td>
  <td>{{ a.top_topics | join(", ") if a.top_topics else "-" }}</td>
</tr>{% endfor %}
</tbody></table>
{% else %}<p class="note">Tidak ada instansi yang disebut.</p>{% endif %}

<h2>Kategori: periode ini vs pembanding</h2>
{% if cmp.categories %}
<table><thead><tr><th>Kategori</th><th>Periode ini</th><th>Pembanding</th><th>Perubahan</th></tr></thead><tbody>
{% for c in cmp.categories[:12] %}<tr><td>{{ c.label }}</td><td class="n">{{ c.a }}</td><td class="n">{{ c.b }}</td>
<td class="n">{{ "%+d" % c.delta }}{% if c.change_pct is not none %} ({{ "%+.0f" % c.change_pct }}%){% endif %}</td></tr>{% endfor %}
</tbody></table>
{% else %}<p class="note">Belum ada konten berkategori.</p>{% endif %}

<h2>Emosi</h2>
{% if overview.emotion_breakdown %}
<p>{% for e in overview.emotion_breakdown %}<span class="tag">{{ e.label }} {{ e.pct }}%</span>{% endfor %}</p>
<p class="note">Persentase konten yang memuat kata emosi tersebut. Satu konten bisa memuat lebih dari satu emosi.</p>
{% else %}<p class="note">Tidak ada kata emosi terdeteksi.</p>{% endif %}

<h2>Sumber dan kesehatan kanal</h2>
<table><thead><tr><th>Platform</th><th>Status</th><th>Konten</th><th>Catatan</th></tr></thead><tbody>
{% for p in platforms %}<tr><td>{{ p.name }}</td><td>{{ p.official_status }}</td><td class="n">{{ p.mention_count }}</td><td class="note">{{ p.note or "" }}</td></tr>{% endfor %}
</tbody></table>

<footer>
  Metode: konten dikumpulkan dari sumber publik terdaftar; kategori, instansi, dan emosi ditentukan dari kamus kata;
  laju dihitung terhadap baseline periode sebelumnya (z-score, minimal {{ overview.baseline.min_surge_volume }} konten).
  Baseline tersedia {{ overview.baseline.windows_available }} dari {{ overview.baseline.windows_target }} periode.
  Angka engagement hanya dari sumber yang menyediakannya.
</footer>
</div></body></html>
""")


def _fmt(n: Optional[int]) -> str:
    if n is None:
        return "-"
    return f"{n:,}".replace(",", ".")


def generate_social_report(db: Session, time_range: str = "24h", scope_kode: str = "ID", dibuat_oleh: str = "Sistem Otomatis") -> Report:
    overview = get_social_pulse_overview(db, time_range=time_range, scope_kode=scope_kode)
    brief = get_social_brief(db, time_range=time_range, scope_kode=scope_kode)
    trends = get_social_trends(db, time_range=time_range, scope_kode=scope_kode, limit=15)
    agencies = [a for a in get_agency_board(db, time_range=time_range, scope_kode=scope_kode)["agencies"] if a["mention_count"]][:12]
    cmp = get_period_comparison(db, time_range=time_range, scope_kode=scope_kode)
    platforms = get_platform_metrics(db, scope_kode=scope_kode, time_range=time_range)

    period = overview["period"]
    jenis = {"24h": "social_harian", "7d": "social_mingguan", "30d": "social_bulanan"}.get(time_range, "social_kustom")
    judul = f"Laporan Social Pulse: {overview['scope_name']}, {period['label']}"
    dibuat = (datetime.utcnow() + timedelta(hours=7)).strftime("%d-%m-%Y %H:%M")

    html = TEMPLATE.render(
        judul=judul, scope_name=overview["scope_name"], period=period, dibuat=dibuat, brief=brief,
        overview=overview, trends=trends, agencies=agencies, cmp=cmp, platforms=platforms, fmt=_fmt,
    )

    snapshot: Dict[str, Any] = {
        "rendered_html": html,
        "period": period,
        "total_mentions": overview["total_mentions"],
        "negative_ratio_pct": overview["negative_ratio_pct"],
        "brief": brief["points"],
    }
    report = Report(
        judul=judul[:255],
        jenis=jenis,
        periode=period["label"][:100],
        file_url=None,
        data_snapshot_json=json.dumps(snapshot),
        dibuat_oleh=dibuat_oleh,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    report.file_url = f"/api/v1/reports/{report.id}/view"
    db.commit()
    return report
