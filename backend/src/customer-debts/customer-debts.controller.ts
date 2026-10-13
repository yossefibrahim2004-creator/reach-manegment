import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../common/types/request-with-user.interface';
import { CustomerDebtsService } from './customer-debts.service';
import { CreateDebtMovementDto } from './dto/create-debt-movement.dto';

@ApiTags('Customer Debts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('customer-debts')
export class CustomerDebtsController {
  constructor(private readonly customerDebtsService: CustomerDebtsService) {}

  @Get()
  @ApiOperation({ summary: 'List customer balances and total receivables (Admin)' })
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('customerId') customerId?: string,
  ) {
    const parsedCustomerId = customerId === undefined ? undefined : Number(customerId);
    if (
      parsedCustomerId !== undefined &&
      (!Number.isInteger(parsedCustomerId) || parsedCustomerId < 1)
    ) {
      throw new BadRequestException({
        code: 'INVALID_CUSTOMER_ID',
        message: 'Customer ID must be a positive integer',
      });
    }

    return this.customerDebtsService.findAll({
      page: Number(page),
      limit: Number(limit),
      customerId: parsedCustomerId,
    });
  }

  @Get(':customerId/movements')
  @ApiOperation({ summary: 'List a customer debt ledger (Admin)' })
  findMovements(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.customerDebtsService.findMovements(customerId, {
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Post('movements')
  @ApiOperation({ summary: 'Increase customer debt or record a payment (Admin)' })
  createMovement(
    @Body() body: CreateDebtMovementDto,
    @Req() req: RequestWithUser,
  ) {
    if (!Number.isFinite(body.amount)) {
      throw new BadRequestException({ code: 'INVALID_DEBT_AMOUNT', message: 'Amount must be a valid number' });
    }

    return this.customerDebtsService.createMovement(body, req.user.sub);
  }
}
