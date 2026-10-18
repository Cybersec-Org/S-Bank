import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProblemResponses } from '../../common/api-problem-responses.decorator.js';
import { CurrentPrincipal } from '../../security/auth/current-principal.decorator.js';
import type { Principal } from '../../security/auth/principal.js';
import { Roles } from '../../security/auth/roles.decorator.js';
import { MeResponseDto } from './dto/me-response.dto.js';
import { MeService } from './me.service.js';

@ApiTags('me')
@ApiBearerAuth()
@Controller('api/me')
export class MeController {
  constructor(private readonly service: MeService) {}

  @Roles('customer', 'employee', 'admin')
  @Get()
  @ApiOperation({ operationId: 'getCurrentUser', summary: 'Who the API thinks the caller is.' })
  @ApiOkResponse({ type: MeResponseDto, description: 'The verified caller.' })
  @ApiProblemResponses(401, 403, 429)
  getCurrentUser(@CurrentPrincipal() principal: Principal): MeResponseDto {
    return this.service.getSummary(principal);
  }
}
