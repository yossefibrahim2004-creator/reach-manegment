import type { ReactNode } from "react";
import { useSettings } from "../../../lib/settings";

interface PrintDocumentLayoutProps {
  /** Arabic/local document title — rendered as a secondary line in brand mode. */
  title: string;
  /** Legacy English title (reports path). Ignored when brandName/documentTitle are used. */
  titleEnglish?: string;
  documentNumber?: string;
  subtitle?: string;
  /** Big heading next to the logo. Defaults to brand.businessName, then "Reach". */
  brandName?: string;
  /** Secondary document-type label (e.g. "INVOICE", "DISBURSEMENT VOUCHER"). */
  documentTitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  dir?: "ltr" | "rtl" | "auto";
  headerVisibility?: "always" | "print";
}

/**
 * A4 print sheet with the curved navy/blue header band.
 *
 * Print safe area: a 4mm blank border on every side of every page
 * (@page rule in print.css — the single source of truth for paper setup, so
 * every document that uses this layout prints with the same margin). This
 * keeps ink away from the physical edge so a small printer feed/offset defect
 * never cuts the document.
 *
 * Band geometry (viewBox 0 0 1000 210, LTR):
 *  - blue swoosh sweeps across the end side behind everything
 *  - navy shape sits on the start side; a fat white stroke on the "gap" path
 *    creates the white swoosh between navy and blue
 *  - [dir="rtl"] mirrors the SVG with scaleX(-1) (see CSS); title/logo swap
 *    sides automatically via flex
 *
 * Header modes:
 *  - brand mode (brandName or documentTitle passed): big heading = business
 *    name, documentTitle renders as a pill, `title` as a smaller local line
 *  - legacy mode (reports): heading = titleEnglish || title (unchanged)
 */

const PRINT_DOCUMENT_CSS = `
/* ==========================================================================
   Print document system — A4, navy/blue band, RTL-first (logical properties)
   ========================================================================== */

.print-document {
  --pd-navy: #0f2a5c;
  --pd-blue: #2f7fd1;
  --pd-ink: #1a2233;
  --pd-muted: #667085;
  --pd-line: #d5dbe5;
  --pd-soft: #f3f6fb;
  --pd-band-h: 44mm;
  --pd-pad-x: 12mm;

  position: relative;
  box-sizing: border-box;
  width: 210mm;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  background: #fff;
  color: var(--pd-ink);
  font-family: "Cairo", "Tajawal", "Segoe UI", Tahoma, Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.55;
  font-variant-numeric: tabular-nums;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.print-document *,
.print-document *::before,
.print-document *::after {
  box-sizing: border-box;
}

/* ---------- Header band ---------- */

.print-document__header {
  position: relative;
  z-index: 2;
  height: var(--pd-band-h);
  flex: none;
  background: #fff;
  border-radius: 2mm;
  overflow: hidden;
}

.print-document__header--print-only {
  display: none;
}

.print-document__band {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}

[dir="rtl"] .print-document__band {
  transform: scaleX(-1);
}

.print-document__band-blue {
  fill: var(--pd-blue);
}

.print-document__band-gap {
  fill: #fff;
  stroke: #fff;
  stroke-width: 22;
  stroke-linejoin: round;
}

.print-document__band-navy {
  fill: var(--pd-navy);
}

.print-document__header-inner {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-inline: var(--pd-pad-x);
  padding-block-end: 6mm;
}

.print-document__header-title {
  /* navy shape covers ~38% of the width; keep the text inside it */
  width: 36%;
  display: flex;
  flex-direction: column;
  gap: 1mm;
  color: #fff;
  padding-block-end: 8mm;
}

.print-document__header-title h1 {
  margin: 0;
  font-size: 19pt;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: 0.02em;
  overflow-wrap: anywhere;
}

.print-document__header-title h1.print-document__title--long {
  font-size: 14pt;
  line-height: 1.2;
}

.print-document__header-title h1.print-document__title--longer {
  font-size: 11.5pt;
  line-height: 1.25;
}

.print-document__header-title p {
  margin: 0;
  font-size: 11pt;
  font-weight: 600;
  opacity: 0.92;
}

/* Document-type pill (brand mode) — stays inside the navy shape */
.print-document__header-title p.print-document__doctype {
  align-self: flex-start;
  margin: 0;
  padding: 0.6mm 2.4mm;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.16);
  border: 0.3mm solid rgba(255, 255, 255, 0.45);
  font-size: 8.5pt;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 1;
}

/* Local (Arabic) document title under the pill (brand mode) */
.print-document__doctype-ar {
  font-size: 9pt;
  font-weight: 600;
  opacity: 0.85;
}

.print-document__subtitle {
  font-size: 8.5pt;
  opacity: 0.8;
}

.print-document__number {
  align-self: flex-start;
  margin-block-start: 1.5mm;
  padding: 0.6mm 2.4mm;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.16);
  border: 0.3mm solid rgba(255, 255, 255, 0.45);
  font-size: 9pt;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.print-document__header-logo {
  flex: none;
  width: 30mm;
  height: 30mm;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: #fff;
  border: 0.6mm solid #fff;
  box-shadow: 0 0 0 0.5mm rgba(255, 255, 255, 0.55);
}

.print-document__header-logo img {
  width: 85%;
  height: 85%;
  object-fit: contain;
  display: block;
}

.print-document__header-logo span {
  font-size: 22pt;
  font-weight: 800;
  color: var(--pd-navy);
}

/* ---------- Content & footer ---------- */

.print-document__content {
  flex: 1 1 auto;
  padding: 6mm var(--pd-pad-x) 6mm;
  display: none !important;
}

.print-document__footer {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8mm;
  margin-inline: var(--pd-pad-x);
  padding-block: 4mm 4mm;
  border-top: 0.3mm solid var(--pd-line);
  font-size: 8.5pt;
  color: var(--pd-muted);
}

/* ==========================================================================
   Shared blocks
   ========================================================================== */

/* ---------- Parties ---------- */

.print-document .pn-parties {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6mm;
  align-items: stretch;
  margin-block-end: 6mm;
  break-inside: avoid;
}

.print-document .pn-parties__bill-to {
  display: flex;
  flex-direction: column;
  gap: 1mm;
  padding: 3.5mm 5mm;
  background: var(--pd-soft);
  border-inline-start: 1.2mm solid var(--pd-blue);
  border-radius: 1.5mm;
}

.print-document .pn-parties__label {
  font-size: 8.5pt;
  font-weight: 600;
  color: var(--pd-muted);
}

.print-document .pn-parties__name {
  font-size: 14pt;
  font-weight: 800;
  line-height: 1.25;
  color: var(--pd-navy);
}

.print-document .pn-parties__line {
  font-size: 9.5pt;
  color: var(--pd-ink);
}

.print-document .pn-parties__meta {
  margin: 0;
  min-width: 56mm;
  display: grid;
  grid-template-columns: auto 1fr;
  align-content: center;
  column-gap: 5mm;
  row-gap: 1.6mm;
  padding: 3.5mm 5mm;
  border: 0.3mm solid var(--pd-line);
  border-radius: 1.5mm;
  font-size: 9pt;
}

.print-document .pn-parties__meta dt {
  color: var(--pd-muted);
  font-weight: 600;
}

.print-document .pn-parties__meta dd {
  margin: 0;
  font-weight: 700;
  text-align: end;
  white-space: nowrap;
}

/* ---------- Items table ---------- */

.print-document .pn-items {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 9.5pt;
}

.print-document .pn-items thead {
  display: table-header-group; /* repeat on every page */
}

.print-document .pn-items tfoot {
  display: table-row-group; /* don't repeat totals on every page */
}

.print-document .pn-items th {
  padding: 2.4mm 3mm;
  background: var(--pd-navy);
  color: #fff;
  font-size: 9pt;
  font-weight: 700;
  text-align: start;
}

.print-document .pn-items th:first-child {
  border-start-start-radius: 1.5mm;
}
.print-document .pn-items th:last-child {
  border-start-end-radius: 1.5mm;
}

.print-document .pn-items td {
  padding: 2.4mm 3mm;
  border-bottom: 0.25mm solid var(--pd-line);
  vertical-align: middle;
}

.print-document .pn-items tr {
  break-inside: avoid;
  page-break-inside: avoid;
}

.print-document .pn-items tbody tr:nth-child(even) td {
  background: #f8fafd;
}

.print-document .pn-items .cell-center,
.print-document .pn-items .cell-sl,
.print-document .pn-items .cell-unit,
.print-document .pn-items .cell-qty {
  text-align: center;
}

.print-document .pn-items--voucher th:nth-child(1),
.print-document .pn-items--voucher td.cell-sl {
  width: 13mm;
}
.print-document .pn-items--voucher th:nth-child(3),
.print-document .pn-items--voucher td.cell-unit {
  width: 26mm;
}
.print-document .pn-items--voucher th:nth-child(4),
.print-document .pn-items--voucher td.cell-qty {
  width: 28mm;
}

.print-document .cell-sl {
  color: var(--pd-muted);
  font-weight: 600;
}

.print-document .cell-product {
  display: table-cell;
}

.print-document .cell-product strong {
  display: block;
  font-weight: 700;
  line-height: 1.35;
}

.print-document .cell-product small {
  display: block;
  margin-block-start: 0.6mm;
  font-size: 7.5pt;
  color: var(--pd-muted);
  letter-spacing: 0.02em;
}

.print-document .cell-unit {
  color: var(--pd-muted);
  font-size: 9pt;
}

.print-document .cell-qty {
  font-size: 11pt;
  font-weight: 800;
  color: var(--pd-navy);
}

.print-document .cell-empty {
  padding-block: 10mm;
  text-align: center;
  color: var(--pd-muted);
}

.print-document .pn-items tfoot td {
  padding-block: 3mm;
  background: var(--pd-soft);
  border-bottom: 0;
  border-top: 0.5mm solid var(--pd-navy);
  font-weight: 800;
  color: var(--pd-navy);
}

.print-document .cell-total-label {
  text-align: start;
}

.print-document .cell-total-value {
  text-align: center;
  font-size: 10.5pt;
}

.print-document .cell-total-value span + span::before {
  content: "+";
  margin-inline: 2mm;
  color: var(--pd-muted);
  font-weight: 400;
}

/* ---------- Note ---------- */

.print-document .pn-note {
  margin-block-start: 5mm;
  padding: 3mm 4mm;
  border: 0.3mm dashed var(--pd-line);
  border-radius: 1.5mm;
  break-inside: avoid;
}

.print-document .pn-note > span {
  display: block;
  font-size: 8.5pt;
  font-weight: 700;
  color: var(--pd-muted);
}

.print-document .pn-note p {
  margin: 1mm 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* ---------- Footer pieces ---------- */

.print-document .pn-footer-query {
  display: flex;
  align-items: center;
  gap: 3mm;
}

.print-document .pn-footer-query__bar {
  width: 1mm;
  height: 7mm;
  border-radius: 1mm;
  background: var(--pd-blue);
}

.print-document .pn-footer-query h3 {
  margin: 0;
  font-size: 9pt;
  font-weight: 700;
  color: var(--pd-ink);
}

.print-document .pn-footer-printinfo {
  font-size: 8pt;
  white-space: nowrap;
}

/* ==========================================================================
   Print — page size and the 4mm safe margin live in print.css (@page).
   Keeping a second @page rule here would override the report landscape page.
   ========================================================================== */

@media print {
  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
  }

  /* Neutralize global .print-area padding when it wraps a print document.
     Without this, the invoice gets extra 16px padding while the voucher (outside .print-area) does not. */
  .print-area:has(.print-document) {
    padding: 0 !important;
    position: static !important;
  }

  .print-document {
    width: 100%;
    margin: 0;
  }

  .print-document__header--print-only {
    display: block;
  }
}

@media screen {
  .print-document {
    box-shadow: 0 0 0 0.3mm var(--pd-line), 0 4mm 12mm rgba(15, 42, 92, 0.12);
  }
  .print-document__header--print-only {
    display: none;
  }
}
`;

const NAVY_PATH =
  "M0,0 H338 C356,30 386,62 401,96 C392,130 316,152 196,159 C124,163 60,165 0,164 Z";

const BLUE_PATH =
  "M352,0 H1000 V196 C1000,206 894,210 730,209 C548,208 386,205 306,199 C338,176 396,148 424,112 C450,80 448,42 426,20 C410,7 384,0 352,0 Z";

export default function PrintDocumentLayout({
  title,
  titleEnglish,
  documentNumber,
  subtitle,
  brandName,
  documentTitle,
  children,
  footer,
  className = "",
  dir = "rtl",
  headerVisibility = "always",
}: PrintDocumentLayoutProps) {
  const { brand } = useSettings();

  // Big heading: explicit prop → brand settings → "Reach" fallback.
  const businessName =
    brandName?.trim() || brand.businessName.trim() || "Reach";
  const initial = businessName.charAt(0).toUpperCase() || "R";

  const englishTitle = titleEnglish?.trim();
  const localTitle = title.trim();
  const typeLabel = documentTitle?.trim();

  // Brand mode is opted into by passing brandName and/or documentTitle.
  const brandMode = brandName !== undefined || typeLabel !== undefined;
  const heading = brandMode ? businessName : englishTitle || title;
  const showLocalTitle = brandMode
    ? Boolean(typeLabel) && localTitle !== "" && localTitle !== typeLabel
    : Boolean(englishTitle) && localTitle !== heading;

  const headingSizeClass =
    heading.length > 26
      ? "print-document__title--longer"
      : heading.length > 14
        ? "print-document__title--long"
        : undefined;

  const headerClass = [
    "print-document__header",
    headerVisibility === "print" ? "print-document__header--print-only" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={`print-document ${className}`.trim()} dir={dir}>
      <style>{PRINT_DOCUMENT_CSS}</style>

      <header className={headerClass}>
        <svg
          className="print-document__band"
          viewBox="0 0 1000 210"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path className="print-document__band-blue" d={BLUE_PATH} />
          <path className="print-document__band-gap" d={NAVY_PATH} />
          <path className="print-document__band-navy" d={NAVY_PATH} />
        </svg>

        <div className="print-document__header-inner">
          <div className="print-document__header-title">
            <h1 className={headingSizeClass}>{heading}</h1>

            {brandMode && typeLabel && (
              <p className="print-document__doctype">{typeLabel}</p>
            )}
            {showLocalTitle && (
              <span className="print-document__doctype-ar">{title}</span>
            )}

            {subtitle && (
              <span className="print-document__subtitle">{subtitle}</span>
            )}
            {documentNumber && (
              <span className="print-document__number" dir="ltr">
                # {documentNumber}
              </span>
            )}
          </div>

          <div className="print-document__header-logo">
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt="" />
            ) : (
              <span aria-hidden="true">{initial}</span>
            )}
          </div>
        </div>
      </header>

      <div className="print-document__content">{children}</div>

      {footer && <footer className="print-document__footer">{footer}</footer>}
    </article>
  );
}