import { resolveHistoryFilter } from './history-filter';

const NO_FILTER = { from: '', to: '', direction: 'all' } as const;

describe('resolveHistoryFilter', () => {
  it('sends no restriction for an empty form', () => {
    const { query, errors } = resolveHistoryFilter(NO_FILTER);

    expect(errors).toEqual([]);
    expect(query).toEqual({ from: null, to: null, direction: null, limit: null });
  });

  it('passes valid dates and direction through', () => {
    const { query, errors } = resolveHistoryFilter({
      from: '2026-10-01',
      to: '2026-10-15',
      direction: 'outgoing',
    });

    expect(errors).toEqual([]);
    expect(query).toMatchObject({ from: '2026-10-01', to: '2026-10-15', direction: 'outgoing' });
  });

  it('reports a malformed or impossible date and leaves it out of the query', () => {
    const result = resolveHistoryFilter({ ...NO_FILTER, from: '2026-02-30', to: 'jutro' });

    expect(result.errors).toEqual(['invalidFrom', 'invalidTo']);
    expect(result.query.from).toBeNull();
    expect(result.query.to).toBeNull();
  });

  it('reports a range whose start is after its end', () => {
    const result = resolveHistoryFilter({ ...NO_FILTER, from: '2026-10-15', to: '2026-10-01' });

    expect(result.errors).toEqual(['invalidRange']);
    expect(result.query.from).toBeNull();
    expect(result.query.to).toBeNull();
  });
});
