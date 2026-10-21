import type { CSSProperties } from "react";
import type { Column } from "../../components/ui/Table";
import { StatusChip } from "../../components/ui/StatusChip";
import { useI18n } from "../../i18n/context";
import type { Invoice } from "../../types";
import {
  formatPrintDate,
  formatPrintNumber,
} from "../printing/utils/formatters";

/**
 * One source of truth for how an invoice row is rendered.
 *
 * Both the admin Invoices page and the dashboard's "Recent invoices" table
 * consume this hook, so number, customer, status, date and amount can never
 * drift apart between the two tables. Pages may pick a subset (and order) of
 * the columns, but the rendering of each column is defined here only.
 */
export type InvoiceColumnKey =
  | "invoiceNumber"
  | "customer"
  | "employee"
  | "date"
  | "status"
  | "note"
  | "total";

const DEFAULT_COLUMN_ORDER: InvoiceColumnKey[] = [
  "invoiceNumber",
  "customer",
  "employee",
  "date",
  "status",
  "note",
  "total",
];

const invoiceNumberStyle: CSSProperties = {
  fontFamily: "'Manrope', sans-serif",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
};

const dateCellStyle: CSSProperties = {
  whiteSpace: "nowrap",
  color: "var(--soft)",
  fontVariantNumeric: "tabular-nums",
};

const noteCellStyle: CSSProperties = {
  display: "block",
  maxWidth: 180,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const amountCellStyle: CSSProperties = {
  display: "block",
  textAlign: "end",
  direction: "ltr",
  whiteSpace: "nowrap",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
};

const formatInvoiceDate = (value: string | Date | null | undefined): string => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : formatPrintDate(date);
};

export function useInvoiceColumns(options?: {
  include?: InvoiceColumnKey[];
}): Column<Invoice>[] {
  const { t } = useI18n();
  const order = options?.include ?? DEFAULT_COLUMN_ORDER;

  const columns: Record<InvoiceColumnKey, Column<Invoice>> = {
    invoiceNumber: {
      key: "invoiceNumber",
      label: t.invoices.invoiceNumber,
      render: (invoice) => (
        <span style={invoiceNumberStyle}>{invoice.invoiceNumber}</span>
      ),
    },
    customer: {
      key: "customerName",
      label: t.invoices.customer,
      render: (invoice) => invoice.customer?.name ?? "—",
    },
    employee: {
      key: "employeeName",
      label: t.invoices.employee,
      render: (invoice) => invoice.employee?.name ?? "—",
    },
    date: {
      key: "date",
      label: t.date,
      render: (invoice) => (
        <span style={dateCellStyle}>{formatInvoiceDate(invoice.date)}</span>
      ),
    },
    status: {
      key: "status",
      label: t.status,
      render: (invoice) => <StatusChip status={invoice.status} />,
    },
    note: {
      key: "note",
      label: t.newInvoice.note,
      render: (invoice) =>
        invoice.note?.trim() ? (
          <span title={invoice.note} style={noteCellStyle}>
            {invoice.note}
          </span>
        ) : (
          ""
        ),
    },
    total: {
      key: "currentTotal",
      label: t.total,
      align: "right",
      render: (invoice) => (
        <span style={amountCellStyle}>
          {formatPrintNumber(invoice.currentTotal)} {t.currency}
        </span>
      ),
    },
  };

  return order.map((key) => columns[key]);
}
