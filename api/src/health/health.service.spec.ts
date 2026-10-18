import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HealthRepository } from './health.repository.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is ready when the database answers', async () => {
    const service = new HealthService({
      pingDatabase: vi.fn().mockResolvedValue(undefined),
    } as unknown as HealthRepository);

    await expect(service.assertReady()).resolves.toBeUndefined();
  });

  it('answers 503 without details when the database is down', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const failing = {
      pingDatabase: vi
        .fn()
        .mockRejectedValue(new Error('password authentication failed for user sbank_app')),
    };
    const service = new HealthService(failing as unknown as HealthRepository);

    const outcome = service.assertReady();

    await expect(outcome).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(outcome).rejects.not.toThrow(/password/);
  });
});
