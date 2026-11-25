import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/policies.guard.js';


@Public()
@Controller()
export class AppController {
  @Get()
  getHello() {
    return { message: 'S-Bank API is running' };
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
