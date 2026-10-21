import { DashboardService } from './dashboard.service';
import { pendingCogsInvoicesWhere } from '../invoices/invoice-queries';
import { pendingPricingReceiptsWhere } from '../stock-receipts/stock-receipt-queries';

describe('DashboardService', () => {
  const summary = {
    netSales: 0,
    expenses: 0,
    cogs: 0,
    netProfit: 0,
    pendingChangeRequestsCount: 0,
    unreadNotificationsCount: 0,
    lowStockModelsCount: 0,
    pendingCogsInvoicesCount: 99,
    range: { from: '2026-10-01', to: '2026-10-21' },
  };

  function buildService() {
    const prisma = {
      invoice: { count: jest.fn().mockResolvedValue(7) },
      stockReceipt: { count: jest.fn().mockResolvedValue(3) },
    } as any;
    const reports = {
      computeDashboardSummary: jest.fn().mockResolvedValue(summary),
    } as any;

    return { service: new DashboardService(prisma, reports), prisma };
  }

  it('counts pending-COGS invoices with the same specification as GET /invoices?cogs=pending', async () => {
    const { service, prisma } = buildService();

    const result = await service.getSummary();

    expect(prisma.invoice.count).toHaveBeenCalledWith({ where: pendingCogsInvoicesWhere });
    expect(result.pendingCogsInvoicesCount).toBe(7);
  });

  it('counts pending-pricing receipts with the same specification as GET /stock-receipts/pending-pricing', async () => {
    const { service, prisma } = buildService();

    const result = await service.getSummary();

    expect(prisma.stockReceipt.count).toHaveBeenCalledWith({
      where: pendingPricingReceiptsWhere,
    });
    expect(result.pendingStockPricingCount).toBe(3);
  });

  it('keeps the review and delivery counters aligned with their list statuses', async () => {
    const { service, prisma } = buildService();

    await service.getSummary();

    expect(prisma.invoice.count).toHaveBeenCalledWith({
      where: { status: 'PENDING_ACCOUNTANT' },
    });
    expect(prisma.invoice.count).toHaveBeenCalledWith({
      where: { status: 'CONFIRMED' },
    });
  });
});
