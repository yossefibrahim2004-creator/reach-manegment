import PrintDocumentLayout from "./PrintDocumentLayout";
import {
  formatPrintDate,
  formatPrintDateTime,
  formatPrintNumber,
} from "../utils/formatters";

export interface DisbursementVoucherLine {
  id: number;
  name: string;
  quantity: number;
  unit?: "PIECE" | "METER";
  barcodes: string[];
}

export interface DisbursementVoucherData {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  employeeName: string;
  printedAt: Date;
  items: DisbursementVoucherLine[];
  note?: string | null;
}

export interface DisbursementVoucherLabels {
  title: string;
  invoiceDate: string;
  customer: string;
  employee: string;
  printDate: string;
  items: string;
  product: string;
  quantity: string;
  noItems: string;
  meter: string;
  note: string;
  sl: string;
  unit: string;
  piece: string;
  query: string;
  receiptStatement: string;
  receivedBy: string;
  signature: string;
  /** No longer rendered — kept optional so existing callers don't break. */
  preparedBy?: string;
  approvedBy?: string;
  name?: string;
  /** Optional: label for the totals row. Falls back to the quantity label. */
  total?: string;
  /** Optional: label for the delivery-date write-in line. Falls back to "التاريخ". */
  deliveryDate?: string;
}

interface DisbursementVoucherDocumentProps {
  data: DisbursementVoucherData;
  labels: DisbursementVoucherLabels;
}

/**
 * The 4mm print safe margin is defined once, in PrintDocumentLayout (@page).
 * Here the sheet has zero padding in print so margins are never doubled.
 */
const VOUCHER_CSS = `
.print-voucher-sheet {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 4mm; /* screen preview only */
}

.disbursement-voucher,
.disbursement-voucher * {
  box-sizing: border-box;
}

/* Repeat the table heading on each printed page. */
.disbursement-voucher .pn-items--voucher thead {
  display: table-header-group;
}

/* Totals appear once at the end, not on every page. */
.disbursement-voucher .pn-items--voucher tfoot {
  display: table-row-group;
}

.disbursement-voucher .pn-items--voucher tr {
  break-inside: avoid;
  page-break-inside: avoid;
}

/* Pieces and meters totals stack vertically. */
.disbursement-voucher .cell-total-value {
  display: table-cell;
}

.disbursement-voucher .cell-total-value span {
  display: block;
}

.disbursement-voucher .pn-note {
  break-inside: avoid;
  page-break-inside: avoid;
}

/* Receipt statement and signature box stay together on one page. */
.disbursement-voucher .disbursement-voucher__footer {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 5mm;
  margin-block-start: 4mm;
  break-inside: avoid;
  page-break-inside: avoid;
  /* Never start a fresh sheet with only the signature block. */
  break-before: avoid;
  page-break-before: avoid;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.disbursement-voucher .disbursement-voucher__receipt {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
  margin: 0;
  padding: 3mm 4mm;
  background: var(--pd-soft);
  border-inline-start: 1mm solid var(--pd-navy);
  border-radius: 1.5mm;
  font-size: 9.5pt;
  font-weight: 600;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.disbursement-voucher .disbursement-voucher__signature {
  flex: 0 0 72mm;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 0.4mm solid var(--pd-navy);
  border-radius: 1.5mm;
  overflow: hidden;
}

.disbursement-voucher .disbursement-voucher__signature h3 {
  margin: 0;
  padding: 1.2mm 2mm;
  background: var(--pd-navy);
  color: #fff;
  font-size: 9pt;
  font-weight: 800;
  text-align: center;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.disbursement-voucher .disbursement-voucher__signature-body {
  display: flex;
  flex-direction: column;
  gap: 0.6mm;
  padding: 1.5mm 3mm 2mm;
}

.disbursement-voucher .disbursement-voucher__field {
  display: flex;
  align-items: flex-end;
  gap: 2mm;
  min-height: 7mm;
  font-size: 8.5pt;
  font-weight: 700;
  color: var(--pd-navy);
}

.disbursement-voucher .disbursement-voucher__field-line {
  flex: 1;
  min-width: 0;
  border-bottom: 0.3mm solid var(--pd-ink);
  height: 5mm;
}

.disbursement-voucher .disbursement-voucher__field--signature {
  flex-direction: column;
  align-items: stretch;
  gap: 0;
}

.disbursement-voucher .disbursement-voucher__field--signature .disbursement-voucher__field-line {
  height: 13mm;
  flex: none;
}

@media print {
  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
  }

  .print-voucher-sheet {
    width: auto !important;
    min-width: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
  }

  .disbursement-voucher {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    margin: 0;
    overflow: visible;
  }

  .disbursement-voucher .pn-items--voucher {
    width: 100%;
    max-width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
  }

  .disbursement-voucher .pn-items--voucher th,
  .disbursement-voucher .pn-items--voucher td {
    overflow-wrap: anywhere;
    word-break: normal;
  }
}
`;

const round2 = (value: number) => Math.round(value * 100) / 100;

export default function DisbursementVoucherDocument({
  data,
  labels,
}: DisbursementVoucherDocumentProps) {
  const hasItems = data.items.length > 0;

  // Pieces and meters can't be added together, so total them separately.
  const totalPieces = round2(
    data.items.reduce((sum, i) => (i.unit === "METER" ? sum : sum + i.quantity), 0),
  );
  const totalMeters = round2(
    data.items.reduce((sum, i) => (i.unit === "METER" ? sum + i.quantity : sum), 0),
  );

  return (
    <div className="print-voucher-sheet" data-print-root aria-hidden="true">
      <style>{VOUCHER_CSS}</style>
      <PrintDocumentLayout
        className="disbursement-voucher"
        title={labels.title}
        documentTitle="DISBURSEMENT VOUCHER"
        documentNumber={data.invoiceNumber || undefined}
        headerVisibility="print"
      >
        <section className="pn-parties" aria-label={labels.title}>
          <div className="pn-parties__bill-to">
            <span className="pn-parties__label">{labels.customer}</span>
            <strong className="pn-parties__name">
              <bdi dir="auto">{data.customerName || "—"}</bdi>
            </strong>
            <span className="pn-parties__line" dir="auto">
              {labels.employee}: <bdi dir="auto">{data.employeeName || "—"}</bdi>
            </span>
          </div>
          <dl className="pn-parties__meta">
            <dt>{labels.invoiceDate}</dt>
            <dd dir="ltr">{formatPrintDate(data.invoiceDate)}</dd>
            <dt>{labels.printDate}</dt>
            <dd dir="ltr">{formatPrintDateTime(data.printedAt)}</dd>
          </dl>
        </section>

        <table className="pn-items pn-items--voucher">
          <thead>
            <tr>
              <th scope="col" className="cell-center">
                {labels.sl}
              </th>
              <th scope="col">{labels.product}</th>
              <th scope="col" className="cell-center">
                {labels.unit}
              </th>
              <th scope="col" className="cell-center">
                {labels.quantity}
              </th>
            </tr>
          </thead>
          <tbody>
            {hasItems ? (
              data.items.map((item, index) => (
                <tr key={item.id}>
                  <td className="cell-sl" dir="ltr">
                    {formatPrintNumber(index + 1, { decimals: 0 })}
                  </td>
                  <td className="cell-product">
                    <strong>
                      <bdi dir="auto">{item.name || "—"}</bdi>
                    </strong>
                    {item.barcodes.length > 0 && (
                      <small>
                        <bdi dir="ltr">{item.barcodes.join(", ")}</bdi>
                      </small>
                    )}
                  </td>
                  <td className="cell-unit">
                    {item.unit === "METER" ? labels.meter : labels.piece}
                  </td>
                  <td className="cell-qty" dir="ltr">
                    {item.quantity}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="cell-empty" colSpan={4}>
                  {labels.noItems}
                </td>
              </tr>
            )}
          </tbody>
          {hasItems && (
            <tfoot>
              <tr>
                <td colSpan={2} className="cell-total-label">
                  {labels.total ?? labels.quantity}
                </td>
                <td colSpan={2} className="cell-total-value" dir="ltr">
                  {totalPieces > 0 && (
                    <span>
                      {totalPieces} <bdi dir="auto">{labels.piece}</bdi>
                    </span>
                  )}
                  {totalMeters > 0 && (
                    <span>
                      {totalMeters} <bdi dir="auto">{labels.meter}</bdi>
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* Invoice note (optional, plain string only — never prices/costs) */}
        {data.note?.trim() && (
          <section className="pn-note">
            <span>{labels.note}</span>
            <p dir="auto">{data.note}</p>
          </section>
        )}

        <div className="disbursement-voucher__footer">
          <p className="disbursement-voucher__receipt">{labels.receiptStatement}</p>
          <div className="disbursement-voucher__signature">
            <h3>{labels.receivedBy}</h3>
            <div className="disbursement-voucher__signature-body">
              <div className="disbursement-voucher__field">
                <span>{labels.name ?? "الاسم"}</span>
                <span className="disbursement-voucher__field-line" />
              </div>
              <div className="disbursement-voucher__field">
                <span>{labels.deliveryDate ?? "التاريخ"}</span>
                <span className="disbursement-voucher__field-line" />
              </div>
              <div className="disbursement-voucher__field disbursement-voucher__field--signature">
                <span>{labels.signature}</span>
                <span className="disbursement-voucher__field-line" />
              </div>
            </div>
          </div>
        </div>
      </PrintDocumentLayout>
    </div>
  );
}