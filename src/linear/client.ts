import { LinearClient } from '@linear/sdk';
import * as dotenv from 'dotenv';

dotenv.config();

export const linearClient = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY || ''
});

export async function getTicketIntent(issueId: string) {
  try {
    const issue = await linearClient.issue(issueId);
    
    if (!issue) {
      return null;
    }

    return {
      title: issue.title,
      description: issue.description
    };
  } catch (error) {
    console.error(`Failed to fetch Linear issue ${issueId}:`, error);
    return null;
  }
}
