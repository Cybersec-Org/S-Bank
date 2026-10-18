import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../security/auth/public.decorator.js';
import { SkipAllThrottling } from '../security/throttling/throttle-profiles.js';
import { HealthService } from './health.service.js';

/** Internal liveness/readiness probe for the container runtime; Caddy does not route it. */
@ApiExcludeController()
@Controller('health')
export class HealthController {
  constructor(private readonly service: HealthService) {}

  @Public()
  @SkipAllThrottling()
  @Get()
  async check(): Promise<{ status: 'ok' }> {
    await this.service.assertReady();
    return { status: 'ok' };
  }
}
