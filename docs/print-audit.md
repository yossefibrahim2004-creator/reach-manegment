# Print System Audit — Pallet (Reach)

Date: 2026-10-21
Scope: every printable view in the frontend (reports, sales invoice, warehouse
disbursement voucher). Backend, business logic, calculations and API contracts
were not changed.

## 1. Method

Searches performed over the repository (excluding `node_modules` and build
output):

- `window.print`, `window.open`, `react-to-print`
- `jsPDF`, `html2canvas`, `html2pdf`, `pdfjs`, `pdf-lib`, `puppeteer`
- `@media print`, `@page`, `no-print`, `print-`, `print-area`
- report / invoice / voucher / statement / ledger components

Browser verification used a separate tool folder (not a project dependency):
Playwright + Chrome, `emulateMedia({ media: 'print' })`, `page.pdf()` as a test
artifact only, `pdfjs-dist` for text extraction, `@napi-rs/canvas` for PNG
rendering.

## 2. Printable workflows

| # | Entry point | Document | Trigger | Paper | Shared layout |
|---|---|---|---|---|---|
| 1 | `/admin/reports/inventory` | Inventory report (68 rows) | `PrintButton` → `useReportPrint` | A4 landscape | `PrintHeader` + `PrintDocumentLayout` |
| 2 | `/admin/reports/revenue` | Revenue + daily summary | same | A4 landscape | same |
| 3 | `/admin/reports/net-profit` | Net profit KPIs | same | A4 landscape | same |
| 4 | `/admin/reports/expenses` | Expenses by category | same | A4 landscape | same |
| 5 | `/admin/reports/employees-sales` | Sales per employee | same | A4 landscape | same |
| 6 | `/admin/reports/products-sales` | Sales per product | same | A4 landscape | same |
| 7 | `/admin/reports/returns` | Returns | same | A4 landscape | same |
| 8 | `/admin/reports/customers` | Customers | same | A4 landscape | same |
| 9 | `/admin/reports/suppliers` | Suppliers | same | A4 landscape | same |
| 10 | `/admin/invoices/:id` | Sales invoice (saved) | `PrintButton` → `prepareAndPrint` | A4 portrait | `InvoiceDocument` + `PrintDocumentLayout` |
| 11 | `/sales/invoice/:id` | Sales invoice (saved) | same | A4 portrait | `InvoiceDocument` + `PrintDocumentLayout` |
| 12 | `/admin/invoices/:id` | Disbursement voucher | `PrintButton` → `prepareAndPrint` | A4 portrait | `DisbursementVoucherDocument` + `PrintDocumentLayout` |
| 13 | `/inventory/delivery` | Disbursement voucher | same | A4 portrait | same |

Non-print export kept as-is: **Excel (.xlsx) via `exceljs`**
(`ExcelExportButton`). It is not a printing path.

The New Invoice page (`/sales/new-invoice`) has a screen-only live summary
preview (customer, lines, totals). It is not a print workflow; the user asked
for the simple summary to be kept, so it is unchanged.

## 3. Classification

| Classification | Workflows |
|---|---|
| (1) Native HTML/CSS + `window.print()` | **All 13 workflows** |
| (2) PDF generated from HTML | none |
| (3) Programmatic PDF | none |
| (4) Canvas / image printing | none |
| (5) External PDF viewer | none |
| (6) Mixed | none |

There is no jsPDF / html2canvas / html2pdf / react-to-print / PDF-viewer code
in the frontend. `puppeteer` appears only in `backend/package.json` and the
lockfile; no source file imports it. It is not a print dependency and was left
untouched (unrelated cleanup).

Existing shared pieces that were extended rather than duplicated:

- `frontend/src/features/printing/print.css` — the single `@page` source
  (portrait default + named `report-landscape`), document rules, voucher
  isolation.
- `frontend/src/features/printing/components/PrintDocumentLayout.tsx` — A4
  sheet, branded band, header modes (`always` / `print`), footer.
- `frontend/src/features/printing/components/InvoiceDocument.tsx` — invoice
  renderer used by both saved-invoice pages; preview/saved modes.
- `frontend/src/features/printing/components/DisbursementVoucherDocument.tsx`
  — voucher renderer; props contain **no price/cost fields**.
- `frontend/src/features/printing/utils/printDocument.ts` — `prepareAndPrint()`
  (fonts + images → `window.print()`).
- `frontend/src/features/reports/components/PrintHeader.tsx`,
  `PrintButton.tsx`, `hooks/useReportPrint.ts`.
- `frontend/src/index.css` `@media print` — isolation and report table rules.
- `frontend/src/components/ui/Table.tsx` — table print rules + `printHidden`
  column option.

## 4. Root causes found (and fixed)

| Severity | File | Root cause | Fix |
|---|---|---|---|
| Blocker | `features/printing/components/PrintDocumentLayout.tsx` | A second **unnamed** `@page { size: A4; margin: 4mm }` was emitted after the named `report-landscape` page. An unnamed `@page` applies to every page and, at equal specificity, the later rule wins → all reports printed **portrait**. | Removed the duplicate; `print.css` is the only `@page` source (default first, named page after). |
| Blocker | `src/index.css` | The app shell (sidebar/top bar/`min-h-screen`) stayed in flow during print because `visibility: hidden` keeps layout → a **completely blank first page**; the shell's remaining height produced a **trailing blank page**. | `display: contents` on the `.print-area` ancestor chain, siblings hidden; `.min-h-screen { min-height: 0 }`. Guarded with `:not(:has(.print-voucher-sheet))` so a voucher printed from the same page is not hidden. |
| Blocker | `features/printing/print.css` | `.print-document { min-height: 97vh }` made the report header a full sheet (header alone on page 2, content on page 3) and pushed the invoice audit log to page 2. | `min-height: 0`; header gets `break-after: avoid`. |
| Major | `src/index.css` | Report KPI rows used `auto-fit, minmax(180px, 1fr)` → 4 cards on one row and 1 alone. | Print grid uses physical units: `repeat(auto-fit, minmax(42mm, 1fr))`. |
| Major | `src/index.css` | KPI values had `white-space: nowrap` + `text-overflow: ellipsis` → clipped figures on paper. | Wrap, no ellipsis, 9pt labels / 13pt values. |
| Major | `src/index.css` | Inline `letter-spacing` / `text-transform` on Arabic labels broke letter joining. | `html[lang="ar"]` print guard forces `normal`. |
| Major | `features/reports/pages/InventoryReportPage.tsx` | Status column rendered a **coloured dot only**; the serial type was a heavy pill; the table had a redundant serial column (12 columns). | Status prints as an outlined text badge (`print-badge`), dot hidden; redundant `type` column hidden on paper via `Table` `printHidden`; 11 readable columns. |
| Major | `components/ui/Table.tsx` | Header cells were `white-space: nowrap`, widening the table past the paper edge; body font was 8.5pt. | Headers wrap; body 9pt (12px); `overflow-wrap: anywhere`; `thead` repeats; `tr` never splits. |
| Major | `features/printing/print.css` | Page counter rendered `7 / 2` in RTL. | `direction: ltr` on the `@bottom-center` margin box. |
| Major | `features/reports/pages/RevenueReportPage.tsx` | `page-break-before: always` on the daily summary created a **blank page** when the invoice table ended at a page boundary. | Summary flows after the table with `break-inside: avoid`; card chrome removed on paper. |
| Major | `components/ui/Pagination.tsx` | The on-screen “showing X–Y of Z / page N of M” footer printed. | Root gets `print-hidden` (print-only utility). |
| Major | `src/index.css` | Report view toggles (“عرض تفاصيل الكل / عرض المحدد”) printed inside the report. | Buttons inside `.print-area` are hidden on paper. |
| Major | `features/printing/components/DisbursementVoucherDocument.tsx` | A 45-row voucher left the **signature block alone on a fourth page**. | Compact signature box + `break-before: avoid`; 45 rows now fit on 3 pages. |
| Minor | `features/printing/utils/printDocument.ts` | Image readiness relied on `complete`/load events only. | Added `img.decode()` (failures ignored only after `naturalWidth > 0`). |

Also removed: `.report-card { break-inside: avoid }` in the revenue report
(a card wrapping a long table cannot stay whole; it caused large gaps).

## 5. Before / after

Measured through the real print entry point (clicking “طباعة التقرير”, which
re-fetches the full dataset). Before = baseline copy of the working tree on
port 5201; after = current tree on port 5174. Same database.

| Workflow | Rows printed | Pages before | Blanks before | Pages after | Blanks after | Paper after |
|---|---:|---:|---|---:|---|---|
| Inventory | 68 | **7** | 1, 6, 7 | **5** | none | 842×595 |
| Revenue | 22 | **6** | 1, 6 | **3** | none | 842×595 |
| Net profit | — | 4 | 1, 4 | **1** | none | 842×595 |
| Expenses | — | 4 | 1, 4 | **1** | none | 842×595 |
| Employee sales | 2 | 4 | 1, 4 | **1** | none | 842×595 |
| Product sales | 2 | 4 | 1, 4 | **1** | none | 842×595 |
| Returns | 2 | 4 | 1, 4 | **1** | none | 842×595 |
| Customers | 1 | 4 | 1, 4 | **1** | none | 842×595 |
| Suppliers | 1 | 4 | 1, 4 | **1** | none | 842×595 |
| Invoice detail | 1 | 2 | 2 | **1** | none | 595×842 |

Artifacts (PNG per page, outside the repo):

- Before: `C:\Users\Yossef\AppData\Local\Temp\opencode\print-audit\out\before-full\`
  (e.g. `inventory-p2.png` shows the header alone with the reversed counter `7 / 2`).
- After: `C:\Users\Yossef\AppData\Local\Temp\opencode\print-audit\out\after-v6\`
  (e.g. `inventory-p1.png`, `inventory-p5.png`, `revenue-p3.png`).
- English (LTR): `...\out\checks\inventory-en-p1.png`.
- New Invoice summary preview: `...\out\screen\new-invoice-v2.png`.

## 6. Edge-case verification (print harness)

Temporary harness (`frontend/print-harness.html`, `frontend/src/print-harness.tsx`,
untracked) renders the shared components with controlled data.

| Scene | Rows | Pages | Blanks | Result |
|---|---:|---:|---|---|
| Report (ar) | 0 / 1 / 12 / 40 / 120 | 1 / 1 / 2 / 3 / 6 | none | landscape, repeated `thead`, last page has rows |
| Report long Arabic names | 40 | 3 | none | wraps, no clipping |
| Invoice | 1 / 8 / 40 | 1 / 2 / 3 | none | portrait; totals stay with items; audit may continue |
| Invoice long names | 25 | 3 | none | no clipped cells |
| Voucher | 5 / 45 | 1 / 3 | none | repeated header, totals once, signature with content |

Voucher privacy check (rendered DOM, not visual):

- `DisbursementVoucherLine` = `id`, `name`, `quantity`, `unit`, `barcodes` only.
- `createDisbursementVoucherData()` maps no price/cost field.
- Rendered voucher text contains **no** `ج.م` / `EGP`, **no** `السعر` / `سعر` /
  `تكلفة` / `خصم` / `صافي`.
- `hasDecimalMoney` was only true from the component's embedded CSS
  (e.g. `1.5mm`), not from document content.

English/LTR: `dir=ltr`, `lang=en`, 68 rows, 12 DOM columns (11 printed),
5 landscape pages, no blank pages, headers readable.

## 7. Assumptions

- Invoices and vouchers: A4 **portrait**, 4mm safe margin.
- Reports: A4 **landscape**, 12mm margins (room for the CSS page counter).
- The intended print path is the in-app print button (it re-fetches the full
  dataset). Browser Ctrl+P on a paginated report still prints only the loaded
  page — the UI footer is now hidden, but the data limit remains.
- The backend caps report `limit` at 100 for the inventory report; the
  `ReportPrintLimitWarning` already warns above that. 68 rows were tested.

## 8. Not verified / limitations

- Physical printer output (only Chrome PDF generation was available).
- Thermal receipts: not implemented in this app.
- Firefox/Safari print rendering (target is Chrome/Edge).
- Ctrl+P on a report while it is showing page 2 of the UI (see assumption).
- The invoice/voucher `@page` margin is 4mm, so CSS page numbers are omitted
  there (no margin box room); report page numbers were verified.
- The real voucher flow requires a `DELIVERED` invoice; the shared voucher
  component was verified via the harness and its data mapper by inspection.

## 9. Unrelated observations (not changed)

- `GET /invoices/:id` still returns prices/costs to roles that can open the
  invoice (explicitly out of scope).
- Invoice detail Back button hardcodes `/admin/invoices` for the sales page.
- Revenue KPI “invoices” count (11) and the invoice table total (22) disagree;
  this is data/business logic, not print.
- `backend/package.json` lists `puppeteer` with no source import.
- New Invoice save button label/state and the summary preview are unchanged.

## 10. Print guidelines (for new printable views)

1. Render a real HTML document; never a canvas/image/PDF for printing.
2. Reuse `PrintDocumentLayout` (invoice/voucher/report) and `print.css`; do not
   add a second `@page`.
3. Put screen chrome in `.no-print`; do not use `visibility: hidden` for
   isolation.
4. Use mm/pt in print, never `vh`/`vw`; keep screen media queries out of print.
5. Long tables: `thead` repeats, `tr { break-inside: avoid }`, hide low-value
   columns with `Column.printHidden`, never wrap a long card in
   `break-inside: avoid`.
6. Keep totals/signatures with their content (`break-inside: avoid` +
   `break-before: avoid`); never let a page contain only a signature.
7. Page numbers only where a margin box exists; force `direction: ltr` for
   `counter(page) " / " counter(pages)`.
8. Status must print as text (light outline), never colour/dot alone.
9. Arabic: no `letter-spacing`/`text-transform`; await `document.fonts.ready`
   and `img.decode()` before `window.print()`.
10. Verify with `emulateMedia({ media: 'print' })` + `page.pdf()`, inspect every
    page as PNG, and assert no page is near-empty.
