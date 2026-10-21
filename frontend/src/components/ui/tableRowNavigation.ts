/**
 * Row-navigation helpers for the shared `Table` component.
 *
 * Kept DOM-light on purpose: the decision logic is a pure function so it can
 * be tested with the project's `node:test` setup, and the two browser-facing
 * helpers are thin wrappers around `window.getSelection()`.
 */

/**
 * Elements inside a row that own their click/keyboard behaviour. Clicking any
 * of them must never navigate the row as a side effect.
 */
export const ROW_INTERACTIVE_SELECTOR = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "summary",
  "[role='button']",
  "[role='link']",
  "[role='menuitem']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='switch']",
  "[contenteditable='true']",
  "[data-row-navigation-ignore]",
].join(",");

export interface RowClickEventLike {
  target: unknown;
  button?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

interface ClosestCapable {
  closest?: (selector: string) => Element | null;
}

/**
 * True when the click landed on (or inside) a control that has its own
 * interaction. Uses `closest` so a click on a nested span inside a button or
 * link is still treated as a child-control click.
 *
 * `boundary` is the row element: the row itself (and anything outside it) is
 * never a child control, otherwise the row's own role/tabindex would block
 * every click on the row.
 */
export function isInteractiveRowChild(target: unknown, boundary?: unknown): boolean {
  const element = target as ClosestCapable | null | undefined;

  if (!element || typeof element.closest !== "function") {
    return false;
  }

  const match = element.closest(ROW_INTERACTIVE_SELECTOR);

  if (!match) {
    return false;
  }

  if (boundary === undefined || boundary === null) {
    return true;
  }

  if (match === boundary) {
    return false;
  }

  const row = boundary as { contains?: (node: unknown) => boolean };

  return typeof row.contains === "function" ? row.contains(match) : false;
}

/**
 * Decides whether a row click should navigate.
 *
 * Guards, in order:
 *  - only the primary (left) button navigates;
 *  - modified clicks keep native browser behaviour (new tab, download, ...);
 *  - selecting text inside a row must not navigate;
 *  - interactive children (links, buttons, inputs, menus) own their clicks.
 */
export function shouldNavigateRow(
  event: RowClickEventLike,
  context: { hasActiveTextSelection: boolean; row?: unknown },
): boolean {
  if (event.button !== undefined && event.button !== 0) {
    return false;
  }

  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
    return false;
  }

  if (context.hasActiveTextSelection) {
    return false;
  }

  return !isInteractiveRowChild(event.target, context.row);
}

/** Reads the current document selection; safe on the server / in tests. */
export function hasActiveTextSelection(): boolean {
  if (typeof window === "undefined" || typeof window.getSelection !== "function") {
    return false;
  }

  const selection = window.getSelection();

  return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
}
