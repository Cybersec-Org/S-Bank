import request, { type Test } from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/create-test-app.js';
import { type AuthzCase, AUTHZ_MATRIX } from './matrix.js';

function send(server: App, method: AuthzCase['method'], path: string): Test {
  switch (method) {
    case 'get':
      return request(server).get(path);
    case 'post':
      return request(server).post(path);
    case 'put':
      return request(server).put(path);
    case 'patch':
      return request(server).patch(path);
    case 'delete':
      return request(server).delete(path);
  }
}

describe('authorization matrix', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it.each(AUTHZ_MATRIX)(
    '$caller $method $path -> $expectedStatus ($rule)',
    async ({ caller, method, path, expectedStatus }) => {
      const call = send(testApp.app.getHttpServer(), method, path);
      const token =
        caller === 'guest' ? undefined : await testApp.tokens.issue({ roles: [caller] });

      const response = await (token === undefined
        ? call
        : call.set('Authorization', `Bearer ${token}`));

      expect(response.status).toBe(expectedStatus);
    },
  );
});
