import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** RFC 9457 problem details as sent by the API (`application/problem+json`). */
export class ProblemDetailsDto {
  @ApiProperty({
    description: 'Relative URI identifying the problem type.',
    example: '/problems/forbidden',
  })
  type!: string;

  @ApiProperty({ description: 'Short, fixed summary of the problem type.', example: 'Forbidden' })
  title!: string;

  @ApiProperty({ type: 'integer', description: 'HTTP status code.', example: 403 })
  status!: number;

  @ApiPropertyOptional({ description: 'Safe, human-readable explanation. Never internal details.' })
  detail?: string;

  @ApiProperty({
    description:
      'Request id (also in the `x-request-id` response header) for support and log lookup.',
    example: '3f1c2a4e-8b0d-4d57-9a53-0f5f1f6f8f21',
  })
  traceId!: string;

  @ApiPropertyOptional({
    description: 'Validation failures (400): which request properties were rejected.',
    type: [String],
  })
  errors?: string[];

  @ApiPropertyOptional({
    description: 'Step-up required (403): authentication context class the token must carry.',
    example: '2',
  })
  requiredAcr?: string;

  @ApiPropertyOptional({
    type: 'integer',
    description: 'Step-up required (403): maximum age of the authentication, in seconds.',
    example: 300,
  })
  maxAgeSeconds?: number;
}
