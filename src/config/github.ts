import { App } from 'octokit';
import { env } from './env';

let _githubApp: App | null = null;

/**
 * Returns the GitHub App instance, lazily initialized on first use.
 * Skips initialization if credentials are not yet configured.
 */
function getGithubApp(): App {
  if (_githubApp) return _githubApp;

  if (!env.GITHUB_APP_ID || !env.GITHUB_PRIVATE_KEY || !env.GITHUB_WEBHOOK_SECRET) {
    throw new Error(
      '[github.ts] GitHub App credentials are not configured. ' +
      'Please set GITHUB_APP_ID, GITHUB_PRIVATE_KEY, and GITHUB_WEBHOOK_SECRET in your .env file.'
    );
  }

  let privateKey = env.GITHUB_PRIVATE_KEY;

  // Decode key from base64 if it doesn't contain the PEM header directly
  if (!privateKey.includes('-----BEGIN')) {
    try {
      const decoded = Buffer.from(privateKey, 'base64').toString('utf8');
      if (decoded.includes('-----BEGIN')) {
        privateKey = decoded;
      }
    } catch (e: any) {
      console.error('[github.ts] Error decoding GITHUB_PRIVATE_KEY from Base64:', e.message);
    }
  }

  _githubApp = new App({
    appId: env.GITHUB_APP_ID,
    privateKey,
    webhooks: {
      secret: env.GITHUB_WEBHOOK_SECRET,
    },
  });

  return _githubApp;
}

// Lazily-evaluated proxy — only touches credentials when first used
export const githubApp = new Proxy({} as App, {
  get(_target, prop) {
    try {
      return Reflect.get(getGithubApp(), prop);
    } catch (e: any) {
      // If oauth client options are not set, Octokit's oauth getter will throw.
      // We catch this and return undefined so the middleware can skip OAuth routes safely.
      if (prop === 'oauth') {
        return undefined;
      }
      throw e;
    }
  },
});

/**
 * Returns an authenticated Octokit instance for a specific GitHub App installation.
 */
export async function getInstallationClient(installationId: number) {
  return await getGithubApp().getInstallationOctokit(installationId);
}
