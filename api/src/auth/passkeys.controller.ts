import { Controller, Delete, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CheckAbilities, PoliciesGuard } from './policies.guard.js';
import { Action } from './casl-ability.factory.js';
import { UserAuthGuard } from './user-auth.guard.js';
import { PasskeysService } from './passkeys.service.js';

@ApiTags('Auth Passkeys')
@ApiBearerAuth()
@UseGuards(UserAuthGuard, PoliciesGuard)
@Controller('auth/passkeys')
export class PasskeysController {
  constructor(private readonly passkeysService: PasskeysService) {}

  @Get()
  @CheckAbilities({ action: Action.Read, subject: 'Passkey' })
  @ApiOperation({ summary: 'List registered WebAuthn Passkeys for the authenticated user' })
  async listPasskeys(@Req() req: any) {
    return this.passkeysService.listPasskeys(req.user);
  }

  @Delete(':id')
  @CheckAbilities({ action: Action.Delete, subject: 'Passkey' })
  @ApiOperation({ summary: 'Delete a registered WebAuthn Passkey belonging to the authenticated user' })
  async removePasskey(@Param('id') id: string, @Req() req: any) {
    return this.passkeysService.removePasskey(id, req.user);
  }
}
