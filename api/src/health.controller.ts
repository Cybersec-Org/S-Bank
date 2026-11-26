import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './auth/policies.guard.js';
import { HealthDto } from './common/dto/error-response.dto.js';

@Public()
@ApiTags('Public')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Checks server health' })
  @ApiOkResponse({ type: HealthDto })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
