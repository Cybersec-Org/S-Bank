import { IsNumber, IsPositive, IsString, Length, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTransactionDto {
  @ApiProperty({ example: 'uuid-sender-account', description: 'Sender Account ID (optional, defaults to primary PLN account)' })
  @IsOptional()
  @IsString()
  senderAccountId?: string;

  @ApiProperty({ example: 'PL99102010260000140202736451', description: 'Receiver IBAN' })
  @IsString()
  @Length(28, 28)
  receiverIban!: string;

  @ApiProperty({ example: 'Anna Nowak', description: 'Receiver Name' })
  @IsString()
  receiverName!: string;

  @ApiProperty({ example: 150.50, description: 'Amount to transfer' })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ example: 'Dinner payment', description: 'Transaction title' })
  @IsString()
  title!: string;
}