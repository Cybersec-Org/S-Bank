import { IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateStatusDto {
  @ApiProperty({ example: 'FROZEN', enum: ['ACTIVE', 'FROZEN', 'CLOSED'] })
  @IsString()
  @IsIn(['ACTIVE', 'FROZEN', 'CLOSED'])
  status!: 'ACTIVE' | 'FROZEN' | 'CLOSED';
}