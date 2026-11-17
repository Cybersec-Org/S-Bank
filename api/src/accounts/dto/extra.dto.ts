import {
  IsNumber,
  IsPositive,
  IsString,
  Length,
  Matches,
  Min,
  Max,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRecipientDto {
  @ApiProperty({ example: 'Anna Nowak (Czynsz)', description: 'Saved recipient display name' })
  @IsString()
  @Length(2, 100)
  name!: string;

  @ApiProperty({ example: 'PL99102010260000140202736451', description: 'Recipient Polish IBAN' })
  @IsString()
  @Length(28, 28)
  @Matches(/^PL\d{26}$/, { message: 'iban must be a valid Polish IBAN (PL + 26 digits)' })
  iban!: string;
}

export class CreatePaymentRequestDto {
  @ApiProperty({ example: 149.99, description: 'Requested payment amount' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(100000)
  amount!: number;

  @ApiProperty({ example: 'Zamówienie #1024 w sklepie Partner', description: 'Payment title' })
  @IsString()
  @Length(2, 140)
  title!: string;

  @ApiProperty({ example: 'PL99102010260000140202736451', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^PL\d{26}$/)
  receiverIban?: string;

  @ApiProperty({ example: 'Sklep Partner Sp. z o.o.', required: false })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  receiverName?: string;
}

export class UpdateSystemConfigDto {
  @ApiProperty({ example: 1000, description: 'Minimum transfer amount requiring Passkey step-up (PLN)', required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(100)
  @Max(50000)
  stepUpThreshold?: number;

  @ApiProperty({ example: 100, description: 'Minimum allowed daily limit (PLN)', required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(10)
  @Max(5000)
  minDailyLimit?: number;

  @ApiProperty({ example: 50000, description: 'Maximum allowed daily limit (PLN)', required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1000)
  @Max(500000)
  maxDailyLimit?: number;
}