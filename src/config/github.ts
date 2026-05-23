import { App } from 'octokit';
import { env } from './env';

let privateKey = env.GITHUB_PRIVATE_KEY;

// Decodes key base64 if it does not contain the header block directly
if (!privateKey.includes('-----BEGIN')) {
  try {
    const decoded = Buffer.from(privateKey, 'base64').toString('utf8');
    if (decoded.includes('-----BEGIN')) {
      privateKey = decoded;
    }
  } catch (e: any) {
    console.error('Error decoding GITHUB_PRIVATE_KEY from Base64:', e.message);
  }
}

export const githubApp = new App({
  appId: env.GITHUB_APP_ID,
  privateKey,
  webhooks: {
    secret: env.GITHUB_WEBHOOK_SECRET,
  },
});

/**
 * Returns an authenticated Octokit instance for the specific installation
 */
export async function getInstallationClient(installationId: number) {
  return await githubApp.getInstallationOctokit(installationId);
}
