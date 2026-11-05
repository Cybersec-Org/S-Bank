import type { ExpoConfig } from 'expo/config';

const APPLICATION_ID = 'pl.sbank.app';
const NEUTRAL_BACKGROUND = '#FFFFFF';

/**
 * Domain that serves `https://<domain>/pay/{id}` links (set `APP_LINK_DOMAIN` at build time; it is not
 * a secret). Empty means only the `sbank://pay/{id}` scheme opens the app. Both forms map to the
 * `pay/[requestId]` route and carry nothing but the request id.
 */
const APP_LINK_DOMAIN = process.env.APP_LINK_DOMAIN?.trim() ?? '';
const hasLinkDomain = APP_LINK_DOMAIN !== '';

/**
 * Static, non-secret app configuration. Runtime values come from `EXPO_PUBLIC_*` variables
 * (see src/shared/config/env.ts); nothing secret belongs here because the manifest ships in the bundle.
 */
const config: ExpoConfig = {
  name: 'S-Bank',
  slug: 'sbank',
  scheme: 'sbank',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: APPLICATION_ID,
    ...(hasLinkDomain ? { associatedDomains: [`applinks:${APP_LINK_DOMAIN}`] } : {}),
  },
  android: {
    package: APPLICATION_ID,
    // MASVS-STORAGE: no app data (and therefore no tokens) in cloud or adb backups.
    allowBackup: false,
    ...(hasLinkDomain
      ? {
          intentFilters: [
            {
              action: 'VIEW',
              autoVerify: true,
              data: [{ scheme: 'https', host: APP_LINK_DOMAIN, pathPrefix: '/pay' }],
              category: ['BROWSABLE', 'DEFAULT'],
            },
          ],
        }
      : {}),
    predictiveBackGestureEnabled: false,
    adaptiveIcon: {
      backgroundColor: NEUTRAL_BACKGROUND,
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  web: {
    bundler: 'metro',
    // SPA: session state lives in memory only, so every route is served by one index.html.
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: NEUTRAL_BACKGROUND,
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    'expo-web-browser',
    [
      'expo-secure-store',
      {
        faceIDPermission: 'Aplikacja S-Bank używa Face ID do odblokowania zapisanej sesji.',
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission: 'Aplikacja S-Bank używa Face ID do odblokowania aplikacji.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
