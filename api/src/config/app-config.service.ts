import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema.js';

/** Typed, validated view of the environment; the only place that reads configuration keys. */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv(): Env['NODE_ENV'] {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get port(): number {
    return this.config.get('API_PORT', { infer: true });
  }

  get databaseUrl(): string {
    return this.config.get('DATABASE_URL', { infer: true });
  }

  get corsOrigins(): readonly string[] {
    return this.config.get('CORS_ORIGINS', { infer: true });
  }

  get oidcIssuerUrl(): string {
    return this.config.get('OIDC_ISSUER_URL', { infer: true });
  }

  get oidcAudience(): string {
    return this.config.get('OIDC_AUDIENCE', { infer: true });
  }

  get oidcJwksUrl(): string | undefined {
    return this.config.get('OIDC_JWKS_URL', { infer: true });
  }

  get logLevel(): Env['LOG_LEVEL'] {
    return this.config.get('LOG_LEVEL', { infer: true });
  }

  get stepUpThresholdGrosze(): number {
    return this.config.get('STEP_UP_THRESHOLD_GROSZE', { infer: true });
  }

  get defaultDailyLimitGrosze(): number {
    return this.config.get('DEFAULT_DAILY_LIMIT_GROSZE', { infer: true });
  }

  get nbpApiBaseUrl(): string {
    return this.config.get('NBP_API_BASE_URL', { infer: true });
  }

  get trustProxy(): boolean {
    return this.config.get('TRUST_PROXY', { infer: true });
  }
}
