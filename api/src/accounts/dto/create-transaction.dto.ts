import {
  IsNumber,
  IsPositive,
  IsString,
  Length,
  IsOptional,
  Matches,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTransactionDto {
  @ApiProperty({
    example: 'uuid-sender-account',
    description: 'Sender Account ID (optional, defaults to primary PLN account)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  senderAccountId?: string;

<<<<<<< HEAD
<<<<<<< HEAD
  @ApiProperty({ example: 'PL47102010260000140202736453', description: 'Receiver IBAN' })
=======
  @ApiProperty({ example: 'PL99102010260000140202736451', description: 'Receiver IBAN (PL + 26 digits)' })
>>>>>>> origin/passkeys-and-stepup
=======
  @ApiProperty({ example: 'PL99102010260000140202736451', description: 'Receiver IBAN (PL + 26 digits)' })
>>>>>>> origin/passkeys-and-stepup
  @IsString()
  @Length(28, 28)
  @Matches(/^PL\d{26}$/, {
    message: 'receiverIban must be a valid Polish IBAN starting with PL followed by 26 digits',
  })
  receiverIban!: string;

  @ApiProperty({ example: 'Anna Nowak', description: 'Receiver Name' })
  @IsString()
  @Length(2, 100)
  receiverName!: string;

  @ApiProperty({ example: 150.5, description: 'Amount to transfer (max 2 decimal places)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(100000)
  amount!: number;

  @ApiProperty({ example: 'Dinner payment', description: 'Transaction title' })
  @IsString()
  @Length(2, 140)
  title!: string;
}