import type { Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { CLOCK } from '../../src/common/clock.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { TOKEN_VERIFIER } from '../../src/security/auth/token-verifier.js';
import { fixedClock } from './factories.js';
import { createTestTokenIssuer, type TestTokenIssuer } from './test-tokens.js';

export interface TestAppOptions {
  /** Test-only controllers registered next to the real modules. */
  readonly controllers?: readonly Type<unknown>[];
  /**
   * `test` (default) verifies tokens against a local JWKS; `fail-closed` keeps the production
   * placeholder verifier, which rejects every token.
   */
  readonly verifier?: 'test' | 'fail-closed';
  /**
   * Connect to DATABASE_URL (default `false`). Tests that only exercise the HTTP and
   * authorization pipeline run without a database; tests that read or write data must opt in.
   */
  readonly useDatabase?: boolean;
}

export interface TestApp {
  readonly app: NestExpressApplication;
  readonly tokens: TestTokenIssuer;
  close(): Promise<void>;
}

/** Boots the real application module through the same `configureApp` as `main.ts`. */
export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const tokens = await createTestTokenIssuer();

  let builder = Test.createTestingModule({
    imports: [AppModule],
    controllers: [...(options.controllers ?? [])],
  })
    .overrideProvider(CLOCK)
    .useValue(fixedClock);

  if (options.verifier !== 'fail-closed') {
    builder = builder.overrideProvider(TOKEN_VERIFIER).useValue(tokens.verifier);
  }
  if (!options.useDatabase) {
    builder = builder.overrideProvider(PrismaService).useValue({});
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  configureApp(app);
  await app.init();

  return { app, tokens, close: () => app.close() };
}
