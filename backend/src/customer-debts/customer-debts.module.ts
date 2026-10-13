import { Module } from '@nestjs/common';
import { CustomerDebtsController } from './customer-debts.controller';
import { CustomerDebtsService } from './customer-debts.service';

@Module({
  controllers: [CustomerDebtsController],
  providers: [CustomerDebtsService],
})
export class CustomerDebtsModule {}
