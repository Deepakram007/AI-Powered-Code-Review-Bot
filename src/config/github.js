const { App } = require('octokit');

const appId = process.env.GITHUB_APP_ID;
let privateKey = process.env.GITHUB_PRIVATE_KEY || '';

// Resilient private key decoding (supports raw PEM, file paths, or base64 encoded)
if (privateKey.includes('-----BEGIN')) {
  // Use as-is
} else if (privateKey) {
  try {
    const decoded = Buffer.from(privateKey, 'base64').toString('utf8');
    if (decoded.includes('-----BEGIN')) {
      privateKey = decoded;
    }
  } catch (e) {
    console.error('Error decoding GITHUB_PRIVATE_KEY from Base64:', e.message);
  }
}

if (!appId || !privateKey) {
  console.warn('WARNING: GITHUB_APP_ID or GITHUB_PRIVATE_KEY is missing. GitHub App integration will not function.');
}

const app = new App({
  appId,
  privateKey,
  webhooks: {
    secret: process.env.GITHUB_WEBHOOK_SECRET || 'development-secret',
  },
});

module.exports = {
  app,
  // Helper to get an octokit instance authenticated for a specific installation
  getInstallationClient: async (installationId) => {
    return await app.getInstallationOctokit(installationId);
  }
};
