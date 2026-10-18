export type Zone = 'public' | 'api' | 'partner' | 'internal';

const PREFIXED_ZONES = ['public', 'api', 'partner'] as const;

const INTERNAL_PATH_PATTERN = /^\/health\/?$/;

/**
 * Maps a request path to its trust zone. Matching is case-insensitive because Express routing is;
 * paths outside every zone return `undefined` and are denied.
 */
export function resolveZone(path: string): Zone | undefined {
  const normalizedPath = path.toLowerCase();
  if (INTERNAL_PATH_PATTERN.test(normalizedPath)) {
    return 'internal';
  }
  return PREFIXED_ZONES.find(
    (zone) => normalizedPath === `/${zone}` || normalizedPath.startsWith(`/${zone}/`),
  );
}
