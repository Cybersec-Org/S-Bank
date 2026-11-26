import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Error body as the API sends it today. Domain errors thrown with an object (`new ForbiddenException({ code,
 * message })`) carry `code` + `message`; framework errors (validation, plain-string exceptions, 401 from guards)
 * use the Nest default `{ statusCode, message, error }`, where `message` is a list for validation errors.
 * Clients must rely on the HTTP status and `code`, never on the text.
 */
export class ErrorResponseDto {
  @ApiPropertyOptional({
    example: 'STEP_UP_REQUIRED',
    description:
      'Machine-readable error code, e.g. STEP_UP_REQUIRED, PASSKEY_REQUIRED, FORBIDDEN, ACCOUNT_NOT_FOUND, ' +
      'TRANSFER_NOT_FOUND, RECIPIENT_NOT_FOUND, INSUFFICIENT_FUNDS, DAILY_LIMIT_EXCEEDED, ACCOUNT_BLOCKED, ' +
      'CURRENCY_MISMATCH, SAME_ACCOUNT_TRANSFER, LIMIT_OUT_OF_RANGE, PAYMENT_REQUEST_NOT_FOUND, PASSKEY_NOT_FOUND',
  })
  code?: string;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    description:
      'Human-readable explanation (a list of messages for validation errors). Not for display.',
  })
  message!: string | string[];

  @ApiPropertyOptional({
    example: 401,
    description: 'HTTP status (Nest default error format only)',
  })
  statusCode?: number;

  @ApiPropertyOptional({
    example: 'Unauthorized',
    description: 'HTTP reason phrase (Nest default error format only)',
  })
  error?: string;
}

export class HealthDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ format: 'date-time' })
  timestamp!: string;
}

export class MessageDto {
  @ApiProperty({ example: 'S-Bank API is running' })
  message!: string;
}
