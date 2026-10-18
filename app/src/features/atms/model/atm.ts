export interface Atm {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly distanceMeters: number;
}

const METERS_PER_KILOMETER = 1000;
const METERS_PER_TENTH_KILOMETER = 100;
const TENTHS_PER_KILOMETER = 10;

/** `350 m` below one kilometre, otherwise `1,2 km`, using integer arithmetic only. */
export function formatDistance(distanceMeters: number): string {
  if (distanceMeters < METERS_PER_KILOMETER) {
    return `${distanceMeters} m`;
  }
  const tenths = Math.round(distanceMeters / METERS_PER_TENTH_KILOMETER);
  return `${Math.trunc(tenths / TENTHS_PER_KILOMETER)},${tenths % TENTHS_PER_KILOMETER} km`;
}

export function sortByDistance(atms: readonly Atm[]): Atm[] {
  return [...atms].sort((left, right) => left.distanceMeters - right.distanceMeters);
}
