import { GoogleGenAI, Type } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface IntentEvaluation {
  confidence_score: number; // 0-100
  divergence_flagged: boolean;
  reasoning_trace: string;
  summary_for_comment: string;
}

export async function evaluatePR(intentText: string, blastRadius: any): Promise<IntentEvaluation> {
  const prompt = `
You are an expert code reviewer and architect.
Here is the business intent for a Pull Request:
${intentText}

Here is the calculated blast radius (structural changes and dependencies) for this PR:
${JSON.stringify(blastRadius, null, 2)}

Evaluate if the structural changes in the code fulfill the requirements of the ticket, or if there are unintended side effects.
Return the result adhering to the required JSON schema.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          confidence_score: { type: Type.INTEGER, description: 'Confidence score from 0-100' },
          divergence_flagged: { type: Type.BOOLEAN, description: 'True if there are unintended side effects or unmet requirements' },
          reasoning_trace: { type: Type.STRING, description: 'Step-by-step reasoning for the evaluation' },
          summary_for_comment: { type: Type.STRING, description: 'Markdown formatted summary to post on the PR' }
        },
        required: ['confidence_score', 'divergence_flagged', 'reasoning_trace', 'summary_for_comment']
      }
    }
  });

  if (!response.text) {
    throw new Error('No text returned from Gemini');
  }

  return JSON.parse(response.text) as IntentEvaluation;
}
