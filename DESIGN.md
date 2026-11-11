# TIP Media Intelligence - Design System & Direction

Dial: ENERGY 1 / RHYTHM 2 / MOTION 1

## Identity & Purpose
- Product: TIP Media Intelligence (PT Technosoft Indo Prima)
- Nature: Mission-critical executive early warning, media intelligence, and decision support platform.
- Target Audience: Public sector executives, intelligence analysts, operations supervisors, and field PIC units.
- Core Values: Transparent, authoritative, evidence-based, human-in-the-loop accountability.

## Color Palette
- Primary Dark / Header: `#0F172A` (Slate 900)
- Brand Accent / Focus: `#2563EB` (Royal Blue)
- Surface & Canvas: `#F8FAFC` (Slate 50), Cards: `#FFFFFF`
- Borders: `#E2E8F0` (Slate 200), `#CBD5E1` (Slate 300)
- Text Primary: `#0F172A` (WCAG AAA contrast on light)
- Text Secondary: `#475569` (WCAG AA compliant: 5.4:1 ratio)
- Text Muted: `#64748B` (WCAG AA compliant for large/UI labels)

### Severity / Risk Status Tokens
- CRITICAL (85-100):
  - Badge Background: `#FEE2E2` (Red 100)
  - Text: `#991B1B` (Red 800)
  - Border: `#FCA5A5` (Red 300)
- HIGH (70-84):
  - Badge Background: `#FFEDD5` (Orange 100)
  - Text: `#9A3412` (Orange 800)
  - Border: `#FDBA74` (Orange 300)
- MEDIUM (40-69):
  - Badge Background: `#DBEAFE` (Blue 100)
  - Text: `#1E40AF` (Blue 800)
  - Border: `#93C5FD` (Blue 300)
- LOW (0-39):
  - Badge Background: `#F1F5F9` (Slate 100)
  - Text: `#334155` (Slate 700)
  - Border: `#CBD5E1` (Slate 300)

## Typography
- UI Sans: `Plus Jakarta Sans`, `Inter`, system-ui, -apple-system, sans-serif
- Monospace / Metrics: `JetBrains Mono`, `Consolas`, monospace (used exclusively for timestamps, coordinates, and exact scores)
- Headings: Bold, clean, tight tracking (`tracking-tight`), human-crafted tone.
- Antislop Copy Rule: Strictly NO em dash (`—`) in UI copy. Use colon (`:`), comma (`,`), or hyphens (`-`).

## Rhythm & Layout
- Top navigation with active role switcher, system health badge, and current pilot region indicator.
- Grid & Card structures: Asymmetric functional balance.
- Focal points: On dashboard, the 4 key operational KPIs and 7-day trend are primary. On issue verification, the analyst decision box and evidence sources are primary.
- Keyboard accessibility: Visible focus rings (`focus:ring-2 focus:ring-blue-600 focus:outline-none`).
- Minimum tap targets: 44px on mobile and touch devices.
