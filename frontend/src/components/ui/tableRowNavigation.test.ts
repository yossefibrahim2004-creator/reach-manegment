import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isInteractiveRowChild,
  shouldNavigateRow,
  type RowClickEventLike,
} from "./tableRowNavigation.ts";

const NO_SELECTION = { hasActiveTextSelection: false };
const SELECTION = { hasActiveTextSelection: true };

/** Minimal stand-in for an Element: only `closest` is used by the guard. */
function elementInsideControl(isControl: boolean) {
  return { closest: () => (isControl ? ({} as Element) : null) };
}

function click(overrides: Partial<RowClickEventLike> = {}): RowClickEventLike {
  return {
    target: elementInsideControl(false),
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides,
  };
}

test("navigates on a plain left click on a non-interactive cell", () => {
  assert.equal(shouldNavigateRow(click(), NO_SELECTION), true);
});

test("navigates when the click target has no closest() (e.g. a text node)", () => {
  assert.equal(shouldNavigateRow(click({ target: {} }), NO_SELECTION), true);
});

test("does not navigate when the click lands on a link, button or other control", () => {
  assert.equal(
    shouldNavigateRow(click({ target: elementInsideControl(true) }), NO_SELECTION),
    false,
  );
});

test("does not navigate on modified clicks (new tab / new window keep native behaviour)", () => {
  for (const modifier of ["ctrlKey", "metaKey", "shiftKey", "altKey"] as const) {
    assert.equal(
      shouldNavigateRow(click({ [modifier]: true }), NO_SELECTION),
      false,
      `${modifier} should block row navigation`,
    );
  }
});

test("does not navigate for middle or right button clicks", () => {
  assert.equal(shouldNavigateRow(click({ button: 1 }), NO_SELECTION), false);
  assert.equal(shouldNavigateRow(click({ button: 2 }), NO_SELECTION), false);
});

test("does not navigate while text is selected in the row", () => {
  assert.equal(shouldNavigateRow(click(), SELECTION), false);
});

test("interactive-child detection is safe for non-element targets", () => {
  assert.equal(isInteractiveRowChild(null), false);
  assert.equal(isInteractiveRowChild(undefined), false);
  assert.equal(isInteractiveRowChild("plain text"), false);
  assert.equal(isInteractiveRowChild(elementInsideControl(true)), true);
  assert.equal(isInteractiveRowChild(elementInsideControl(false)), false);
});

test("the row itself never counts as an interactive child", () => {
  const row = { contains: () => true };
  const target = { closest: () => row };

  assert.equal(isInteractiveRowChild(target, row), false);
  assert.equal(
    shouldNavigateRow({ ...click(), target }, { hasActiveTextSelection: false, row }),
    true,
  );
});

test("an interactive element outside the row does not block navigation", () => {
  const row = { contains: () => false };
  const target = { closest: () => ({}) };

  assert.equal(isInteractiveRowChild(target, row), false);
});

test("a control inside the row still blocks navigation when a boundary is given", () => {
  const row = { contains: () => true };
  const button = {};
  const target = { closest: () => button };

  assert.equal(isInteractiveRowChild(target, row), true);
});
