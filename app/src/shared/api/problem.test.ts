import { pl } from '@/shared/i18n/pl';

import { NotImplementedYet } from './not-implemented';
import { ApiProblem, describeProblem, isNotFoundProblem, parseProblem } from './problem';

describe('parseProblem', () => {
  it('maps the problem type URI the API sends to a typed problem', () => {
    const problem = parseProblem(
      { type: '/problems/step-up-required', title: 'Step-up required', status: 403 },
      403,
    );

    expect(problem).toBeInstanceOf(ApiProblem);
    expect(problem.status).toBe(403);
    expect(problem.code).toBe('step_up_required');
  });

  it('keeps the HTTP status when the body is not problem details', () => {
    const problem = parseProblem('<html>Bad gateway</html>', 502);

    expect(problem.status).toBe(502);
    expect(problem.code).toBeUndefined();
  });

  it('ignores unknown problem types instead of trusting them', () => {
    expect(parseProblem({ type: '/problems/something-new' }, 422).code).toBeUndefined();
    expect(
      parseProblem({ type: 'https://other.example/problems/step-up-required' }, 403).code,
    ).toBeUndefined();
  });

  it('does not read a code member that the API never sends', () => {
    expect(parseProblem({ code: 'step_up_required' }, 403).code).toBeUndefined();
  });

  it('never exposes server-provided detail text', () => {
    const problem = parseProblem({ detail: 'SELECT * FROM accounts failed', status: 500 }, 500);

    expect(problem.message).not.toContain('SELECT');
  });
});

describe('describeProblem', () => {
  it.each([
    [401, pl.errors.unauthorized],
    [403, pl.errors.forbidden],
    [404, pl.errors.notFound],
    [409, pl.errors.conflict],
    [422, pl.errors.validation],
    [429, pl.errors.tooManyRequests],
    [503, pl.errors.server],
    [418, pl.errors.generic],
  ])('describes HTTP %i in Polish', (status, expected) => {
    expect(describeProblem(new ApiProblem({ status }))).toBe(expected);
  });

  it('prefers the specific message of a known code', () => {
    expect(describeProblem(new ApiProblem({ status: 422, code: 'insufficient_funds' }))).toBe(
      pl.errors.insufficientFunds,
    );
  });

  it('names the backlog item for endpoints that do not exist yet', () => {
    expect(describeProblem(new NotImplementedYet('B-18'))).toContain('B-18');
  });

  it('falls back to a generic message for unknown errors', () => {
    expect(describeProblem(new Error('boom'))).toBe(pl.errors.generic);
  });
});

describe('isNotFoundProblem', () => {
  it('recognises 404 problems only', () => {
    expect(isNotFoundProblem(new ApiProblem({ status: 404 }))).toBe(true);
    expect(isNotFoundProblem(new ApiProblem({ status: 403 }))).toBe(false);
    expect(isNotFoundProblem(new Error('x'))).toBe(false);
  });
});
