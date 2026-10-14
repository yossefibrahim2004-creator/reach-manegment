import { useI18n } from "../../../i18n/context";

interface ReportPrintLimitWarningProps {
  limit?: number;
  total?: number;
}

export default function ReportPrintLimitWarning({
  limit,
  total,
}: ReportPrintLimitWarningProps) {
  const { t } = useI18n();
  if (!limit || total === undefined || total <= limit) return null;

  return (
    <p className="report-print-limit-warning" role="alert">
      {t.reports.printLimitWarning
        .replace("{limit}", String(limit))
        .replace("{total}", String(total))}
    </p>
  );
}
