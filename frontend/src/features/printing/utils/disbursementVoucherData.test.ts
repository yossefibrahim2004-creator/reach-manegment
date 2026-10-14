import assert from "node:assert/strict";
import test from "node:test";
import type { Invoice } from "../../../types";
import { createInvoiceDocumentData } from "./invoiceDocumentData.ts";
import {
  createDisbursementVoucherData,
  getActiveDisbursementBarcodes,
} from "./disbursementVoucherData.ts";

const invoice: Invoice = {
  id: 1,
  invoiceNumber: "INV-001",
  customerId: 2,
  customer: {
    id: 2,
    name: "عميل",
    type: "COMPANY",
    isActive: true,
    deletedAt: null,
    createdAt: "",
  },
  employeeId: 3,
  employee: {
    id: 3,
    name: "موظف",
    role: "INVENTORY",
    username: "employee",
    isActive: true,
    createdAt: "",
    updatedAt: "",
  },
  status: "DELIVERED",
  date: "2026-10-13T10:00:00.000Z",
  originalTotal: 100,
  currentTotal: 100,
  items: [
    {
      id: 4,
      invoiceId: 1,
      productUnitId: 5,
      productModelId: 6,
      productModel: {
        id: 6,
        name: "جهاز إنذار",
        categoryId: 7,
        minStockAlert: 0,
        isSerialized: true,
        unit: "PIECE",
        isActive: true,
        deletedAt: null,
        createdAt: "",
      },
      quantity: 2,
      price: 50,
      costAtSale: 20,
      unitAssignments: [
        { id: 8, productUnit: { id: 9, barcode: "UNIT-001", status: "SOLD" } },
        { id: 10, productUnit: { id: 11, barcode: "UNIT-002", status: "SOLD" } },
        { id: 12, productUnit: { id: 13, barcode: "", status: "SOLD" } },
        {
          id: 14,
          reversedAt: "2026-10-13T12:00:00.000Z",
          productUnit: { id: 15, barcode: "REVERSED-001", status: "SOLD" },
        },
      ],
      createdAt: "",
    },
  ],
};

test("includes only active-assignment barcodes for the shared voucher", () => {
  assert.deepEqual(getActiveDisbursementBarcodes(invoice.items[0]), [
    "UNIT-001",
    "UNIT-002",
  ]);
});

test("maps voucher data without exposing price or cost fields", () => {
  const data = createDisbursementVoucherData(invoice, new Date(2026, 9, 13));
  assert.equal(data.invoiceNumber, "INV-001");
  assert.equal(data.customerName, "عميل");
  assert.equal(data.employeeName, "موظف");
  assert.equal(data.items[0].quantity, 2);
  assert.deepEqual(data.items[0].barcodes, ["UNIT-001", "UNIT-002"]);
  assert.equal("price" in data.items[0], false);
  assert.equal("costAtSale" in data.items[0], false);
});

test("invoice documents contain every active assigned serial barcode", () => {
  const data = createInvoiceDocumentData(
    invoice,
    [],
    undefined,
    (action) => action,
    (status) => status,
  );
  assert.equal(data.items[0].barcode, "UNIT-001, UNIT-002");
});
