import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { createValidationPipe } from './common/validation-pipe.js';
import { AppConfigService } from './config/app-config.service.js';
import { DOCS_PATH, mountSwaggerUi } from './openapi/openapi-document.js';

const JSON_BODY_LIMIT = '100kb';

/** Caddy is the only proxy in front of the API, so exactly one hop is trusted. */
const TRUSTED_PROXY_HOPS = 1;

const CORS_PREFLIGHT_MAX_AGE_SECONDS = 600;

/** The API serves JSON only: nothing may be loaded, framed or submitted from its responses. */
const API_CSP_DIRECTIVES = {
  'default-src': ["'none'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
};

/** Swagger UI needs its own scripts and styles; mounted outside production only. */
const SWAGGER_UI_CSP_DIRECTIVES = {
  'default-src': ["'none'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
};

/**
 * The single place that configures the HTTP pipeline. `main.ts` and the e2e test helper both call
 * it, so tests exercise exactly what runs in production.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(AppConfigService);

  app.useLogger(app.get(Logger));
  app.use(
    helmet({ contentSecurityPolicy: { useDefaults: false, directives: API_CSP_DIRECTIVES } }),
  );

  if (config.trustProxy) {
    app.set('trust proxy', TRUSTED_PROXY_HOPS);
  }

  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.enableCors({
    origin: config.corsOrigins.length > 0 ? [...config.corsOrigins] : false,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['authorization', 'content-type', 'idempotency-key', 'x-request-id'],
    exposedHeaders: ['x-request-id', 'retry-after'],
    maxAge: CORS_PREFLIGHT_MAX_AGE_SECONDS,
  });
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();

  if (!config.isProduction) {
    app.use(
      `/${DOCS_PATH}`,
      helmet.contentSecurityPolicy({ useDefaults: false, directives: SWAGGER_UI_CSP_DIRECTIVES }),
    );
    mountSwaggerUi(app);
  }
}
