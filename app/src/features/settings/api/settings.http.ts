import { z } from 'zod';

import { voidResponseSchema, type HttpTransport } from '@/shared/api/http';

import type { Passkey } from '../model/settings';
import type { SettingsRepository } from './settings.repository';

const apiPasskeySchema = z.object({
  id: z.string(),
  label: z.string(),
  createdAt: z.string(),
});

export function createHttpSettingsRepository(transport: HttpTransport): SettingsRepository {
  let biometricsEnabled = false;
  return {
    getSecuritySettings: () => Promise.resolve({ biometricsEnabled }),
    setBiometricsEnabled: (enabled) => {
      biometricsEnabled = enabled;
      return Promise.resolve({ biometricsEnabled });
    },
    listPasskeys: (): Promise<readonly Passkey[]> =>
      transport.requestJson('/auth/passkeys', z.array(apiPasskeySchema)),
    addPasskey: () => Promise.reject(new Error('Use Keycloak passkey registration in live mode')),
    removePasskey: async (passkeyId: string) => {
      await transport.requestJson(
        `/auth/passkeys/${encodeURIComponent(passkeyId)}`,
        voidResponseSchema,
        { method: 'DELETE' },
      );
    },
  };
}
