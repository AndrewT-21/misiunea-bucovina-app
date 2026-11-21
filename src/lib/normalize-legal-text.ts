/** Normalize WordPress line wrapping while retaining paragraph breaks and wording. */
export function normalizeLegalBody(value: string): string {
  return (value || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map(paragraph => paragraph.replace(/[ \t]*\n[ \t]*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}
