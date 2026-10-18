/** Artificial latency so loading states are visible while designing against mock data. */
export const MOCK_LATENCY_MS = 400;

export interface MockOptions {
  /** Delay before every call resolves. Tests pass 0. */
  readonly latencyMs: number;
  /** When set, every call rejects with this error after the delay (error-state toggle). */
  readonly failWith: Error | null;
  /** When true, list endpoints return no items (empty-state toggle). */
  readonly empty: boolean;
}

export const DEFAULT_MOCK_OPTIONS: MockOptions = {
  latencyMs: MOCK_LATENCY_MS,
  failWith: null,
  empty: false,
};

export function resolveMockOptions(partial: Partial<MockOptions> | undefined): MockOptions {
  return { ...DEFAULT_MOCK_OPTIONS, ...partial };
}

export interface MockRunner {
  readonly empty: boolean;
  run: <Result>(produce: () => Result) => Promise<Result>;
}

/** Wraps synchronous mock logic in latency and the optional failure so every repository behaves alike. */
export function createMockRunner(options: MockOptions): MockRunner {
  return {
    empty: options.empty,
    run: async <Result>(produce: () => Result): Promise<Result> => {
      await new Promise<void>((resolve) => setTimeout(resolve, options.latencyMs));
      if (options.failWith !== null) {
        throw options.failWith;
      }
      return produce();
    },
  };
}
