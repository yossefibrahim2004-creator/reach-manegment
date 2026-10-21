import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../lib/api";
import { useDebouncedValue, isAbortError } from "../../hooks";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { Pagination } from "../../components/ui/Pagination";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { EmptyState } from "../../components/ui/EmptyState";
import DateRangePicker from "../../components/ui/DateRangePicker";
import { useI18n } from "../../i18n/context";
import { useRealtimeRefresh } from "../../hooks/useRealtimeEvents";
import { useInvoiceColumns } from "../../features/invoices";
import type { Invoice } from "../../types";

const STATUS_FILTERS = [
  "PENDING_ACCOUNTANT",
  "CONFIRMED",
  "DELIVERED",
  "CANCELLED",
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];

const isStatusFilter = (value: string): value is StatusFilter =>
  (STATUS_FILTERS as readonly string[]).includes(value);

export default function Invoices() {
  const { t } = useI18n();
  const navigate = useNavigate();
  // Filters live in the URL so dashboard links can deep-link a filtered list
  // and the row count always matches the queue badge that led here.
  const [searchParams, setSearchParams] = useSearchParams();

  const rawStatus = searchParams.get("status") ?? "";
  const statusFilter: StatusFilter | "" = isStatusFilter(rawStatus) ? rawStatus : "";
  const cogsFilter = searchParams.get("cogs") === "pending" ? "pending" : "";
  const search = searchParams.get("search") ?? "";
  const debouncedSearch = useDebouncedValue(search, 300);
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState<{
    page: number;
    totalPages: number;
    total: number;
    limit: number;
    hint?: "UNIT_NOT_FOUND" | "UNIT_NOT_IN_ANY_INVOICE";
  }>({ page: 1, totalPages: 1, total: 0, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const setFilter = useCallback(
    (patch: Record<string, string>) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(patch).forEach(([key, value]) => {
            if (value) next.set(key, value);
            else next.delete(key);
          });
          return next;
        },
        { replace: true },
      );
      setPage(1);
    },
    [setSearchParams],
  );

  const fetchInvoices = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (statusFilter) params.status = statusFilter;
      if (cogsFilter) params.cogs = cogsFilter;
      const res = await api.get("/invoices", { params, signal });
      setInvoices(res.data.data ?? res.data);
      setMeta(res.data.meta ?? { page: 1, totalPages: 1, total: 0, limit: 20 });
    } catch (err) {
      if (isAbortError(err)) return;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, debouncedSearch, dateFrom, dateTo, statusFilter, cogsFilter]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchInvoices(controller.signal);
    return () => controller.abort();
  }, [fetchInvoices]);

  useRealtimeRefresh(() => {
    void fetchInvoices();
  }, ["invoice.created", "invoice.confirmed", "invoice.rejected", "invoice.delivery.scan", "invoice.delivered"]);

  const columns = useInvoiceColumns();

  return (
    <div>
      <PageHeader
        title={t.pages.invoices}
        subtitle={t.pages.invoicesSubtitle}
        actions={<Button onClick={() => navigate("/admin/new-invoice")}>{t.nav.newInvoice}</Button>}
      />

      <div className="toolbar">
        <div className="toolbar-grow">
          <Input placeholder={t.invoices.searchPlaceholder} value={search} onChange={(e) => setFilter({ search: e.target.value })} />
        </div>
        <DateRangePicker from={dateFrom} to={dateTo} onChange={(from, to) => setFilter({ dateFrom: from, dateTo: to })} />
        <div className="toolbar-fixed">
          <Select
            aria-label={t.status}
            options={[
              { label: t.all, value: "" },
              { label: t.statusLabels.pendingReview, value: "PENDING_ACCOUNTANT" },
              { label: t.statusLabels.confirmed, value: "CONFIRMED" },
              { label: t.statusLabels.delivered, value: "DELIVERED" },
              { label: t.statusLabels.cancelled, value: "CANCELLED" },
            ]}
            value={statusFilter}
            onChange={(e) => setFilter({ status: e.target.value })}
          />
        </div>
        <div className="toolbar-fixed">
          <Select
            aria-label={t.dashboard.cogs}
            options={[
              { label: t.all, value: "" },
              { label: t.dashboard.pendingCogsInvoices, value: "pending" },
            ]}
            value={cogsFilter}
            onChange={(e) => setFilter({ cogs: e.target.value })}
          />
        </div>
      </div>

      {loading ? (
        <div className="state-block">
          <LoadingSpinner size={28} />
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          title={t.invoices.noInvoices}
          description={
            meta.hint === "UNIT_NOT_FOUND"
              ? t.invoices.unitNotFound
              : meta.hint === "UNIT_NOT_IN_ANY_INVOICE"
                ? t.invoices.unitNotInInvoice
                : t.invoices.tryDifferent
          }
        />
      ) : (
        <>
          <Table
            columns={columns}
            data={invoices}
            getRowHref={(invoice) => `/admin/invoices/${invoice.id}`}
            keyExtractor={(invoice) => String(invoice.id)}
          />
          <Pagination
            currentStart={(meta.page - 1) * meta.limit + 1}
            currentEnd={Math.min(meta.page * meta.limit, meta.total)}
            total={meta.total}
            currentPage={meta.page}
            totalPages={meta.totalPages}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
          />
        </>
      )}
    </div>
  );
}
