import { type ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { resolveZone } from '../zones.js';

const ONE_MINUTE_MS = 60_000;

/** Request budgets per client and minute. B-25 tunes them with load-test results. */
export const THROTTLE_PROFILES = {
  default: { ttl: ONE_MINUTE_MS, limit: 100 },
  public: { ttl: ONE_MINUTE_MS, limit: 30 },
  auth: { ttl: ONE_MINUTE_MS, limit: 10 },
  transfers: { ttl: ONE_MINUTE_MS, limit: 10 },
} as const;

export type ThrottleProfileName = keyof typeof THROTTLE_PROFILES;

export const THROTTLE_PROFILE_NAMES = Object.keys(THROTTLE_PROFILES) as ThrottleProfileName[];

export type NamedThrottleProfile = Exclude<ThrottleProfileName, 'default'>;

export const THROTTLE_PROFILE_KEY = 'sbank:throttle-profile';

const reflector = new Reflector();

/** Puts a route (or controller) under one of the stricter named profiles. */
export const ThrottleProfile = (name: NamedThrottleProfile) =>
  SetMetadata(THROTTLE_PROFILE_KEY, name);

/** For internal routes such as `/health` that must never be rate limited. */
export const SkipAllThrottling = () =>
  SkipThrottle(Object.fromEntries(THROTTLE_PROFILE_NAMES.map((name) => [name, true])));

/**
 * Exactly one profile applies to a request: an explicit `@ThrottleProfile()`, else `public` for
 * anonymous-zone routes, else `default`.
 */
export function resolveThrottleProfile(context: ExecutionContext): ThrottleProfileName {
  const explicit = reflector.getAllAndOverride<NamedThrottleProfile | undefined>(
    THROTTLE_PROFILE_KEY,
    [context.getHandler(), context.getClass()],
  );
  if (explicit) {
    return explicit;
  }
  const { path } = context.switchToHttp().getRequest<Request>();
  return resolveZone(path) === 'public' ? 'public' : 'default';
}
