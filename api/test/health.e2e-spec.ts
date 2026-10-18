import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers/create-test-app.js';

describe('GET /health', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ useDatabase: true });
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('answers 200 without authentication when the database is reachable', async () => {
    const response = await request(testApp.app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('is never rate limited', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 120; attempt += 1) {
      statuses.push((await request(testApp.app.getHttpServer()).get('/health')).status);
    }

    expect(new Set(statuses)).toEqual(new Set([200]));
  });

  it('is internal: it is not part of the published OpenAPI document', async () => {
    const response = await request(testApp.app.getHttpServer()).get('/public/docs-json');

    expect(response.status).toBe(200);
    expect(Object.keys((response.body as { paths: object }).paths)).toEqual(['/api/me']);
  });
});
