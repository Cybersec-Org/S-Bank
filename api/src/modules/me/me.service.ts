import { Injectable } from '@nestjs/common';
import type { Principal } from '../../security/auth/principal.js';
import type { MeResponseDto } from './dto/me-response.dto.js';

@Injectable()
export class MeService {
  getSummary(principal: Principal): MeResponseDto {
    return {
      subject: principal.subject,
      roles: [...principal.roles],
      acr: principal.acr ?? null,
    };
  }
}
