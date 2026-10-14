import type { Invoice } from "../../../types";
import type {
  DisbursementVoucherData,
  DisbursementVoucherLine,
} from "../components/DisbursementVoucherDocument";

export function getActiveDisbursementBarcodes(
  item: Invoice["items"][number],
): string[] {
  return (item.unitAssignments ?? [])
    .filter(
      (assignment) =>
        assignment.reversedAt === undefined || assignment.reversedAt === null,
    )
    .map((assignment) => assignment.productUnit?.barcode)
    .filter((barcode): barcode is string => Boolean(barcode));
}

function toVoucherQuantity(value: number | undefined): number {
  const quantity = value ?? 1;
  if (!Number.isFinite(quantity)) {
    throw new RangeError(`Cannot print non-finite voucher quantity: ${quantity}`);
  }
  return quantity;
}

export function createDisbursementVoucherData(
  invoice: Invoice,
  printedAt: Date,
): DisbursementVoucherData {
  const items: DisbursementVoucherLine[] = (invoice.items ?? []).map((item) => ({
    id: item.id,
    name:
      item.productModel?.name ||
      item.productUnit?.productModel?.name ||
      "",
    quantity: toVoucherQuantity(item.quantity),
    unit: item.productModel?.unit ?? item.productUnit?.productModel?.unit,
    barcodes: getActiveDisbursementBarcodes(item),
  }));

  return {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.date,
    customerName: invoice.customer?.name ?? "",
    employeeName: invoice.employee?.name ?? "",
    printedAt,
    items,
    note: invoice.note,
  };
}
