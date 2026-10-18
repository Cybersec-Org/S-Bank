import { describe, expect, it } from 'vitest';
import { isRootEnvFileEnabled } from './root-env-file.js';

describe('isRootEnvFileEnabled', () => {
  it.each([
    ['development', true],
    ['test', true],
    [undefined, true],
    ['production', false],
  ])('for NODE_ENV=%s returns %s', (nodeEnv, expected) => {
    expect(isRootEnvFileEnabled(nodeEnv)).toBe(expected);
  });
});
