import { useState, useEffect, useCallback, useRef } from "react";
import api from "../../lib/api";
import { isAbortError } from "../../hooks";
import { notify } from "../../lib/notify";
import { getFriendlyErrorMessage } from "../../lib/messages";
import { getSuccessMessages } from "../../lib/success-messages";
import { Button } from "../../components/ui/Button";
import { Table } from "../../components/ui/Table";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Modal } from "../../components/ui/Modal";
import { useI18n } from "../../i18n/context";
import { useRealtimeRefresh } from "../../hooks/useRealtimeEvents";
import PrintButton from "../../features/reports/components/PrintButton";
import PrintHeader from "../../features/reports/components/PrintHeader";
import type { Invoice, PaginatedResponse } from "../../types";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface ScannedUnit {
  barcode: string;
  scannedAt: string;
  scannedBy?: string;
}

interface SerializedLine {
  invoiceItemId: number;
  productModelId: number;
  productModelName: string;
  requiredQuantity: number;
  scannedQuantity: number;
  scannedUnits: ScannedUnit[];
}

interface DeliverySummary {
  invoiceId: number;
  invoiceNumber: string;
  status: string;
  serializedLines: SerializedLine[];
}

/* ------------------------------------------------------------------ */
/* Helpers (pure functions: no reason to re-create them every render)  */
/* ------------------------------------------------------------------ */

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("en-GB");

// 13/10/2026 — 14:45  (Latin digits + 24h so it prints the same on every machine)
const formatDateTime = (value: Date) => {
  const date = value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = value.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date} — ${time}`;
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function InvoiceDelivery() {
  const { t } = useI18n();
  const SUCCESS_MESSAGES = getSuccessMessages(t);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [delivering, setDelivering] = useState<number | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [deliverySummary, setDeliverySummary] = useState<DeliverySummary | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeError, setBarcodeError] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [printedAt, setPrintedAt] = useState<Date>(() => new Date());

  const detailAbortRef = useRef<AbortController | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);

  /* ----------------------------- derived ---------------------------- */

  const serializedLines = deliverySummary?.serializedLines ?? [];
  const remainingScans = serializedLines.reduce(
    (sum, line) => sum + Math.max(0, line.requiredQuantity - line.scannedQuantity),
    0,
  );
  const firstUnscannedItemId = serializedLines.find(
    (line) => line.scannedQuantity < line.requiredQuantity,
  )?.invoiceItemId;

  /* ----------------------------- data ------------------------------- */

  const fetchInvoices = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const { data } = await api.get<PaginatedResponse<Invoice>>("/invoices/delivery-queue", { signal });
      setInvoices(data.data || []);
    } catch (err) {
      if (isAbortError(err)) return;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  const fetchInvoiceDelivery = useCallback(async (invoiceId: number) => {
    detailAbortRef.current?.abort();
    const controller = new AbortController();
    detailAbortRef.current = controller;
    const { signal } = controller;

    setDetailLoading(true);
    try {
      const [invoiceRes, deliveryRes] = await Promise.all([
        api.get<Invoice>(`/invoices/${invoiceId}`, { signal }),
        api.get<DeliverySummary>(`/invoices/${invoiceId}/delivery`, { signal }),
      ]);
      setSelectedInvoice(invoiceRes.data);
      setDeliverySummary(deliveryRes.data);
      setBarcodeInput("");
    } catch (err) {
      if (isAbortError(err)) return;
      setSelectedInvoice(null);
      setDeliverySummary(null);
    } finally {
      if (!signal.aborted) setDetailLoading(false);
    }
  }, []);

  /* ----------------------------- effects ---------------------------- */

  useEffect(() => {
    const controller = new AbortController();
    void fetchInvoices(controller.signal);
    return () => {
      controller.abort();
      detailAbortRef.current?.abort();
    };
  }, [fetchInvoices]);

  useRealtimeRefresh(() => {
    void fetchInvoices();
    if (selectedInvoice) void fetchInvoiceDelivery(selectedInvoice.id);
  }, ["invoice.confirmed", "invoice.delivery.scan", "invoice.delivered"]);

  // Keep the barcode field focused so a hardware scanner always has a target.
  useEffect(() => {
    if (!detailLoading && selectedInvoice && deliverySummary) {
      barcodeInputRef.current?.focus();
    }
  }, [detailLoading, selectedInvoice, deliverySummary]);

  // Capture the REAL print moment. `beforeprint` fires on Ctrl+P and on window.print(),
  // so the date on the paper is when it was printed, not when the page was opened.
  useEffect(() => {
    const stamp = () => setPrintedAt(new Date());
    window.addEventListener("beforeprint", stamp);
    return () => window.removeEventListener("beforeprint", stamp);
  }, []);

  /* ----------------------------- actions ---------------------------- */

  const openDelivery = useCallback(
    (invoiceId: number) => {
      void fetchInvoiceDelivery(invoiceId);
    },
    [fetchInvoiceDelivery],
  );

  const closeModal = useCallback(() => {
    setSelectedInvoice(null);
    setDeliverySummary(null);
    setBarcodeInput("");
  }, []);

  const handleDeliver = async (invoiceId: number) => {
    setDelivering(invoiceId);
    try {
      await api.patch(`/invoices/${invoiceId}/deliver`);
      setSelectedInvoice((current) => {
        const deliveredInvoice = current ?? invoices.find((invoice) => invoice.id === invoiceId) ?? null;
        return deliveredInvoice?.id === invoiceId
          ? { ...deliveredInvoice, status: "DELIVERED" }
          : current;
      });
      setDeliverySummary((current) =>
        current ? { ...current, status: "DELIVERED" } : current,
      );
      void fetchInvoices();
      notify.success(SUCCESS_MESSAGES.invoice.delivered);
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      notify.error(getFriendlyErrorMessage(err, t));
      // Guide the employee to the scan screen instead of leaving them with a dead end.
      if (code === "DELIVERY_INCOMPLETE") {
        openDelivery(invoiceId);
      }
    } finally {
      setDelivering(null);
    }
  };

  const handleBarcodeScan = async () => {
    if (!selectedInvoice || scanLoading) return;
    if (!barcodeInput.trim()) {
      setBarcodeError(t.errors.common.required);
      return;
    }
    setBarcodeError("");
    setScanLoading(true);
    try {
      await api.post(`/invoices/${selectedInvoice.id}/delivery/scan`, { barcode: barcodeInput.trim() });
      setBarcodeInput("");
      notify.success(t.invoices.barcodeScannedSuccessfully);
      await fetchInvoiceDelivery(selectedInvoice.id);
    } catch (err) {
      notify.error(getFriendlyErrorMessage(err, t));
    } finally {
      setScanLoading(false);
    }
  };

  /* ----------------------------- table ------------------------------ */

  const columns = [
    {
      key: "invoiceNumber",
      label: t.invoices.invoiceNumber,
      render: (row: Invoice) => (
        <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{row.invoiceNumber}</span>
      ),
    },
    {
      key: "customer",
      label: t.invoices.customer,
      render: (row: Invoice) => row.customer?.name || "—",
    },
    {
      key: "employee",
      label: t.invoices.employee,
      render: (row: Invoice) => row.employee?.name || "—",
    },
    {
      key: "date",
      label: t.date,
      render: (row: Invoice) => new Date(row.date).toLocaleDateString(),
    },
    {
      key: "itemsSummary",
      label: t.products,
      render: (row: Invoice) => {
        const items = row.items ?? [];

        if (items.length === 0) {
          return "—";
        }

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {items.map((item) => {
              const productName = item.productModel?.name || "Product";
              const quantity = item.quantity ?? 1;
              const isSerialized = item.productModel?.isSerialized ?? false;

              return (
                <div
                  key={item.id}
                  style={{ display: "flex", justifyContent: "space-between", gap: "12px", fontSize: "12px" }}
                >
                  <span style={{ color: "var(--ink)", fontWeight: 600 }}>{productName}</span>
                  <span style={{ color: "var(--soft)", fontVariantNumeric: "tabular-nums" }}>
                    {isSerialized
                      ? `barcode x${quantity}`
                      : `x${quantity}${item.productModel?.unit === "METER" ? ` ${t.uom.METER}` : ""}`}
                  </span>
                </div>
              );
            })}
          </div>
        );
      },
    },
    {
      key: "itemCount",
      label: t.items,
      align: "center" as const,
      render: (row: Invoice) => (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{row.items?.length ?? 0}</span>
      ),
    },
    {
      key: "actions",
      label: "",
      align: "right" as const,
      render: (row: Invoice) => (
        <div className="toolbar" style={{ justifyContent: "flex-end", marginBottom: 0 }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openDelivery(row.id);
            }}
          >
            {t.view}
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={delivering === row.id}
            onClick={(e) => {
              e.stopPropagation();
              void handleDeliver(row.id);
            }}
          >
            {t.markDelivered}
          </Button>
        </div>
      ),
    },
  ];

  /* ----------------------------- render ----------------------------- */

  return (
    <div>
      <PageHeader title={t.pages.invoiceDelivery} subtitle={t.pages.invoiceDeliverySubtitle} />

      {loading ? (
        <div className="state-block">
          <LoadingSpinner size={28} />
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          title={t.invoices.noInvoices}
          description={t.noInvoicesPendingDelivery}
          icon={
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
      ) : (
        <Table
          columns={columns}
          data={invoices}
          keyExtractor={(row) => String((row as unknown as Invoice).id)}
        />
      )}

      {/* ------------------------- Detail modal ------------------------- */}
      <Modal
        isOpen={!!selectedInvoice}
        onClose={closeModal}
        title={
          selectedInvoice
            ? `${t.invoices.invoiceNumber} ${selectedInvoice.invoiceNumber}`
            : t.invoiceDetails
        }
        footer={
          selectedInvoice ? (
            <>
              {selectedInvoice.status === "DELIVERED" ? (
                <PrintButton />
              ) : (
                <Button
                  variant="primary"
                  loading={delivering === selectedInvoice.id}
                  disabled={remainingScans > 0}
                  onClick={() => {
                    void handleDeliver(selectedInvoice.id);
                  }}
                >
                  {t.markDelivered}
                </Button>
              )}
              <Button variant="secondary" onClick={closeModal}>
                {t.close}
              </Button>
            </>
          ) : null
        }
      >
        {detailLoading || !selectedInvoice ? (
          <div className="state-block">
            <LoadingSpinner size={24} />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="form-grid-wide" style={{ gap: "12px" }}>
              <div style={{ background: "var(--surface)", padding: "12px", borderRadius: "8px" }}>
                <div style={{ fontSize: "11px", color: "var(--soft)", textTransform: "uppercase" }}>
                  {t.customerName}
                </div>
                <div style={{ fontWeight: 600 }}>{selectedInvoice.customer?.name || "—"}</div>
              </div>
              <div style={{ background: "var(--surface)", padding: "12px", borderRadius: "8px" }}>
                <div style={{ fontSize: "11px", color: "var(--soft)", textTransform: "uppercase" }}>
                  {t.employeeName}
                </div>
                <div style={{ fontWeight: 600 }}>{selectedInvoice.employee?.name || "—"}</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--ink)" }}>{t.products}</div>

              {(selectedInvoice.items ?? []).map((item) => {
                const productName = item.productModel?.name || "Product";
                const quantity = item.quantity ?? 1;
                const isSerialized = item.productModel?.isSerialized ?? false;
                const serializedLine =
                  deliverySummary?.serializedLines.find((line) => line.invoiceItemId === item.id) ??
                  deliverySummary?.serializedLines.find((line) => line.productModelId === item.productModelId);
                const needsScan =
                  isSerialized &&
                  !!serializedLine &&
                  serializedLine.scannedQuantity < serializedLine.requiredQuantity;
                const attachRef = needsScan && serializedLine?.invoiceItemId === firstUnscannedItemId;

                return (
                  <div
                    key={item.id}
                    style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" }}
                  >
                    <div
                      style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{productName}</div>
                        <div style={{ fontSize: "12px", color: "var(--soft)" }}>
                          {isSerialized ? t.invoices.serialized : t.invoices.nonSerialized}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                        {t.invoices.qty} {quantity}
                      </div>
                    </div>

                    {isSerialized && serializedLine && (
                      <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ fontSize: "12px", color: "var(--soft)" }}>
                          {t.invoices.scanned} {serializedLine.scannedQuantity} / {serializedLine.requiredQuantity}
                        </div>

                        {serializedLine.scannedUnits.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {serializedLine.scannedUnits.map((unit) => (
                              <span
                                key={unit.barcode}
                                style={{
                                  background: "var(--mint-bg)",
                                  color: "var(--mint)",
                                  padding: "4px 8px",
                                  borderRadius: "999px",
                                  fontSize: "11px",
                                }}
                              >
                                {unit.barcode}
                              </span>
                            ))}
                          </div>
                        )}

                        {needsScan && selectedInvoice.status !== "DELIVERED" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <input
                                ref={attachRef ? barcodeInputRef : undefined}
                                value={barcodeInput}
                                onChange={(e) => {
                                  setBarcodeInput(e.target.value);
                                  setBarcodeError("");
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    void handleBarcodeScan();
                                  }
                                }}
                                placeholder={t.invoices.barcode}
                                aria-label={t.invoices.barcode}
                                style={{
                                  flex: 1,
                                  padding: "8px 10px",
                                  borderRadius: "8px",
                                  border: barcodeError ? "1px solid var(--accent)" : "1px solid var(--border)",
                                  background: "var(--card)",
                                  fontSize: "13px",
                                  color: "var(--ink)",
                                }}
                              />
                              <Button
                                size="sm"
                                loading={scanLoading}
                                disabled={scanLoading}
                                onClick={() => {
                                  void handleBarcodeScan();
                                }}
                              >
                                {t.invoices.scan}
                              </Button>
                            </div>
                            {barcodeError && (
                              <span
                                style={{ fontFamily: "'Manrope', sans-serif", fontSize: "12px", color: "var(--accent)" }}
                              >
                                {barcodeError}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {remainingScans > 0 && selectedInvoice.status !== "DELIVERED" && (
                <div
                  style={{
                    background: "var(--accent-bg)",
                    border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                    color: "var(--accent)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  {t.invoices.remainingToScan.replace("{n}", String(remainingScans))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* -------------------------- Print sheet ------------------------- */}
      {selectedInvoice?.status === "DELIVERED" && (
        <div className="delivery-print-sheet invoice-page" dir="rtl" aria-hidden="true">
          <div className="invoice-container">
            {/* <PrintHeader
              titleEn={`Delivery Note ${selectedInvoice.invoiceNumber}`}
              titleAr="إذن تسليم فاتورة"
              range={{ from: formatDate(selectedInvoice.date), to: formatDate(selectedInvoice.date) }}
              filters={[
                { label: t.invoices.customer, value: selectedInvoice.customer?.name || "—" },
                { label: t.invoices.employee, value: selectedInvoice.employee?.name || "—" },
              ]}
            /> */}

            <section className="invoice-panel invoice-overview">
              <div className="invoice-title-row">
                <div>
                  <p className="invoice-kicker">إذن تسليم · DELIVERY NOTE</p>
                  <h1 dir="ltr">{selectedInvoice.invoiceNumber}</h1>
                </div>
              </div>

              <dl className="invoice-meta">
                <div>
                  <dt>{t.date}</dt>
                  <dd dir="ltr">{formatDate(selectedInvoice.date)}</dd>
                </div>
                <div>
                  <dt>{t.invoices.customer}</dt>
                  <dd>{selectedInvoice.customer?.name || "—"}</dd>
                </div>
                <div>
                  <dt>{t.invoices.employee}</dt>
                  <dd>{selectedInvoice.employee?.name || "—"}</dd>
                </div>
              </dl>

              <div className="print-date-box">
                <span className="print-date-label">
                  تاريخ ووقت الطباعة <small>Printed on</small>
                </span>
                <strong className="print-date-value" dir="ltr">
                  {formatDateTime(printedAt)}
                </strong>
              </div>
            </section>

            <section className="invoice-panel invoice-items-panel">
              <div className="invoice-section-head">
                <h2>{t.invoices.invoiceItems}</h2>
                <span>{selectedInvoice.items?.length ?? 0}</span>
              </div>
              <div className="invoice-table-wrap">
                <table className="invoice-table">
                  <thead>
                    <tr>
                      <th scope="col" className="cell-index">#</th>
                      <th scope="col">{t.invoices.product}</th>
                      <th scope="col" className="cell-center">{t.invoices.qty}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedInvoice.items ?? []).length === 0 ? (
                      <tr>
                        <td className="invoice-no-data" colSpan={3}>{t.invoices.noItems}</td>
                      </tr>
                    ) : (
                      selectedInvoice.items.map((item, index) => (
                        <tr key={String(item.id ?? item.productUnit?.barcode ?? index)}>
                          <td className="cell-index numeric">{index + 1}</td>
                          <td>
                            <strong>
                              {item.productUnit?.productModel?.name || item.productModel?.name || "—"}
                            </strong>
                            {item.productUnit?.barcode && <small dir="ltr">{item.productUnit.barcode}</small>}
                          </td>
                          <td className="cell-center numeric">
                            {item.quantity ?? 1}
                            {item.productModel?.unit === "METER" ? ` ${t.uom.METER}` : ""}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="delivery-signatures" aria-label="تأكيد استلام الأصناف">
              <div className="delivery-signatures-heading">
                <h2>تأكيد الاستلام</h2>
                <p>أقر باستلام الأصناف الموضحة أعلاه بالحالة والكميات المذكورة.</p>
              </div>
              <div className="delivery-signatures-grid">
                <div className="delivery-signature">
                  <h3>
                    المستلم <span>Received by</span>
                  </h3>
                  <div className="delivery-signature-space" aria-hidden="true" />
                  <div className="delivery-signature-fields">
                    <span>الاسم</span>
                    <span>التوقيع</span>
                  
                  </div>
                </div>
                <div className="delivery-signature">
                  <h3>
                    أمين المخزن <span>Issued by</span>
                  </h3>
                  <div className="delivery-signature-space" aria-hidden="true" />
                  <div className="delivery-signature-fields">
                    <span>الاسم</span>
                    <span>التوقيع</span>
                  
                  </div>
                </div>
              </div>
            </section>

            <footer className="delivery-print-footer">
              <span>
                {selectedInvoice.invoiceNumber} · طُبع في <bdi dir="ltr">{formatDateTime(printedAt)}</bdi>
              </span>
            </footer>
          </div>
        </div>
      )}

      <style>{`
        /* ---------- Screen: the print sheet stays hidden ---------- */
        .delivery-print-sheet {
          display: none;
          --invoice-ink: #173f5f;
          --invoice-primary: #247ba0;
          --invoice-soft: #668397;
          --invoice-border: rgba(23, 63, 95, 0.12);
          --invoice-surface: rgba(255, 255, 255, 0.78);
          color: var(--invoice-ink);
          font-family: "Manrope", "Cairo", Arial, sans-serif;
        }

        /* ---------- Overview ---------- */
        .delivery-print-sheet .invoice-overview {
          padding: 28px;
          margin-bottom: 22px;
        }

        .delivery-print-sheet .invoice-title-row {
          display: flex;
          justify-content: space-between;
        }

        .delivery-print-sheet .invoice-kicker {
          margin: 0 0 5px;
          color: var(--invoice-soft);
          font-size: 11px;
          font-weight: 700;
        }

        .delivery-print-sheet .invoice-title-row h1 {
          margin: 0;
          font-family: "Sora", "Cairo", sans-serif;
          font-size: 30px;
        }

        .delivery-print-sheet .invoice-meta {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 22px;
          margin: 28px 0 0;
        }

        .delivery-print-sheet .invoice-meta dt {
          color: var(--invoice-soft);
          font-size: 11px;
        }

        .delivery-print-sheet .invoice-meta dd {
          margin: 5px 0 0;
          font-size: 13px;
          font-weight: 600;
        }

        /* ---------- Print date (the highlighted strip) ---------- */
        .delivery-print-sheet .print-date-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-top: 22px;
          padding: 12px 16px;
          border: 1.5px solid var(--invoice-ink);
          border-radius: 10px;
          background: rgba(36, 123, 160, 0.07);
        }

        .delivery-print-sheet .print-date-label {
          display: flex;
          align-items: baseline;
          gap: 8px;
          color: var(--invoice-ink);
          font-size: 13px;
          font-weight: 700;
        }

        .delivery-print-sheet .print-date-label small {
          color: var(--invoice-soft);
          font-size: 10px;
          font-weight: 500;
          direction: ltr;
        }

        .delivery-print-sheet .print-date-value {
          color: var(--invoice-ink);
          font-family: "Sora", "Manrope", sans-serif;
          font-size: 17px;
          font-weight: 800;
          letter-spacing: 0.02em;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        /* ---------- Items table ---------- */
        .delivery-print-sheet .invoice-items-panel {
          overflow: hidden;
          border: 1px solid var(--invoice-border);
          border-radius: 18px;
          background: var(--invoice-surface);
          box-shadow: 0 18px 50px rgba(23, 63, 95, 0.06);
        }

        .delivery-print-sheet .invoice-section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 22px;
          border-bottom: 1px solid var(--invoice-border);
        }

        .delivery-print-sheet .invoice-section-head h2 {
          margin: 0;
          font-size: 17px;
        }

        .delivery-print-sheet .invoice-section-head > span {
          display: grid;
          min-width: 25px;
          height: 25px;
          padding: 0 7px;
          place-items: center;
          border-radius: 999px;
          background: rgba(36, 123, 160, 0.1);
          color: var(--invoice-primary);
          font-size: 11px;
          font-weight: 700;
        }

        .delivery-print-sheet .invoice-table {
          width: 100%;
          border-collapse: collapse;
          text-align: start;
        }

        .delivery-print-sheet .invoice-table th {
          padding: 12px 22px;
          background: rgba(36, 123, 160, 0.055);
          color: var(--invoice-soft);
          font-size: 11px;
          font-weight: 700;
        }

        .delivery-print-sheet .invoice-table td {
          padding: 16px 22px;
          border-top: 1px solid var(--invoice-border);
          font-size: 13px;
        }

        .delivery-print-sheet .invoice-table td strong,
        .delivery-print-sheet .invoice-table td small {
          display: block;
        }

        .delivery-print-sheet .invoice-table td small {
          margin-top: 4px;
          color: var(--invoice-soft);
          font-size: 10px;
        }

        .delivery-print-sheet .cell-center {
          text-align: center;
        }

        .delivery-print-sheet .cell-index {
          width: 44px;
          text-align: center;
        }

        .delivery-print-sheet .numeric {
          direction: ltr;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .delivery-print-sheet .invoice-no-data {
          padding: 20px;
          color: var(--invoice-soft);
          text-align: center;
        }

        /* ---------- Signatures ---------- */
        .delivery-print-sheet .delivery-signatures {
          margin-top: 22px;
          padding: 20px 22px 18px;
          border: 1px solid var(--invoice-border);
          border-radius: 14px;
          background: #fff;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .delivery-print-sheet .delivery-signatures-heading {
          padding-bottom: 13px;
          border-bottom: 1px solid var(--invoice-border);
        }

        .delivery-print-sheet .delivery-signatures-heading h2 {
          margin: 0;
          color: var(--invoice-ink);
          font-size: 15px;
        }

        .delivery-print-sheet .delivery-signatures-heading p {
          margin: 5px 0 0;
          color: var(--invoice-soft);
          font-size: 11px;
        }

        .delivery-print-sheet .delivery-signatures-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 26px;
          padding-top: 16px;
        }

        .delivery-print-sheet .delivery-signature h3 {
          display: flex;
          align-items: baseline;
          gap: 7px;
          margin: 0;
          color: var(--invoice-ink);
          font-size: 12px;
        }

        .delivery-print-sheet .delivery-signature h3 span {
          color: var(--invoice-soft);
          font-size: 9px;
          font-weight: 500;
          direction: ltr;
        }

        .delivery-print-sheet .delivery-signature-space {
          height: 28px;
        }

        .delivery-print-sheet .delivery-signature-fields {
          display: grid;
          grid-template-columns: 1.2fr 1.2fr 0.8fr;
          gap: 12px;
        }

        .delivery-print-sheet .delivery-signature-fields span {
          padding-top: 5px;
          border-top: 1px solid #8da0ac;
          color: var(--invoice-soft);
          font-size: 9px;
        }

        /* ---------- Footer ---------- */
        .delivery-print-sheet .delivery-print-footer {
          display: flex;
          justify-content: center;
          margin-top: 14px;
          color: var(--invoice-soft);
          font-size: 10px;
        }

        /* ================== PRINT ================== */
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }

          body * {
            visibility: hidden !important;
          }

          .delivery-print-sheet,
          .delivery-print-sheet * {
            visibility: visible !important;
          }

          .delivery-print-sheet {
            --invoice-ink: #111;
            --invoice-primary: #222;
            --invoice-soft: #555;
            --invoice-border: #888;
            --invoice-surface: #fff;
            display: block !important;
            position: fixed;
            inset: 0;
            z-index: 2147483647;
            width: 100%;
            min-height: 0;
            overflow: visible;
            padding: 0;
            background: #fff;
            color: var(--invoice-ink);
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .delivery-print-sheet .invoice-container {
            width: 100%;
            max-width: none;
            margin: 0;
          }

          /* Shared "flat, black-and-white" look for every card */
          .delivery-print-sheet .report-header-card,
          .delivery-print-sheet .invoice-overview,
          .delivery-print-sheet .invoice-items-panel,
          .delivery-print-sheet .delivery-signatures {
            border-color: #777;
            background: #fff;
            color: #111;
            box-shadow: none;
          }

          /* PrintHeader overrides */
          .delivery-print-sheet .report-print-header {
            --report-ink: #111;
            --report-primary: #222;
            --report-soft: #555;
            --report-border: #888;
            color: #111;
          }

          .delivery-print-sheet .report-brand-mark {
            background: #222 !important;
            border-color: #777 !important;
            color: #fff;
          }

          .delivery-print-sheet .report-brand-mark img {
            filter: grayscale(1);
          }

          .delivery-print-sheet .report-badge,
          .delivery-print-sheet .report-filter,
          .delivery-print-sheet .invoice-section-head > span {
            border-color: #999;
            background: #eee;
            color: #222;
          }

          /* Secondary text */
          .delivery-print-sheet .invoice-table td small,
          .delivery-print-sheet .invoice-meta dt,
          .delivery-print-sheet .invoice-kicker,
          .delivery-print-sheet .delivery-signatures-heading p,
          .delivery-print-sheet .delivery-signature h3 span,
          .delivery-print-sheet .delivery-signature-fields span,
          .delivery-print-sheet .invoice-no-data,
          .delivery-print-sheet .print-date-label small,
          .delivery-print-sheet .delivery-print-footer {
            color: #555;
          }

          /* Primary text */
          .delivery-print-sheet .invoice-title-row h1,
          .delivery-print-sheet .invoice-meta dd,
          .delivery-print-sheet .invoice-section-head h2,
          .delivery-print-sheet .invoice-table td strong,
          .delivery-print-sheet .delivery-signatures-heading h2,
          .delivery-print-sheet .delivery-signature h3,
          .delivery-print-sheet .print-date-label,
          .delivery-print-sheet .print-date-value,
          .delivery-print-sheet .report-title-block h2,
          .delivery-print-sheet .report-range strong,
          .delivery-print-sheet .report-filter strong,
          .delivery-print-sheet .report-generated strong {
            color: #111;
          }

          /* Overview */
          .delivery-print-sheet .invoice-overview {
            padding: 14px 16px;
            margin-bottom: 7mm;
            border: 1px solid var(--invoice-border);
            border-radius: 8px;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .delivery-print-sheet .invoice-title-row h1 {
            font-size: 24px;
          }

          .delivery-print-sheet .invoice-meta {
            gap: 12px 18px;
            margin-top: 12px;
          }

          /* Print date: bold, boxed, and survives B&W printers (no colour dependency) */
          .delivery-print-sheet .print-date-box {
            margin-top: 12px;
            padding: 8px 12px;
            border: 1.5px solid #111;
            border-radius: 6px;
            background: #f1f1f1;
          }

          .delivery-print-sheet .print-date-label {
            font-size: 12px;
          }

          .delivery-print-sheet .print-date-value {
            font-size: 15px;
          }

          /* Table */
          .delivery-print-sheet .invoice-items-panel {
            border-radius: 8px;
            break-inside: auto;
            page-break-inside: auto;
          }

          .delivery-print-sheet .invoice-section-head {
            padding: 9px 12px;
            border-color: #888;
            background: #eee;
            color: #222;
          }

          .delivery-print-sheet .invoice-table thead {
            display: table-header-group; /* repeat header on every page */
          }

          .delivery-print-sheet .invoice-table th {
            padding: 6px 9px;
            border-color: #888;
            background: #eee;
            color: #222;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .delivery-print-sheet .invoice-table td {
            padding: 7px 9px;
            border-color: #aaa;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .delivery-print-sheet .invoice-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          /* Signatures */
          .delivery-print-sheet .delivery-signatures {
            margin-top: 8mm;
            padding: 6mm 7mm 5mm;
            border-radius: 7px;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .delivery-print-sheet .delivery-signatures-heading {
            border-color: #aaa;
          }

          .delivery-print-sheet .delivery-signatures-grid {
            gap: 12mm;
            padding-top: 5mm;
          }

          .delivery-print-sheet .delivery-signature-space {
            height: 24mm;
          }

          .delivery-print-sheet .delivery-signature-fields span {
            border-color: #555;
          }

          .delivery-print-sheet .delivery-print-footer {
            margin-top: 6mm;
            padding-top: 3mm;
            border-top: 1px dashed #999;
          }
        }
      `}</style>
    </div>
  );
}