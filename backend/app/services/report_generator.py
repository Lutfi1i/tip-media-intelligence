import json
from datetime import datetime
from typing import Dict, Any, List
from jinja2 import Template
from sqlalchemy.orm import Session
from backend.app.models import Report, Issue, Case, Region, RawItem

REPORT_HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>{{ judul }}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      color: #0F172A;
      background: #FFFFFF;
      margin: 0;
      padding: 40px;
    }
    .header {
      border-bottom: 2px solid #0F172A;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .brand {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #2563EB;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .title {
      font-size: 26px;
      font-weight: 800;
      color: #0F172A;
      margin: 0 0 8px 0;
    }
    .meta {
      font-size: 13px;
      color: #64748B;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }
    .kpi-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 16px;
    }
    .kpi-label {
      font-size: 12px;
      color: #64748B;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .kpi-val {
      font-size: 28px;
      font-weight: 800;
      color: #0F172A;
    }
    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: #0F172A;
      border-bottom: 1px solid #CBD5E1;
      padding-bottom: 8px;
      margin-top: 32px;
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 13px;
    }
    th {
      background: #F1F5F9;
      text-align: left;
      padding: 10px 12px;
      font-weight: 600;
      color: #334155;
      border-bottom: 1px solid #CBD5E1;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #E2E8F0;
      vertical-align: top;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
    }
    .badge-CRITICAL { background: #FEE2E2; color: #991B1B; }
    .badge-HIGH { background: #FFEDD5; color: #9A3412; }
    .badge-MEDIUM { background: #DBEAFE; color: #1E40AF; }
    .badge-LOW { background: #F1F5F9; color: #334155; }
    .footer {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid #E2E8F0;
      font-size: 11px;
      color: #94A3B8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">PT Technosoft Indo Prima &bull; TIP Media Intelligence</div>
    <h1 class="title">{{ judul }}</h1>
    <div class="meta">Periode: {{ periode }} | Tanggal Cetak: {{ generated_at }} | Klasifikasi: Rahasia Eksekutif</div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Mention Unik</div>
      <div class="kpi-val">{{ kpi.mention_unik }}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Isu Prioritas</div>
      <div class="kpi-val">{{ kpi.isu_prioritas }}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Wilayah Terdampak</div>
      <div class="kpi-val">{{ kpi.wilayah_terdampak }}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Kasus Selesai</div>
      <div class="kpi-val">{{ kpi.kasus_selesai }}</div>
    </div>
  </div>

  <div class="section-title">1. Ringkasan Eksekutif & Isu Prioritas</div>
  <p style="font-size: 14px; color: #334155; margin-bottom: 16px;">
    Sepanjang periode pemantauan, sistem mendeteksi total {{ kpi.mention_unik }} mention unik lintas kanal resmi dan media publik.
    Fokus utama tertuju pada wilayah Jakarta Selatan dan sekitarnya terkait eskalasi infrastruktur drainase dan genangan air hujan.
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 15%;">Kode & Level</th>
        <th style="width: 35%;">Judul Isu & Wilayah</th>
        <th style="width: 35%;">Ringkasan AI & Verifikasi Analis</th>
        <th style="width: 15%;">Status</th>
      </tr>
    </thead>
    <tbody>
      {% for issue in issues %}
      <tr>
        <td>
          <span class="badge badge-{{ issue.level }}">{{ issue.level }} &bull; {{ issue.skor|round|int }}</span>
          <div style="font-size: 11px; color: #64748B; margin-top: 4px;">{{ issue.kode_referensi }}</div>
        </td>
        <td>
          <strong>{{ issue.judul }}</strong>
          <div style="font-size: 12px; color: #475569; margin-top: 2px;">{{ issue.wilayah }} &bull; {{ issue.kategori }}</div>
        </td>
        <td>
          {{ issue.ringkasan }}
        </td>
        <td>
          <span style="font-weight: 600; text-transform: capitalize;">{{ issue.status }}</span>
        </td>
      </tr>
      {% endfor %}
    </tbody>
  </table>

  <div class="section-title">2. Sebaran Per Wilayah</div>
  <table>
    <thead>
      <tr>
        <th>Wilayah</th>
        <th>Total Mention</th>
        <th>Konten Unik</th>
        <th>Sentimen Negatif</th>
        <th>Isu Utama</th>
      </tr>
    </thead>
    <tbody>
      {% for reg in regions %}
      <tr>
        <td><strong>{{ reg.nama }}</strong></td>
        <td>{{ reg.mention_count }}</td>
        <td>{{ reg.unique_content_count }}</td>
        <td>{{ reg.sentiment_negative_pct }}%</td>
        <td>{{ reg.top_issue or 'Kondusif' }}</td>
      </tr>
      {% endfor %}
    </tbody>
  </table>

  <div class="section-title">3. Rekomendasi & Tindak Lanjut Unit (SLA)</div>
  <ul style="font-size: 13px; color: #334155; line-height: 1.8;">
    {% if issues %}
      {% for iss in issues[:3] %}
      <li>Prioritaskan penanganan isu <strong>{{ iss.judul }}</strong> di {{ iss.wilayah }} (Level: {{ iss.level }}, Skor: {{ iss.skor }}). Koordinasikan dengan unit teknis terkait.</li>
      {% endfor %}
    {% else %}
      <li>Terus pantau feed resmi portal berita dan instansi secara berkala guna deteksi dini potensi lonjakan isu.</li>
    {% endif %}
  </ul>

  <div class="footer">
    <div>Dokumen Otomatis Sistem TIP Media Intelligence &bull; Tanpa Tanda Tangan Basah</div>
    <div>Halaman 1 dari 1</div>
  </div>
</body>
</html>
"""

def generate_report_document(
    db: Session,
    jenis: str = "mingguan",
    periode: str = "9-15 November 2026"
) -> Report:
    """Generate executive report HTML artifact and store database record."""
    issues = db.query(Issue).order_by(Issue.skor.desc()).all()
    regions = db.query(Region).order_by(Region.mention_count.desc()).all()
    
    raw_count = db.query(RawItem).count()
    total_mention = sum(r.mention_count for r in regions) or raw_count
    priority_count = len([i for i in issues if i.level in ("CRITICAL", "HIGH")])
    cases = db.query(Case).all()
    completed_cases = len([c for c in cases if c.status == "selesai"])
    affected_regions = len([r for r in regions if r.mention_count > 0])

    kpi = {
        "mention_unik": total_mention,
        "isu_prioritas": priority_count,
        "wilayah_terdampak": affected_regions,
        "kasus_selesai": completed_cases,
    }

    template = Template(REPORT_HTML_TEMPLATE)
    rendered_html = template.render(
        judul=f"Laporan {jenis.capitalize()} Intelijen Media & Respon Krisis",
        periode=periode,
        generated_at=datetime.utcnow().strftime("%d %B %Y, %H:%M WIB"),
        kpi=kpi,
        issues=issues,
        regions=regions
    )

    report_record = Report(
        judul=f"Laporan {jenis.capitalize()} ({periode})",
        jenis=jenis,
        periode=periode,
        file_url=f"/reports/laporan_{jenis}_{datetime.utcnow().strftime('%Y%m%d%H%M')}.html",
        data_snapshot_json=json.dumps({
            "kpi": kpi,
            "total_issues": len(issues),
            "rendered_html": rendered_html
        }),
        dibuat_oleh="Sistem Analitik TIP MI"
    )
    db.add(report_record)
    db.commit()
    db.refresh(report_record)
    return report_record
