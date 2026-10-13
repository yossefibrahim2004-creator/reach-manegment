import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import { isAbortError } from "../../hooks";
import { notify } from "../../lib/notify";
import { getFriendlyErrorMessage } from "../../lib/messages";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Input } from "../../components/ui/Input";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Pagination } from "../../components/ui/Pagination";
import { Select } from "../../components/ui/Select";
import { Table, type Column } from "../../components/ui/Table";
import { useI18n } from "../../i18n/context";
import type {
  CustomerDebt,
  CustomerDebtMovement,
  Customer,
  DebtMovementType,
  PaginatedResponse,
} from "../../types";

interface CustomerDebtResponse extends PaginatedResponse<CustomerDebt> {
  summary: {
    totalDebt: number | string;
    customersWithDebt: number;
  };
}

type DebtMovementResponse = PaginatedResponse<CustomerDebtMovement>;

const PAGE_SIZE = 20;

function errorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "code" in error.response.data &&
    typeof error.response.data.code === "string"
  ) {
    return error.response.data.code;
  }
  return "";
}

export default function AdminCustomerDebts() {
  const { t, language } = useI18n();
  const [debtData, setDebtData] = useState<CustomerDebtResponse | null>(null);
  const [page, setPage] = useState(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerOptions, setCustomerOptions] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersLoadError, setCustomersLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [movementCustomer, setMovementCustomer] = useState<CustomerDebt | null>(null);
  const [movementType, setMovementType] = useState<DebtMovementType>("INCREASE");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [amountError, setAmountError] = useState("");
  const [noteError, setNoteError] = useState("");
  const [saving, setSaving] = useState(false);

  const [historyCustomer, setHistoryCustomer] = useState<CustomerDebt | null>(null);
  const [history, setHistory] = useState<DebtMovementResponse | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchDebts = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await api.get<CustomerDebtResponse>("/customer-debts", {
        params: {
          page,
          limit: PAGE_SIZE,
          ...(selectedCustomerId ? { customerId: Number(selectedCustomerId) } : {}),
        },
        signal,
      });
      setDebtData(data);
    } catch (error) {
      if (isAbortError(error)) return;
      setLoadError(true);
      notify.error(getFriendlyErrorMessage(error, t));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, selectedCustomerId, t]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchDebts(controller.signal);
    return () => controller.abort();
  }, [fetchDebts]);

  const fetchAllCustomers = useCallback(async (signal?: AbortSignal) => {
    setCustomersLoading(true);
    setCustomersLoadError(false);
    try {
      const firstPage = await api.get<PaginatedResponse<Customer>>("/customers", {
        params: { page: 1, limit: 100 },
        signal,
      });
      const allCustomers = firstPage.data.data;
      const totalPages = firstPage.data.meta.totalPages;
      if (totalPages > 1) {
        const remainingPages = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) =>
            api.get<PaginatedResponse<Customer>>("/customers", {
              params: { page: index + 2, limit: 100 },
              signal,
            }),
          ),
        );
        allCustomers.push(...remainingPages.flatMap((response) => response.data.data));
      }
      setCustomerOptions(allCustomers);
    } catch (error) {
      if (isAbortError(error)) return;
      setCustomersLoadError(true);
      notify.error(getFriendlyErrorMessage(error, t));
    } finally {
      if (!signal?.aborted) setCustomersLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchAllCustomers(controller.signal);
    return () => controller.abort();
  }, [fetchAllCustomers]);

  const fetchHistory = useCallback(async (customerId: number, currentPage: number, signal?: AbortSignal) => {
    setHistoryLoading(true);
    try {
      const { data } = await api.get<DebtMovementResponse>(
        `/customer-debts/${customerId}/movements`,
        { params: { page: currentPage, limit: PAGE_SIZE }, signal },
      );
      setHistory(data);
    } catch (error) {
      if (isAbortError(error)) return;
      notify.error(getFriendlyErrorMessage(error, t));
    } finally {
      if (!signal?.aborted) setHistoryLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!historyCustomer) return;
    const controller = new AbortController();
    void fetchHistory(historyCustomer.id, historyPage, controller.signal);
    return () => controller.abort();
  }, [fetchHistory, historyCustomer, historyPage]);

  const openMovement = (customer: CustomerDebt, type: DebtMovementType) => {
    setMovementCustomer(customer);
    setMovementType(type);
    setAmount("");
    setNote("");
    setAmountError("");
    setNoteError("");
  };

  const submitMovement = async () => {
    const parsedAmount = Number(amount);
    const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
    const validNote = note.trim().length >= 2;
    setAmountError(validAmount ? "" : t.errors.common.required);
    setNoteError(validNote ? "" : t.errors.common.required);
    if (!validAmount || !validNote || !movementCustomer || saving) return;

    setSaving(true);
    try {
      await api.post("/customer-debts/movements", {
        customerId: movementCustomer.id,
        type: movementType,
        amount: parsedAmount,
        note: note.trim(),
      });
      setMovementCustomer(null);
      notify.success(t.customerDebts.movementSaved);
      void fetchDebts();
    } catch (error) {
      if (errorCode(error) === "PAYMENT_EXCEEDS_CUSTOMER_DEBT") {
        setAmountError(t.customerDebts.paymentExceedsBalance);
      } else {
        notify.error(getFriendlyErrorMessage(error, t));
      }
    } finally {
      setSaving(false);
    }
  };

  const formatMoney = useCallback(
    (value: number | string | null | undefined) =>
      Number(value ?? 0).toLocaleString(language === "ar" ? "ar-EG" : "en-EG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [language],
  );

  const movementColumns = useMemo<Column<CustomerDebtMovement>[]>(() => [
    {
      key: "createdAt",
      label: t.date,
      render: (row) => new Date(row.createdAt).toLocaleString(language === "ar" ? "ar-EG" : "en-EG"),
    },
    {
      key: "type",
      label: t.customerDebts.history,
      render: (row) => row.type === "INCREASE" ? t.customerDebts.increase : t.customerDebts.payment,
    },
    {
      key: "amount",
      label: t.customerDebts.amount,
      align: "right",
      render: (row) => (
        <span style={{ color: row.type === "INCREASE" ? "var(--accent)" : "var(--success, #16845b)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {row.type === "INCREASE" ? "+" : "−"}{t.currency} {formatMoney(row.amount)}
        </span>
      ),
    },
    {
      key: "balanceAfter",
      label: t.customerDebts.balanceAfter,
      align: "right",
      render: (row) => `${t.currency} ${formatMoney(row.balanceAfter)}`,
    },
    {
      key: "note",
      label: t.customerDebts.note,
      render: (row) => (
        <span title={row.note} style={{ display: "block", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.note}
        </span>
      ),
    },
    {
      key: "employee",
      label: t.customerDebts.performedBy,
      render: (row) => row.employee?.name || "—",
    },
  ], [formatMoney, language, t]);

  const customerColumns = useMemo<Column<CustomerDebt>[]>(() => [
    {
      key: "name",
      label: t.customerDebts.customer,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 700 }}>{row.name}</div>
          <div style={{ color: "var(--soft)", fontSize: 12 }}>{row.phone || "—"}</div>
        </div>
      ),
    },
    {
      key: "currentDebt",
      label: t.customerDebts.currentBalance,
      align: "right",
      render: (row) => (
        <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: Number(row.currentDebt) > 0 ? "var(--accent)" : "var(--soft)" }}>
          {t.currency} {formatMoney(row.currentDebt)}
        </span>
      ),
    },
    {
      key: "actions",
      label: t.actions,
      align: "right",
      render: (row) => (
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Button variant="secondary" size="sm" onClick={() => openMovement(row, "INCREASE")}>
            {t.customerDebts.addDebt}
          </Button>
          <Button
            variant="quiet"
            size="sm"
            disabled={Number(row.currentDebt) <= 0}
            onClick={() => openMovement(row, "PAYMENT")}
          >
            {t.customerDebts.recordPayment}
          </Button>
          <Button
            variant="quiet"
            size="sm"
            onClick={() => {
              setHistory(null);
              setHistoryPage(1);
              setHistoryCustomer(row);
            }}
          >
            {t.customerDebts.history}
          </Button>
        </div>
      ),
    },
  ], [formatMoney, t]);

  const customers = debtData?.data ?? [];
  const meta = debtData?.meta;
  const customerSelectOptions = useMemo(
    () => customerOptions.map((customer) => ({
      value: String(customer.id),
      label: customer.phone ? `${customer.name} — ${customer.phone}` : customer.name,
    })),
    [customerOptions],
  );

  return (
    <div>
      <PageHeader
        title={t.pages.customerDebts}
        subtitle={t.pages.customerDebtsSubtitle}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
        <Card>
          <div style={{ color: "var(--soft)", fontSize: 13, fontWeight: 600 }}>{t.customerDebts.totalReceivables}</div>
          <div style={{ marginTop: 8, color: "var(--ink)", fontSize: 25, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
            {t.currency} {formatMoney(debtData?.summary.totalDebt)}
          </div>
        </Card>
        <Card>
          <div style={{ color: "var(--soft)", fontSize: 13, fontWeight: 600 }}>{t.customerDebts.customersWithDebt}</div>
          <div style={{ marginTop: 8, color: "var(--ink)", fontSize: 25, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
            {debtData?.summary.customersWithDebt ?? "—"}
          </div>
        </Card>
      </div>

      <div style={{ marginBottom: 16, maxWidth: 420 }}>
        <Select
          aria-label={t.customerDebts.customer}
          label={t.customerDebts.customer}
          options={customerSelectOptions}
          value={selectedCustomerId}
          placeholder={t.customerDebts.selectCustomer}
          searchablePlaceholder={t.customers.searchPlaceholder}
          noResultsText={t.customerDebts.noCustomers}
          loading={customersLoading}
          disabled={customersLoadError}
          onChange={(event) => {
            setSelectedCustomerId(event.target.value);
            setPage(1);
          }}
        />
        {customersLoadError && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
            <Button variant="quiet" size="sm" onClick={() => { void fetchAllCustomers(); }}>
              {t.apply}
            </Button>
          </div>
        )}
      </div>

      {loading && !debtData ? (
        <div className="state-block"><LoadingSpinner size={28} /></div>
      ) : loadError && !debtData ? (
        <EmptyState
          title={t.error}
          description={t.customerDebts.loadFailed}
          action={<Button variant="secondary" onClick={() => { void fetchDebts(); }}>{t.apply}</Button>}
        />
      ) : customers.length === 0 ? (
        <EmptyState
          title={t.customerDebts.noCustomers}
          description={selectedCustomerId ? t.customers.tryDifferent : t.customers.noCustomersInSystem}
        />
      ) : (
        <>
          <Table
            columns={customerColumns}
            data={customers}
            loading={loading}
            keyExtractor={(customer) => String(customer.id)}
          />
          {meta && meta.totalPages > 1 && (
            <Pagination
              currentStart={(meta.page - 1) * meta.limit + 1}
              currentEnd={Math.min(meta.page * meta.limit, meta.total)}
              total={meta.total}
              currentPage={meta.page}
              totalPages={meta.totalPages}
              onPrev={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => Math.min(meta.totalPages, current + 1))}
              loading={loading}
            />
          )}
        </>
      )}

      <Modal
        isOpen={!!movementCustomer}
        onClose={() => {
          if (!saving) setMovementCustomer(null);
        }}
        title={movementType === "INCREASE" ? t.customerDebts.addDebt : t.customerDebts.recordPayment}
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setMovementCustomer(null)}>
              {t.cancel}
            </Button>
            <Button variant="primary" loading={saving} onClick={() => { void submitMovement(); }}>
              {t.customerDebts.saveMovement}
            </Button>
          </>
        }
      >
        {movementCustomer && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: 12, borderRadius: 10, background: "var(--surface)" }}>
              <div style={{ color: "var(--soft)", fontSize: 12 }}>{t.customerDebts.customer}</div>
              <strong>{movementCustomer.name}</strong>
              <div style={{ color: "var(--soft)", fontSize: 13, marginTop: 4 }}>
                {t.customerDebts.currentBalance}: {t.currency} {formatMoney(movementCustomer.currentDebt)}
              </div>
            </div>
            <Input
              label={t.customerDebts.amount}
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setAmountError("");
              }}
              error={amountError}
            />
            <Input
              label={t.customerDebts.note}
              value={note}
              maxLength={500}
              placeholder={t.customerDebts.notePlaceholder}
              onChange={(event) => {
                setNote(event.target.value);
                setNoteError("");
              }}
              error={noteError}
            />
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!historyCustomer}
        onClose={() => {
          setHistoryCustomer(null);
          setHistory(null);
        }}
        title={historyCustomer ? `${t.customerDebts.history} — ${historyCustomer.name}` : t.customerDebts.history}
        footer={
          history && history.meta.totalPages > 1 ? (
            <Pagination
              currentStart={(history.meta.page - 1) * history.meta.limit + 1}
              currentEnd={Math.min(history.meta.page * history.meta.limit, history.meta.total)}
              total={history.meta.total}
              currentPage={history.meta.page}
              totalPages={history.meta.totalPages}
              onPrev={() => setHistoryPage((current) => Math.max(1, current - 1))}
              onNext={() => setHistoryPage((current) => Math.min(history.meta.totalPages, current + 1))}
              loading={historyLoading}
            />
          ) : (
            <Button variant="secondary" onClick={() => setHistoryCustomer(null)}>{t.close}</Button>
          )
        }
      >
        {historyLoading && !history ? (
          <div className="state-block"><LoadingSpinner size={24} /></div>
        ) : history?.data.length ? (
          <Table
            columns={movementColumns}
            data={history.data}
            loading={historyLoading}
            keyExtractor={(movement) => String(movement.id)}
            density="compact"
          />
        ) : (
          <EmptyState title={t.customerDebts.noMovements} />
        )}
      </Modal>
    </div>
  );
}
