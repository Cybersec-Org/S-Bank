import { describe, expect, it } from 'vitest';
import { sortObjectKeys } from './sort-object-keys.js';

describe('sortObjectKeys', () => {
  it('sorts keys at every depth and keeps array order', () => {
    const sorted = sortObjectKeys({ b: 1, a: { d: [3, 1, 2], c: null }, A: true });

    expect(JSON.stringify(sorted)).toBe('{"A":true,"a":{"c":null,"d":[3,1,2]},"b":1}');
  });

  it('produces identical output regardless of input key order', () => {
    const first = JSON.stringify(sortObjectKeys({ x: { b: 1, a: 2 }, y: [{ q: 1, p: 2 }] }));
    const second = JSON.stringify(sortObjectKeys({ y: [{ p: 2, q: 1 }], x: { a: 2, b: 1 } }));

    expect(first).toBe(second);
  });

  it.each([1, 'text', null, undefined, true])('returns the primitive %j unchanged', (value) => {
    expect(sortObjectKeys(value)).toBe(value);
  });
});
