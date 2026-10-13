import { DebtMovementType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

export class CreateDebtMovementDto {
  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(1)
  customerId: number;

  @ApiProperty({ enum: DebtMovementType, example: DebtMovementType.INCREASE })
  @IsEnum(DebtMovementType)
  type: DebtMovementType;

  @ApiProperty({ example: 1500, minimum: 0.01 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'بضاعة آجلة / سداد نقدي' })
  @IsString()
  @MinLength(2)
  @Matches(/\S/)
  @MaxLength(500)
  note: string;
}
