import { Controller, Delete, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CheckAbilities, PoliciesGuard } from './policies.guard.js';
import { Action } from './casl-ability.factory.js';
import { UserAuthGuard } from './user-auth.guard.js';
import { PasskeysService } from './passkeys.service.js';
import { PasskeyResponseDto } from './dto/passkey.dto.js';
import { DeletedDto } from '../accounts/dto/responses.dto.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';

@ApiTags('Auth Passkeys')
@ApiBearerAuth()
@UseGuards(UserAuthGuard, PoliciesGuard)
@ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Missing, invalid or expired token' })
@ApiForbiddenResponse({ type: ErrorResponseDto, description: 'PASSKEY_REQUIRED (staff without acr=2, or removing the last staff Passkey)' })
@Controller('auth/passkeys')
export class PasskeysController {
  constructor(private readonly passkeysService: PasskeysService) {}

  @Get()
  @CheckAbilities({ action: Action.Read, subject: 'Passkey' })
  @ApiOperation({ summary: 'List registered WebAuthn Passkeys for the authenticated user' })
  @ApiOkResponse({ type: [PasskeyResponseDto] })
  async listPasskeys(@Req() req: any) {
    return this.passkeysService.listPasskeys(req.user);
  }

  @Delete(':id')
  @CheckAbilities({ action: Action.Delete, subject: 'Passkey' })
  @ApiOperation({ summary: 'Delete a registered WebAuthn Passkey belonging to the authenticated user' })
  @ApiOkResponse({ type: DeletedDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'PASSKEY_NOT_FOUND' })
  async removePasskey(@Param('id') id: string, @Req() req: any) {
    return this.passkeysService.removePasskey(id, req.user);
  }
}
