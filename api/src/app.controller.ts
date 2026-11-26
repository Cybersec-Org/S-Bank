import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { Public } from './auth/policies.guard.js';
import { HealthDto, MessageDto } from './common/dto/error-response.dto.js';


@Public()
@Controller()
export class AppController {
  @Get()
  @ApiOkResponse({ type: MessageDto })
  getHello() {
    return { message: 'S-Bank API is running' };
  }

  @Get('health')
  @ApiOkResponse({ type: HealthDto })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
