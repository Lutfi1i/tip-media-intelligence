"""Ekspor laporan Tren Sosial ke Excel (openpyxl) dan PDF (fpdf2).

Input adalah keluaran trend_service.get_report_data, sehingga isi file sama dengan yang
tampil di halaman Laporan & Insight.
"""

from __future__ import annotations

import io
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Sequence

STATUS_LABEL = {
    "LONJAKAN TINGGI": "Melonjak",
    "MENINGKAT": "Naik",
    "BARU": "Baru muncul",
    "STABIL": "Stabil",
    "MENURUN": "Turun",
    "SINYAL LEMAH": "Sinyal lemah",
}


def _status(s: str) -> str:
    return STATUS_LABEL.get(s, s)


def _num(v: Optional[float]) -> str:
    if v is None:
        return "-"
    return f"{v:,.0f}".replace(",", ".")


def report_title(data: Dict[str, Any]) -> str:
    return f"Laporan Tren Sosial: {data['lokasi']['nama']}, {data['periode']['label']}"


def _generated_at() -> str:
    return (datetime.utcnow() + timedelta(hours=7)).strftime("%d-%m-%Y %H:%M WIB")


# ---------------------------------------------------------------------------
# Excel
# ---------------------------------------------------------------------------

def build_xlsx(data: Dict[str, Any]) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="1F2937")

    def sheet(title: str, headers: Sequence[str], rows: List[Sequence[Any]], first: bool = False):
        ws = wb.active if first else wb.create_sheet()
        ws.title = title
        ws.append(list(headers))
        for cell in ws[1]:
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(vertical="center")
        for r in rows:
            ws.append(list(r))
        for i, h in enumerate(headers, start=1):
            width = max([len(str(h))] + [len(str(r[i - 1])) for r in rows if r[i - 1] is not None] or [10])
            ws.column_dimensions[get_column_letter(i)].width = min(60, width + 2)
        ws.freeze_panes = "A2"
        return ws

    r = data["ringkasan"]
    eng = r.get("engagement") or {}
    sent = r.get("sentimen_pct") or {}
    summary_rows = [
        ("Judul", report_title(data)),
        ("Lokasi", data["lokasi"]["nama"]),
        ("Periode", data["periode"]["label"]),
        ("Platform", data["platform_filter"]),
        ("Dibuat", _generated_at()),
        ("Postingan", r["postingan"]),
        ("Akun unik", r["akun_unik"]),
        ("Tren terdeteksi", r["tren"]),
        ("Tren naik", r["tren_naik"]),
        ("Sentimen positif (%)", sent.get("positif")),
        ("Sentimen netral (%)", sent.get("netral")),
        ("Sentimen negatif (%)", sent.get("negatif")),
        ("Interaksi (konten bermetrik)", eng.get("interactions")),
        ("Views (konten bermetrik)", eng.get("views")),
        ("Konten dengan metrik", eng.get("posts_with_data")),
        ("Data pembanding", f"{data['baseline']['tersedia']} dari {data['baseline']['target']} periode"),
    ]
    sheet("Ringkasan", ["Indikator", "Nilai"], summary_rows, first=True)
    sheet(
        "Topik",
        ["Peringkat", "Topik", "Kategori", "Postingan", "Status", "Pertumbuhan (%)", "Negatif (%)"],
        [(i, t["topik"], t["kategori"], t["postingan"], _status(t["status"]), t["pertumbuhan_pct"], t["negatif_pct"])
         for i, t in enumerate(data["topik"], start=1)],
    )
    sheet(
        "Platform",
        ["Platform", "Postingan", "Akun", "Interaksi", "Views", "Negatif (%)"],
        [(p["platform"], p["postingan"], p["akun"], p["interaksi"], p["views"], p["negatif_pct"]) for p in data["platform"]],
    )
    if data["wilayah"]:
        sheet("Wilayah", ["Kode", "Wilayah", "Postingan", "Negatif"], [(w["kode"], w["nama"], w["postingan"], w["negatif"]) for w in data["wilayah"]])
    sheet("Harian", ["Tanggal", "Postingan"], [(h["tanggal"], h["postingan"]) for h in data["harian"]])
    sheet(
        "Hashtag & Keyword",
        ["Jenis", "Kata", "Postingan", "Sumber"],
        [("Hashtag", k["label"], k["jumlah"], k["sumber"]) for k in data["hashtag"]]
        + [("Keyword", k["label"], k["jumlah"], k["sumber"]) for k in data["keyword"]],
    )
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------------

_NON_LATIN1 = re.compile(r"[^\x00-\xff]")


def _pdf_text(value: Any) -> str:
    """Font inti PDF hanya Latin-1; emoji dan aksara lain dibuang agar file tetap terbentuk."""
    text = str(value if value is not None else "-")
    text = text.replace("—", "-").replace("–", "-").replace("’", "'").replace("“", '"').replace("”", '"')
    return " ".join(_NON_LATIN1.sub("", text).split()) or "-"


def build_pdf(data: Dict[str, Any]) -> bytes:
    from fpdf import FPDF

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    width = pdf.w - pdf.l_margin - pdf.r_margin

    def heading(text: str, size: float = 11) -> None:
        pdf.ln(3)
        pdf.set_font("Helvetica", "B", size)
        pdf.multi_cell(width, 6, _pdf_text(text), new_x="LMARGIN", new_y="NEXT")

    def table(headers: Sequence[str], rows: List[Sequence[Any]], widths: Sequence[float]) -> None:
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_fill_color(31, 41, 55)
        pdf.set_text_color(255, 255, 255)
        for h, w in zip(headers, widths):
            pdf.cell(w, 6, _pdf_text(h), border=0, fill=True)
        pdf.ln()
        pdf.set_text_color(0, 0, 0)
        pdf.set_font("Helvetica", "", 8)
        for i, row in enumerate(rows):
            if pdf.get_y() > pdf.h - 20:
                pdf.add_page()
            fill = i % 2 == 1
            pdf.set_fill_color(243, 244, 246)
            for v, w in zip(row, widths):
                text = _pdf_text(v)
                while pdf.get_string_width(text) > w - 1.5 and len(text) > 3:
                    text = text[:-4] + "..."
                pdf.cell(w, 5.5, text, border=0, fill=fill)
            pdf.ln()

    pdf.set_font("Helvetica", "B", 14)
    pdf.multi_cell(width, 7, _pdf_text(report_title(data)), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(90, 90, 90)
    pdf.multi_cell(
        width, 5,
        _pdf_text(f"Platform: {data['platform_filter']}. Dibuat {_generated_at()}. Sumber: TIP Media Intelligence."),
        new_x="LMARGIN", new_y="NEXT",
    )
    pdf.set_text_color(0, 0, 0)

    r = data["ringkasan"]
    sent = r.get("sentimen_pct") or {}
    eng = r.get("engagement") or {}
    heading("Ringkasan")
    table(
        ["Postingan", "Akun unik", "Tren", "Tren naik", "Negatif", "Interaksi*"],
        [(_num(r["postingan"]), _num(r["akun_unik"]), _num(r["tren"]), _num(r["tren_naik"]),
          f"{sent.get('negatif', 0)}%", _num(eng.get("interactions")))],
        [width / 6] * 6,
    )
    pdf.set_font("Helvetica", "I", 7.5)
    pdf.multi_cell(
        width, 4.5,
        _pdf_text(
            f"*Interaksi hanya dari {eng.get('posts_with_data', 0)} konten yang menyediakan metrik (YouTube, Bluesky, Telegram). "
            f"Data pembanding laju: {data['baseline']['tersedia']} dari {data['baseline']['target']} periode."
        ),
        new_x="LMARGIN", new_y="NEXT",
    )

    heading("Topik paling populer")
    table(
        ["#", "Topik", "Kategori", "Postingan", "Status", "Negatif"],
        [(i, t["topik"], t["kategori"], t["postingan"], _status(t["status"]), f"{t['negatif_pct']}%") for i, t in enumerate(data["topik"], 1)],
        [8, width * 0.38, width * 0.24, 18, 24, width - 8 - width * 0.62 - 42],
    )

    heading("Perbandingan platform")
    table(
        ["Platform", "Postingan", "Akun", "Interaksi", "Views", "Negatif"],
        [(p["platform"], p["postingan"], p["akun"], _num(p["interaksi"]), _num(p["views"]), f"{p['negatif_pct']}%") for p in data["platform"]],
        [width * 0.24] + [width * 0.152] * 5,
    )

    if data["wilayah"]:
        heading("Perbandingan wilayah")
        table(
            ["Wilayah", "Postingan", "Negatif"],
            [(w["nama"], w["postingan"], w["negatif"]) for w in data["wilayah"][:20]],
            [width * 0.6, width * 0.2, width * 0.2],
        )

    heading("Pertumbuhan harian")
    table(["Tanggal", "Postingan"], [(h["tanggal"], h["postingan"]) for h in data["harian"]], [width * 0.5, width * 0.5])

    heading("Hashtag dan keyword teratas")
    rows = [("Hashtag", k["label"], k["jumlah"]) for k in data["hashtag"][:10]] + [("Keyword", k["label"], k["jumlah"]) for k in data["keyword"][:10]]
    table(["Jenis", "Kata", "Postingan"], rows or [("-", "Belum ada", "-")], [width * 0.2, width * 0.6, width * 0.2])

    return bytes(pdf.output())
