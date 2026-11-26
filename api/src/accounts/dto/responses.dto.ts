import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Response bodies of the banking endpoints. Amounts are PLN (or the account currency) as JSON numbers. */

export class AccountDto {
  @ApiProperty({ example: 'acc-1' })
  id!: string;

  @ApiProperty({ example: 'PL11102010260000140202736451' })
  iban!: string;

  @ApiProperty({ example: 'client-1', description: 'Customer id of the owner' })
  ownerId!: string;

  @ApiProperty({ example: 'PLN' })
  currency!: string;

  @ApiProperty({ example: 12500, description: 'Balance in the account currency' })
  balance!: number;

  @ApiProperty({ example: 5000, description: 'Daily outgoing limit' })
  dailyLimit!: number;

  @ApiProperty({
    example: 150.5,
    description: 'Sum of completed outgoing transfers since local midnight',
  })
  dailyUsed!: number;

  @ApiProperty({ enum: ['ACTIVE', 'FROZEN', 'CLOSED'], example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiPropertyOptional({
    example: 'Jan',
    description: 'Present when the owner was loaded with the account',
  })
  ownerFirstName?: string;

  @ApiPropertyOptional({
    example: 'Kowalski',
    description: 'Present when the owner was loaded with the account',
  })
  ownerLastName?: string;
}

export class TransactionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ nullable: true, type: String, example: 'OP-1795725463000-1234' })
  operationNumber!: string | null;

  @ApiProperty({ example: 'acc-1' })
  senderAccountId!: string;

  @ApiProperty({ nullable: true, type: String, example: 'acc-3' })
  receiverAccountId!: string | null;

  @ApiProperty({ example: 'PL99102010260000140202736451' })
  receiverIban!: string;

  @ApiProperty({ example: 'Anna Nowak' })
  receiverName!: string;

  @ApiProperty({ example: 150.5 })
  amount!: number;

  @ApiProperty({ example: 'PLN' })
  currency!: string;

  @ApiProperty({ example: 'Czynsz' })
  title!: string;

  @ApiProperty({ example: 'COMPLETED', description: 'DRAFT, PROCESSING, COMPLETED or CANCELLED' })
  status!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'ECDSA P-256 signature (base64) of the confirmation',
  })
  signature!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  executedAt!: string | null;
}

export class TransferDraftDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['DRAFT'], example: 'DRAFT' })
  status!: string;

  @ApiProperty({ example: 'acc-1' })
  senderAccountId!: string;

  @ApiProperty({ example: 'PL11102010260000140202736451' })
  senderIban!: string;

  @ApiProperty({ example: 'PL99102010260000140202736451' })
  receiverIban!: string;

  @ApiProperty({ example: 'Anna Nowak' })
  receiverName!: string;

  @ApiProperty({ example: 1250 })
  amount!: number;

  @ApiProperty({ example: 'PLN' })
  currency!: string;

  @ApiProperty({ example: 'Czynsz' })
  title!: string;

  @ApiProperty({
    description:
      'true when the amount reaches the step-up threshold (Passkey, acr=2, fresh auth_time)',
  })
  requiresStepUp!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class TransferConfirmationPayloadDto {
  @ApiProperty({ example: 'OP-1795725463000-1234' })
  operationNumber!: string;

  @ApiProperty({ example: 'PL11102010260000140202736451' })
  senderIban!: string;

  @ApiProperty({ example: 'PL99102010260000140202736451' })
  receiverIban!: string;

  @ApiProperty({ example: 1250 })
  amount!: number;

  @ApiProperty({ example: 'PLN' })
  currency!: string;

  @ApiProperty({ format: 'date-time' })
  executedAt!: string;
}

export class TransferConfirmedDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['COMPLETED'], example: 'COMPLETED' })
  status!: string;

  @ApiProperty({ nullable: true, type: String, example: 'OP-1795725463000-1234' })
  operationNumber!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  executedAt!: string | null;

  @ApiProperty({ example: 1250 })
  amount!: number;

  @ApiProperty({ example: 'PLN' })
  currency!: string;

  @ApiProperty({
    description:
      'ECDSA P-256 signature (base64) of confirmationPayload; verify with GET /public/keys',
  })
  signature!: string;

  @ApiProperty({ type: TransferConfirmationPayloadDto })
  confirmationPayload!: TransferConfirmationPayloadDto;
}

export class TransferCancelledDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['CANCELLED'], example: 'CANCELLED' })
  status!: string;
}

export class RecipientDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'client-1' })
  ownerId!: string;

  @ApiProperty({ example: 'Anna Nowak (Czynsz)' })
  name!: string;

  @ApiProperty({ example: 'PL99102010260000140202736451' })
  iban!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class DeletedDto {
  @ApiProperty({ example: true })
  deleted!: boolean;

  @ApiProperty({ example: '6f1c…' })
  id!: string;
}

export class PaymentRequestDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'partner1' })
  partnerId!: string;

  @ApiProperty({ example: 'PL99102010260000140202736451' })
  receiverIban!: string;

  @ApiProperty({ example: 'Sklep Partner Sp. z o.o.' })
  receiverName!: string;

  @ApiProperty({ example: 149.99 })
  amount!: number;

  @ApiProperty({ example: 'PLN' })
  currency!: string;

  @ApiProperty({ example: 'Zamówienie #1024' })
  title!: string;

  @ApiProperty({ example: 'PENDING', description: 'PENDING, PROCESSING or PAID' })
  status!: string;

  @ApiProperty({ nullable: true, type: String, description: 'Transaction id once paid' })
  transactionId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  paidAt!: string | null;
}

export class PartnerPaymentRequestCreatedDto extends PaymentRequestDto {
  @ApiProperty({
    example: 'sbank://pay/6f1c…',
    description: 'Deep link carrying only the request id',
  })
  deepLink!: string;
}

export class CustomerSummaryDto {
  @ApiProperty({ example: 'client-1' })
  id!: string;

  @ApiProperty({ example: 'Jan' })
  firstName!: string;

  @ApiProperty({ example: 'Kowalski' })
  lastName!: string;

  @ApiProperty({ example: 'jan.kowalski@example.com' })
  email!: string;

  @ApiProperty({ example: 'CUST-1001' })
  customerNumber!: string;

  @ApiProperty({ type: [AccountDto] })
  accounts!: AccountDto[];
}

export class CustomerDetailsDto extends CustomerSummaryDto {
  @ApiProperty({
    type: [TransactionDto],
    description: 'Completed transactions of all customer accounts, newest first',
  })
  transactions!: TransactionDto[];
}

export class AuditLogDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'emp-1' })
  userId!: string;

  @ApiProperty({ example: 'EMPLOYEE' })
  userRole!: string;

  @ApiProperty({ example: 'EMPLOYEE_CUSTOMER_VIEW' })
  action!: string;

  @ApiProperty({ nullable: true, type: String, example: 'client-1' })
  resourceId!: string | null;

  @ApiProperty({ nullable: true, type: String, example: '127.0.0.1' })
  ipAddress!: string | null;

  @ApiProperty({ example: 'Employee viewed customer profile' })
  reason!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class SystemConfigDto {
  @ApiProperty({ example: 'global' })
  id!: string;

  @ApiProperty({
    example: 1000,
    description: 'Transfers of this amount or more need a Passkey step-up',
  })
  stepUpThreshold!: number;

  @ApiProperty({ example: 100 })
  minDailyLimit!: number;

  @ApiProperty({ example: 50000 })
  maxDailyLimit!: number;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
