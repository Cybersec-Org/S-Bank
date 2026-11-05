import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Clock = () => Date;

const systemClock: Clock = () => new Date();
const ClockContext = createContext<Clock>(systemClock);

interface ClockProviderProps {
  readonly children: ReactNode;
  /** Tests inject a fixed clock; the app uses the system clock. */
  readonly clock: Clock;
}

export function ClockProvider({ children, clock }: ClockProviderProps) {
  return <ClockContext.Provider value={clock}>{children}</ClockContext.Provider>;
}

/** The current time, refreshed every `intervalMs`; used for live countdowns only. */
export function useNow(intervalMs: number): Date {
  const clock = useContext(ClockContext);
  const [now, setNow] = useState<Date>(() => clock());
  useEffect(() => {
    const timer = setInterval(() => setNow(clock()), intervalMs);
    return () => clearInterval(timer);
  }, [clock, intervalMs]);
  return now;
}
