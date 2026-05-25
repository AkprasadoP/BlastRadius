import { App } from '@octokit/app';
import * as dotenv from 'dotenv';

dotenv.config();

export const githubApp = new App({
  appId: process.env.GITHUB_APP_ID || '',
  privateKey: process.env.GITHUB_PRIVATE_KEY || '',
  webhooks: {
    secret: process.env.GITHUB_WEBHOOK_SECRET || '',
  },
});

githubApp.webhooks.onError((error) => {
  console.error('Webhook error:', error);
});
