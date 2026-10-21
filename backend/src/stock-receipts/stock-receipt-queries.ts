import { Prisma, StockReceiptStatus } from '@prisma/client';

/**
 * Stock receipts whose purchase price has not been set yet.
 *
 * Single source of truth for the "pending pricing" work queue: the dashboard
 * badge (DashboardService) and GET /stock-receipts/pending-pricing both use
 * this specification, so the count on the dashboard always equals the number
 * of receipts listed on the Stock Pricing page.
 */
export const pendingPricingReceiptsWhere: Prisma.StockReceiptWhereInput = {
  status: StockReceiptStatus.PENDING_PRICING,
};
