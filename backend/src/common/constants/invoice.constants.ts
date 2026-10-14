// Single source of truth for invoice-level limits on the backend.
// The frontend mirrors this value in frontend/src/lib/constants.ts
// (the two packages are built separately, so the constant is duplicated
// deliberately — keep both files in sync).
export const INVOICE_NOTE_MAX_LENGTH = 500;
