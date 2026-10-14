import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../../../i18n/context";
import { notify } from "../../../lib/notify";
import { prepareAndPrint } from "../../printing/utils/printDocument";

/**
 * Browser-print helper for paginated reports.
 * When print is requested, the page re-fetches with a large limit so the
 * printed output contains the full report, then restores normal pagination
 * after the print dialog closes.
 */
export function useReportPrint(allLimit = 1000) {
  const { t } = useI18n();
  const [printLimit, setPrintLimit] = useState<number | undefined>(undefined);
  const pendingRef = useRef(false);
  const printTimerRef = useRef<number | null>(null);
  const restoreRef = useRef<(() => void) | null>(null);

  const requestPrint = useCallback(() => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPrintLimit(allLimit);
  }, [allLimit]);

  const notifyReady = useCallback(() => {
    if (!pendingRef.current) return;
    pendingRef.current = false;

    const restore = () => {
      if (printTimerRef.current !== null) {
        window.clearTimeout(printTimerRef.current);
        printTimerRef.current = null;
      }
      window.removeEventListener("afterprint", restore);
      restoreRef.current = null;
      setPrintLimit(undefined);
    };
    restoreRef.current = restore;
    window.addEventListener("afterprint", restore);

    printTimerRef.current = window.setTimeout(() => {
      printTimerRef.current = null;
      void prepareAndPrint().catch(() => {
        restore();
        notify.error(t.reports.printPrepareFailed);
      });
    }, 100);
  }, [t.reports.printPrepareFailed]);

  const notifyFailed = useCallback(() => {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    setPrintLimit(undefined);
    notify.error(t.reports.failedToLoadReport);
  }, [t.reports.failedToLoadReport]);

  useEffect(
    () => () => {
      if (printTimerRef.current !== null) {
        window.clearTimeout(printTimerRef.current);
      }
      if (restoreRef.current) {
        window.removeEventListener("afterprint", restoreRef.current);
      }
    },
    [],
  );

  return { printLimit, requestPrint, notifyReady, notifyFailed };
}
