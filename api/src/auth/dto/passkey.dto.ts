import { ApiProperty } from '@nestjs/swagger';

/** OpenAPI description of a registered WebAuthn Passkey (same shape as `PasskeyDto` in passkeys.service.ts). */
export class PasskeyResponseDto {
  @ApiProperty({ description: 'Keycloak credential id' })
  id!: string;

  @ApiProperty({ example: 'Klucz dostępu (Passkey)' })
  label!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
