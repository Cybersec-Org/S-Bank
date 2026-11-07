import { IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLimitDto {
  @ApiProperty({ example: 2000.00, description: 'New daily limit' })
  @IsNumber()
  @IsPositive()
  newLimit!: number;
}