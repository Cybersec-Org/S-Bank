import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import { format, resolveConfig } from 'prettier';

/**
 * Non-secret placeholders so the app can be built without a database or network. NODE_ENV is
 * `production` on purpose: the root dotenv file is then never read, so the output cannot depend
 * on a developer's local configuration.
 */
const PLACEHOLDER_ENVIRONMENT = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://openapi:openapi@127.0.0.1:5432/openapi',
  CORS_ORIGINS: 'http://localhost:8081',
  OIDC_ISSUER_URL: 'https://localhost/auth/realms/sbank',
  OIDC_AUDIENCE: 'sbank-api',
  OIDC_JWKS_URL: '',
  LOG_LEVEL: 'silent',
  TRUST_PROXY: 'false',
};

/** Run through the package script, so the working directory is `api/`. */
const OUTPUT_PATH = resolve(process.cwd(), 'openapi.json');

Object.assign(process.env, PLACEHOLDER_ENVIRONMENT);

// Imported after the environment is set: the config module validates it when it is loaded.
const { AppModule } = await import('../src/app.module.js');
const { PrismaService } = await import('../src/prisma/prisma.service.js');
const { buildOpenApiDocument } = await import('../src/openapi/openapi-document.js');
const { sortObjectKeys } = await import('../src/common/sort-object-keys.js');

const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(PrismaService)
  .useValue({})
  .compile();
const app = moduleRef.createNestApplication({ logger: false });

const document = sortObjectKeys(buildOpenApiDocument(app));
const prettierConfig = await resolveConfig(OUTPUT_PATH);
const formatted = await format(JSON.stringify(document), {
  ...prettierConfig,
  filepath: OUTPUT_PATH,
});
await writeFile(OUTPUT_PATH, formatted);
await app.close();
