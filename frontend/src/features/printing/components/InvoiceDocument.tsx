import { memo } from "react";
import PrintDocumentLayout from "./PrintDocumentLayout";
import { LoadingSpinner } from "../../../components/ui/LoadingSpinner";
import {
  formatPrintCurrency,
  formatPrintDate,
  formatPrintDateTime,
} from "../utils/formatters";

export interface InvoiceDocumentLine {
  id: number | string;
  name: string;
  quantity: number;
  unit?: string;
  barcode?: string | null;
  price: number;
}

export interface InvoiceDocumentAuditEntry {
  id: number | string;
  action: string;
  employeeName: string;
  timestamp: string | Date;
}

export interface InvoiceDocumentData {
  invoiceNumber: string;
  date: string | Date;
  customerName: string;
  customerPhone?: string | null;
  employeeName: string;
  status?: string;
  statusLabel?: string;
  paymentType?: string;
  note?: string | null;
  originalTotal: number | string;
  currentTotal: number | string;
  discountPercentage?: number;
  discountAmount?: number;
  percentageDiscount?: number;
  items: InvoiceDocumentLine[];
  auditEntries?: InvoiceDocumentAuditEntry[];
  printedAt?: Date;
  previewSubtitle?: string;
}

export interface InvoiceDocumentLabels {
  title: string;
  invoice: string;
  date: string;
  customer: string;
  employee: string;
  status: string;
  payment: string;
  note: string;
  items: string;
  product: string;
  quantity: string;
  price: string;
  lineTotal: string;
  summary: string;
  originalTotal: string;
  currentTotal: string;
  discountPercent: string;
  discountAmount: string;
  audit: string;
  noAudit: string;
  noItems: string;
  draft: string;
  billTo: string;
  subtotal: string;
  printedAt: string;
  meter: string;
  sl: string;
  total: string;
  query: string;
  authorisedSignature: string;
}

interface InvoiceDocumentProps {
  data: InvoiceDocumentData;
  labels: InvoiceDocumentLabels;
  currency: string;
  mode: "saved" | "preview";
  auditLoading?: boolean;
}

/**
 * The 4mm print safe margin is defined once, in PrintDocumentLayout (@page).
 * Here the document has zero padding/margin in print so margins are never doubled.
 */
const INVOICE_PRINT_CSS = `
@media print {
  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
  }

  .invoice-document {
    box-sizing: border-box;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .invoice-document *,
  .invoice-document *::before,
  .invoice-document *::after {
    box-sizing: border-box;
  }

  .invoice-document .pn-items {
    width: 100%;
    max-width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
  }

  .invoice-document .pn-items th,
  .invoice-document .pn-items td {
    overflow-wrap: anywhere;
    word-break: normal;
  }

  /* Repeat the table heading on every printed page. */
  .invoice-document .pn-items thead {
    display: table-header-group;
  }

  /* Never split a row across two pages. */
  .invoice-document .pn-items tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Keep totals and note together, and the audit block intact. */
  .invoice-document .pn-bottom,
  .invoice-document .pn-totals,
  .invoice-document .pn-note,
  .invoice-document .pn-audit__head {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .invoice-document .pn-audit__head {
    break-after: avoid;
    page-break-after: avoid;
  }
}
`;

function InvoiceDocument({
  data,
  labels,
  currency,
  mode,
  auditLoading = false,
}: InvoiceDocumentProps) {
  const isPreview = mode === "preview";
  const dateText = formatPrintDate(data.date);
  const auditEntries = data.auditEntries ?? [];
  const money = (value: number | string | undefined) =>
    formatPrintCurrency(value ?? 0, currency, { useGrouping: false });

  return (
    <PrintDocumentLayout
      title={labels.title}
      documentTitle="INVOICE"
      documentNumber={data.invoiceNumber || undefined}
      subtitle={isPreview ? data.previewSubtitle : undefined}
      className={`invoice-document invoice-document--${mode}`}
      headerVisibility={isPreview ? "always" : "print"}
    >
      <style>{INVOICE_PRINT_CSS}</style>

      <section className="pn-parties">
        <div className="pn-parties__bill-to">
          <span className="pn-parties__label">{labels.billTo}</span>
          <strong className="pn-parties__name">
            <bdi dir="auto">{data.customerName || "—"}</bdi>
          </strong>
          {data.customerPhone && (
            <span className="pn-parties__line" dir="ltr">
              {data.customerPhone}
            </span>
          )}
          {!isPreview && data.status && (
            <span className="pn-status">{data.statusLabel ?? data.status}</span>
          )}
        </div>
        <dl className="pn-parties__meta">
          <dt>{labels.invoice}</dt>
          <dd dir="ltr">{data.invoiceNumber || labels.draft}</dd>
          <dt>{labels.date}</dt>
          <dd dir="ltr">{dateText}</dd>
          <dt>{labels.payment}</dt>
          <dd dir="auto">{data.paymentType || "—"}</dd>
          <dt>{labels.employee}</dt>
          <dd dir="auto">{data.employeeName || "—"}</dd>
          {data.printedAt && (
            <>
              <dt>{labels.printedAt}</dt>
              <dd dir="ltr">{formatPrintDateTime(data.printedAt)}</dd>
            </>
          )}
        </dl>
      </section>

      <table className="pn-items">
        <thead>
          <tr>
            <th scope="col" className="cell-center">
              {labels.sl}
            </th>
            <th scope="col">{labels.product}</th>
            <th scope="col" className="cell-end">
              {labels.price}
            </th>
            <th scope="col" className="cell-center">
              {labels.quantity}
            </th>
            {!isPreview && (
              <th scope="col" className="cell-end">
                {labels.lineTotal}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.items.length === 0 ? (
            <tr>
              <td className="cell-empty" colSpan={isPreview ? 4 : 5}>
                {labels.noItems}
              </td>
            </tr>
          ) : (
            data.items.map((item, index) => (
              <tr key={item.id}>
                <td className="cell-sl" dir="ltr">
                  {index + 1}
                </td>
                <td className="cell-product">
                  <strong>
                    <bdi dir="auto">{item.name || "—"}</bdi>
                  </strong>
                  {item.barcode && (
                    <small>
                      <bdi dir="ltr">{item.barcode}</bdi>
                    </small>
                  )}
                </td>
                <td className="cell-num">
                  <bdi dir="ltr">
                    {isPreview
                      ? item.price === 0
                        ? "—"
                        : money(item.price * item.quantity)
                      : money(item.price)}
                  </bdi>
                </td>
                <td className="cell-center cell-num">
                  {item.quantity}
                  {item.unit === "METER" ? ` ${labels.meter}` : ""}
                </td>
                {!isPreview && (
                  <td className="cell-num">
                    <bdi dir="ltr">{money(item.price * item.quantity)}</bdi>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="pn-bottom">
        <div className="pn-bottom__start">
          {data.note?.trim() && (
            <section className="pn-note">
              <span>{labels.note}</span>
              <p dir="auto">{data.note}</p>
            </section>
          )}
        </div>

        <div className="pn-totals">
          <div className="pn-totals__row">
            <span>{isPreview ? labels.subtotal : labels.originalTotal}</span>
            <strong dir="ltr">{money(data.originalTotal)}</strong>
          </div>
          {Boolean(data.discountPercentage) && (
            <div className="pn-totals__row">
              <span>
                {labels.discountPercent} ({data.discountPercentage}%)
              </span>
              <strong dir="ltr">- {money(data.percentageDiscount)}</strong>
            </div>
          )}
          {Boolean(data.discountAmount) && (
            <div className="pn-totals__row">
              <span>{labels.discountAmount}</span>
              <strong dir="ltr">- {money(data.discountAmount)}</strong>
            </div>
          )}
          <div className="pn-total-bar">
            <span className="pn-total-bar__chip">{labels.total}</span>
            <strong className="pn-total-bar__amount" dir="ltr">
              {money(data.currentTotal)}
            </strong>
          </div>
        </div>
      </div>

      {!isPreview && (
        <section className="pn-audit">
          <div className="pn-audit__head">
            <h2>{labels.audit}</h2>
            <span>{auditLoading ? "…" : auditEntries.length}</span>
          </div>
          {auditLoading ? (
            <p className="pn-audit__empty">
              <LoadingSpinner size={20} />
            </p>
          ) : auditEntries.length === 0 ? (
            <p className="pn-audit__empty">{labels.noAudit}</p>
          ) : (
            <table className="pn-items pn-audit__table">
              <thead>
                <tr>
                  <th scope="col">{labels.audit}</th>
                  <th scope="col">{labels.employee}</th>
                  <th scope="col">{labels.date}</th>
                </tr>
              </thead>
              <tbody>
                {auditEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <strong>{entry.action || "—"}</strong>
                    </td>
                    <td>
                      <bdi dir="auto">{entry.employeeName || "—"}</bdi>
                    </td>
                    <td dir="ltr">
                      <bdi dir="ltr">
                        {formatPrintDateTime(entry.timestamp)}
                      </bdi>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </PrintDocumentLayout>
  );
}

export default memo(InvoiceDocument);