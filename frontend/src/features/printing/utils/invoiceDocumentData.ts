import type {
  Invoice,
  InvoiceAuditLog,
  InvoiceItem,
  InvoiceStatus,
} from "../../../types";
import type {
  InvoiceDocumentAuditEntry,
  InvoiceDocumentData,
  InvoiceDocumentLine,
} from "../components/InvoiceDocument";
function toDocumentLine(item: InvoiceItem): InvoiceDocumentLine {
  const assignedBarcodes = (item.unitAssignments ?? [])
    .filter(
      (assignment) =>
        assignment.reversedAt === undefined || assignment.reversedAt === null,
    )
    .map((assignment) => assignment.productUnit?.barcode)
    .filter((barcode): barcode is string => Boolean(barcode));

  return {
    id: item.id,
    name:
      item.productUnit?.productModel?.name ||
      item.productModel?.name ||
      "",
    quantity: Number(item.quantity ?? 1),
    unit: item.productModel?.unit,
    barcode: assignedBarcodes.length
      ? assignedBarcodes.join(", ")
      : item.productUnit?.barcode,
    price: Number(item.price ?? 0),
  };
}

export function createInvoiceDocumentData(
  invoice: Invoice,
  auditLogs: InvoiceAuditLog[],
  printedAt: Date | undefined,
  translateAction: (action: string) => string,
  translateStatus: (status: InvoiceStatus) => string = (status) => status,
): InvoiceDocumentData {
  const auditEntries: InvoiceDocumentAuditEntry[] = auditLogs.map((entry) => ({
    id: entry.id,
    action: translateAction(entry.action),
    employeeName: entry.employee?.name ?? "",
    timestamp: entry.timestamp,
  }));

  return {
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.date,
    customerName: invoice.customer?.name ?? "",
    customerPhone: invoice.customer?.phone,
    employeeName: invoice.employee?.name ?? "",
    status: invoice.status,
    statusLabel: translateStatus(invoice.status),
    paymentType: invoice.paymentType,
    note: invoice.note,
    originalTotal: invoice.originalTotal,
    currentTotal: invoice.currentTotal,
    discountPercentage: invoice.discountPercentage,
    discountAmount: invoice.discountAmount,
    items: invoice.items.map(toDocumentLine),
    auditEntries,
    printedAt,
  };
}

export function createInvoicePreviewData(input: {
  invoiceNumber: string;
  date: Date;
  customerName: string;
  customerPhone?: string | null;
  employeeName: string;
  paymentType: string;
  note?: string;
  subtotal: number;
  percentageDiscount: number;
  discountPercentage: number;
  fixedDiscount: number;
  total: number;
  previewSubtitle: string;
  items: InvoiceDocumentLine[];
}): InvoiceDocumentData {
  return {
    invoiceNumber: input.invoiceNumber,
    date: input.date,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    employeeName: input.employeeName,
    paymentType: input.paymentType,
    note: input.note?.trim() || null,
    originalTotal: input.subtotal,
    currentTotal: input.total,
    percentageDiscount: input.percentageDiscount,
    discountPercentage: input.discountPercentage,
    discountAmount: input.fixedDiscount,
    previewSubtitle: input.previewSubtitle,
    items: input.items,
  };
}
