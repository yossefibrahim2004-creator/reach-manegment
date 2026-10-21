import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  BarChart3,
  Bell,
  Boxes,
  CalendarCheck,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Factory,
  FilePlus2,
  FileClock,
  FileSearch,
  FileText,
  History,
  Home,
  HandCoins,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  Receipt,
  ScanSearch,
  Settings,
  SlidersHorizontal,
  Tags,
  Truck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useI18n } from "../i18n/context";
import { useSettings } from "../lib/settings";
import BrandLogo from "./BrandLogo";

type NavKey =
  | "home"
  | "dashboard"
  | "notifications"
  | "newInvoice"
  | "invoiceSearch"
  | "unitSearch"
  | "customers"
  | "myRequests"
  | "attendance"
  | "pendingInvoices"
  | "expenses"
  | "customerDebts"
  | "reports"
  | "receiveShipment"
  | "inventory"
  | "categoriesModels"
  | "invoiceDelivery"
  | "stockAdjustments"
  | "changeRequests"
  | "invoices"
  | "suppliers"
  | "stockPricing"
  | "employees"
  | "auditHistory"
  | "settings";

type UserRole = "ADMIN" | "ACCOUNTANT" | "INVENTORY" | "SALES";
type Language = "en" | "ar";

interface NavItem {
  to: string;
  key: NavKey;
  icon: LucideIcon;
  primary?: boolean;
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const DESKTOP_BREAKPOINT = 1024;

const ROLE_LABELS: Record<UserRole, Record<Language, string>> = {
  ADMIN: { en: "Admin", ar: "مدير" },
  ACCOUNTANT: { en: "Accountant", ar: "محاسب" },
  INVENTORY: { en: "Inventory", ar: "أمين المخزن" },
  SALES: { en: "Sales", ar: "مبيعات" },
};

/**
 * One icon per meaning. Nothing is reused for a different concept:
 *  - Home / LayoutDashboard ........ landing page (dashboard for admin)
 *  - Bell .......................... notifications
 *  - FilePlus2 / FileSearch ........ create invoice / find invoice
 *  - FileClock ..................... invoices waiting for review
 *  - FileText ...................... invoice list
 *  - ScanSearch .................... look up a unit by serial number
 *  - Users / Factory ............... customers / suppliers
 *  - ClipboardList / ClipboardCheck  my requests / change requests (approval)
 *  - Truck / PackageCheck .......... deliver to customer / receive from supplier
 *  - Boxes / Tags .................. stock levels / categories & models
 *  - SlidersHorizontal ............. manual stock adjustments
 *  - BadgeDollarSign ............... stock pricing
 *  - Receipt / HandCoins ........... expenses / customer debts
 *  - BarChart3 ..................... reports
 *  - UserCog / CalendarCheck ....... employees / attendance
 *  - History / Settings ............ audit log / settings
 */
function getSections(
  role: UserRole | undefined,
  language: Language,
): NavSection[] {
  const labels =
    language === "ar"
      ? {
          overview: "نظرة عامة",
          sales: "المبيعات",
          inventory: "المخزون",
          finance: "المالية",
          people: "الموظفون والحضور",
          system: "الإدارة والنظام",
        }
      : {
          overview: "Overview",
          sales: "Sales",
          inventory: "Inventory",
          finance: "Finance",
          people: "People & attendance",
          system: "Administration",
        };

  const overview: NavSection = {
    id: "overview",
    label: labels.overview,
    defaultOpen: true,
    items: [
      {
        to: "/",
        key: role === "ADMIN" ? "dashboard" : "home",
        icon: role === "ADMIN" ? LayoutDashboard : Home,
      },
      {
        to: role === "ADMIN" ? "/admin/notifications" : "/notifications",
        key: "notifications",
        icon: Bell,
      },
    ],
  };

  if (role === "SALES" || !role) {
    return [
      overview,
      {
        id: "sales",
        label: labels.sales,
        defaultOpen: true,
        items: [
          { to: "/sales/new-invoice", key: "newInvoice", icon: FilePlus2, primary: true },
          { to: "/sales/invoice-search", key: "invoiceSearch", icon: FileSearch },
          { to: "/sales/customers", key: "customers", icon: Users },
          { to: "/unit-search", key: "unitSearch", icon: ScanSearch },
          { to: "/sales/my-requests", key: "myRequests", icon: ClipboardList },
        ],
      },
      {
        id: "people",
        label: labels.people,
        items: [{ to: "/sales/attendance", key: "attendance", icon: CalendarCheck }],
      },
    ];
  }

  if (role === "ACCOUNTANT") {
    return [
      overview,
      {
        id: "finance",
        label: labels.finance,
        defaultOpen: true,
        items: [
          { to: "/accountant/pending-invoices", key: "pendingInvoices", icon: FileClock, primary: true },
          { to: "/accountant/expenses", key: "expenses", icon: Receipt },
          { to: "/reports/expenses", key: "reports", icon: BarChart3 },
        ],
      },
      {
        id: "people",
        label: labels.people,
        items: [{ to: "/accountant/attendance", key: "attendance", icon: CalendarCheck }],
      },
    ];
  }

  if (role === "INVENTORY") {
    return [
      overview,
      {
        id: "inventory",
        label: labels.inventory,
        defaultOpen: true,
        items: [
          { to: "/inventory/delivery", key: "invoiceDelivery", icon: Truck, primary: true },
          { to: "/inventory/receive-shipment", key: "receiveShipment", icon: PackageCheck },
          { to: "/inventory/stock", key: "inventory", icon: Boxes },
          { to: "/inventory/categories-models", key: "categoriesModels", icon: Tags },
          { to: "/inventory/stock-adjustments", key: "stockAdjustments", icon: SlidersHorizontal },
          { to: "/unit-search", key: "unitSearch", icon: ScanSearch },
        ],
      },
      {
        id: "people",
        label: labels.people,
        items: [{ to: "/inventory/attendance", key: "attendance", icon: CalendarCheck }],
      },
    ];
  }

  // ADMIN
  return [
    overview,
    {
      id: "sales",
      label: labels.sales,
      defaultOpen: true,
      items: [
        { to: "/admin/new-invoice", key: "newInvoice", icon: FilePlus2, primary: true },
        { to: "/admin/invoices", key: "invoices", icon: FileText },
        { to: "/admin/customers", key: "customers", icon: Users },
        { to: "/admin/suppliers", key: "suppliers", icon: Factory },
        { to: "/admin/unit-search", key: "unitSearch", icon: ScanSearch },
      ],
    },
    {
      id: "inventory",
      label: labels.inventory,
      defaultOpen: true,
      items: [
        { to: "/admin/delivery", key: "invoiceDelivery", icon: Truck, primary: true },
        { to: "/admin/stock-pricing", key: "stockPricing", icon: BadgeDollarSign },
        { to: "/admin/stock-adjustments", key: "stockAdjustments", icon: SlidersHorizontal },
      ],
    },
    {
      id: "finance",
      label: labels.finance,
      items: [
        { to: "/admin/expenses", key: "expenses", icon: Receipt },
        { to: "/admin/customer-debts", key: "customerDebts", icon: HandCoins },
        { to: "/admin/reports/revenue", key: "reports", icon: BarChart3 },
      ],
    },
    {
      id: "people",
      label: labels.people,
      items: [
        { to: "/admin/employees", key: "employees", icon: UserCog },
        { to: "/admin/attendance", key: "attendance", icon: CalendarCheck },
      ],
    },
    {
      id: "system",
      label: labels.system,
      items: [
        { to: "/admin/change-requests", key: "changeRequests", icon: ClipboardCheck },
        { to: "/admin/audit", key: "auditHistory", icon: History },
        { to: "/admin/settings", key: "settings", icon: Settings },
      ],
    },
  ];
}

function isRouteActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--brand)]";

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const { brand } = useSettings();
  const { pathname } = useLocation();

  const role = user?.role as UserRole | undefined;
  const isAr = language === "ar";

  const sections = useMemo(() => getSections(role, language), [role, language]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s) => [s.id, s.defaultOpen ?? true])),
  );

  // Keep state in sync with the sections list and never hide the section
  // that contains the current page.
  useEffect(() => {
    setOpenSections((current) => {
      const next = { ...current };
      sections.forEach((section) => {
        if (!(section.id in next)) next[section.id] = section.defaultOpen ?? true;
        if (section.items.some((item) => isRouteActive(pathname, item.to))) {
          next[section.id] = true;
        }
      });
      return next;
    });
  }, [sections, pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!open || window.innerWidth >= DESKTOP_BREAKPOINT) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && window.innerWidth < DESKTOP_BREAKPOINT) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleNavClick = () => {
    if (window.innerWidth < DESKTOP_BREAKPOINT) onClose();
  };

  const toggleSection = (sectionId: string) =>
    setOpenSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));

  if (!open) return null;

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const initials =
    `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "•";
  const roleLabel = role ? ROLE_LABELS[role]?.[language] ?? role : "";

  return (
    <>
      {/* Mobile overlay */}
      <div
        className="fixed inset-0 z-40 lg:hidden"
        style={{ backgroundColor: "var(--overlay)" }}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        id="app-sidebar"
        aria-label={t.appName}
        className="fixed start-0 top-0 bottom-0 z-50 w-[272px] max-w-[85vw] flex flex-col overflow-hidden"
        style={{
          backgroundColor: "var(--card)",
          borderInlineEnd: "1px solid var(--border)",
        }}
      >
        {/* Brand */}
        <div
          className="h-[72px] shrink-0 flex items-center px-5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0">
              <BrandLogo size={36} />
            </div>
            <div className="min-w-0">
              <span
                className="text-[15px] font-semibold block leading-tight truncate"
                style={{ color: "var(--ink)", fontFamily: "Sora, sans-serif" }}
              >
                {brand.businessName || t.appName}
              </span>
              <span
                className="text-[12px] font-medium block truncate mt-0.5"
                style={{ color: "var(--soft)" }}
              >
                {t.appSubtitle}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 overflow-y-auto overscroll-contain px-3 py-3"
          aria-label={isAr ? "التنقل الرئيسي" : "Main navigation"}
        >
          <div className="space-y-2">
            {sections.map((section) => {
              const isOpen = !!openSections[section.id];
              const panelId = `nav-section-${section.id}`;

              return (
                <section key={section.id}>
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:bg-[var(--row-selected)] ${FOCUS_RING}`}
                  >
                    {/* No uppercase / letter-spacing: both break Arabic letter joining */}
                    <span
                      className="flex-1 text-start text-[12px] font-semibold"
                      style={{ color: "var(--soft)" }}
                    >
                      {section.label}
                    </span>

                    <ChevronDown
                      size={14}
                      strokeWidth={2}
                      aria-hidden="true"
                      className="shrink-0 transition-transform duration-200 motion-reduce:transition-none"
                      style={{
                        color: "var(--soft)",
                        // Collapsed chevron points toward the inline-end in both LTR and RTL.
                        transform: isOpen
                          ? "rotate(0deg)"
                          : isAr
                            ? "rotate(90deg)"
                            : "rotate(-90deg)",
                      }}
                    />
                  </button>

                  {/* Height animation without magic numbers: 0fr -> 1fr */}
                  <div
                    id={panelId}
                    className="grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none"
                    style={{
                      gridTemplateRows: isOpen ? "1fr" : "0fr",
                      opacity: isOpen ? 1 : 0,
                    }}
                  >
                    <div className="min-h-0 overflow-hidden">
                      {/* visibility:hidden removes collapsed links from the tab order */}
                      <ul
                        className="space-y-0.5 pb-1"
                        style={{
                          visibility: isOpen ? "visible" : "hidden",
                          transition: "visibility 200ms",
                        }}
                      >
                        {section.items.map((item) => {
                          const Icon = item.icon;

                          return (
                            <li key={item.to}>
                              <NavLink
                                to={item.to}
                                end={item.to === "/"}
                                onClick={handleNavClick}
                                className={({ isActive }) =>
                                  [
                                    "relative flex items-center gap-3 min-h-11 lg:min-h-10 px-3 rounded-lg text-[13.5px] transition-colors duration-150",
                                    FOCUS_RING,
                                    isActive
                                      ? "font-semibold bg-[var(--row-selected)] text-[color:var(--brand)]"
                                      : "font-medium text-[color:var(--ink)] hover:bg-[var(--row-selected)]",
                                  ].join(" ")
                                }
                              >
                                {({ isActive }) => (
                                  <>
                                    {isActive && (
                                      <span
                                        aria-hidden="true"
                                        className="absolute start-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-e-full"
                                        style={{ backgroundColor: "var(--brand)" }}
                                      />
                                    )}

                                    {/* Primary action = tinted icon tile */}
                                    <span
                                      className="grid place-items-center w-7 h-7 shrink-0 rounded-md"
                                      style={
                                        item.primary && !isActive
                                          ? {
                                              color: "var(--brand)",
                                              backgroundColor:
                                                "color-mix(in srgb, var(--brand) 14%, transparent)",
                                            }
                                          : undefined
                                      }
                                    >
                                      <Icon
                                        size={18}
                                        strokeWidth={isActive ? 2 : 1.75}
                                        aria-hidden="true"
                                        focusable="false"
                                      />
                                    </span>

                                    <span className="flex-1 truncate">{t.nav[item.key]}</span>
                                  </>
                                )}
                              </NavLink>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          {/* Language */}
          <div className="px-4 pt-3 pb-2">
            <div
              role="group"
              aria-label={isAr ? "اللغة" : "Language"}
              className="flex p-1 rounded-lg"
              style={{ backgroundColor: "var(--row-selected)" }}
            >
              {(
                [
                  { code: "en", label: "EN" },
                  { code: "ar", label: "عربي" },
                ] as const
              ).map(({ code, label }) => {
                const active = language === code;

                return (
                  <button
                    key={code}
                    type="button"
                    lang={code}
                    aria-pressed={active}
                    onClick={() => setLanguage(code)}
                    className={`flex-1 h-9 rounded-md text-[12px] font-semibold transition-all ${FOCUS_RING}`}
                    style={{
                      backgroundColor: active ? "var(--card)" : "transparent",
                      color: active ? "var(--brand)" : "var(--soft)",
                      boxShadow: active ? "var(--shadow-sm)" : "none",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* User + sign out */}
          <div className="px-4 pt-2 pb-4">
            <div
              className="flex items-center gap-3 p-2.5 rounded-xl"
              style={{ backgroundColor: "var(--row-selected)" }}
            >
              <div
                aria-hidden="true"
                className="w-9 h-9 shrink-0 flex items-center justify-center text-white text-[12px] font-bold rounded-lg"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {initials}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: "var(--ink)" }}>
                  {fullName}
                </p>
                <p className="text-[12px] font-medium truncate mt-0.5" style={{ color: "var(--soft)" }}>
                  {roleLabel}
                </p>
              </div>

              <button
                type="button"
                onClick={() => logout()}
                className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--card)] ${FOCUS_RING}`}
                style={{ color: "var(--soft)" }}
                title={t.signOut}
                aria-label={t.signOut}
              >
                {/* Mirror the arrow in RTL so it still points "out" */}
                <LogOut size={17} strokeWidth={1.75} aria-hidden="true" className={isAr ? "-scale-x-100" : ""} />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}