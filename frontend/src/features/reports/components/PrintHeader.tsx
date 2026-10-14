import { useEffect, useState } from "react";
import { useI18n } from "../../../i18n/context";
import PrintDocumentLayout from "../../printing/components/PrintDocumentLayout";
import { formatPrintDateTime } from "../../printing/utils/formatters";

interface PrintFilter {
  label: string;
  value: string;
}

interface PrintHeaderProps {
  titleEn: string;
  titleAr: string;
  range: { from: string; to: string };
  filters?: PrintFilter[];
}

export default function PrintHeader({
  titleEn,
  titleAr,
  range,
  filters = [],
}: PrintHeaderProps) {
  const { t } = useI18n();
  const [generatedAt, setGeneratedAt] = useState(() => new Date());

  useEffect(() => {
    const stamp = () => setGeneratedAt(new Date());
    window.addEventListener("beforeprint", stamp);
    return () => window.removeEventListener("beforeprint", stamp);
  }, []);

  const visibleFilters = filters.filter(
    ({ value }) => value.trim() !== "" && value.trim() !== "—",
  );

  return (
    <PrintDocumentLayout
      title={titleAr}
      titleEnglish={titleEn}
      headerVisibility="print"
      className="report-print-document"
    >
      <div className="report-context">
        <div className="report-context-main">
          <span className="report-badge">{t.reports.reportBadge}</span>
          <div className="report-range">
            <span>{t.invoices.dateRange}</span>
            <strong dir="ltr">{range.from}</strong>
            {range.from !== range.to && (
              <>
                <i aria-hidden="true">—</i>
                <strong dir="ltr">{range.to}</strong>
              </>
            )}
          </div>

          {visibleFilters.length > 0 && (
            <div className="report-filters">
              {visibleFilters.map((filter, index) => (
                <span
                  className="report-filter"
                  key={`${filter.label}-${index}`}
                >
                  <b>{filter.label}</b>
                  <strong>{filter.value}</strong>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="report-generated">
          <span>{t.invoices.generated}</span>
          <strong dir="ltr">{formatPrintDateTime(generatedAt)}</strong>
        </div>
      </div>
    </PrintDocumentLayout>
  );
}
