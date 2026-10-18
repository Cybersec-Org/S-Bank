import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HealthRepository } from './health.repository.js';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly repository: HealthRepository) {}

  /** Readiness: the API is healthy when the database answers. Details stay in the log. */
  async assertReady(): Promise<void> {
    try {
      await this.repository.pingDatabase();
    } catch (error) {
      this.logger.error(
        'Database health check failed',
        error instanceof Error ? error.name : undefined,
      );
      throw new ServiceUnavailableException();
    }
  }
}
