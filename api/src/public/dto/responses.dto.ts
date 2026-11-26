import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Response bodies of the public (unauthenticated) endpoints. */

export class ExchangeRateDto {
  @ApiProperty({ example: 'Euro' })
  currency!: string;

  @ApiProperty({ example: 'EUR' })
  code!: string;

  @ApiProperty({ example: 4.2645, description: 'NBP table A mid rate in PLN' })
  mid!: number;
}

export class RatesDto {
  @ApiProperty({ example: 'nbp_api', description: 'nbp_api, cache or stale_cache' })
  source!: string;

  @ApiProperty({ example: '2026-11-26' })
  effectiveDate!: string;

  @ApiProperty({ type: [ExchangeRateDto] })
  rates!: ExchangeRateDto[];
}

export class ConversionDto {
  @ApiProperty({ example: 100 })
  amount!: number;

  @ApiProperty({ example: 'PLN' })
  fromCurrency!: string;

  @ApiProperty({ example: 'EUR' })
  toCurrency!: string;

  @ApiProperty({ example: 23.45 })
  convertedAmount!: number;

  @ApiProperty({ example: 0.2345 })
  exchangeRate!: number;

  @ApiProperty({ example: '2026-11-26' })
  effectiveDate!: string;
}

export class AtmDto {
  @ApiProperty({ example: 'atm-ktw-1' })
  id!: string;

  @ApiProperty({ example: 'S-Bankomat Galeria Katowicka' })
  name!: string;

  @ApiProperty({ example: 'S-Bank' })
  operator!: string;

  @ApiProperty({ example: 'Katowice' })
  city!: string;

  @ApiProperty({ example: '3 Maja 30' })
  street!: string;

  @ApiProperty({ example: 50.2599 })
  lat!: number;

  @ApiProperty({ example: 19.0216 })
  lng!: number;

  @ApiProperty({ example: true })
  cashAvailable!: boolean;
}

export class AtmsDto {
  @ApiProperty({
    example: 'osm_nominatim_api',
    description: 'sbank_directory, osm_cache, osm_nominatim_api or fallback',
  })
  source!: string;

  @ApiProperty({ example: 'Katowice', description: 'Resolved city, ALL when no city was given' })
  city!: string;

  @ApiProperty({ type: [AtmDto] })
  atms!: AtmDto[];
}

export class TermsDto {
  @ApiProperty({ example: '2026.11' })
  version!: string;

  @ApiProperty({ example: '2026-11-17' })
  updatedAt!: string;

  @ApiProperty({ description: 'Static HTML document; render in a sandbox without JavaScript' })
  html!: string;
}

export class PublicKeyDto {
  @ApiProperty({ example: 'sbank-transfer-signing-2026' })
  keyId!: string;

  @ApiProperty({ example: 'ECDSA_P256_SHA256' })
  algorithm!: string;

  @ApiProperty({
    example: 'Software-HSM-Fallback',
    description: 'SoftHSM2-PKCS11 or Software-HSM-Fallback',
  })
  provider!: string;

  @ApiProperty({ description: 'SPKI public key in PEM format' })
  publicKeyPem!: string;
}

export class VerifyConfirmationPayloadDto {
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

/** Documentation only: the handler reads the body as a plain object, so no DTO validation is applied. */
export class VerifyConfirmationRequestDto {
  @ApiProperty({ type: VerifyConfirmationPayloadDto })
  payload!: VerifyConfirmationPayloadDto;

  @ApiProperty({ description: 'Base64 signature from the transfer confirmation' })
  signature!: string;
}

export class VerifyConfirmationResultDto {
  @ApiProperty({ example: true })
  valid!: boolean;
}

export class PartnerTestDto {
  @ApiProperty({ example: 'Payments endpoint accessible' })
  message!: string;

  @ApiPropertyOptional({ example: 'partner1' })
  partner?: string;
}
