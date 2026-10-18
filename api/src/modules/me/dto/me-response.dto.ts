import { ApiProperty } from '@nestjs/swagger';
import { ROLES, type Role } from '../../../security/auth/principal.js';

export class MeResponseDto {
  @ApiProperty({ description: 'Keycloak subject (`sub`) of the caller.' })
  subject!: string;

  @ApiProperty({ enum: ROLES, isArray: true, description: 'Roles from the verified token.' })
  roles!: Role[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Authentication context class of the session: `2` after a passkey login.',
  })
  acr!: string | null;
}
