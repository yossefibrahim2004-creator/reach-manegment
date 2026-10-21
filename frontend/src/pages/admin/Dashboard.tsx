import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { isAbortError } from "../../hooks";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Table } from "../../components/ui/Table";
import { EmptyState } from "../../components/ui/EmptyState";
import { useI18n } from "../../i18n/context";
import { useInvoiceColumns } from "../../features/invoices";
import type { Invoice, InvoiceReturn } from "../../types";
import type { DashboardSummaryResponse } from "../../types/reports";

/* ───────────── Routes (verified against App.tsx) ─────────────
   Each pending item links to the list that shows exactly the rows counted on
   /dashboard. Leave a value as "" to render that item as plain text. */
const ROUTES = {
  invoices: "/admin/invoices",
  // No standalone returns list exists; the returns report is the only page
  // that lists InvoiceReturn rows (there is no return-details route).
  returns: "/admin/reports/returns",
  pendingReviews: "/admin/invoices?status=PENDING_ACCOUNTANT",
  // Pricing happens on the Stock Pricing page, which lists the receipts.
  stockPricing: "/admin/stock-pricing",
  pendingDeliveries: "/admin/delivery",
  pendingChangeRequests: "/admin/change-requests?status=PENDING",
  notifications: "/admin/notifications?tab=unread",
};

/* The same details route the Invoices page opens. */
const invoiceDetailsHref = (invoiceId: number) => `/admin/invoices/${invoiceId}`;

/* ───────────── Formatters ───────────── */
const fmt = (value: number | undefined | null) =>
  (value ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (value: string | Date | undefined | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB");
};

const fmtTime = (value: Date) =>
  value.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/* ───────────── CSS that inline styles can't do ─────────────
   Hover, focus-visible, keyframes, media queries, reduced motion. */
const css = `
.dash-main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: var(--space-5);
  align-items: start;
}
.dash-side { position: sticky; top: var(--space-5); min-width: 0; }
.dash-stack { display: flex; flex-direction: column; gap: var(--space-5); min-width: 0; }
@media (max-width: 1100px) {
  .dash-main-grid { grid-template-columns: minmax(0, 1fr); }
  .dash-side { position: static; order: -1; }
}

.dash-queue-row {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 14px 24px; color: inherit; text-decoration: none;
  border-bottom: 1px solid var(--border);
  transition: background-color 140ms ease;
}
.dash-queue-row:last-child { border-bottom: none; }
a.dash-queue-row:hover { background-color: var(--bg-muted); }
a.dash-queue-row:focus-visible,
.dash-link:focus-visible,
.dash-refresh:focus-visible {
  outline: 2px solid var(--brand); outline-offset: -2px; border-radius: var(--radius-sm);
}
html[dir="rtl"] .dash-chev { transform: scaleX(-1); }

.dash-link {
  display: inline-flex; align-items: center; gap: 6px;
  color: var(--brand); font-size: 14px; font-weight: 600; text-decoration: none;
}
.dash-link:hover { text-decoration: underline; }

.dash-refresh {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 14px; cursor: pointer;
  color: var(--ink); font: inherit; font-size: 14px; font-weight: 600;
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-md, 10px);
  transition: background-color 140ms ease, border-color 140ms ease;
}
.dash-refresh:hover:not(:disabled) { background: var(--bg-muted); }
.dash-refresh:disabled { cursor: progress; opacity: 0.7; }
.dash-spin { animation: dash-rotate 0.9s linear infinite; }

.dash-skel {
  border-radius: 8px;
  background: linear-gradient(90deg, var(--bg-muted) 25%, color-mix(in srgb, var(--border) 70%, transparent) 50%, var(--bg-muted) 75%);
  background-size: 200% 100%;
  animation: dash-shimmer 1.4s ease-in-out infinite;
}

@keyframes dash-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@keyframes dash-rotate { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .dash-skel, .dash-spin { animation: none; }
  .dash-queue-row, .dash-refresh { transition: none; }
}
`;

/* ───────────── Inline style objects ───────────── */
const panelStyle: React.CSSProperties = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-sm)",
  minWidth: 0,
};

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const mutedTextStyle: React.CSSProperties = {
  color: "var(--soft)",
  fontSize: "13px",
};

const bannerStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "12px 18px",
  color: "var(--ink)",
  fontSize: "14px",
  backgroundColor: "color-mix(in srgb, var(--warning) 14%, transparent)",
  border: "1px solid color-mix(in srgb, var(--warning) 40%, transparent)",
  borderRadius: "var(--radius-md, 10px)",
};

const financeGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
};

const heroStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "10px",
  padding: "32px",
  minWidth: 0,
};

const heroValueStyle = (negative: boolean): React.CSSProperties => ({
  margin: 0,
  display: "flex",
  alignItems: "baseline",
  gap: "10px",
  color: negative ? "var(--danger, #b42318)" : "var(--ink)",
  fontFamily: "'Manrope', 'Noto Sans Arabic', sans-serif",
  fontSize: "clamp(34px, 4vw, 48px)",
  fontWeight: 800,
  lineHeight: 1.15,
  letterSpacing: "-0.04em",
  fontVariantNumeric: "tabular-nums",
  overflowWrap: "anywhere",
});

const marginChipStyle = (negative: boolean): React.CSSProperties => ({
  alignSelf: "flex-start",
  padding: "2px 10px",
  borderRadius: "999px",
  fontSize: "13px",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  color: negative ? "var(--danger, #b42318)" : "var(--ink)",
  backgroundColor: negative
    ? "color-mix(in srgb, var(--danger, #b42318) 12%, transparent)"
    : "color-mix(in srgb, var(--mint) 28%, transparent)",
});

const ledgerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  margin: 0,
  padding: "12px 32px",
  minWidth: 0,
  borderInlineStart: "1px solid var(--border)",
};

const ledgerRowStyle = (last: boolean): React.CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "16px 0",
  borderBottom: last ? "none" : "1px solid var(--border)",
});

const ledgerLineStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "16px",
};

const trackStyle: React.CSSProperties = {
  height: "4px",
  borderRadius: "2px",
  backgroundColor: "var(--bg-muted)",
  overflow: "hidden",
};

const queueCountStyle = (active: boolean): React.CSSProperties => ({
  flexShrink: 0,
  minWidth: "36px",
  padding: "2px 10px",
  borderRadius: "999px",
  textAlign: "center",
  fontSize: "14px",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  color: active ? "var(--ink)" : "var(--soft)",
  backgroundColor: active
    ? "color-mix(in srgb, var(--warning) 22%, transparent)"
    : "var(--bg-muted)",
});

const amountCellStyle: React.CSSProperties = {
  display: "block",
  textAlign: "end",
  direction: "ltr",
  whiteSpace: "nowrap",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
};

const dateCellStyle: React.CSSProperties = {
  whiteSpace: "nowrap",
  color: "var(--soft)",
  fontVariantNumeric: "tabular-nums",
};

const reasonCellStyle: React.CSSProperties = {
  display: "block",
  maxWidth: "260px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const tableScrollStyle: React.CSSProperties = {
  width: "100%",
  overflowX: "auto",
};

const cardFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  paddingTop: "12px",
  marginTop: "4px",
  borderTop: "1px solid var(--border)",
};

/* ───────────── Small pieces ───────────── */
const RefreshIcon = ({ spinning }: { spinning: boolean }) => (
  <svg
    className={spinning ? "dash-spin" : undefined}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </svg>
);

const Chevron = () => (
  <svg
    className="dash-chev"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ color: "var(--soft)", flexShrink: 0 }}
  >
    <path d="M9 6l6 6-6 6" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ color: "var(--mint)", flexShrink: 0 }}
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.7 2.7L16 9.8" />
  </svg>
);

const Skeleton = ({ h, w = "100%" }: { h: number; w?: string }) => (
  <div className="dash-skel" style={{ height: h, width: w }} />
);

/* Skeleton mirrors the real layout, so nothing jumps when data arrives. */
const DashboardSkeleton = ({ label }: { label: string }) => (
  <div
    role="status"
    aria-busy="true"
    aria-label={label}
    style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}
  >
    <Skeleton h={56} w="40%" />
    <div style={{ ...panelStyle, padding: 32 }}>
      <Skeleton h={150} />
    </div>
    <div className="dash-main-grid">
      <div className="dash-stack">
        <div style={{ ...panelStyle, padding: 24 }}>
          <Skeleton h={220} />
        </div>
        <div style={{ ...panelStyle, padding: 24 }}>
          <Skeleton h={180} />
        </div>
      </div>
      <div style={{ ...panelStyle, padding: 24 }}>
        <Skeleton h={260} />
      </div>
    </div>
  </div>
);

interface ActivityData {
  recentInvoices: Invoice[];
  recentApprovals: InvoiceReturn[];
}

interface LedgerItem {
  label: string;
  value: number;
  color: string;
  sign: string;
}

interface QueueItem {
  label: string;
  count: number;
  to: string;
}

export default function AdminDashboard() {
  const { t, dir } = useI18n();
  const isRtl = dir === "rtl";
  const invoiceColumns = useInvoiceColumns({
    include: ["invoiceNumber", "customer", "status", "date", "total"],
  });

  const [data, setData] = useState<DashboardSummaryResponse | null>(null);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Tells us whether we already have something to show, so a failed
  // refresh keeps the old numbers instead of wiping the whole page.
  const hasData = useRef(false);

  const loadErrorMessage = t.dashboard.failedToLoad;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const loadDashboard = async () => {
      if (hasData.current) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [summaryRes, activityRes] = await Promise.all([
          api.get("/dashboard", { signal }),
          api.get("/dashboard/activity", { signal }),
        ]);

        if (signal.aborted) return;

        setData(summaryRes.data as DashboardSummaryResponse);
        setActivity(activityRes.data as ActivityData);
        setUpdatedAt(new Date());
        hasData.current = true;
      } catch (err: unknown) {
        if (signal.aborted || isAbortError(err)) return;

        setError(loadErrorMessage);
      } finally {
        if (!signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void loadDashboard();

    return () => controller.abort();
  }, [loadErrorMessage, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  if (loading) {
    return (
      <>
        <style>{css}</style>
        <DashboardSkeleton label={t.loading} />
      </>
    );
  }

  // First load failed: nothing to show, so offer a clear way out.
  if (error && !data) {
    return (
      <div
        className="state-block"
        role="alert"
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <style>{css}</style>
        <EmptyState title={t.error} description={error} />
        <button type="button" className="dash-refresh" onClick={reload}>
          <RefreshIcon spinning={false} />
          {t.dashboard.retry}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const netSales = data.netSales ?? 0;
  const netProfit = data.netProfit ?? 0;
  const isLoss = netProfit < 0;
  const marginPct = netSales > 0 ? (netProfit / netSales) * 100 : null;

  const shareOfSales = (value: number | undefined | null) =>
    netSales > 0
      ? Math.min(100, Math.max(0, ((value ?? 0) / netSales) * 100))
      : 0;

  const ledger: LedgerItem[] = [
    {
      label: t.dashboard.monthlyNetSales,
      value: netSales,
      color: "var(--brand)",
      sign: "",
    },
    {
      label: t.dashboard.cogs,
      value: data.cogs ?? 0,
      color: "var(--accent)",
      sign: "−",
    },
    {
      label: t.dashboard.monthlyExpenses,
      value: data.expenses ?? 0,
      color: "var(--peach)",
      sign: "−",
    },
  ];

  // Fixed order on purpose: rows that jump around break muscle memory.
  const queue: QueueItem[] = [
    {
      label: t.dashboard.pendingReviews,
      count: data.pendingInvoiceReviewsCount ?? 0,
      to: ROUTES.pendingReviews,
    },
    {
      label: t.dashboard.pendingStockPricing,
      count: data.pendingStockPricingCount ?? 0,
      to: ROUTES.stockPricing,
    },
    {
      label: t.dashboard.pendingDeliveries,
      count: data.pendingDeliveriesCount ?? 0,
      to: ROUTES.pendingDeliveries,
    },
    {
      label: t.dashboard.pendingChangeRequests,
      count: data.pendingChangeRequestsCount ?? 0,
      to: ROUTES.pendingChangeRequests,
    },
    {
      label: t.dashboard.unreadNotifications,
      count: data.unreadNotificationsCount ?? 0,
      to: ROUTES.notifications,
    },
  ];

  const totalPending = queue.reduce((sum, item) => sum + item.count, 0);

  const monthLabel = new Date().toLocaleDateString(
    isRtl ? "ar-EG-u-nu-latn" : "en-US",
    { month: "long", year: "numeric" },
  );

  const returnColumns = [
    {
      key: "invoiceId",
      label: t.invoices.invoiceNumber,
      render: (invoiceReturn: InvoiceReturn) =>
        invoiceReturn.invoice?.invoiceNumber ?? `#${invoiceReturn.invoiceId}`,
    },
    {
      key: "reason",
      label: t.dashboard.reason,
      render: (invoiceReturn: InvoiceReturn) => (
        <span style={reasonCellStyle} title={invoiceReturn.reason ?? ""}>
          {invoiceReturn.reason || "—"}
        </span>
      ),
    },
    {
      key: "refundTotal",
      label: t.dashboard.refund,
      align: "right" as const,
      render: (invoiceReturn: InvoiceReturn) => (
        <span style={amountCellStyle}>
          {fmt(invoiceReturn.refundTotal)} {t.currency}
        </span>
      ),
    },
    {
      key: "createdAt",
      label: t.date,
      render: (invoiceReturn: InvoiceReturn) => (
        <span style={dateCellStyle}>{fmtDate(invoiceReturn.createdAt)}</span>
      ),
    },
  ];

  return (
    <main
      className="admin-dashboard"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
        width: "100%",
        minWidth: 0,
        paddingBottom: "var(--space-6)",
      }}
    >
      <style>{css}</style>

      <PageHeader
        title={t.pages.dashboard}
        subtitle={t.pages.dashboardSubtitle}
      />

      {/* Toolbar: which period am I looking at, how fresh is it, refresh */}
      <div style={toolbarStyle}>
        <span style={{ color: "var(--ink)", fontWeight: 700, fontSize: 16 }}>
          {monthLabel}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {updatedAt && (
            <span style={mutedTextStyle} aria-live="polite">
              {t.dashboard.updatedAt}{" "}
              <span dir="ltr" style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmtTime(updatedAt)}
              </span>
            </span>
          )}
          <button
            type="button"
            className="dash-refresh"
            onClick={reload}
            disabled={refreshing}
          >
            <RefreshIcon spinning={refreshing} />
            {refreshing ? t.dashboard.refreshing : t.dashboard.refresh}
          </button>
        </div>
      </div>

      {/* A failed refresh keeps the old numbers and says so */}
      {error && (
        <div style={bannerStyle} role="alert">
          <span>{t.dashboard.refreshFailed}</span>
          <button type="button" className="dash-link" onClick={reload}
            style={{ background: "none", border: "none", cursor: "pointer", font: "inherit", fontWeight: 600 }}>
            {t.dashboard.retry}
          </button>
        </div>
      )}

      {/* Finance: one hero number + the breakdown that produces it */}
      <section aria-label={t.dashboard.monthlyNetProfit} style={panelStyle}>
        <div style={financeGridStyle}>
          <div style={heroStyle}>
            <p
              style={{
                margin: 0,
                color: "var(--soft)",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {t.dashboard.monthlyNetProfit}
            </p>
            <p style={heroValueStyle(isLoss)} dir="ltr">
              <span>{fmt(netProfit)}</span>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: 0,
                  color: "var(--soft)",
                }}
              >
                {t.currency}
              </span>
            </p>
            {marginPct !== null && (
              <span style={marginChipStyle(isLoss)}>
                {t.dashboard.margin}{" "}
                <span dir="ltr">{marginPct.toFixed(1)}%</span>
              </span>
            )}
          </div>

          <dl style={ledgerStyle}>
            {ledger.map((item, index) => (
              <div
                key={item.label}
                style={ledgerRowStyle(index === ledger.length - 1)}
              >
                <div style={ledgerLineStyle}>
                  <dt style={{ color: "var(--soft)", fontSize: 14 }}>
                    {item.label}
                  </dt>
                  <dd
                    style={{
                      margin: 0,
                      color: "var(--ink)",
                      fontSize: 16,
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                    }}
                    dir="ltr"
                  >
                    {item.sign} {fmt(item.value)}
                  </dd>
                </div>
                <div style={trackStyle} aria-hidden="true">
                  <div
                    style={{
                      width: `${shareOfSales(item.value)}%`,
                      height: "100%",
                      borderRadius: 2,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </dl>
        </div>

        <p
          style={{
            margin: 0,
            padding: "14px 32px",
            borderTop: "1px solid var(--border)",
            color: "var(--soft)",
            fontSize: 13,
            lineHeight: 1.8,
          }}
        >
          {t.dashboard.netProfitFormula}
        </p>
      </section>

      {/* Main area: activity on the primary side, work queue beside it */}
      <div className="dash-main-grid">
        <div className="dash-stack">
          <Card title={t.dashboard.recentInvoices}>
            <div style={tableScrollStyle}>
              <Table
                columns={invoiceColumns}
                data={activity?.recentInvoices ?? []}
                getRowHref={(invoice) => invoiceDetailsHref(invoice.id)}
                emptyMessage={t.dashboard.noRecentInvoices}
              />
            </div>
            {ROUTES.invoices && (
              <div style={cardFooterStyle}>
                <Link className="dash-link" to={ROUTES.invoices}>
                  {t.dashboard.viewAllInvoices}
                  <Chevron />
                </Link>
              </div>
            )}
          </Card>

          <Card title={t.dashboard.recentReturns}>
            <div style={tableScrollStyle}>
              <Table
                columns={returnColumns}
                data={activity?.recentApprovals ?? []}
                emptyMessage={t.dashboard.noRecentReturns}
              />
            </div>
            {ROUTES.returns && (
              <div style={cardFooterStyle}>
                <Link className="dash-link" to={ROUTES.returns}>
                  {t.dashboard.viewAllReturns}
                  <Chevron />
                </Link>
              </div>
            )}
          </Card>
        </div>

        <aside
          className="dash-side"
          style={panelStyle}
          aria-label={t.dashboard.attention}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "20px 24px 12px",
            }}
          >
            <h2
              style={{
                margin: 0,
                color: "var(--ink)",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {t.dashboard.attention}
            </h2>
            {totalPending > 0 && (
              <span style={queueCountStyle(true)} dir="ltr">
                {totalPending}
              </span>
            )}
          </div>

          {totalPending === 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "4px 24px 16px",
                color: "var(--soft)",
                fontSize: 14,
              }}
            >
              <CheckIcon />
              {t.dashboard.allClear}
            </div>
          )}

          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {queue.map((item) => {
              const content = (
                <>
                  <span
                    style={{
                      color: item.count > 0 ? "var(--ink)" : "var(--soft)",
                      fontSize: 14,
                      fontWeight: item.count > 0 ? 600 : 400,
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span style={queueCountStyle(item.count > 0)} dir="ltr">
                      {item.count}
                    </span>
                    {item.to && <Chevron />}
                  </span>
                </>
              );

              return (
                <li key={item.label}>
                  {item.to ? (
                    <Link className="dash-queue-row" to={item.to}>
                      {content}
                    </Link>
                  ) : (
                    <div className="dash-queue-row">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </main>
  );
}