import { describe, it, expect } from 'vitest';
import { extractLinearIssueId } from '../src/linear/parser.js';

describe('Linear Parser', () => {
  it('should extract issue ID from full URL', () => {
    const text = 'Fixes https://linear.app/team/issue/ENG-123/bug-fix';
    expect(extractLinearIssueId(text)).toBe('ENG-123');
  });

  it('should extract issue ID from shorthand text', () => {
    const text = 'This PR addresses ENG-123 directly.';
    expect(extractLinearIssueId(text)).toBe('ENG-123');
  });

  it('should extract issue ID from brackets format', () => {
    const text = '[ENG-123] Update auth flow';
    expect(extractLinearIssueId(text)).toBe('ENG-123');
  });

  it('should return null when no issue ID is present', () => {
    const text = 'No ticket linked here';
    expect(extractLinearIssueId(text)).toBeNull();
  });
});
