import { IsNumber, IsPositive, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLimitDto {
  @ApiProperty({
    example: 5000.0,
    description: 'New daily limit in allowed range (100 - 50 000 PLN)',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Min(100, { message: 'Daily limit cannot be lower than 100 PLN' })
  @Max(50000, { message: 'Daily limit cannot exceed the maximum allowed threshold of 50 000 PLN' })
  newLimit!: number;
}