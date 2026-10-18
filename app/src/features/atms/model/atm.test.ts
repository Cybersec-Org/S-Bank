import { formatDistance, sortByDistance, type Atm } from './atm';

describe('formatDistance', () => {
  it.each([
    [0, '0 m'],
    [350, '350 m'],
    [999, '999 m'],
    [1000, '1,0 km'],
    [1240, '1,2 km'],
    [2960, '3,0 km'],
    [12_340, '12,3 km'],
  ])('formats %i m as %s', (meters, expected) => {
    expect(formatDistance(meters)).toBe(expected);
  });
});

describe('sortByDistance', () => {
  it('orders by distance without mutating the input', () => {
    const atms: Atm[] = [
      { id: 'b', name: 'B', address: '', distanceMeters: 900 },
      { id: 'a', name: 'A', address: '', distanceMeters: 100 },
    ];

    const sorted = sortByDistance(atms);

    expect(sorted.map((atm) => atm.id)).toEqual(['a', 'b']);
    expect(atms.map((atm) => atm.id)).toEqual(['b', 'a']);
  });
});
