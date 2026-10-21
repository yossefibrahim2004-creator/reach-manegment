import { CogsStatus, InvoiceStatus, Prisma } from '@prisma/client';

/**
 * Invoices whose cost of goods sold has not been resolved yet.
 *
 * Single source of truth for the "Invoices Pending Pricing" work queue:
 * the dashboard badge (DashboardService) and the filtered invoice list
 * (GET /invoices?cogs=pending) both use this specification, so the count on
 * the dashboard always equals the number of rows on the target list.
 */
export const pendingCogsInvoicesWhere: Prisma.InvoiceWhereInput = {
  status: { in: [InvoiceStatus.CONFIRMED, InvoiceStatus.DELIVERED] },
  items: { some: { cogsStatus: CogsStatus.PENDING } },
};
