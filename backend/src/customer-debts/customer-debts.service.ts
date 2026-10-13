import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DebtMovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDebtMovementDto } from './dto/create-debt-movement.dto';

@Injectable()
export class CustomerDebtsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: { page?: number; limit?: number; customerId?: number }) {
    const page = Number.isInteger(params.page) && Number(params.page) > 0 ? Number(params.page) : 1;
    const limit = Number.isInteger(params.limit) && Number(params.limit) > 0
      ? Math.min(Number(params.limit), 100)
      : 20;
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(Number.isInteger(params.customerId) && Number(params.customerId) > 0
        ? { id: Number(params.customerId) }
        : {}),
    };

    const [customers, total, totals] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          type: true,
          isActive: true,
          currentDebt: true,
        },
        orderBy: [{ currentDebt: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
      this.prisma.customer.aggregate({
        _sum: { currentDebt: true },
        _count: { _all: true },
        where: { currentDebt: { gt: 0 }, deletedAt: null },
      }),
    ]);

    return {
      data: customers,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      summary: {
        totalDebt: totals._sum.currentDebt ?? new Prisma.Decimal(0),
        customersWithDebt: totals._count._all,
      },
    };
  }

  async findMovements(customerId: number, params: { page?: number; limit?: number }) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });
    }

    const page = Number.isInteger(params.page) && Number(params.page) > 0 ? Number(params.page) : 1;
    const limit = Number.isInteger(params.limit) && Number(params.limit) > 0
      ? Math.min(Number(params.limit), 100)
      : 20;
    const where = { customerId };
    const [data, total] = await Promise.all([
      this.prisma.customerDebtMovement.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customerDebtMovement.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async createMovement(data: CreateDebtMovementDto, employeeId: number) {
    const amount = new Prisma.Decimal(data.amount.toFixed(2));
    if (!amount.isFinite() || amount.lte(0)) {
      throw new BadRequestException({ code: 'INVALID_DEBT_AMOUNT', message: 'Amount must be greater than zero' });
    }

    return this.prisma.$transaction(async (transaction) => {
      const customer = await transaction.customer.findUnique({
        where: { id: data.customerId },
        select: { id: true },
      });
      if (!customer) {
        throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });
      }

      if (data.type === DebtMovementType.PAYMENT) {
        const updated = await transaction.customer.updateMany({
          where: { id: data.customerId, currentDebt: { gte: amount } },
          data: { currentDebt: { decrement: amount } },
        });
        if (updated.count !== 1) {
          throw new BadRequestException({
            code: 'PAYMENT_EXCEEDS_CUSTOMER_DEBT',
            message: 'Payment cannot exceed the customer debt balance',
          });
        }
      } else {
        await transaction.customer.update({
          where: { id: data.customerId },
          data: { currentDebt: { increment: amount } },
        });
      }

      const updatedCustomer = await transaction.customer.findUniqueOrThrow({
        where: { id: data.customerId },
        select: { currentDebt: true },
      });

      return transaction.customerDebtMovement.create({
        data: {
          customerId: data.customerId,
          employeeId,
          type: data.type,
          amount,
          balanceAfter: updatedCustomer.currentDebt,
          note: data.note.trim(),
        },
        include: {
          employee: { select: { id: true, name: true } },
        },
      });
    });
  }
}
