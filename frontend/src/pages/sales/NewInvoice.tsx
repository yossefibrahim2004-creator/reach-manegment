import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import api from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { notify } from "../../lib/notify";
import { getFriendlyErrorMessage } from "../../lib/messages";
import { getSuccessMessages } from "../../lib/success-messages";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useI18n } from "../../i18n/context";
import { ALL_OPTIONS_LIMIT, useCustomerOptions, useInvalidateOptions } from "../../hooks";
import { INVOICE_NOTE_MAX_LENGTH } from "../../lib/constants";
import type { Customer, ProductModel } from "../../types";

// ---------- types ----------
type ModelWithCategory = ProductModel & { category?: { id: number; name: string } | null };

interface InvoiceLine {
  id: string;
  model: ProductModel;
  quantity: number;
  price: number;
}

// IMPORTANT: must match the backend DTO limit (CreateInvoiceDto.note).
const NOTE_MAX_LENGTH = INVOICE_NOTE_MAX_LENGTH;
const FONT_UI = "'Manrope', sans-serif";

// ---------- shared styles ----------
const fieldStyle: CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  fontFamily: FONT_UI,
  fontSize: "13px",
  color: "var(--ink)",
  backgroundColor: "var(--card)",
  outline: "none",
  boxSizing: "border-box",
};

const cardLabelStyle: CSSProperties = {
  display: "block",
  fontFamily: FONT_UI,
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--ink)",
  marginBottom: "6px",
};

const thStyle: CSSProperties = {
  padding: "6px 8px",
  fontSize: "11px",
  fontWeight: 600,
  color: "var(--soft)",
};

const smallInputStyle: CSSProperties = {
  fontFamily: FONT_UI,
  fontVariantNumeric: "tabular-nums",
  color: "var(--ink)",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  backgroundColor: "var(--surface)",
  outline: "none",
  boxSizing: "border-box",
};

const dropdownItemStyle: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "start",
  padding: "10px 12px",
  fontFamily: FONT_UI,
  fontSize: "14px",
  border: "none",
  cursor: "pointer",
  borderRadius: "6px",
};

const errorTextStyle: CSSProperties = {
  fontFamily: FONT_UI,
  fontSize: "12px",
  color: "var(--accent)",
  display: "block",
  marginTop: "4px",
};

// ---------- pure helpers ----------

// Normalize Arabic so "قاعدة" / "قاعده" / أ-إ-آ variants all match
const normalizeAr = (s: string) => s.replace(/[أإآ]/g, "ا").replace(/[ةه]/g, "ه").trim();

// Models whose name contains "قاعدة" can be added without a price
const isPriceOptional = (m?: { name: string } | null) => !!m && normalizeAr(m.name).includes("قاعده");

const isValidPercentage = (v: string) =>
  v.trim() === "" || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100);

const isValidAmount = (v: string) => v.trim() === "" || (Number.isFinite(Number(v)) && Number(v) >= 0);

// Money math in floats drifts (0.1 + 0.2 !== 0.3), so round every money result to 2 decimals.
const round2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => round2(n).toFixed(2);

// ---------- small presentational pieces ----------
function SummaryRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "12px",
        fontFamily: FONT_UI,
        fontSize: "13px",
        color: muted ? "var(--soft)" : "var(--ink)",
      }}
    >
      <span>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export default function NewInvoice() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();
  const SUCCESS_MESSAGES = useMemo(() => getSuccessMessages(t), [t]);
  const lineSeq = useRef(0);

  // customer
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // create-customer modal
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerType, setNewCustomerType] = useState<"INDIVIDUAL" | "COMPANY">("INDIVIDUAL");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newCustomerNameError, setNewCustomerNameError] = useState("");

  // invoice
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [paymentType, setPaymentType] = useState("CASH");
  const [invoiceNote, setInvoiceNote] = useState("");
  const [discountPercentage, setDiscountPercentage] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");

  // add-item row
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [itemPrice, setItemPrice] = useState("");
  const [allModels, setAllModels] = useState<ModelWithCategory[]>([]);

  // save flow
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedInvoiceNumber, setSavedInvoiceNumber] = useState<string | null>(null);
  const [savedInvoiceId, setSavedInvoiceId] = useState<number | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const invalidateOptions = useInvalidateOptions();
  const { data: customerOptions = [] } = useCustomerOptions(customerSearch);

  // ---------- data loading ----------
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    api
      .get("/product-models", { params: { page: 1, limit: ALL_OPTIONS_LIMIT }, signal })
      .then((res) => {
        if (signal.aborted) return;
        const payload = res.data?.data ?? res.data;
        setAllModels(Array.isArray(payload) ? payload : []);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Auto-clear the form error (with cleanup)
  useEffect(() => {
    if (!formError) return;
    const id = setTimeout(() => setFormError(null), 6000);
    return () => clearTimeout(id);
  }, [formError]);

  // Keep the selected customer object fresh when options reload
  useEffect(() => {
    if (selectedCustomerId === null) return;
    const fromOptions = customerOptions.find((c) => c.id === selectedCustomerId);
    if (fromOptions) setSelectedCustomer(fromOptions);
  }, [customerOptions, selectedCustomerId]);

  // ---------- derived data ----------
  const categoryOptions = useMemo(() => {
    const unique = new Map<number, { id: number; name: string }>();
    for (const m of allModels) {
      if (m.category) unique.set(m.category.id, m.category);
    }
    return Array.from(unique.values()).map((c) => ({ label: c.name, value: String(c.id) }));
  }, [allModels]);

  const modelOptions = useMemo(
    () =>
      allModels
        .filter((m) => !selectedCategoryId || String(m.category?.id) === selectedCategoryId)
        .map((m) => ({ label: m.name, value: String(m.id) })),
    [allModels, selectedCategoryId],
  );

  // Display-only totals. The backend must recompute these and never trust the client values.
  const { subtotal, parsedPercentage, percentageDiscount, fixedDiscount, totalDiscount, total } = useMemo(() => {
    const sub = round2(lines.reduce((sum, l) => sum + l.price * l.quantity, 0));
    const pct = Math.max(0, Math.min(Number(discountPercentage) || 0, 100));
    const pctDiscount = round2((pct / 100) * sub);
    // The fixed discount can only take what is LEFT after the percentage discount,
    // otherwise the two discounts together could exceed the subtotal.
    const fixed = round2(Math.max(0, Math.min(Number(discountAmount) || 0, sub - pctDiscount)));
    return {
      subtotal: sub,
      parsedPercentage: pct,
      percentageDiscount: pctDiscount,
      fixedDiscount: fixed,
      totalDiscount: round2(pctDiscount + fixed),
      total: round2(Math.max(0, sub - pctDiscount - fixed)),
    };
  }, [lines, discountPercentage, discountAmount]);

  // Errors are DERIVED from the inputs. No separate error state to keep in sync.
  const discountPercentageValid = isValidPercentage(discountPercentage);
  const discountAmountValid = isValidAmount(discountAmount);

  const canSave =
    selectedCustomerId !== null &&
    lines.length > 0 &&
    lines.every((l) => l.quantity > 0 && (l.price > 0 || isPriceOptional(l.model))) &&
    discountPercentageValid &&
    discountAmountValid;

  const selectedModel = allModels.find((m) => String(m.id) === selectedModelId);
  const priceOptional = isPriceOptional(selectedModel);
  const addDisabled = !selectedModelId || !itemQuantity || (!priceOptional && !itemPrice);
  const employeeName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();

  // ---------- handlers ----------
  const updateLine = (lineId: string, patch: Partial<InvoiceLine>) =>
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l)));

  const handleRemoveLine = (lineId: string) => setLines((prev) => prev.filter((l) => l.id !== lineId));

  const handleAddItem = () => {
    setFormError(null);
    if (addDisabled) return;
    const model = selectedModel;
    if (!model) return;

    const optional = isPriceOptional(model);
    const unit = model.unit ?? "PIECE";
    const rawQty = parseFloat(itemQuantity);
    if (!(rawQty > 0)) return;
    if (unit !== "METER" && !Number.isInteger(rawQty)) {
      setFormError(t.errors.delivery.FRACTIONAL_QUANTITY_NOT_ALLOWED);
      return;
    }
    const qty = unit === "METER" ? round2(rawQty) : rawQty;
    const typedPrice = itemPrice ? parseFloat(itemPrice) : 0;
    if (!optional && !(typedPrice > 0)) return;

    setLines((prev) => {
      const existing = prev.find((l) => l.model.id === model.id);
      if (existing) {
        return prev.map((l) =>
          l.model.id === model.id
            ? {
                ...l,
                quantity: unit === "METER" ? round2(l.quantity + qty) : l.quantity + qty,
                // If the price box was left empty, keep the price already on the line.
                price: itemPrice ? typedPrice : l.price,
              }
            : l,
        );
      }
      lineSeq.current += 1;
      return [...prev, { id: `line-${lineSeq.current}`, model, quantity: qty, price: typedPrice }];
    });
    setSelectedModelId("");
    setItemQuantity("1");
    setItemPrice("");
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) {
      setNewCustomerNameError(t.errors.common.required);
      return;
    }
    setNewCustomerNameError("");
    setCreatingCustomer(true);
    try {
      const { data } = await api.post("/customers", {
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || undefined,
        type: newCustomerType,
      });
      setSelectedCustomerId(data.id);
      setSelectedCustomer(data);
      setCustomerSearch(data.name);
      setShowCreateCustomer(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerType("INDIVIDUAL");
      void invalidateOptions.customers();
      notify.success(SUCCESS_MESSAGES.customer.added);
    } catch (err) {
      notify.error(getFriendlyErrorMessage(err, t));
    } finally {
      setCreatingCustomer(false);
    }
  };

  // Reset EVERYTHING for a fresh invoice (also used when the confirmation modal is dismissed,
  // so a saved invoice can never be saved a second time by accident).
  const resetForm = useCallback(() => {
    setShowConfirmModal(false);
    setLines([]);
    setSelectedCustomerId(null);
    setSelectedCustomer(null);
    setCustomerSearch("");
    setInvoiceNote("");
    setPaymentType("CASH");
    setDiscountPercentage("");
    setDiscountAmount("");
    setSelectedCategoryId("");
    setSelectedModelId("");
    setItemQuantity("1");
    setItemPrice("");
    setFormError(null);
    setSavedInvoiceNumber(null);
    setSavedInvoiceId(null);
  }, []);

  const handleSave = async () => {
    if (saving || savedInvoiceId !== null) return; // blocks double-click / re-save
    if (invoiceNote.trim().length > NOTE_MAX_LENGTH) {
      const msg = t.errors.common.noteMaxLength.replace("{n}", String(NOTE_MAX_LENGTH));
      setFormError(msg);
      notify.error(msg);
      return;
    }
    if (!canSave) return;

    setSaving(true);
    try {
      const { data } = await api.post("/invoices", {
        customerId: selectedCustomerId,
        paymentType,
        note: invoiceNote.trim() || undefined,
        discountPercentage: parsedPercentage || undefined,
        discountAmount: fixedDiscount || undefined,
        // Serialized-unit assignment happens later, at delivery/fulfillment by Warehouse.
        items: lines.map((l) => ({
          productModelId: l.model.id,
          quantity: l.quantity,
          price: l.price,
        })),
      });
      setSavedInvoiceNumber(data.invoiceNumber);
      setSavedInvoiceId(data.id);
      notify.success(SUCCESS_MESSAGES.invoice.created);
      setShowConfirmModal(true);
    } catch (error: unknown) {
      if (import.meta.env.DEV && isAxiosError(error)) {
        console.error("[createInvoice] rejected:", error.response?.status, error.response?.data);
      }
      const message = getFriendlyErrorMessage(error, t, t.newInvoice.unableToSave);
      const text = typeof message === "string" ? message : t.newInvoice.unableToSave;
      setFormError(text);
      notify.error(text);
    } finally {
      setSaving(false);
    }
  };

  const addOnEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4" style={{ alignItems: "flex-start" }}>
      {/* LEFT PANEL: inputs */}
      <div style={{ flex: 1, minWidth: 0, width: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Customer */}
        <Card style={{ overflow: "visible" }}>
          <label style={cardLabelStyle}>{t.newInvoice.customer}</label>
          <div style={{ position: "relative", zIndex: 10 }}>
            <input
              type="text"
              placeholder={t.newInvoice.searchCustomer}
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setSelectedCustomerId(null);
                setSelectedCustomer(null);
                setShowCustomerDropdown(true);
              }}
              onFocus={() => setShowCustomerDropdown(true)}
              // Items below use onMouseDown, which fires BEFORE blur, so no timeout hack is needed.
              onBlur={() => setShowCustomerDropdown(false)}
              style={{ ...fieldStyle, fontSize: "14px" }}
            />
            {showCustomerDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  boxShadow: "var(--shadow-md)",
                  maxHeight: "260px",
                  overflowY: "auto",
                  zIndex: 20,
                }}
              >
                {customerOptions.map((c) => {
                  const active = c.id === selectedCustomerId;
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onMouseDown={() => {
                        setSelectedCustomerId(c.id);
                        setSelectedCustomer(c);
                        setCustomerSearch(c.name);
                        setShowCustomerDropdown(false);
                      }}
                      style={{
                        ...dropdownItemStyle,
                        color: active ? "var(--brand)" : "var(--ink)",
                        backgroundColor: active ? "var(--row-selected)" : "transparent",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--row-hover)")}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = active ? "var(--row-selected)" : "transparent")
                      }
                    >
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                      {c.phone && (
                        <span style={{ color: "var(--soft)", marginInlineStart: "8px", fontSize: "12px" }}>{c.phone}</span>
                      )}
                      <span style={{ float: "inline-end", fontSize: "11px", color: "var(--soft)" }}>{c.type}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setShowCustomerDropdown(false);
                    setNewCustomerNameError("");
                    setShowCreateCustomer(true);
                  }}
                  style={{
                    ...dropdownItemStyle,
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--brand)",
                    backgroundColor: "transparent",
                    borderTop: "1px solid var(--border)",
                    borderRadius: 0,
                  }}
                >
                  {t.newInvoice.createNewCustomer}
                </button>
              </div>
            )}
          </div>
          {selectedCustomer && (
            <p style={{ fontFamily: FONT_UI, fontSize: "12px", color: "var(--soft)", margin: "6px 0 0" }}>
              {selectedCustomer.type} · {selectedCustomer.phone || t.newInvoice.noPhone}
            </p>
          )}
        </Card>

        {/* Payment type */}
        <Card>
          <label style={cardLabelStyle}>{t.newInvoice.paymentType}</label>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {["CASH", "CARD", "TRANSFER", "CREDIT"].map((pt) => {
              const active = paymentType === pt;
              return (
                <button
                  type="button"
                  key={pt}
                  onClick={() => setPaymentType(pt)}
                  aria-pressed={active}
                  style={{
                    flex: "1 1 80px",
                    minHeight: "40px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
                    backgroundColor: active ? "var(--row-selected)" : "transparent",
                    color: active ? "var(--brand)" : "var(--ink)",
                    fontFamily: FONT_UI,
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {pt}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Add item: every product model is selectable. Serial units get assigned later by Warehouse.
            Models whose name contains "قاعدة" can be added without a price. */}
        <Card>
          <label style={cardLabelStyle}>{t.newInvoice.addItem ?? t.newInvoice.addNonSerializedItem}</label>
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "130px" }}>
              <Select
                options={categoryOptions}
                placeholder={t.newInvoice.allCategories ?? "كل الفئات"}
                value={selectedCategoryId}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value);
                  setSelectedModelId("");
                }}
              />
            </div>
            <div style={{ flex: 2, minWidth: "160px" }}>
              <Select
                options={modelOptions}
                placeholder={t.newInvoice.selectModel}
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
              />
            </div>
            <div style={{ flex: 1, minWidth: "90px" }}>
              <input
                type="number"
                min={selectedModel?.unit === "METER" ? "0.01" : "1"}
                step={selectedModel?.unit === "METER" ? "0.01" : "1"}
                placeholder={t.newInvoice.qty}
                value={itemQuantity}
                onChange={(e) => setItemQuantity(e.target.value)}
                onKeyDown={addOnEnter}
                style={fieldStyle}
              />
            </div>
            <div
              style={{
                fontFamily: FONT_UI,
                fontSize: "12px",
                color: "var(--soft)",
                paddingBottom: "10px",
                whiteSpace: "nowrap",
              }}
            >
              {t.uom[selectedModel?.unit ?? "PIECE"]}
            </div>
            <div style={{ flex: 1, minWidth: "90px" }}>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder={t.newInvoice.price}
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                onKeyDown={addOnEnter}
                style={fieldStyle}
              />
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              disabled={addDisabled}
              style={{
                padding: "8px 16px",
                minHeight: "36px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "var(--brand-fill)",
                color: "var(--on-brand)",
                fontFamily: FONT_UI,
                fontSize: "13px",
                fontWeight: 600,
                cursor: addDisabled ? "not-allowed" : "pointer",
                opacity: addDisabled ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {t.newInvoice.add}
            </button>
          </div>
          {formError && (
            <div
              role="alert"
              style={{
                marginTop: "8px",
                padding: "8px 12px",
                borderRadius: "8px",
                backgroundColor: "var(--accent-bg)",
                color: "var(--accent)",
                fontFamily: FONT_UI,
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {formError}
            </div>
          )}
        </Card>

        {/* Lines */}
        <Card style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <h3
            style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--ink)",
              margin: "0 0 12px",
            }}
          >
            {t.items} ({lines.length})
          </h3>

          {lines.length === 0 ? (
            <p
              style={{
                fontFamily: FONT_UI,
                fontSize: "14px",
                color: "var(--soft)",
                textAlign: "center",
                padding: "32px 16px",
                margin: 0,
              }}
            >
              {t.newInvoice.noItemsScanned}
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 420, borderCollapse: "collapse", fontFamily: FONT_UI, fontSize: "13px" }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: "start" }}>{t.newInvoice.model}</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>{t.newInvoice.qty}</th>
                    <th style={{ ...thStyle, textAlign: "end" }}>{t.newInvoice.price}</th>
                    <th style={{ width: "40px" }} />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const unit = line.model.unit ?? "PIECE";
                    return (
                      <tr key={line.id}>
                        <td style={{ padding: "8px", fontWeight: 600 }}>{line.model.name}</td>
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          <input
                            type="number"
                            min={unit === "METER" ? "0.01" : "1"}
                            step={unit === "METER" ? "0.01" : "1"}
                            value={line.quantity}
                            onChange={(e) => {
                              const parsed = parseFloat(e.target.value);
                              const next = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
                              updateLine(line.id, {
                                quantity: unit === "METER" ? round2(next) : Math.max(1, Math.trunc(next)),
                              });
                            }}
                            style={{ ...smallInputStyle, width: "64px", textAlign: "center", fontSize: "13px", padding: "4px 6px" }}
                          />
                          <div style={{ fontSize: "11px", color: "var(--soft)", marginTop: "2px" }}>{t.uom[unit]}</div>
                        </td>
                        <td style={{ padding: "8px", textAlign: "end" }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.price}
                            onChange={(e) => updateLine(line.id, { price: Math.max(0, parseFloat(e.target.value) || 0) })}
                            style={{
                              ...smallInputStyle,
                              width: "96px",
                              textAlign: "end",
                              fontSize: "14px",
                              fontWeight: 600,
                              padding: "4px 8px",
                            }}
                          />
                        </td>
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--accent)",
                              padding: "4px",
                              lineHeight: 1,
                            }}
                            title={t.newInvoice.remove}
                            aria-label={t.newInvoice.remove}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Discounts */}
        <Card>
          <label style={cardLabelStyle}>{t.newInvoice.discounts}</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--soft)", marginBottom: "4px" }}>
                {t.newInvoice.discountPercent}
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(e.target.value)}
                placeholder="0"
                style={{
                  ...fieldStyle,
                  border: discountPercentageValid ? "1px solid var(--border)" : "1px solid var(--accent)",
                }}
              />
              {!discountPercentageValid && <span style={errorTextStyle}>{t.errors.common.invalidNumber}</span>}
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--soft)", marginBottom: "4px" }}>
                {t.newInvoice.discountAmount}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                placeholder="0"
                style={{
                  ...fieldStyle,
                  border: discountAmountValid ? "1px solid var(--border)" : "1px solid var(--accent)",
                }}
              />
              {!discountAmountValid && <span style={errorTextStyle}>{t.errors.common.invalidNumber}</span>}
            </div>
          </div>
        </Card>

        {/* Note */}
        <Card>
          <label htmlFor="invoice-note" style={cardLabelStyle}>
            {t.newInvoice.note}
          </label>
          <textarea
            id="invoice-note"
            dir="auto"
            value={invoiceNote}
            onChange={(e) => setInvoiceNote(e.target.value)}
            maxLength={NOTE_MAX_LENGTH}
            rows={3}
            placeholder={t.newInvoice.notePlaceholder}
            style={{ ...fieldStyle, resize: "vertical", padding: "9px 11px", fontFamily: "'Cairo', sans-serif" }}
          />
          <small
            style={{
              display: "block",
              marginTop: "4px",
              color: invoiceNote.length >= NOTE_MAX_LENGTH ? "var(--danger, #b42318)" : "var(--soft)",
              textAlign: "end",
            }}
          >
            {invoiceNote.length}/{NOTE_MAX_LENGTH}
          </small>
        </Card>
      </div>

      {/* RIGHT PANEL: live summary (replaces the scaled invoice preview) */}
      <aside
        className="w-full lg:w-[340px] xl:w-[380px] lg:sticky lg:top-4"
        style={{ flexShrink: 0, minWidth: 0 }}
        aria-label={t.newInvoice.preview}
      >
        <Card style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <h3
            style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--ink)",
              margin: 0,
            }}
          >
            {t.newInvoice.preview}
          </h3>

          {/* Who / how */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <SummaryRow label={t.newInvoice.customer} value={selectedCustomer?.name ?? "—"} />
            <SummaryRow label={t.newInvoice.payment} value={paymentType} muted />
            {employeeName && <SummaryRow label={t.invoices.employee} value={employeeName} muted />}
          </div>

          {/* Items */}
          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: "12px",
              maxHeight: "240px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {lines.length === 0 ? (
              <p style={{ fontFamily: FONT_UI, fontSize: "13px", color: "var(--soft)", margin: 0, textAlign: "center" }}>
                {t.newInvoice.noItemsScanned}
              </p>
            ) : (
              lines.map((l) => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: FONT_UI,
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--ink)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {l.model.name}
                    </div>
                    <div
                      style={{
                        fontFamily: FONT_UI,
                        fontSize: "12px",
                        color: "var(--soft)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {l.quantity} × {money(l.price)}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: FONT_UI,
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--ink)",
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {money(l.price * l.quantity)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <SummaryRow label={t.newInvoice.subtotal} value={money(subtotal)} muted />
            {percentageDiscount > 0 && (
              <SummaryRow
                label={`${t.newInvoice.discountPercent} (${parsedPercentage}%)`}
                value={`− ${money(percentageDiscount)}`}
                muted
              />
            )}
            {fixedDiscount > 0 && (
              <SummaryRow label={t.newInvoice.discountAmount} value={`− ${money(fixedDiscount)}`} muted />
            )}
            {totalDiscount > 0 && <SummaryRow label={t.newInvoice.discount} value={`− ${money(totalDiscount)}`} />}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginTop: "6px",
                fontFamily: FONT_UI,
                color: "var(--ink)",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: 600 }}>{t.total}</span>
              <span style={{ fontSize: "24px", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                {t.currency} {money(total)}
              </span>
            </div>
          </div>

          <Button variant="primary" size="lg" loading={saving} disabled={!canSave} onClick={handleSave} style={{ width: "100%" }}>
            {t.newInvoice.saveInvoice}
          </Button>
        </Card>
      </aside>

      {/* Create customer modal */}
      <Modal
        isOpen={showCreateCustomer}
        onClose={() => setShowCreateCustomer(false)}
        title={t.newInvoice.newCustomer}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateCustomer(false)}>
              {t.cancel}
            </Button>
            <Button variant="primary" loading={creatingCustomer} onClick={handleCreateCustomer}>
              {t.create}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Input
            label={t.name}
            value={newCustomerName}
            onChange={(e) => {
              setNewCustomerName(e.target.value);
              setNewCustomerNameError("");
            }}
            placeholder={t.newInvoice.customerNamePlaceholder}
            error={newCustomerNameError}
          />
          <Input
            label={t.newInvoice.phoneOptional}
            value={newCustomerPhone}
            onChange={(e) => setNewCustomerPhone(e.target.value)}
            placeholder={t.newInvoice.phoneNumberPlaceholder}
          />
          <Select
            label={t.customers.type}
            value={newCustomerType}
            onChange={(e) => setNewCustomerType(e.target.value as "INDIVIDUAL" | "COMPANY")}
            options={[
              { label: t.newInvoice.retail, value: "INDIVIDUAL" },
              { label: t.newInvoice.wholesale, value: "COMPANY" },
            ]}
          />
        </div>
      </Modal>

      {/* Save confirmation modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={resetForm}
        title={t.newInvoice.invoiceCreated}
        footer={
          <>
            <Button variant="secondary" onClick={resetForm}>
              {t.newInvoice.startNewInvoice}
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                navigate(user?.role === "ADMIN" ? `/admin/invoices/${savedInvoiceId}` : `/sales/invoice/${savedInvoiceId}`)
              }
            >
              {t.newInvoice.viewInvoice}
            </Button>
          </>
        }
      >
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: "var(--mint-bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--mint)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p style={{ fontFamily: "'Sora', sans-serif", fontSize: "18px", fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>
            {t.newInvoice.savedAsPendingAccountant}
          </p>
          <p style={{ fontFamily: FONT_UI, fontSize: "14px", color: "var(--soft)", margin: 0 }}>
            {t.newInvoice.invoiceNumberLabel}{" "}
            <strong style={{ color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{savedInvoiceNumber}</strong>
          </p>
        </div>
      </Modal>
    </div>
  );
}