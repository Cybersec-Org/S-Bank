import { IsNumber, IsPositive, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTransactionDto {
  @ApiProperty({ example: 'PL83102010260000140202736451', description: 'Receiver IBAN' })
  @IsString()
  @Length(28, 28)
  receiverIban!: string;

  @ApiProperty({ example: 'John Smith', description: 'Receiver Name' })
  @IsString()
  receiverName!: string;

  @ApiProperty({ example: 150.50, description: 'Amount to transfer' })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ example: 'Invoice payment', description: 'Transaction title' })
  @IsString()
  title!: string;
}