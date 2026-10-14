import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPrintCurrency,
  formatPrintDate,
  formatPrintDateTime,
  formatPrintNumber,
} from "./formatters.ts";

test("formats invoice amounts with Western digits and fixed decimals", () => {
  assert.equal(
    formatPrintCurrency(1234.5, "EGP", {
      locale: "en-US",
      useGrouping: false,
    }),
    "EGP 1234.50",
  );
});

test("formats report values with grouping and retains zero values", () => {
  assert.equal(formatPrintNumber(0), "0.00");
  assert.equal(formatPrintNumber("1234.5"), "1,234.50");
});

test("formats dates with the specified stable locale", () => {
  const localDate = new Date(2026, 9, 13, 9, 5);
  assert.equal(formatPrintDate(localDate), "13/10/2026");
  assert.equal(
    formatPrintDateTime(localDate, "en-GB"),
    "13/10/2026, 09:05",
  );
});

test("rejects invalid numeric and date values instead of printing misleading data", () => {
  assert.throws(() => formatPrintNumber("invalid"), RangeError);
  assert.throws(() => formatPrintDate("not-a-date"), RangeError);
});
