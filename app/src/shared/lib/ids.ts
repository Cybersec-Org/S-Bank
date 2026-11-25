const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Deep links and QR codes carry only an id; anything not shaped like a UUID is rejected before any request. */
const RESOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** Server-issued ids that are not UUIDs (customer ids such as `client-1`): letters, digits, `-` and `_` only. */
export function isResourceId(value: unknown): value is string {
  return typeof value === 'string' && RESOURCE_ID_PATTERN.test(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
