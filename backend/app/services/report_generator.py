import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from jinja2 import Template
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.app.models import Case, Issue, RawItem, Region, Report, Source
from backend.app.services.storage import get_object, put_object

WIB = timezone(timedelta(hours=7))

BULAN_ID = [
    "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]


def _fmt_tanggal_id(dt: datetime) -> str:
    return f"{dt.day} {BULAN_ID[dt.month]} {dt.year}"


def _fmt_waktu_wib(dt: datetime) -> str:
    wib_dt = dt.replace(tzinfo=timezone.utc).astimezone(WIB) if dt.tzinfo is None else dt.astimezone(WIB)
    return f"{wib_dt.strftime('%H.%M')} WIB"


def _fmt_num_id(val: int | float) -> str:
    return f"{int(round(val)):,}".replace(",", ".")


def _doc_number(jenis: str, seq: int = 1) -> str:
    kode_map = {"harian": "HAR", "mingguan": "MIN", "bulanan": "BUL", "insidental": "INS"}
    kode = kode_map.get(jenis.lower(), "HAR")
    now_wib = datetime.now(WIB)
    return f"TIP-MI/{kode}/{now_wib.strftime('%Y-%m-%d')}/{seq:03d}"


REPORT_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>{{ judul }} - {{ doc_number }}</title>
  <style>
    @page {
      size: A4;
      margin: 25mm 20mm 25mm 30mm;
      @top-left {
        content: "TIP Media Intelligence · Laporan Situasi Isu Publik";
        font: 8.5pt "Inter", Arial, sans-serif;
        color: #737B89;
      }
      @top-right {
        content: "{{ klasifikasi }}";
        font: 8.5pt "Inter", Arial, sans-serif;
        color: #737B89;
      }
      @bottom-left {
        content: "{{ doc_number }} · v{{ versi }}";
        font: 8.5pt "Inter", Arial, sans-serif;
        color: #737B89;
      }
      @bottom-right {
        content: "Halaman " counter(page) " dari " counter(pages);
        font: 8.5pt "Inter", Arial, sans-serif;
        color: #737B89;
      }
    }
    @page :first {
      margin-top: 20mm;
      @top-left { content: none; }
      @top-right { content: none; }
    }
    body {
      font-family: "Noto Serif", Georgia, "Times New Roman", serif;
      font-size: 10.5pt;
      line-height: 1.45;
      color: #202B3A;
      background: #FFFFFF;
      margin: 0;
      padding: 28px 36px;
    }
    .kop {
      display: flex;
      align-items: center;
      gap: 14px;
      padding-bottom: 10px;
      border-bottom: 2px solid #202B3A;
    }
    .kop-inner-rule {
      border-top: 0.75px solid #202B3A;
      margin-top: 2px;
      margin-bottom: 14px;
    }
    .kop-logo {
      width: 44px;
      height: 44px;
      border: 1.5px solid #202B3A;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: "Inter", Arial, sans-serif;
      font-weight: 800;
      font-size: 13pt;
      color: #202B3A;
      flex-shrink: 0;
    }
    .kop-org {
      font-family: "Inter", Arial, sans-serif;
      font-size: 13pt;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin: 0;
    }
    .kop-unit {
      font-family: "Inter", Arial, sans-serif;
      font-size: 9.5pt;
      font-weight: 600;
      color: #2161F5;
      margin: 1px 0 2px 0;
    }
    .kop-addr {
      font-family: "Inter", Arial, sans-serif;
      font-size: 8pt;
      color: #737B89;
      margin: 0;
    }
    .doc-title-block {
      text-align: center;
      margin: 10px 0 14px 0;
    }
    .doc-title {
      font-family: "Inter", Arial, sans-serif;
      font-size: 13pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin: 0;
    }
    .doc-subtitle {
      font-family: "Inter", Arial, sans-serif;
      font-size: 10.5pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #202B3A;
      margin: 2px 0 0 0;
    }
    .meta-box {
      border-top: 1px solid #202B3A;
      border-bottom: 1px solid #202B3A;
      padding: 8px 0;
      margin-bottom: 18px;
      font-family: "Inter", Arial, sans-serif;
      font-size: 9pt;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
    }
    .meta-table td {
      padding: 2px 6px 2px 0;
      border: none;
      vertical-align: top;
    }
    .meta-label { color: #737B89; width: 110px; font-weight: 600; }
    .meta-val { color: #202B3A; font-weight: 500; }
    h1 {
      font-family: "Inter", Arial, sans-serif;
      font-size: 11.5pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #202B3A;
      border-bottom: 1px solid #E8EBF0;
      padding-bottom: 4px;
      margin: 18px 0 8px 0;
      break-after: avoid;
    }
    p.prose {
      text-align: justify;
      margin: 0 0 10px 0;
    }
    .kpi-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin: 10px 0 14px 0;
      font-family: "Inter", Arial, sans-serif;
    }
    .kpi-cell {
      border: 1px solid #E8EBF0;
      padding: 8px 10px;
      background: #FAFBFC;
    }
    .kpi-lbl { font-size: 8pt; color: #737B89; text-transform: uppercase; font-weight: 600; }
    .kpi-num { font-size: 15pt; font-weight: 800; color: #202B3A; margin-top: 2px; }
    .kpi-unit { font-size: 8pt; color: #737B89; font-weight: 400; }
    .table-caption {
      font-family: "Inter", Arial, sans-serif;
      font-size: 9pt;
      font-weight: 700;
      margin: 8px 0 4px 0;
      color: #202B3A;
    }
    table.data {
      width: 100%;
      border-collapse: collapse;
      font-family: "Inter", Arial, sans-serif;
      font-size: 8.8pt;
      margin-bottom: 4px;
    }
    table.data thead {
      display: table-header-group;
      background: #EEF4FF;
    }
    table.data th {
      text-align: left;
      padding: 5px 6px;
      font-weight: 700;
      color: #202B3A;
      border-top: 1px solid #202B3A;
      border-bottom: 1px solid #202B3A;
    }
    table.data td {
      padding: 5px 6px;
      border-bottom: 0.5pt solid #E8EBF0;
      vertical-align: top;
    }
    table.data tr { break-inside: avoid; }
    .angka { text-align: right; font-variant-numeric: tabular-nums; }
    .table-source {
      font-family: "Inter", Arial, sans-serif;
      font-size: 8pt;
      color: #737B89;
      margin: 2px 0 12px 0;
    }
    .badge {
      display: inline-block;
      padding: 1.5px 6px;
      font-size: 7.5pt;
      font-weight: 700;
      font-family: "Inter", Arial, sans-serif;
      border-radius: 2px;
    }
    .badge-CRITICAL { background: #202B3A; color: #FFFFFF; border: 1px solid #202B3A; }
    .badge-HIGH { background: #FFFFFF; color: #202B3A; border: 1.2px solid #202B3A; }
    .badge-MEDIUM { background: #FFFFFF; color: #202B3A; border: 0.8px dashed #737B89; }
    .badge-LOW { background: #FFFFFF; color: #737B89; border: 0.6px solid #CBD5E1; }
    .unverified { font-size: 7.5pt; color: #9A3412; font-weight: 600; }
    .sign-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 18px;
      margin-top: 14px;
      font-family: "Inter", Arial, sans-serif;
      font-size: 9pt;
      break-inside: avoid;
    }
    .sign-box { text-align: left; }
    .sign-role { font-weight: 700; color: #202B3A; }
    .sign-title { font-size: 8.2pt; color: #737B89; margin-bottom: 48px; }
    .sign-line { border-top: 1px solid #202B3A; padding-top: 3px; font-weight: 600; }
    .sign-date { font-size: 8pt; color: #737B89; }
    .doc-footer-note {
      margin-top: 18px;
      padding-top: 8px;
      border-top: 0.5pt solid #E8EBF0;
      font-family: "Inter", Arial, sans-serif;
      font-size: 8pt;
      color: #737B89;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="kop">
    <div class="kop-logo">TIP</div>
    <div>
      <p class="kop-org">PT Technosoft Indo Prima</p>
      <p class="kop-unit">TIP Media Intelligence &middot; Pusat Pemantauan Isu Publik</p>
      <p class="kop-addr">Jakarta, Indonesia &middot; Surel: command-center@tip-media.local &middot; Dokumen Kedinasan Internal</p>
    </div>
  </div>
  <div class="kop-inner-rule"></div>

  <div class="doc-title-block">
    <div class="doc-title">Laporan Situasi Isu Publik</div>
    <div class="doc-subtitle">{{ jenis_upper }}</div>
  </div>

  <div class="meta-box">
    <table class="meta-table">
      <tr>
        <td class="meta-label">Nomor</td>
        <td class="meta-val">: {{ doc_number }}</td>
        <td class="meta-label">Klasifikasi</td>
        <td class="meta-val">: {{ klasifikasi }}</td>
      </tr>
      <tr>
        <td class="meta-label">Periode</td>
        <td class="meta-val">: {{ periode }}</td>
        <td class="meta-label">Versi</td>
        <td class="meta-val">: {{ versi }}</td>
      </tr>
      <tr>
        <td class="meta-label">Disusun oleh</td>
        <td class="meta-val">: Tim Analis Media Intelligence</td>
        <td class="meta-label">Tanggal Cetak</td>
        <td class="meta-val">: {{ tanggal_cetak }}</td>
      </tr>
    </table>
  </div>

  <h1>1. Ringkasan Eksekutif</h1>
  <p class="prose">
    Selama periode pemantauan {{ periode }}, sistem mencatat {{ kpi.mention_unik_fmt }} konten unik dari {{ kpi.sumber_aktif }} sumber aktif
    yang terklaster menjadi {{ kpi.total_isu }} isu publik di {{ kpi.wilayah_terdampak }} wilayah administratif.
    Sebanyak {{ kpi.isu_prioritas }} isu berada pada tingkat prioritas tinggi atau kritis dan memerlukan perhatian unit teknis terkait.
    Skor risiko disajikan sebagai alat triase awal; setiap isu berstatus otomatis tetap ditandai &ldquo;Belum terverifikasi&rdquo; hingga divalidasi analis.
  </p>

  <div class="kpi-strip">
    <div class="kpi-cell">
      <div class="kpi-lbl">Isu Prioritas</div>
      <div class="kpi-num">{{ kpi.isu_prioritas }} <span class="kpi-unit">isu</span></div>
    </div>
    <div class="kpi-cell">
      <div class="kpi-lbl">Konten Unik</div>
      <div class="kpi-num">{{ kpi.mention_unik_fmt }} <span class="kpi-unit">item</span></div>
    </div>
    <div class="kpi-cell">
      <div class="kpi-lbl">Wilayah Terdampak</div>
      <div class="kpi-num">{{ kpi.wilayah_terdampak }} <span class="kpi-unit">wilayah</span></div>
    </div>
    <div class="kpi-cell">
      <div class="kpi-lbl">Belum Terpetakan</div>
      <div class="kpi-num">{{ kpi.unmapped_pct }}% <span class="kpi-unit">item</span></div>
    </div>
  </div>

  <h1>2. Isu Prioritas</h1>
  <div class="table-caption">Tabel 1. Daftar isu prioritas periode pemantauan</div>
  <table class="data">
    <thead>
      <tr>
        <th style="width: 5%;">No</th>
        <th style="width: 31%;">Judul Isu &amp; Ringkasan</th>
        <th style="width: 17%;">Wilayah</th>
        <th style="width: 14%;">Level</th>
        <th class="angka" style="width: 8%;">Skor</th>
        <th class="angka" style="width: 9%;">Volume</th>
        <th style="width: 16%;">Status Verifikasi</th>
      </tr>
    </thead>
    <tbody>
      {% for issue in issues[:15] %}
      <tr>
        <td class="angka">{{ loop.index }}</td>
        <td>
          <strong>{{ issue.judul }}</strong>
          <div style="font-size: 8pt; color: #737B89; margin-top: 2px;">{{ issue.ringkasan or 'Dalam pemantauan intensif.' }}</div>
        </td>
        <td>{{ issue.wilayah }}<br><span style="font-size: 7.8pt; color: #737B89;">{{ issue.kategori }}</span></td>
        <td><span class="badge badge-{{ issue.level }}">{{ issue.level }}</span></td>
        <td class="angka">{{ issue.skor|round|int }}</td>
        <td class="angka">{{ issue.current_volume }}</td>
        <td>
          {% if issue.status == 'otomatis' %}
            <span class="unverified">Belum terverifikasi</span>
          {% else %}
            {{ issue.status|capitalize }}
          {% endif %}
        </td>
      </tr>
      {% endfor %}
    </tbody>
  </table>
  <div class="table-source">Sumber: Basis data TIP Media Intelligence (diakses {{ tanggal_cetak }}). Skor 0-100 adalah alat triase, bukan keputusan akhir.</div>

  <h1>3. Perkembangan per Wilayah</h1>
  <div class="table-caption">Tabel 2. Sebaran volume konten dan sentimen negatif per wilayah</div>
  <table class="data">
    <thead>
      <tr>
        <th style="width: 8%;">Kode</th>
        <th style="width: 34%;">Wilayah</th>
        <th class="angka" style="width: 14%;">Konten Unik</th>
        <th class="angka" style="width: 16%;">Sentimen Negatif</th>
        <th style="width: 28%;">Isu Dominan</th>
      </tr>
    </thead>
    <tbody>
      {% for reg in regions[:12] %}
      <tr>
        <td>{{ reg.kode_wilayah }}</td>
        <td>{{ reg.nama }}</td>
        <td class="angka">{{ reg.unique_content_count }}</td>
        <td class="angka">{{ reg.sentiment_negative_pct }}%</td>
        <td>{{ reg.top_issue or 'Kondusif' }}</td>
      </tr>
      {% endfor %}
    </tbody>
  </table>
  <div class="table-source">Sumber: Agregasi gazetteer wilayah Kemendagri pada TIP Media Intelligence. Tabel ini menggambarkan kondisi saat laporan disusun, bukan khusus periode laporan.</div>

  <h1>4. Kualitas Data dan Keterbatasan</h1>
  <p class="prose">
    Pemantauan periode ini mencakup {{ kpi.sumber_aktif }} sumber resmi dan portal berita publik terverifikasi.
    Persentase konten tanpa lokasi pasti (belum terpetakan) tercatat sebesar {{ kpi.unmapped_pct }}%.
    Konten yang belum melalui verifikasi analis ditandai secara eksplisit pada Tabel 1 dan tidak disajikan sebagai fakta final.
  </p>

  <h1>5. Pengesahan</h1>
  <div class="sign-grid">
    <div class="sign-box">
      <div class="sign-role">Disusun oleh,</div>
      <div class="sign-title">Analis Media Intelligence</div>
      <div class="sign-line">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</div>
      <div class="sign-date">Tanggal: {{ tanggal_saja }}</div>
    </div>
    <div class="sign-box">
      <div class="sign-role">Diverifikasi oleh,</div>
      <div class="sign-title">Koordinator Verifikasi</div>
      <div class="sign-line">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</div>
      <div class="sign-date">Tanggal: {{ tanggal_saja }}</div>
    </div>
    <div class="sign-box">
      <div class="sign-role">Disetujui oleh,</div>
      <div class="sign-title">Pimpinan Pusat Krisis</div>
      <div class="sign-line">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</div>
      <div class="sign-date">Tanggal: {{ tanggal_saja }}</div>
    </div>
  </div>

  <div class="doc-footer-note">
    <span>{{ doc_number }} &middot; Versi {{ versi }} &middot; {{ klasifikasi }}</span>
    <span>Dokumen Kedinasan Internal TIP Media Intelligence</span>
  </div>
</body>
</html>
"""


def _latin1(text: str) -> str:
    return (text or "").encode("latin-1", "replace").decode("latin-1")


def render_report_pdf_bytes(
    judul: str,
    periode: str,
    kpi: Dict[str, Any],
    issues: List[Issue],
    rendered_html: str,
    regions: Optional[List[Region]] = None,
    doc_number: str = "",
) -> bytes:
    """Render laporan kedinasan ke PDF via WeasyPrint, atau fallback fpdf2 bergaya kedinasan."""
    try:
        from weasyprint import HTML

        return HTML(string=rendered_html).write_pdf()
    except Exception:
        from fpdf import FPDF

        class KedinasanPDF(FPDF):
            def header(self):
                if self.page_no() > 1:
                    self.set_font("Helvetica", "", 8)
                    self.set_text_color(115, 123, 137)
                    self.cell(self.epw * 0.7, 5, _latin1("TIP Media Intelligence - Laporan Situasi Isu Publik"))
                    self.cell(self.epw * 0.3, 5, "INTERNAL / TERBATAS", align="R", new_x="LMARGIN", new_y="NEXT")
                    self.set_draw_color(232, 235, 240)
                    self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
                    self.ln(3)
                    self.set_text_color(32, 43, 58)

            def footer(self):
                self.set_y(-15)
                self.set_font("Helvetica", "", 8)
                self.set_text_color(115, 123, 137)
                num = doc_number or "TIP-MI/LAP/v1.0"
                self.cell(self.epw * 0.65, 5, _latin1(f"{num} - v1.0"))
                self.cell(self.epw * 0.35, 5, f"Halaman {self.page_no()} dari {{nb}}", align="R")

        pdf = KedinasanPDF(format="A4")
        pdf.alias_nb_pages()
        pdf.set_margins(left=30, top=22, right=20)
        pdf.set_auto_page_break(auto=True, margin=22)
        pdf.add_page()
        pdf.set_text_color(32, 43, 58)

        # Kop surat kedinasan + garis ganda
        y0 = pdf.get_y()
        pdf.set_draw_color(32, 43, 58)
        pdf.set_line_width(0.5)
        pdf.rect(30, y0, 12, 12)
        pdf.set_xy(30, y0 + 3)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(12, 6, "TIP", align="C")

        pdf.set_xy(45, y0)
        pdf.set_font("Helvetica", "B", 13)
        pdf.cell(pdf.epw - 15, 6, "PT TECHNOSOFT INDO PRIMA", new_x="LMARGIN", new_y="NEXT")
        pdf.set_x(45)
        pdf.set_font("Helvetica", "B", 9.5)
        pdf.set_text_color(33, 97, 245)
        pdf.cell(pdf.epw - 15, 4.5, "TIP Media Intelligence - Pusat Pemantauan Isu Publik", new_x="LMARGIN", new_y="NEXT")
        pdf.set_x(45)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(115, 123, 137)
        pdf.cell(pdf.epw - 15, 4, "Jakarta, Indonesia | Surel: command-center@tip-media.local", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)
        y_line = pdf.get_y()
        pdf.set_draw_color(32, 43, 58)
        pdf.set_line_width(0.8)
        pdf.line(30, y_line, pdf.w - 20, y_line)
        pdf.set_line_width(0.25)
        pdf.line(30, y_line + 1.2, pdf.w - 20, y_line + 1.2)
        pdf.ln(5)

        # Judul dokumen
        pdf.set_text_color(32, 43, 58)
        pdf.set_font("Helvetica", "B", 13)
        pdf.cell(pdf.epw, 6, "LAPORAN SITUASI ISU PUBLIK", align="C", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(pdf.epw, 5, _latin1(judul.upper()), align="C", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)

        # Blok metadata
        pdf.set_draw_color(32, 43, 58)
        pdf.line(30, pdf.get_y(), pdf.w - 20, pdf.get_y())
        pdf.ln(2)
        pdf.set_font("Helvetica", "", 8.5)
        now_str = _fmt_tanggal_id(datetime.now(WIB)) + ", " + _fmt_waktu_wib(datetime.utcnow())
        pdf.cell(pdf.epw * 0.55, 5, _latin1(f"Nomor       : {doc_number or 'TIP-MI/LAP/001'}"))
        pdf.cell(pdf.epw * 0.45, 5, "Klasifikasi : Internal / Terbatas", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(pdf.epw * 0.55, 5, _latin1(f"Periode     : {periode}"))
        pdf.cell(pdf.epw * 0.45, 5, "Versi       : 1.0", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(pdf.epw * 0.55, 5, "Disusun oleh: Tim Analis Media Intelligence")
        pdf.cell(pdf.epw * 0.45, 5, _latin1(f"Dicetak     : {now_str}"), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)
        pdf.line(30, pdf.get_y(), pdf.w - 20, pdf.get_y())
        pdf.ln(5)

        # 1. Ringkasan Eksekutif
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(pdf.epw, 6, "1. RINGKASAN EKSEKUTIF", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9.5)
        summary_text = (
            f"Selama periode {periode}, sistem mencatat {kpi.get('mention_unik_fmt', kpi.get('mention_unik', 0))} konten unik "
            f"dari {kpi.get('sumber_aktif', 0)} sumber aktif, dengan {kpi.get('isu_prioritas', 0)} isu prioritas tinggi/kritis "
            f"di {kpi.get('wilayah_terdampak', 0)} wilayah administratif. Persentase konten belum terpetakan tercatat {kpi.get('unmapped_pct', 0)}%."
        )
        pdf.multi_cell(pdf.epw, 5, _latin1(summary_text))
        pdf.ln(3)

        # 2. Isu Prioritas
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(pdf.epw, 6, "2. ISU PRIORITAS", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "B", 8.5)
        pdf.cell(pdf.epw, 5, "Tabel 1. Daftar isu prioritas periode pemantauan", new_x="LMARGIN", new_y="NEXT")
        cols = [10, 68, 30, 20, 12, 20]
        headers = ["No", "Judul Isu", "Wilayah", "Level", "Skor", "Status"]
        pdf.set_fill_color(238, 244, 255)
        pdf.set_draw_color(32, 43, 58)
        for w, h in zip(cols, headers):
            align = "R" if h in ("No", "Skor") else "L"
            pdf.cell(w, 6, h, border="TB", fill=True, align=align)
        pdf.ln()

        pdf.set_font("Helvetica", "", 8.2)
        pdf.set_draw_color(220, 224, 230)
        for idx, iss in enumerate(issues[:12], start=1):
            judul_short = (iss.judul[:46] + "...") if len(iss.judul) > 48 else iss.judul
            wil_short = (iss.wilayah[:18] + "..") if len(iss.wilayah) > 20 else iss.wilayah
            st = "Belum verif." if iss.status == "otomatis" else iss.status.capitalize()
            pdf.cell(cols[0], 6, str(idx), border="B", align="R")
            pdf.cell(cols[1], 6, _latin1(judul_short), border="B")
            pdf.cell(cols[2], 6, _latin1(wil_short), border="B")
            pdf.cell(cols[3], 6, _latin1(iss.level), border="B")
            pdf.cell(cols[4], 6, str(int(round(iss.skor))), border="B", align="R")
            pdf.cell(cols[5], 6, _latin1(st), border="B")
            pdf.ln()
        pdf.set_font("Helvetica", "I", 7.5)
        pdf.set_text_color(115, 123, 137)
        pdf.cell(pdf.epw, 5, "Sumber: Basis data TIP Media Intelligence. Skor risiko adalah alat triase awal.", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)

        # 3. Pengesahan 3 Kolom
        pdf.set_text_color(32, 43, 58)
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(pdf.epw, 6, "3. PENGESAHAN", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)
        col_w = pdf.epw / 3
        roles = ["Disusun oleh,", "Diverifikasi oleh,", "Disetujui oleh,"]
        titles = ["Analis Media Intelligence", "Koordinator Verifikasi", "Pimpinan Pusat Krisis"]
        pdf.set_font("Helvetica", "B", 8.5)
        for r in roles:
            pdf.cell(col_w, 5, r)
        pdf.ln()
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(115, 123, 137)
        for t in titles:
            pdf.cell(col_w, 4, t)
        pdf.ln(16)
        pdf.set_text_color(32, 43, 58)
        for _ in range(3):
            pdf.cell(col_w, 5, "(_________________________)")
        pdf.ln()

        return bytes(pdf.output())


# Rentang data per jenis laporan. Insidental tidak dibatasi waktu karena
# periodenya ditulis bebas oleh analis (nama kejadian, tanggal kejadian).
REPORT_WINDOWS: Dict[str, Optional[timedelta]] = {
    "harian": timedelta(hours=24),
    "mingguan": timedelta(days=7),
    "bulanan": timedelta(days=30),
    "insidental": None,
}


def report_window_start(jenis: str, now: Optional[datetime] = None) -> Optional[datetime]:
    """Awal rentang data (naive UTC, sama seperti kolom DB) atau None bila tanpa batas.

    Jenis yang tidak dikenal diperlakukan seperti mingguan, nilai default endpoint.
    """
    window = REPORT_WINDOWS.get(jenis, REPORT_WINDOWS["mingguan"])
    if window is None:
        return None
    return (now or datetime.utcnow()) - window


def generate_report_document(
    db: Session,
    jenis: str = "mingguan",
    periode: str = "9-15 November 2026",
) -> Report:
    """Generate laporan kedinasan HTML & PDF dan simpan ke storage + database (FR-20)."""
    since = report_window_start(jenis)

    issue_q = db.query(Issue)
    raw_q = db.query(RawItem)
    case_q = db.query(Case)
    if since is not None:
        issue_q = issue_q.filter(Issue.last_updated >= since)
        raw_q = raw_q.filter(func.coalesce(RawItem.published_at, RawItem.fetched_at) >= since)
        case_q = case_q.filter(Case.updated_at >= since)
    issues = issue_q.order_by(Issue.skor.desc()).all()
    cases = case_q.all()
    total_mention = raw_q.count()

    # Region menyimpan agregat terkini tanpa riwayat waktu, jadi tabel wilayah
    # menggambarkan kondisi saat laporan disusun (dijelaskan di template).
    regions = db.query(Region).order_by(Region.mention_count.desc()).all()
    sumber_aktif = db.query(Source).filter(Source.status_izin == "aktif").count()

    priority_count = len([i for i in issues if i.level in ("CRITICAL", "HIGH")])
    completed_cases = len([c for c in cases if c.status == "selesai"])
    affected_regions = len({i.wilayah for i in issues if i.wilayah})
    unmapped_pct = 0

    existing_count = db.query(Report).count()
    doc_num = _doc_number(jenis, seq=existing_count + 1)
    now_wib = datetime.now(WIB)
    tanggal_saja = _fmt_tanggal_id(now_wib)
    tanggal_cetak = f"{tanggal_saja}, {now_wib.strftime('%H.%M')} WIB"

    kpi = {
        "mention_unik": total_mention,
        "mention_unik_fmt": _fmt_num_id(total_mention),
        "isu_prioritas": priority_count,
        "total_isu": len(issues),
        "wilayah_terdampak": affected_regions,
        "kasus_selesai": completed_cases,
        "sumber_aktif": sumber_aktif,
        "unmapped_pct": unmapped_pct,
    }

    judul_doc = f"Laporan Situasi Isu Publik ({jenis.capitalize()})"
    template = Template(REPORT_HTML_TEMPLATE)
    rendered_html = template.render(
        judul=judul_doc,
        jenis_upper=jenis.upper(),
        doc_number=doc_num,
        klasifikasi="INTERNAL / TERBATAS",
        versi="1.0",
        periode=periode,
        tanggal_cetak=tanggal_cetak,
        tanggal_saja=tanggal_saja,
        kpi=kpi,
        issues=issues,
        regions=regions,
    )

    pdf_bytes = render_report_pdf_bytes(
        judul_doc,
        periode,
        kpi,
        issues,
        rendered_html,
        regions=regions,
        doc_number=doc_num,
    )
    pdf_key = f"reports/laporan_{jenis}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.pdf"
    put_object(pdf_key, pdf_bytes, content_type="application/pdf")

    report_record = Report(
        judul=f"{doc_num} - Laporan {jenis.capitalize()} ({periode})",
        jenis=jenis,
        periode=periode,
        file_url=pdf_key,
        data_snapshot_json=json.dumps({
            "doc_number": doc_num,
            "kpi": kpi,
            "total_issues": len(issues),
            "rentang_mulai_utc": since.isoformat() if since else None,
            "rendered_html": rendered_html,
            "pdf_key": pdf_key,
        }),
        dibuat_oleh="Tim Analis TIP MI",
    )
    db.add(report_record)
    db.commit()
    db.refresh(report_record)
    return report_record


def get_report_pdf_bytes(report: Report) -> bytes:
    snapshot = json.loads(report.data_snapshot_json or "{}")
    pdf_key = snapshot.get("pdf_key") or report.file_url
    if pdf_key and pdf_key.endswith(".pdf"):
        cached = get_object(pdf_key)
        if cached:
            return cached
    return render_report_pdf_bytes(
        report.judul,
        report.periode,
        snapshot.get("kpi", {}),
        [],
        snapshot.get("rendered_html", f"<h1>{report.judul}</h1>"),
        doc_number=snapshot.get("doc_number", ""),
    )
