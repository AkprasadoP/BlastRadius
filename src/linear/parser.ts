export function extractLinearIssueId(text: string): string | null {
  const match = text.match(/([a-zA-Z]+-\d+)/);
  if (match) {
    return match[1].toUpperCase();
  }
  return null;
}
