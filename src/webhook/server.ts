import express from 'express';
import { createNodeMiddleware } from '@octokit/webhooks';
import { githubApp } from '../github/app.js';
import { extractLinearIssueId } from '../linear/parser.js';
import { getTicketIntent } from '../linear/client.js';
import { evaluatePR } from '../llm/evaluator.js';
import { TypeScriptWalker } from '../walker/TypeScriptWalker.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CRITICAL: Do NOT use app.use(express.json()) globally. It will break GitHub's signature validation.

app.use(createNodeMiddleware(githubApp.webhooks, { path: '/api/webhook' }));

githubApp.webhooks.on(['pull_request.opened', 'pull_request.reopened'], async ({ payload }) => {
  const prNumber = payload.pull_request.number;
  console.log(`Received PR event for #${prNumber}`);
  
  const installationId = payload.installation?.id;
  if (!installationId) {
    console.error('No installation ID found in payload');
    return;
  }
  
  const prBody = payload.pull_request.body || '';
  
  // 1. Extract Linear issue ID
  const issueId = extractLinearIssueId(prBody);
  if (!issueId) {
    console.log('No Linear issue ID found in PR body. Skipping.');
    return;
  }
  
  // 2. Fetch ticket intent
  const intent = await getTicketIntent(issueId);
  if (!intent) {
    console.log(`Failed to fetch intent for Linear issue ${issueId}. Skipping.`);
    return;
  }
  
  const intentText = `Title: ${intent.title}\nDescription: ${intent.description}`;
  
  console.log(`Processing PR #${prNumber} against ticket ${issueId}...`);
  
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const headRef = payload.pull_request.head.ref;
  const headRepoCloneUrl = payload.pull_request.head.repo.clone_url;
  
  // Create a unique temp folder path inside the system temp directory (for Cloud Run compatibility)
  const tempDirName = `temp-pr-${prNumber}-${Date.now()}`;
  const tempDirPath = path.join(os.tmpdir(), tempDirName);
  
  let blastRadius: any = null;
  
  try {
    const auth = await githubApp.octokit.auth({ type: 'installation', installationId }) as any;
    const token = auth.token;
    const octokit = await githubApp.getInstallationOctokit(installationId);
    
    // 4. Fetch changed files from GitHub Pull Request API
    console.log(`Fetching changed files for PR #${prNumber}...`);
    const filesResponse = await octokit.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
      { owner, repo, pull_number: prNumber }
    );
    
    // Filter to only include .ts or .tsx files
    const changedPaths = filesResponse.data
      .map((f: any) => f.filename)
      .filter((filename: string) => filename.endsWith('.ts') || filename.endsWith('.tsx'));
      
    if (changedPaths.length === 0) {
      console.log('No TypeScript changes detected in PR. Skipping AST analysis.');
      return;
    }
    
    console.log(`Found TS/TSX changed files: ${JSON.stringify(changedPaths)}`);
    
    // 5. Ephemeral Clone
    console.log(`Creating temp directory at: ${tempDirPath}`);
    fs.mkdirSync(tempDirPath, { recursive: true });
    
    // Build authenticated clone URL
    const authCloneUrl = headRepoCloneUrl.replace('https://github.com/', `https://x-access-token:${token}@github.com/`);
    
    console.log(`Cloning branch "${headRef}" into "${tempDirPath}"...`);
    execSync(`git clone --depth 1 --branch "${headRef}" "${authCloneUrl}" "${tempDirPath}"`, { stdio: 'ignore' });
    
    // 6. Run AST Walker
    const absoluteChangedPaths = changedPaths.map(p => path.join(tempDirPath, p));
    const tsConfigPath = path.join(tempDirPath, 'tsconfig.json');
    const walker = new TypeScriptWalker(fs.existsSync(tsConfigPath) ? tsConfigPath : undefined);
    
    console.log('Running blast radius static analysis...');
    const result = await walker.getBlastRadius(absoluteChangedPaths);
    
    // Map absolute paths back to relative paths for clean reports
    blastRadius = {
      modifiedSymbols: result.modifiedSymbols.map(sym => ({
        ...sym,
        filePath: path.relative(tempDirPath, sym.filePath).replace(/\\/g, '/')
      })),
      affectedFiles: result.affectedFiles.map(aff => ({
        ...aff,
        filePath: path.relative(tempDirPath, aff.filePath).replace(/\\/g, '/')
      })),
      tokenEstimate: result.tokenEstimate
    };
    
    console.log(`Blast radius analysis complete. Symbols modified: ${blastRadius.modifiedSymbols.length}`);
    
    // 7. Evaluate with LLM
    console.log(`Evaluating PR #${prNumber} against ticket ${issueId} with Gemini...`);
    const evaluation = await evaluatePR(intentText, blastRadius);
    
    // 8. Gating
    if (evaluation.confidence_score < 85) {
      console.log(`Suppressed due to low confidence (${evaluation.confidence_score}/100)`);
      return;
    }
    
    // 9. Construct Comment Body
    const commentBody = `### 🤖 PR Intent & Blast Radius Evaluation

**Linear Ticket:** ${issueId}
**Confidence Score:** ${evaluation.confidence_score}/100

${evaluation.summary_for_comment}

**Blast Radius Data:**
- Modified Symbols: ${blastRadius.modifiedSymbols.length}
${blastRadius.modifiedSymbols.length > 0 ? blastRadius.modifiedSymbols.map((sym: any) => `  - \`${sym.name}\` (${sym.kind}) in \`${sym.filePath}\``).join('\n') : '  - *(None)*'}
- Downstream Affected Files: ${blastRadius.affectedFiles.length}
${blastRadius.affectedFiles.length > 0 ? blastRadius.affectedFiles.map((aff: any) => `  - \`${aff.filePath}\` (uses: ${aff.consumedSymbols.join(', ')})`).join('\n') : '  - *(None)*'}

*Divergence Flagged:* ${evaluation.divergence_flagged ? 'Yes ⚠️' : 'No ✅'}`;

    // 10. Post comment
    console.log(`Posting evaluation comment to PR #${prNumber}...`);
    await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      owner,
      repo,
      issue_number: prNumber,
      body: commentBody
    });
    
    console.log(`Successfully posted evaluation for PR #${prNumber}`);
    
  } catch (error) {
    console.error('Error during PR evaluation:', error);
  } finally {
    // 11. Clean up temp folder recursively
    if (fs.existsSync(tempDirPath)) {
      console.log(`Cleaning up temp folder: ${tempDirPath}`);
      try {
        fs.rmSync(tempDirPath, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.error(`Failed to clean up ${tempDirPath}:`, cleanupErr);
      }
    }
  }
});

app.listen(PORT, () => {
  console.log(`Webhook server is listening on port ${PORT}`);
});
