/* TEMPORARY print-verification harness (not part of the app bundle). */
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import "./index.css";
import { I18nProvider, useI18n } from "./i18n/context";
import { SettingsProvider } from "./lib/settings";
import PrintHeader from "./features/reports/components/PrintHeader";
import ReportKpiCard from "./features/reports/components/ReportKpiCard";
import { Table } from "./components/ui/Table";
import InvoiceDocument from "./features/printing/components/InvoiceDocument";
import DisbursementVoucherDocument from "./features/printing/components/DisbursementVoucherDocument";

const params = new URLSearchParams(location.search);
const scene = params.get("scene") ?? "report";
const rows = Number(params.get("rows") ?? "40");
const longText = params.get("long") === "1";

if (params.get("lang") === "ar") {
  localStorage.setItem("pallet-lang", "ar");
}

const arabicNames = [
  "أحمد محمد عبد الرحمن الشرقاوي",
  "شركة النيل للتجارة والتوزيع ش.م.م",
  "مؤسسة الأمل للمقاولات العامة والتوريدات",
  "محمد إبراهيم السيد عبد الله",
  "مجموعة الرياض للتجارة الدولية",
];

const tableRows = Array.from({ length: rows }, (_, index) => ({
  id: index + 1,
  invoiceNumber: `INV-2026-${String(index + 1).padStart(5, "0")}`,
  customer: longText
    ? `${arabicNames[index % arabicNames.length]} — فرع مدينة نصر — شارع عباس العقاد`
    : arabicNames[index % arabicNames.length],
  date: "2026-10-21",
  total: 1234567.89 + index * 98123.45,
  status: index % 3 === 0 ? "مدفوعة" : index % 3 === 1 ? "معلقة" : "ملغاة",
}));

const invoiceItems = Array.from({ length: rows }, (_, index) => ({
  id: index + 1,
  name: longText
    ? `منتج تجريبي طويل الاسم للاختبار — ${index + 1} — عبوة كبيرة`
    : `منتج ${index + 1}`,
  quantity: (index % 7) + 1,
  unit: index % 4 === 0 ? "METER" : "PIECE",
  barcode: `62210300${String(index + 1).padStart(4, "0")}`,
  price: 12345.67 + index * 321.5,
}));

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--surface)" }}>
      <div className="lg:ms-64">
        <main
          className="page-container"
          style={{ padding: "var(--page-pad-y) var(--page-pad-x)" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function ReportScene() {
  const { t } = useI18n();
  const columns = [
    { key: "invoiceNumber", label: "رقم الفاتورة" },
    { key: "customer", label: "العميل" },
    { key: "date", label: "التاريخ", align: "center" as const },
    {
      key: "total",
      label: "الإجمالي",
      align: "right" as const,
      render: (row: (typeof tableRows)[number]) => (
        <strong style={{ fontVariantNumeric: "tabular-nums" }} dir="ltr">
          {row.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </strong>
      ),
    },
    { key: "status", label: "الحالة", align: "center" as const },
  ];

  return (
    <Shell>
      <div className="reports-layout">
        <div className="no-print" style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>{t.reports.revenue}</h1>
          <div className="toolbar" style={{ display: "flex", gap: 8 }}>
            <button type="button">طباعة</button>
            <button type="button">تصدير</button>
          </div>
        </div>

        <div className="print-area">
          <PrintHeader
            titleEn="Revenue Report"
            titleAr="تقرير المبيعات"
            range={{ from: "2026-01-01", to: "2026-10-21" }}
            filters={[{ label: "الفرع", value: "الفرع الرئيسي" }]}
          />

          <div
            className="report-card form-grid"
            style={{ gap: 12, marginBottom: "var(--section-gap)" }}
          >
            <ReportKpiCard
              label="إجمالي المبيعات"
              value="١٢٬٣٤٥٬٦٧٨٫٩٠ ج.م"
              color="var(--brand)"
            />
            <ReportKpiCard
              label="التعديلات المعتمدة"
              value="١٢٣٬٤٥٦٫٧٨ ج.م"
              color="var(--accent)"
            />
            <ReportKpiCard
              label="المرتجعات المعتمدة"
              value="٥٬٦٧٨٫٩٠ ج.م"
              color="var(--peach)"
            />
            <ReportKpiCard
              label="صافي المبيعات"
              value="١٢٬٢١٦٬٥٤٣٫٢٢ ج.م"
              color="var(--mint)"
            />
          </div>

          <div style={{ marginBottom: "var(--section-gap)" }}>
            <div style={{ marginBottom: 8, fontWeight: 700, fontSize: 16 }}>
              تفاصيل الفواتير
            </div>
            <div
              className="ui-card"
              style={{
                padding: 16,
                border: "1px solid var(--border)",
                borderRadius: 12,
                background: "var(--card)",
              }}
            >
              <Table
                columns={columns}
                data={tableRows}
                keyExtractor={(row) => String(row.id)}
              />
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function InvoiceScene() {
  return (
    <Shell>
      <div className="print-area">
        <InvoiceDocument
          mode="saved"
          currency="ج.م"
          data={{
            invoiceNumber: "INV-2026-00042",
            date: "2026-10-21",
            customerName: longText
              ? "شركة النيل للتجارة والتوزيع ش.م.م — فرع مدينة نصر — شارع عباس العقاد"
              : "شركة النيل للتجارة والتوزيع",
            customerPhone: "01001234567",
            employeeName: "أحمد محمد عبد الرحمن",
            status: "PAID",
            statusLabel: "مدفوعة",
            paymentType: "نقدي",
            note: longText
              ? "ملاحظات طويلة للاختبار: يرجى مراجعة الأصناف المستلمة والتوقيع على نسخة المندوب قبل مغادرة المخزن، مع الاحتفاظ بنسخة لدى الإدارة المالية."
              : "شكراً لتعاملكم معنا.",
            originalTotal: 1234567.89,
            currentTotal: 1234567.89,
            discountPercentage: 5,
            percentageDiscount: 61728.39,
            discountAmount: 0,
            items: invoiceItems,
            auditEntries: Array.from({ length: 4 }, (_, index) => ({
              id: index + 1,
              action: "تم إنشاء الفاتورة",
              employeeName: "أحمد محمد عبد الرحمن",
              timestamp: "2026-10-21T10:15:00",
            })),
            printedAt: new Date("2026-10-21T12:00:00"),
          }}
          labels={{
            title: "فاتورة مبيعات",
            invoice: "رقم الفاتورة",
            date: "التاريخ",
            customer: "العميل",
            employee: "الموظف",
            status: "الحالة",
            payment: "طريقة الدفع",
            note: "ملاحظات",
            items: "الأصناف",
            product: "المنتج",
            quantity: "الكمية",
            price: "السعر",
            lineTotal: "الإجمالي",
            summary: "الملخص المالي",
            originalTotal: "الإجمالي الأصلي",
            currentTotal: "الإجمالي الحالي",
            discountPercent: "خصم نسبة",
            discountAmount: "خصم مبلغ",
            audit: "سجل التعديلات",
            noAudit: "لا توجد تعديلات",
            noItems: "لا توجد أصناف",
            draft: "مسودة",
            billTo: "فاتورة إلى",
            subtotal: "المجموع",
            printedAt: "تاريخ الطباعة",
            meter: "متر",
            sl: "م",
            total: "الإجمالي",
            query: "استفسار",
            authorisedSignature: "التوقيع المعتمد",
          }}
        />
      </div>
    </Shell>
  );
}

function VoucherScene() {
  return (
    <Shell>
      <DisbursementVoucherDocument
        data={{
          invoiceNumber: "INV-2026-00042",
          customerName: "شركة النيل للتجارة والتوزيع",
          employeeName: "أحمد محمد عبد الرحمن",
          invoiceDate: "2026-10-21",
          printedAt: new Date("2026-10-21T12:00:00"),
          note: "يرجى مراجعة الأصناف والتوقيع.",
          items: invoiceItems.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit === "METER" ? ("METER" as const) : ("PIECE" as const),
            barcodes: item.barcode ? [item.barcode] : [],
          })),
        }}
        labels={{
          title: "إذن صرف",
          invoiceDate: "تاريخ الفاتورة",
          customer: "العميل",
          employee: "الموظف",
          printDate: "تاريخ الطباعة",
          items: "الأصناف",
          product: "المنتج",
          quantity: "الكمية",
          unit: "الوحدة",
          noItems: "لا توجد أصناف",
          meter: "متر",
          note: "ملاحظات",
          total: "الإجمالي",
          sl: "م",
          piece: "قطعة",
          query: "استفسار",
          receiptStatement: "إقرار الاستلام",
          preparedBy: "أعدّه",
          approvedBy: "اعتمده",
          receivedBy: "استلمه",
          name: "الاسم",
          signature: "التوقيع",
        }}
      />
    </Shell>
  );
}

function App() {
  if (scene === "invoice") return <InvoiceScene />;
  if (scene === "voucher") return <VoucherScene />;
  return <ReportScene />;
}

createRoot(document.getElementById("root")!).render(
  <MemoryRouter>
    <I18nProvider>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </I18nProvider>
  </MemoryRouter>,
);
