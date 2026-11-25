import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './auth/policies.guard.js';

@Public()
@ApiTags('Public')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Checks server health' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
