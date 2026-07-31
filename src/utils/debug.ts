// Debug logger — outputs to Metro terminal (console.log).
// Set DEBUG=true to enable; all debug calls are no-ops when false.
const DEBUG = true;

export function debug(tag: string, ...args: any[]) {
  if (!DEBUG) return;
  const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
  console.log(`[${ts}][${tag}]`, ...args);
}

// Truncate a long string for readable console output.
export function truncate(s: string, max = 300): string {
  if (!s) return '(empty)';
  return s.length <= max ? s : s.slice(0, max) + `…[${s.length} chars]`;
}
